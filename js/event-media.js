// ===== EVENT MEDIA PLAYER FUNCTIONS =====
// Uses Blob URL instead of localStorage to handle large video files

window.eventMediaBlob = null; // Store the actual Blob object

window.handleEventMediaUpload = function (input) {
    const file = input.files[0];
    if (!file) return;

    const fileType = file.type.startsWith('video/') ? 'video' : 'image';

    // Create Blob URL (no size limit!)
    const blobUrl = URL.createObjectURL(file);

    // Store reference
    window.eventMediaBlob = file;
    window.eventMediaUrl = blobUrl;
    window.eventMediaType = fileType;

    // Save metadata to localStorage (just type, not the file itself)
    localStorage.setItem('eventMediaType', fileType);
    localStorage.setItem('eventMediaFileName', file.name);

    // Show preview
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const preview = document.getElementById('mediaPreview');

    if (fileType === 'video') {
        preview.innerHTML = `<video src="${blobUrl}" class="w-full h-full object-contain" muted loop autoplay></video>`;
    } else {
        preview.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-contain">`;
    }

    previewContainer.classList.remove('hidden');

    console.log('[Event Media] File loaded:', file.name, fileType, `${(file.size / 1024 / 1024).toFixed(2)}MB`);
};

window.clearEventMedia = function () {
    // Revoke Blob URL to free memory
    if (window.eventMediaUrl) {
        URL.revokeObjectURL(window.eventMediaUrl);
    }

    // Clear from storage
    localStorage.removeItem('eventMediaType');
    localStorage.removeItem('eventMediaFileName');

    // Clear state
    window.eventMediaBlob = null;
    window.eventMediaUrl = null;
    window.eventMediaType = null;
    window.showEventMedia = false;

    // Clear preview
    const previewContainer = document.getElementById('mediaPreviewContainer');
    const preview = document.getElementById('mediaPreview');
    preview.innerHTML = '';
    previewContainer.classList.add('hidden');

    // Reset file input
    const fileInput = document.getElementById('eventMediaInput');
    if (fileInput) fileInput.value = '';

    // Broadcast update
    if (window.broadcastData) window.broadcastData();

    console.log('[Event Media] Media cleared');
};

window.toggleEventMedia = function () {
    if (!window.eventMediaUrl) {
        alert('Upload video/foto terlebih dahulu dari menu Pengaturan!');
        return;
    }

    window.showEventMedia = !window.showEventMedia;

    // Update button visual
    const btn = document.getElementById('btnEventMedia');
    if (btn) {
        if (window.showEventMedia) {
            btn.classList.add('bg-purple-600', 'text-white');
            btn.classList.remove('bg-white/5', 'text-purple-400');
        } else {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('bg-white/5', 'text-purple-400');
        }
    }

    // Broadcast to monitor
    if (window.broadcastData) window.broadcastData();

    console.log('[Event Media] Toggle:', window.showEventMedia ? 'ON' : 'OFF');
};

// NOTE: File upload persists only during session
// User must re-upload video after refresh (by design - avoids quota issues)
console.log('[Event Media] Module loaded (Blob URL mode)');
