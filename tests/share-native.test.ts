import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'

// Simulate the Capacitor bridge, not an Android device. No browser document is
// installed, so any accidental native <a download> fallback fails this suite.
const calls: { plugin: string; method: string; options: Record<string, unknown> }[] = []
const preferences = new Map<string, string>()
let failure: string | null = null
Object.assign(globalThis, {
  androidBridge: {},
  window: new EventTarget(),
  Capacitor: {
    PluginHeaders: [
      { name: 'Filesystem', methods: [{ name: 'writeFile', rtype: 'promise' }] },
      { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
      { name: 'Preferences', methods: ['get', 'set'].map(name => ({ name, rtype: 'promise' })) },
    ],
    nativePromise: async (plugin: string, method: string, options: Record<string, unknown>) => {
      calls.push({ plugin, method, options })
      if (failure === plugin) throw new Error(plugin === 'Share' ? 'Share canceled' : 'Cache write failed')
      if (plugin === 'Filesystem') return { uri: `file:///cache/${options.path}` }
      if (plugin === 'Preferences' && method === 'get') return { value: preferences.get(options.key as string) ?? null }
      if (plugin === 'Preferences' && method === 'set') preferences.set(options.key as string, options.value as string)
      return { activityType: 'chosen.app' }
    },
  },
})
const { downloadBackupFile, getLastBackupDate, LAST_BACKUP_KEY } = await import('../src/lib/db')
const { shareFile } = await import('../src/lib/share-file')
const { fixture } = await import('./fixtures')
const { createOrChangePin, lockVault } = await import('../src/lib/vault')
const { decodeBackup } = await import('../src/lib/backup-format')
beforeEach(async () => { lockVault(); globalThis.indexedDB = new IDBFactory(); await createOrChangePin('482915'); calls.length = 0; failure = null; preferences.clear() })

test('native backup writes UTF-8 .fatorati to Cache, shares the returned URI, then records date', async () => {
  await downloadBackupFile(fixture(), 'secret')
  assert.deepEqual(calls.map(c => `${c.plugin}.${c.method}`), ['Filesystem.writeFile', 'Share.share', 'Preferences.set'])
  const write = calls[0].options
  assert.equal(write.directory, 'CACHE')
  assert.equal(write.encoding, 'utf8')
  assert.match(write.path as string, /^exports\/[^/]+\/fatorati-backup-\d{4}-\d{2}-\d{2}\.fatorati$/)
  assert.deepEqual(await decodeBackup(write.data as string, 'secret'), fixture())
  assert.deepEqual(calls[1].options, { url: `file:///cache/${write.path}` })
  assert.ok((await getLastBackupDate())! > 0)
})

test('encrypted native export never writes plaintext to cache', async () => {
  await downloadBackupFile(fixture(), 'secret')
  const data = calls[0].options.data as string
  assert.equal(JSON.parse(data).format, 'fatorati-encrypted')
  assert.ok(!data.includes('متجر Café'))
})

for (const plugin of ['Filesystem', 'Share']) {
  test(`${plugin} failure or cancellation preserves previous backup date and does not fall back`, async () => {
    preferences.set(LAST_BACKUP_KEY, '123')
    failure = plugin
    await assert.rejects(downloadBackupFile(fixture(), 'secret'))
    assert.equal(preferences.get(LAST_BACKUP_KEY), '123')
    assert.ok(!calls.some(c => c.plugin === 'Preferences'))
    if (plugin === 'Filesystem') assert.ok(!calls.some(c => c.plugin === 'Share'))
  })
}

test('same share path supports BOM CSV and binary PDF without updating the backup date', async () => {
  await shareFile('customers.csv', '\uFEFF"عميل Café"\r\n', 'text/csv')
  assert.equal(calls[0].options.data, '\uFEFF"عميل Café"\r\n')
  assert.equal(calls[0].options.encoding, 'utf8')
  calls.length = 0
  const bytes = new TextEncoder().encode('%PDF-1.3\n')
  await shareFile('invoice.pdf', bytes, 'application/pdf')
  assert.equal(calls[0].options.encoding, undefined)
  assert.equal(atob(calls[0].options.data as string), '%PDF-1.3\n')
  assert.ok(!calls.some(c => c.plugin === 'Preferences'))
})

test('missing/invalid preference is never mistaken for a recent backup', async () => {
  assert.equal(await getLastBackupDate(), null)
  for (const value of ['garbage', '-1', 'Infinity', '0']) {
    preferences.set(LAST_BACKUP_KEY, value)
    assert.equal(await getLastBackupDate(), null)
  }
})
