import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { exportBackup, importBackup, loadBackupFile } from '../src/lib/db'
import { STORES, validateBackup, encodeBackup, decodeBackup, PasswordRequiredError } from '../src/lib/backup-format'
import { buildCsv, csvRows } from '../src/lib/csv'
import { fixture } from './fixtures'
import { createOrChangePin, lockVault } from '../src/lib/vault'

beforeEach(async () => { lockVault(); globalThis.indexedDB = new IDBFactory(); await createOrChangePin('123456') })

async function snapshot() {
  const { exportedAt: _, ...data } = await exportBackup()
  return data
}

test('plain and legacy v1 JSON round-trip, including Arabic/French', async () => {
  const source = fixture()
  const encoded = await encodeBackup(source)
  assert.ok(encoded.includes('متجر Café'))
  assert.deepEqual(await decodeBackup(encoded), source)
  const file = new File(['\uFEFF' + encoded], 'old.json')
  assert.deepEqual(await loadBackupFile(file), source)
})

test('AES-GCM round-trip, random salt/IV, missing/wrong password and tampering', async () => {
  const source = fixture()
  const encoded = await encodeBackup(source, 'سري secret é')
  assert.ok(!encoded.includes('متجر Café'))
  const header = JSON.parse(encoded)
  const other = JSON.parse(await encodeBackup(source, 'سري secret é'))
  assert.notEqual(header.iv, other.iv)
  assert.notEqual(header.salt, other.salt)
  assert.deepEqual(await decodeBackup(encoded, 'سري secret é'), source)
  await assert.rejects(decodeBackup(encoded), PasswordRequiredError)
  await assert.rejects(decodeBackup(encoded, 'wrong'), /Wrong password/)
  header.ciphertext = (header.ciphertext[0] === 'A' ? 'B' : 'A') + header.ciphertext.slice(1)
  await assert.rejects(decodeBackup(JSON.stringify(header), 'سري secret é'), /Wrong password or damaged/)
  header.iterations = 1_000_000_000
  await assert.rejects(decodeBackup(JSON.stringify(header), 'password'), /header/)
  header.iterations = 600_000; header.iv = 'bad'
  await assert.rejects(decodeBackup(JSON.stringify(header), 'password'), /header/)
})

test('invalid version, missing store, duplicates, fields, timestamps, enums and items are rejected before writes', async () => {
  await importBackup(fixture(), 'replace')
  const before = await snapshot()
  const malformed = [
    { ...fixture(), version: '3.0.0' },
    { ...fixture(), customers: undefined },
    { ...fixture(), exportedAt: 'not a date' },
    { ...fixture(), products: [fixture().products[0], fixture().products[0]] },
    { ...fixture(), expenses: [{ ...fixture().expenses[0], amount: '5' }] },
    { ...fixture(), customers: [{ ...fixture().customers[0], updatedAt: NaN }] },
    { ...fixture(), settings: [{ ...fixture().settings[0], currency: '???' }] },
    { ...fixture(), invoices: [{ ...fixture().invoices[0], items: [{}] }] },
  ]
  for (const value of malformed) {
    assert.throws(() => validateBackup(value))
    await assert.rejects(importBackup(value as ReturnType<typeof fixture>, 'replace'))
    assert.deepEqual(await snapshot(), before)
  }
  await assert.rejects(decodeBackup('{oops'), /not valid JSON/)
})

test('replace clears every store; empty arrays also replace existing records', async () => {
  await importBackup(fixture(), 'replace')
  const incoming = fixture()
  for (const name of STORES) incoming[name] = []
  assert.deepEqual(await importBackup(incoming, 'replace'), { added: 0, updated: 0, skipped: 0 })
  for (const name of STORES) assert.deepEqual((await exportBackup())[name], [])
})

