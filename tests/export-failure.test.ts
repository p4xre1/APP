import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Capacitor bridge stub: a Filesystem that fails on demand, a Share sheet that
// records calls, and no document, so the browser fallback cannot hide a failure.
const calls: { plugin: string; method: string; options: Record<string, unknown> }[] = []
let writeFailure: Error | null = null
let shareFailure: Error | null = null
Object.assign(globalThis, {
  androidBridge: {},
  window: new EventTarget(),
  Capacitor: {
    PluginHeaders: [
      { name: 'Filesystem', methods: ['writeFile', 'deleteFile'].map(name => ({ name, rtype: 'promise' })) },
      { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
    ],
    nativePromise: async (plugin: string, method: string, options: Record<string, unknown>) => {
      calls.push({ plugin, method, options })
      if (plugin === 'Filesystem' && method === 'writeFile') {
        if (writeFailure) throw writeFailure
        return { uri: `file:///cache/${options.path}` }
      }
      if (plugin === 'Filesystem' && method === 'deleteFile') return {}
      if (plugin === 'Share') {
        if (shareFailure) throw shareFailure
        return { activityType: 'chosen.app' }
      }
      return {}
    },
  },
})

const { EXPORT_NO_SPACE, EXPORT_WRITE_FAILED, exportWriteError, shareFile } = await import('../src/lib/share-file')
const { errorText, t } = await import('../src/i18n')

const languages = ['en', 'ar', 'fr', 'es', 'pt'] as const
const dictionaries = Object.fromEntries(languages.map(language => [
  language,
  JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>,
])) as Record<typeof languages[number], Record<string, string>>

beforeEach(() => { calls.length = 0; writeFailure = null; shareFailure = null })

test('an out-of-space write failure is reported as out of space and leaves no partial file', async () => {
  writeFailure = new Error('NotEnoughSpace: There is not enough space on the device')
  await assert.rejects(shareFile('fatorati-subscriptions-2026-09-30.xlsx', new Uint8Array([1, 2, 3]), 'application/vnd.ms-excel'),
    (error: Error) => error.message === EXPORT_NO_SPACE)
  // The staged path is deleted again, so the cache does not keep a truncated file.
  const write = calls.find(call => call.method === 'writeFile')!
  const remove = calls.find(call => call.method === 'deleteFile')!
  assert.equal(remove.options.path, write.options.path)
  assert.equal(remove.options.directory, 'CACHE')
  assert.equal(calls.some(call => call.plugin === 'Share'), false)
})

test('a generic staging failure gets its own message, also without leaving a file behind', async () => {
  for (const message of ['Directory does not exist', 'Permission denied', '']) {
    calls.length = 0
    writeFailure = new Error(message)
    await assert.rejects(shareFile('export.csv', 'a,b\n1,2', 'text/csv'), (error: Error) => error.message === EXPORT_WRITE_FAILED)
    assert.equal(calls.filter(call => call.method === 'deleteFile').length, 1, message || '(empty)')
  }
  // Any other thrown value is treated the same way instead of leaking a raw message.
  assert.equal(exportWriteError('x').message, EXPORT_WRITE_FAILED)
  assert.equal(exportWriteError(new Error('No space left on device')).message, EXPORT_NO_SPACE)
})

test('a cancelled share is not turned into a storage error and keeps the staged file', async () => {
  shareFailure = new Error('Share canceled')
  await assert.rejects(shareFile('fatorati-backup.fatorati', '{}', 'application/json'),
    (error: Error) => error.message === 'Share canceled')
  assert.equal(calls.some(call => call.method === 'deleteFile'), false)
  assert.equal(calls.filter(call => call.method === 'share').length, 1)
})

test('both messages exist in all five languages and reach the user already translated', () => {
  for (const language of languages) {
    for (const key of [EXPORT_NO_SPACE, EXPORT_WRITE_FAILED]) {
      const value = dictionaries[language][key]
      assert.ok(value?.trim(), `${language} is missing: ${key}`)
      assert.equal(t(key, {}, language), value)
    }
  }
  // The English dictionary carries the sentence itself; the other four translate it.
  assert.equal(dictionaries.en[EXPORT_NO_SPACE], EXPORT_NO_SPACE)
  assert.equal(dictionaries.en[EXPORT_WRITE_FAILED], EXPORT_WRITE_FAILED)
  for (const language of ['fr', 'es', 'pt', 'ar'] as const) {
    assert.notEqual(dictionaries[language][EXPORT_NO_SPACE], EXPORT_NO_SPACE, `${language} must translate the message`)
    assert.notEqual(dictionaries[language][EXPORT_WRITE_FAILED], EXPORT_WRITE_FAILED, `${language} must translate the message`)
  }
  // errorText resolves a shipped message instead of falling back to "Operation failed".
  for (const key of [EXPORT_NO_SPACE, EXPORT_WRITE_FAILED]) {
    assert.notEqual(errorText(new Error(key)), t('Operation failed'))
  }
})

test('every export surface that can fail reports through errorText', () => {
  for (const file of ['src/modules/Subscriptions.tsx', 'src/components/ExportCsvButton.tsx', 'src/components/BackupPanel.tsx', 'src/modules/Invoices.tsx', 'src/modules/Estimates.tsx']) {
    const source = readFileSync(file, 'utf8')
    assert.match(source, /errorText\(/, `${file} must translate export failures`)
  }
  const share = readFileSync('src/lib/share-file.ts', 'utf8')
  assert.match(share, /await discardStaged\(path\)/, 'a failed stage must delete the partial file')
  assert.match(share, /Filesystem\.deleteFile/)
})
