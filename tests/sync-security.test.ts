import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { createOrChangePin, lockVault, unlockPin, readMeta, getResetStatus, requestAppReset, cancelAppReset, resetApp, resetAppFromSettings, resetWord, b64, unb64 } from '../src/lib/vault'
import { importBackup, exportBackup, getAll, remove, add } from '../src/lib/db'
import { fixture } from './fixtures'
import { resetElapsedMs, resetRemainingMs, resetReady, RESET_WAIT_MS } from '../src/lib/reset'
import { weakSecret, validateSecret, detectSecretKind, normalizeWord } from '../src/lib/secret'
import { encodeProtectedExport, decodeProtectedExport, ExportPasswordRequiredError } from '../src/lib/export-crypto'
import { commit, readSnapshot } from '../src/lib/storage'
import { STORES } from '../src/lib/backup-format'
import { encryptRecord, decryptRecord } from '../src/lib/vault'
import ar from '../src/i18n/ar.json'

const PIN = '482915'
beforeEach(() => { lockVault(); globalThis.indexedDB = new IDBFactory() })

test('deleting a record leaves an encrypted tombstone that survives a PIN change', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await remove('customers', 'customer')
  const raw = await readSnapshot()
  assert.equal(raw.stores.customers.length, 0)
  assert.equal(raw.stores.tombstones.length, 1)
  assert.ok(!JSON.stringify(raw.stores.tombstones).includes('"store"'))
  const backup = await exportBackup()
  assert.deepEqual(backup.tombstones, [{ id: 'customer', store: 'customers', deletedAt: backup.tombstones[0].deletedAt, createdAt: backup.tombstones[0].createdAt, updatedAt: backup.tombstones[0].updatedAt }])
  await createOrChangePin('739184', PIN)
  assert.deepEqual((await exportBackup()).tombstones, backup.tombstones)
})

test('a record that comes back drops its tombstone', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await remove('customers', 'customer')
  await add('customers', { ...fixture().customers[0] } as never)
  assert.deepEqual((await exportBackup()).tombstones, [])
})

test('delete-then-merge: an older backup cannot resurrect a deleted record', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await remove('invoices', 'invoice')
  const stale = fixture() // The other phone still has the invoice, last updated before the deletion.
  const summary = await importBackup(stale, 'merge')
  assert.deepEqual(summary, { added: 0, updated: 0, deleted: 0, skipped: 7 })
  assert.deepEqual((await getAll('invoices')).length, 0)
  assert.equal((await exportBackup()).tombstones.length, 1)
})

test('delete-then-merge: an incoming tombstone deletes the local record and counts it', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  const incoming = fixture()
  incoming.customers = []
  incoming.tombstones = [{ id: 'customer', store: 'customers', deletedAt: 900, createdAt: 900, updatedAt: 900 }]
  assert.deepEqual(await importBackup(incoming, 'merge'), { added: 0, updated: 0, deleted: 1, skipped: 7 })
  assert.deepEqual(await getAll('customers'), [])
  // A backup from before the deletion cannot bring it back either.
  assert.deepEqual(await importBackup(fixture(), 'merge'), { added: 0, updated: 0, deleted: 0, skipped: 7 })
  assert.deepEqual(await getAll('customers'), [])
})

test('edit-then-merge: a record edited after the deletion wins and the tombstone is dropped', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await remove('customers', 'customer')
  const edited = fixture()
  edited.customers[0].updatedAt = Date.now() + 1000
  edited.customers[0].name = 'عميل جديد'
  assert.deepEqual(await importBackup(edited, 'merge'), { added: 1, updated: 0, deleted: 0, skipped: 7 })
  assert.equal((await getAll<{ name: string }>('customers'))[0].name, 'عميل جديد')
  assert.deepEqual((await exportBackup()).tombstones, [])
})

test('conflicting merge: a newer local record beats an older incoming tombstone', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  const incoming = fixture()
  incoming.customers = []
  incoming.tombstones = [{ id: 'customer', store: 'customers', deletedAt: 150, createdAt: 150, updatedAt: 150 }]
  assert.deepEqual(await importBackup(incoming, 'merge'), { added: 0, updated: 0, deleted: 0, skipped: 8 })
  assert.equal((await getAll('customers')).length, 1)
  assert.deepEqual((await exportBackup()).tombstones, [])
})

test('replace mode replaces tombstones too, and older backups migrate with an empty list', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await remove('customers', 'customer')
  assert.equal((await exportBackup()).tombstones.length, 1)
  await importBackup(fixture(), 'replace')
  assert.deepEqual((await exportBackup()).tombstones, [])
  const legacy = JSON.parse(JSON.stringify(fixture()))
  legacy.version = '2.0.0'
  delete legacy.tombstones
  await importBackup(legacy, 'replace')
  assert.deepEqual((await exportBackup()).tombstones, [])
})

