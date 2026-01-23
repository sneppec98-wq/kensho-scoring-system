const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { autoUpdater } = require('electron-updater');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Kensho Tech | Scoring System",
        icon: path.join(__dirname, 'Kensho.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // We will create this
        },
        // Frameless window for Discord look (optional, can be enabled later)
        // titleBarStyle: 'hidden',
        // titleBarOverlay: true
    });

    // Path fix for persistent data (ASAR read-only workaround)
    const userDataPath = app.getPath('userData');
    console.log('User Data Path:', userDataPath);

    win.setMenuBarVisibility(false);

    win.loadFile('login.html');

    // Handle window.open from renderer (e.g., monitor window)
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('file://') || url.includes('scoring-monitor.html')) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js')
                    }
                }
            };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

ipcMain.on('open-external-browser', (event, url) => {
    shell.openExternal(url);
});

ipcMain.on('set-always-on-top', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setAlwaysOnTop(flag);
});

ipcMain.handle('get-pc-name', async () => {
    return os.hostname();
});

ipcMain.handle('get-machine-id', async () => {
    return new Promise((resolve) => {
        exec('wmic baseboard get serialnumber', (err, stdout) => {
            let id = stdout ? stdout.replace('SerialNumber', '').trim() : '';

            if (!id || id === 'To be filled by O.E.M.') {
                exec('wmic csproduct get uuid', (err2, stdout2) => {
                    id = stdout2 ? stdout2.replace('UUID', '').trim() : 'UNKNOWN-DEVICE';
                    resolve(id);
                });
            } else {
                resolve(id);
            }
        });
    });
});

app.whenReady().then(() => {
    createWindow();

    // Check for updates every 60 minutes
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000);

    // Listen for restart request from UI
    ipcMain.handle('restart-app', () => {
        autoUpdater.quitAndInstall();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// AUTO-UPDATE LOGIC - IPC Communication
autoUpdater.on('update-available', (info) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-available', info.version);
    });
});

autoUpdater.on('update-downloaded', (info) => {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-downloaded', info.version);
    });
});

autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
});
