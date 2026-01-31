const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openInBrowser: (url) => ipcRenderer.send('open-external-browser', url),
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    getPCName: () => ipcRenderer.invoke('get-pc-name'),
    setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, version) => callback(version)),
    downloadUpdate: () => ipcRenderer.invoke('download-update')
});