test('tombstones older than 180 days are purged when a backup is created', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  const snapshot = await readSnapshot()
  const old = { id: 'ancient', store: 'customers', deletedAt: Date.now() - 200 * 86_400_000, createdAt: 1, updatedAt: 1 }
  const fresh = { id: 'recent', store: 'customers', deletedAt: Date.now() - 10 * 86_400_000, createdAt: 1, updatedAt: 1 }
  await commit(snapshot.meta.revision, snapshot.meta, { tombstones: await Promise.all([old, fresh].map(row => encryptRecord('tombstones', row))) })
  const backup = await exportBackup()
  assert.deepEqual(backup.tombstones.map(row => row.id), ['recent'])
})

test('weak PINs and passcodes are rejected, strong ones are accepted', async () => {
  // Repeated digits, simple runs both ways, repeated pairs and years are all refused.
  for (const pin of ['111111', '123456', '654321', '121212', '12121212', '987654', '198505', '48201985', '741985', '000000000000'])
    assert.throws(() => validateSecret(pin), /too simple/, pin)
  for (const pin of ['482915', '7391842', '918273645']) assert.equal(validateSecret(pin).kind, 'pin')
  for (const code of ['abcdefgh', 'qwertyui', 'zzzzzzzz', 'password']) assert.throws(() => validateSecret(code), /too simple/, code)
  assert.equal(validateSecret('Fatorati7x').kind, 'passcode')
  for (const bad of ['12345', '1234567890123', 'abcdefg!', 'ab cd1234', '1234', ''])
    assert.throws(() => detectSecretKind(bad), /6-12 digit PIN or a passcode/)
  assert.equal(detectSecretKind('4829157'), 'pin')
  assert.equal(detectSecretKind('739184xy'), 'passcode')
  assert.ok(weakSecret('121212', 'pin'))
  assert.equal(weakSecret('112233', 'pin'), false)
  assert.equal(weakSecret('482915', 'pin'), false)
})

test('a longer PIN or a passcode unlocks, and Arabic-Indic digits still normalize', async () => {
  await createOrChangePin('7391842')
  lockVault(); await unlockPin('٧٣٩١٨٤٢')
  lockVault(); await createOrChangePin('Fatorati7x', '7391842')
  lockVault(); await assert.rejects(unlockPin('7391842'), /Incorrect/)
  await unlockPin('Fatorati7x')
  assert.equal((await readMeta()).secretKind, 'passcode')
  lockVault(); await unlockPin('Fatorati7x')
  await assert.rejects(createOrChangePin('Fatorati7x', 'wrong-one9'), /Incorrect/)
})

test('stored iteration counts are raised on unlock without losing records', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  const before = await readSnapshot()
  // A vault written by an older build: every record and the verifier use a lower cost.
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(PIN), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(before.meta.salt!), iterations: 100_000, hash: 'SHA-256' }, base, 512))
  const weakKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-GCM', false, ['encrypt', 'decrypt'])
  const stores = {} as Record<string, unknown[]>
  for (const name of STORES) stores[name] = await Promise.all(before.stores[name].map(async row => encryptRecord(name, await decryptRecord(name, row), weakKey)))
  const verifier = b64(bits.slice(32))
  bits.fill(0)
  await commit(before.meta.revision, { ...before.meta, iterations: 100_000, verifier }, stores as never)
  lockVault(); await unlockPin(PIN)
  const after = await readSnapshot()
  assert.equal(after.meta.iterations, 600_000)
  assert.equal(after.meta.secretKind, 'pin')
  assert.equal(after.meta.keyId, before.meta.keyId)
  // WebCrypto ties the key to the cost, so raising it re-encrypts every record exactly once.
  assert.notDeepEqual(after.stores.customers, before.stores.customers)
  assert.equal((await getAll<{ name: string }>('customers'))[0].name, 'عميل André')
  lockVault(); await unlockPin(PIN)
  assert.equal((await getAll<{ name: string }>('customers'))[0].name, 'عميل André')
})

test('the failed attempt counter survives a restart and a force-stop', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace'); lockVault()
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(unlockPin('918273'), /Incorrect/)
  // A force-stop only closes the database: every later read opens it again.
  const before = await readMeta()
  await assert.rejects(unlockPin(PIN), /please wait/)
  const after = await readMeta()
  assert.equal(after.failures, 5)
  assert.equal(after.blockedUntil, before.blockedUntil)
  assert.ok(after.blockedUntil > Date.now())
  assert.equal((await readSnapshot()).stores.customers.length, 1)
})

