import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const main = readFileSync('electron/main.cjs', 'utf8')
const preload = readFileSync('electron/preload.cjs', 'utf8')

test('desktop package has runnable development, production and installer commands', () => {
  assert.equal(pkg.main, 'electron/main.cjs')
  assert.match(pkg.scripts['desktop:dev'], /desktop-dev/)
  assert.match(pkg.scripts['desktop:start'], /build.*electron/s)
  assert.match(pkg.scripts['desktop:dist'], /build.*electron-builder/s)
  assert.equal(pkg.build.appId, 'com.fatorati.desktop')
  assert.ok(pkg.build.files.includes('electron/**/*'))
  assert.ok(pkg.build.files.includes('dist/**/*'))
})

test('desktop renderer keeps a narrow sandboxed native boundary', () => {
  assert.match(main, /contextIsolation:\s*true/)
  assert.match(main, /nodeIntegration:\s*false/)
  assert.match(main, /sandbox:\s*true/)
  assert.match(main, /webSecurity:\s*true/)
  assert.match(main, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/)
  assert.match(main, /setPermissionRequestHandler/)
  assert.match(preload, /contextBridge\.exposeInMainWorld/)
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*(?:require|process|ipcRenderer)\s*[,}]/s)
})

test('desktop export IPC validates filenames and limits payload size', () => {
  assert.match(main, /MAX_EXPORT_BYTES/)
  assert.match(main, /Invalid filename/)
  assert.match(main, /showOverwriteConfirmation/)
  assert.match(main, /desktop:save-file/)
})
