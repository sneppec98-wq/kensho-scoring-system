/* Custom Window Controls Script */

function initWindowControls() {
    // 1. Create Title Bar Element
    const titleBar = document.createElement('div');
    titleBar.className = 'custom-title-bar';
    titleBar.innerHTML = `
        <div class="drag-region"></div>
        <div class="window-controls">
            <div class="control-btn" id="win-min" title="Minimalkan">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
            </div>
            <div class="control-btn" id="win-max" title="Maksimalkan">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h16v16H4z"/></svg>
            </div>
            <div class="control-btn btn-close" id="win-close" title="Tutup">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
        </div>
    `;

    document.body.prepend(titleBar);

    // 2. Add Event Listeners
    const btnMin = document.getElementById('win-min');
    const btnMax = document.getElementById('win-max');
    const btnClose = document.getElementById('win-close');

    if (btnMin) {
        btnMin.onclick = () => {
            if (window.electronAPI && window.electronAPI.minimizeApp) {
                window.electronAPI.minimizeApp();
            }
        };
    }

    if (btnMax) {
        btnMax.onclick = () => {
            if (window.electronAPI && window.electronAPI.maximizeApp) {
                window.electronAPI.maximizeApp();
            }
        };
    }

    if (btnClose) {
        btnClose.onclick = () => {
            if (window.electronAPI && window.electronAPI.closeApp) {
                window.electronAPI.closeApp();
            }
        };
    }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWindowControls);
} else {
    initWindowControls();
}
