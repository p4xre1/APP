import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { shareFile } from '../src/lib/share-file'

test('non-native fallback uses a browser file download and releases the URL after clicking', async () => {
  const events: string[] = []
  const anchor = { href: '', download: '', click: () => events.push('click'), remove: () => events.push('remove') }
  Object.assign(globalThis, {
    document: {
      body: { appendChild: () => events.push('append') },
      createElement: (tag: string) => { assert.equal(tag, 'a'); return anchor },
    },
  })
  let downloaded: Blob | undefined
  mock.method(URL, 'createObjectURL', (blob: Blob) => { downloaded = blob; return 'blob:test' })
  mock.method(URL, 'revokeObjectURL', () => events.push('revoke'))
  mock.method(globalThis, 'setTimeout', (callback: () => void, delay: number) => {
    assert.equal(delay, 60_000); callback(); return 0
  })
  try {
    await shareFile('fatorati-backup-2026-09-29.fatorati', '{"test":true}', 'application/json')
    assert.equal(anchor.download, 'fatorati-backup-2026-09-29.fatorati')
    assert.equal(anchor.href, 'blob:test')
    assert.equal(await downloaded!.text(), '{"test":true}')
    assert.equal(downloaded!.type, 'application/json')
    assert.deepEqual(events, ['append', 'click', 'remove', 'revoke'])
  } finally { mock.restoreAll() }
})