test('merge adds, updates, skips older/tied IDs in ALL stores, preserving local-only records and timestamps', async () => {
  const local = fixture()
  for (const name of STORES) {
    // Same shape, distinct IDs. Invoice/estimate numbers intentionally collide.
    const rows = local[name] as { id: string; updatedAt: number }[]
    rows.push({ ...rows[0], id: `${name}-local-only` })
  }
  await importBackup(local, 'replace')
  const incoming = fixture()
  for (const name of STORES) {
    incoming[name][0].updatedAt = 400
    const rows = incoming[name] as { id: string; updatedAt: number }[]
    rows.push({ ...rows[0], id: `${name}-new` })
  }
  assert.deepEqual(await importBackup(incoming, 'merge'), { added: 8, updated: 8, skipped: 0 })
  assert.deepEqual(await importBackup(incoming, 'merge'), { added: 0, updated: 0, skipped: 16 })
  assert.deepEqual(await importBackup(fixture(), 'merge'), { added: 0, updated: 0, skipped: 8 })
  const result = await exportBackup()
  for (const name of STORES) {
    assert.equal(result[name].length, 3)
    assert.equal(result[name].find(item => item.id === `${name}-local-only`)?.updatedAt, 200)
    assert.equal(result[name].find(item => item.id === incoming[name][0].id)?.updatedAt, 400)
    assert.equal(result[name].find(item => item.id === incoming[name][0].id)?.createdAt, 100)
  }
})

for (const mode of ['replace', 'merge'] as const) {
  test(`${mode}: a late-store write failure rolls back the entire import`, async () => {
    await importBackup(fixture(), 'replace')
    const before = await snapshot()
    const incoming = fixture()
    for (const name of STORES) incoming[name][0].updatedAt = 500
    // Inject a real asynchronous constraint failure in the last store.
    // put behaves like add for this test only, violating settings' primary key.
    const original = IDBObjectStore.prototype.put
    const originalAdd = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.put = function (...args) {
      return this.name === 'settings' ? originalAdd.apply(this, args) : original.apply(this, args)
    }
    IDBObjectStore.prototype.add = function (...args) {
      const request = originalAdd.apply(this, args)
      if (this.name === 'settings') originalAdd.apply(this, args)
      return request
    }
    try { await assert.rejects(importBackup(incoming, mode), /no data was changed/) }
    finally { IDBObjectStore.prototype.put = original; IDBObjectStore.prototype.add = originalAdd }
    assert.deepEqual(await snapshot(), before)
  })
}

test('version 1 DB migrates without data loss, allowing same invoice number with different IDs', async () => {
  lockVault(); globalThis.indexedDB = new IDBFactory()
  const source = fixture()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('fatorati-offline-v1', 1)
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        const store = request.result.createObjectStore(name, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt'); store.createIndex('updatedAt', 'updatedAt')
        if (name === 'invoices' || name === 'estimates') store.createIndex('number', 'number', { unique: true })
        for (const record of source[name]) store.add(record)
      }
    }
    request.onsuccess = () => { request.result.close(); resolve() }
    request.onerror = () => reject(request.error)
  })
  await createOrChangePin('123456')
  assert.deepEqual((await exportBackup()).customers, source.customers)
  source.invoices[0].id = 'other-phone-invoice'
  const result = await importBackup(source, 'merge')
  assert.equal(result.added, 1)
  assert.equal((await exportBackup()).invoices.length, 2)
})

test('CSV contains UTF-8 BOM, quoted commas/newlines, escaped quotes and protected formulas', () => {
  const csv = buildCsv([['Name', 'Note'], ['عميل Café', 'a,"b"\nnext'], ['=HYPERLINK("x")', -10], ['\t=1+1', '  +1']])
  assert.deepEqual([...new TextEncoder().encode(csv).slice(0, 3)], [239, 187, 191])
  assert.ok(csv.includes('"عميل Café","a,""b""\nnext"'))
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")","-10"'))
  assert.ok(csv.includes('"\'\t=1+1","\'  +1"'))
  for (const name of ['customers', 'invoices', 'expenses'] as const) assert.equal(csvRows(name, fixture()).length, 2)
})
