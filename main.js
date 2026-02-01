const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const { autoUpdater } = require('electron-updater');

// Disable auto-downloading, we only want to notify the user
autoUpdater.autoDownload = false;


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

    // Handle window.open from renderer (e.g., monitor window & printing)
    win.webContents.setWindowOpenHandler(({ url }) => {
        // Allow internal windows, about:blank (for printing), and specific tool pages
        const isInternal = url === 'about:blank' || url === '' || url.startsWith('file://');
        const isSpecificPage = url.includes('scoring-monitor.html') || url.includes('update-notification.html');

        if (isInternal || isSpecificPage) {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    frame: url.includes('update-notification.html') ? false : true,
                    width: url.includes('update-notification.html') ? 500 : 900,
                    height: url.includes('update-notification.html') ? 450 : 700,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js')
                    }
                }
            };
        }

        // External links open in default browser
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

    // Manual download trigger from UI
    ipcMain.handle('download-update', () => {
        shell.openExternal('https://github.com/sneppec98-wq/kensho-scoring-system/releases/latest');
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
    console.log('Update available:', info.version);
    BrowserWindow.getAllWindows().forEach(win => {
        // Send version and release notes (releaseNotes might be an array or string)
        win.webContents.send('update-available', {
            version: info.version,
            releaseNotes: info.releaseNotes || 'Pembaruan sistem rutin untuk performa lebih baik.'
        });
    });
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);

    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-progress', progressObj.percent);
    });
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-downloaded', info.version);
    });
});

autoUpdater.on('error', (err) => {
    console.error('Update check error:', err);
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('update-error', err.message);
    });
});

// IPC Handlers for Update Flow
ipcMain.handle('start-download', () => {
    autoUpdater.downloadUpdate();
});

ipcMain.handle('restart-app', () => {
    autoUpdater.quitAndInstall();
});
