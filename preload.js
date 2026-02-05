const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openInBrowser: (url) => ipcRenderer.send('open-external-browser', url),
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    getPCName: () => ipcRenderer.invoke('get-pc-name'),
    setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, version) => callback(version)),
    onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event) => callback()),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (event, msg) => callback(msg)),
    startDownload: () => ipcRenderer.invoke('start-download'),
    restartApp: () => ipcRenderer.invoke('restart-app'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    minimizeApp: () => ipcRenderer.invoke('minimize-app'),
    maximizeApp: () => ipcRenderer.invoke('maximize-app'),
    closeApp: () => ipcRenderer.invoke('close-app'),
    centerWindow: () => ipcRenderer.send('center-window')
});
