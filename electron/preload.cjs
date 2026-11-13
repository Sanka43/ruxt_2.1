const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ruxtDesktop', {
  platform: process.platform,
  version: '2.0.0',
  getVersion: () => ipcRenderer.invoke('app-get-version'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Software Updates
  checkForUpdates: () => ipcRenderer.invoke('app-check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('app-download-update'),
  quitAndInstall: () => ipcRenderer.send('app-quit-and-install'),
  onUpdaterEvent: (channel, cb) => {
    const validChannels = [
      'updater-checking',
      'updater-update-available',
      'updater-not-available',
      'updater-error',
      'updater-progress',
      'updater-downloaded'
    ];
    if (validChannels.includes(channel)) {
      const listener = (_event, data) => cb(data);
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    }
    return () => {};
  },

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
