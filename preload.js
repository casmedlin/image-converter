const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  processImages: (data) => ipcRenderer.invoke('process-images', data),
  getMetadata: (filePath) => ipcRenderer.invoke('get-metadata', filePath),
  generateThumbnail: (filePath) => ipcRenderer.invoke('generate-thumbnail', filePath),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  onProgress: (callback) => {
    ipcRenderer.on('image-progress', (_event, data) => callback(data));
  },
  onOpenFiles: (callback) => {
    ipcRenderer.on('open-files', (_event, files) => callback(files));
  },
  removeProgressListeners: () => {
    ipcRenderer.removeAllListeners('image-progress');
  },

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateChecking: (callback) => {
    ipcRenderer.on('update-checking', () => callback());
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_event, data) => callback(data));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_event, msg) => callback(msg));
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_event, data) => callback(data));
  },
});