test('a locked reset needs the word, then 24 hours, and unlocking cancels it', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace'); lockVault()
  await assert.rejects(requestAppReset('erase'), /confirmation word/)
  await assert.rejects(requestAppReset(`${resetWord()}!`), /confirmation word/)
  const request = await requestAppReset(resetWord().toLowerCase())
  assert.equal(request.requestedAt > 0, true)
  assert.ok((await getResetStatus()).remainingMs > RESET_WAIT_MS - 60_000)
  await assert.rejects(resetApp(resetWord()), /waiting period/)
  await unlockPin(PIN)
  assert.equal((await getResetStatus()).remainingMs, 0)
  assert.equal((await readMeta()).resetRequest, undefined)
})

test('the reset wait uses the smaller of the wall-clock and monotonic readings', () => {
  const request = { requestedAt: 1_000_000, monotonicAt: 5_000_000 }
  assert.equal(resetElapsedMs(request, 1_000_000, 5_000_000), 0)
  // Moving the phone clock forward cannot shorten the wait.
  assert.equal(resetRemainingMs(request, 1_000_000 + RESET_WAIT_MS, 5_000_000), RESET_WAIT_MS)
  // Moving it back cannot shorten it either.
  assert.equal(resetRemainingMs(request, 1_000_000 - RESET_WAIT_MS, 5_000_000), RESET_WAIT_MS)
  // Real time passing does shorten it, and monotonic time is what decides.
  assert.equal(resetRemainingMs(request, 1_000_000 + 60_000, 5_000_000 + 60_000), RESET_WAIT_MS - 60_000)
  assert.equal(resetReady(request, 1_000_000 + RESET_WAIT_MS, 5_000_000 + RESET_WAIT_MS), true)
  assert.equal(resetReady(request, 1_000_000 + RESET_WAIT_MS, 5_000_000 + 60_000), false)
  assert.equal(resetReady(undefined, 9e15, 9e15), false)
})

test('a settings reset needs the current secret and the typed word', async () => {
  await createOrChangePin(PIN); await importBackup(fixture(), 'replace')
  await assert.rejects(resetAppFromSettings(PIN, 'nope'), /confirmation word/)
  await assert.rejects(resetAppFromSettings('918273', resetWord()), /Incorrect/)
  assert.equal((await getAll('customers')).length, 1)
  assert.equal(normalizeWord(`  ${ar['Reset word'].replace(/ /g, '  ')} `), normalizeWord(ar['Reset word']))
  assert.equal(normalizeWord(` ${resetWord()} `), normalizeWord(resetWord()))
  await resetAppFromSettings(PIN, ` ${resetWord()} `)
  assert.equal((await readSnapshot()).meta.salt, undefined)
  assert.deepEqual((await readSnapshot()).stores, { businesses: [], customers: [], projects: [], invoices: [], estimates: [], expenses: [], products: [], settings: [], tombstones: [] })
})

test('protected exports round-trip and never leak the payload', async () => {
  const csv = '﻿"Name","Total"\r\n"عميل André","10.00"\r\n'
  const file = await encodeProtectedExport(csv, { password: 'مفتاح سري', kind: 'csv', filename: 'invoice.csv' })
  assert.ok(!file.includes('عميل André'))
  const header = JSON.parse(file)
  assert.equal(header.format, 'fatorati-export')
  assert.notEqual(header.iv, (JSON.parse(await encodeProtectedExport(csv, { password: 'مفتاح سري', kind: 'csv', filename: 'invoice.csv' }))).iv)
  await assert.rejects(decodeProtectedExport(file), ExportPasswordRequiredError)
  await assert.rejects(decodeProtectedExport(file, 'wrong'), /Wrong password or damaged/)
  const opened = await decodeProtectedExport(file, 'مفتاح سري')
  assert.equal(opened.payload, csv)
  assert.equal(opened.header.filename, 'invoice.csv')
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  const pdf = await encodeProtectedExport(bytes, { password: 'secret', kind: 'pdf', filename: 'INV-1.pdf' })
  const openedPdf = await decodeProtectedExport(pdf, 'secret')
  assert.equal(Buffer.compare(Buffer.from(openedPdf.payload as Uint8Array), Buffer.from(bytes)), 0)
  const tampered = JSON.parse(pdf)
  tampered.kind = 'csv'
  await assert.rejects(decodeProtectedExport(JSON.stringify(tampered), 'secret'), /Wrong password or damaged/)
  await assert.rejects(decodeProtectedExport('{"format":"other"}', 'secret'), /header/)
  await assert.rejects(encodeProtectedExport(csv, { password: '', kind: 'csv', filename: 'x.csv' }), /password/)
})
