'use strict'

const { app, BrowserWindow, dialog, ipcMain, net, powerMonitor, protocol, session } = require('electron')
const { writeFile } = require('node:fs/promises')
const { extname, join, normalize, relative } = require('node:path')
const { pathToFileURL } = require('node:url')

const APP_SCHEME = 'fatorati'
const MAX_EXPORT_BYTES = 100 * 1024 * 1024
const DIST_DIR = join(__dirname, '..', 'dist')
const DEV_URL = process.env.FATORATI_DEV_URL

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
    },
  },
])

function safeDistPath(requestUrl) {
  const url = new URL(requestUrl)
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const candidate = normalize(join(DIST_DIR, requested.replace(/^\/+/, '')))
  const rel = relative(DIST_DIR, candidate)
  if (rel.startsWith('..') || rel.includes(`..${require('node:path').sep}`)) return null
  return candidate
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, request => {
    const file = safeDistPath(request.url)
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}

function sendLock(window) {
  if (window && !window.isDestroyed()) window.webContents.send('desktop:lock')
}

function createWindow() {
  const window = new BrowserWindow({
    title: 'Fatorati',
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: '#f4f6f9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('minimize', () => sendLock(window))
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-attach-webview', event => event.preventDefault())

  if (DEV_URL) void window.loadURL(DEV_URL)
  else void window.loadURL(`${APP_SCHEME}://app/index.html`)

  return window
}

function bytesFrom(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  throw new Error('Invalid export data')
}

function extensionFilter(filename, mime) {
  const extension = extname(filename).replace(/^\./, '').toLowerCase()
  if (!extension) return []
  const label = mime === 'application/pdf' ? 'PDF' :
    mime.includes('spreadsheet') || extension === 'xlsx' ? 'Excel' :
    mime.startsWith('image/') ? 'Image' :
    extension === 'fatorati' ? 'Fatorati backup' : 'Document'
  return [{ name: label, extensions: [extension] }]
}

function registerDesktopIpc() {
  ipcMain.handle('desktop:save-file', async (event, request) => {
    const filename = typeof request?.filename === 'string'
      ? request.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180)
      : ''
    const mime = typeof request?.mime === 'string' ? request.mime.slice(0, 120) : 'application/octet-stream'
    if (!filename || filename === '.' || filename === '..') throw new Error('Invalid filename')

    const data = bytesFrom(request.data)
    if (data.byteLength > MAX_EXPORT_BYTES) throw new Error('Export file is too large')

    const owner = BrowserWindow.fromWebContents(event.sender) || undefined
    const result = await dialog.showSaveDialog(owner, {
      title: 'Save export',
      defaultPath: filename,
      filters: extensionFilter(filename, mime),
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    })
    if (result.canceled || !result.filePath) return { saved: false }
    await writeFile(result.filePath, data, { flag: 'w' })
    return { saved: true }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  let mainWindow = null

  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    if (!DEV_URL) registerAppProtocol()
    registerDesktopIpc()
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
    mainWindow = createWindow()
    powerMonitor.on('lock-screen', () => sendLock(mainWindow))
    powerMonitor.on('suspend', () => sendLock(mainWindow))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
