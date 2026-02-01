/**
 * Kensho Tech Update Client
 * Handles update events from Electron and shows a consistent notification UI.
 */

export const initUpdater = () => {
    if (!window.electronAPI) return;

    console.log('Updater Client Initialized');

    // Handle update availability
    window.electronAPI.onUpdateAvailable((info) => {
        console.log('Update detected:', info.version);

        // Open the dedicated notification window
        // We pass the version in the URL, the window will fetch more details via IPC
        const width = 500;
        const height = 450;

        // Use window.open with specific features to trigger Electron's windowOpenHandler
        window.open(`update-notification.html?version=${info.version}`, '_blank', `width=${width},height=${height},frame=false`);
    });

    // Handle background download completion (if autoDownload was true or triggered elsewhere)
    window.electronAPI.onUpdateDownloaded((version) => {
        console.log('Update downloaded background:', version);
        // If the notification window is already open, it handles this.
        // If not, we might want to alert the user here as well.
    });

    // Handle errors
    window.electronAPI.onUpdateError((msg) => {
        console.error('Auto-update error:', msg);
    });
};
