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
});
