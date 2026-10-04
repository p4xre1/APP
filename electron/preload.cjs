'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fatoratiDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  saveFile: (filename, data, mime) => ipcRenderer.invoke('desktop:save-file', {
    filename,
    data,
    mime,
  }),
  onLock: callback => {
    if (typeof callback !== 'function') return () => {}
    const listener = () => callback()
    ipcRenderer.on('desktop:lock', listener)
    return () => ipcRenderer.removeListener('desktop:lock', listener)
  },
}))
