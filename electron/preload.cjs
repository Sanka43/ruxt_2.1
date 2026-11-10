const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ruxtDesktop', {
  platform: process.platform,
  version: '2.1.0',
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Floating 'RuXt on Work' HUD Overlay controls
  showOverlay: (data) => ipcRenderer.send('desktop-overlay-show', data),
  updateOverlay: (data) => ipcRenderer.send('desktop-overlay-update', data),
  hideOverlay: () => ipcRenderer.send('desktop-overlay-hide'),
  abortTask: () => ipcRenderer.send('desktop-overlay-abort'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('desktop-overlay-set-ignore-mouse', ignore, options),
  onBannerUpdate: (cb) => {
    ipcRenderer.on('banner-update-data', (_event, data) => cb(data));
  },
  onAbort: (cb) => {
    ipcRenderer.on('desktop-task-aborted', (_event) => cb());
  }
});
