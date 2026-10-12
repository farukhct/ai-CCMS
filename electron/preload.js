/**
 * Company Court Management System (CCMS)
 * Electron Preload Bridge
 * Exposes narrowly-scoped, validated APIs via contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path')
});
