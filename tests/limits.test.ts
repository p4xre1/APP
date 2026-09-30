import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'

// A native bridge that fails everywhere, to prove that a broken plugin cannot
// leave the vault untouched during an explicit reset.
const calls: string[] = []
Object.assign(globalThis, {
  androidBridge: {},
  window: new EventTarget(),
  Capacitor: {
    PluginHeaders: [
      { name: 'Filesystem', methods: ['writeFile', 'readdir', 'rmdir'].map(name => ({ name, rtype: 'promise' })) },
      { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
      { name: 'Preferences', methods: ['get', 'set', 'clear'].map(name => ({ name, rtype: 'promise' })) },
      { name: 'NativeBiometric', methods: ['deleteCredentials', 'isAvailable', 'verifyIdentity', 'getCredentials'].map(name => ({ name, rtype: 'promise' })) },
    ],
    nativePromise: async (plugin: string, method: string) => {
      calls.push(`${plugin}.${method}`)
      if (plugin === 'Filesystem') throw new Error('Cache unavailable')
      throw new Error(`${plugin} failed`)
    },
  },
})

const { createOrChangePin, lockVault, resetApp, readMeta, unlockPin } = await import('../src/lib/vault')
const { importBackup, exportBackup, loadBackupFile } = await import('../src/lib/db')
const { readSnapshot } = await import('../src/lib/storage')
const { encodeBackup, decodeBackup, MAX_BACKUP_BYTES, MAX_RECORDS_PER_STORE, MAX_TEXT_LENGTH, MIN_PASSWORD_LENGTH } = await import('../src/lib/backup-format')
const { fixture } = await import('./fixtures')

beforeEach(async () => { lockVault(); globalThis.indexedDB = new IDBFactory(); await createOrChangePin('123456'); calls.length = 0 })

test('a backup password below the minimum length is refused before any crypto', async () => {
  await assert.rejects(encodeBackup(fixture(), 'x'.repeat(MIN_PASSWORD_LENGTH - 1)), /too short/)
  const encoded = await encodeBackup(fixture(), 'x'.repeat(MIN_PASSWORD_LENGTH))
  assert.deepEqual(await decodeBackup(encoded, 'x'.repeat(MIN_PASSWORD_LENGTH)), fixture())
})

test('oversized or overlong import content is rejected before validation completes', async () => {
  await assert.rejects(loadBackupFile(new File([new Uint8Array(MAX_BACKUP_BYTES + 1)], 'big.fatorati')), /too large/)
  const records = Array.from({ length: MAX_RECORDS_PER_STORE + 1 }, (_, index) => ({ ...fixture().customers[0], id: `c${index}` }))
  await assert.rejects(importBackup({ ...fixture(), customers: records }, 'replace'), /too many records/)
  await assert.rejects(importBackup({ ...fixture(), customers: [{ ...fixture().customers[0], notes: 'x'.repeat(MAX_TEXT_LENGTH + 1) }] }, 'replace'), /Invalid backup record/)
  const items = Array.from({ length: 501 }, (_, index) => ({ ...fixture().invoices[0].items[0], id: `i${index}` }))
  await assert.rejects(importBackup({ ...fixture(), invoices: [{ ...fixture().invoices[0], items }] }, 'replace'), /Invalid backup record/)
  // Nothing was written by any of the rejected imports.
  assert.equal((await readSnapshot()).stores.customers.length, 0)
})

test('an encrypted backup header outside the supported PBKDF2 range is refused', async () => {
  const header = JSON.parse(await encodeBackup(fixture(), 'long-enough-secret'))
  for (const iterations of [1, 9_999, 5_000_001]) {
    await assert.rejects(decodeBackup(JSON.stringify({ ...header, iterations }), 'long-enough-secret'), /header/)
  }
})

test('a failing native plugin cannot stop an explicit reset from erasing the vault', async () => {
  await importBackup(fixture(), 'replace')
  assert.equal((await readSnapshot()).stores.customers.length, 1)
  await resetApp()
  assert.ok(calls.some(call => call === 'Filesystem.readdir'), 'native cleanup was attempted')
  const after = await readSnapshot()
  for (const name of ['businesses', 'customers', 'invoices'] as const) assert.equal(after.stores[name].length, 0, name)
  assert.equal(after.meta.salt, undefined)
  assert.equal((await readMeta()).salt, undefined)
  // The old PIN no longer exists and the vault is locked, so nothing can be read.
  await assert.rejects(exportBackup(), /locked/)
  await assert.rejects(unlockPin('123456'), /Create your PIN/)
})
