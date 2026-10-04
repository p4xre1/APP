import assert from 'node:assert/strict'
import test from 'node:test'
import { shareFile } from '../src/lib/share-file'

test('desktop export uses the isolated native save bridge and preserves UTF-8 bytes', async () => {
  let received: { filename: string; data: Uint8Array<ArrayBuffer>; mime: string } | undefined
  const oldWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      fatoratiDesktop: {
        isDesktop: true,
        platform: 'linux',
        saveFile: async (filename: string, data: Uint8Array<ArrayBuffer>, mime: string) => {
          received = { filename, data, mime }
          return { saved: true }
        },
        onLock: () => () => {},
      },
    },
  })
  try {
    assert.equal(await shareFile('backup name.fatorati', 'Café عميل', 'application/json'), true)
    assert.equal(received?.filename, 'backup_name.fatorati')
    assert.equal(received?.mime, 'application/json')
    assert.equal(new TextDecoder().decode(received?.data), 'Café عميل')
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow })
  }
})

test('cancelling the desktop save dialog is not reported as a completed export', async () => {
  const oldWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      fatoratiDesktop: {
        isDesktop: true,
        platform: 'win32',
        saveFile: async () => ({ saved: false }),
        onLock: () => () => {},
      },
    },
  })
  try {
    assert.equal(await shareFile('invoice.pdf', new Uint8Array([1, 2, 3]), 'application/pdf'), false)
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow })
  }
})
