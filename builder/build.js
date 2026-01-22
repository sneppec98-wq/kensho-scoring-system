// --- KONFIGURASI FIREBASE ---

// Menggunakan konfigurasi Firebase yang sama dengan aplikasi scoring

const firebaseConfig = {

    apiKey: "AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM",

    authDomain: "adm-spartan-sport-2f4ec.firebaseapp.com",

    databaseURL: "https://adm-spartan-sport-2f4ec-default-rtdb.asia-southeast1.firebasedatabase.app",

    projectId: "adm-spartan-sport-2f4ec",

    storageBucket: "adm-spartan-sport-2f4ec.firebasestorage.app",

    messagingSenderId: "847888051133",

    appId: "1:847888051133:web:fdd362c642c654bd2080d4",

    measurementId: "G-SC7SBDVHZ2"

};



firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let activeTemplateId = null; // Menyimpan ID template yang sedang aktif

// Fungsi untuk memperbarui UI status template
function updateTemplateStatusUI(templateName) {
    const statusName = document.getElementById('activeTemplateName');
    const statusDot = document.getElementById('activeTemplateDot');
    const saveProgressBtn = document.getElementById('saveProgressBtn');

    if (templateName) {
        statusName.textContent = templateName;
        statusDot.classList.add('active');
        saveProgressBtn.disabled = false;
        if (saveProgressBtn) {
            saveProgressBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    } else {
        statusName.textContent = 'Draft (Belum disimpan)';
        statusDot.classList.remove('active');
        saveProgressBtn.disabled = true;
        if (saveProgressBtn) {
            saveProgressBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

// --- NAVIGATION & UNDO STATE ---
let currentZoom = 1;
let undoStack = [];
let redoStack = [];
const MAX_STACK_SIZE = 50;

let isPanning = false;
let startPanX = 0, startPanY = 0;
let canvasOffsetX = 0, canvasOffsetY = 0;

function saveState() {
    // Ambil semua elemen saat ini
    const currentState = serializeCanvas();

    // Jika state terakhir sama dengan sekarang, abaikan
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === currentState) return;

    undoStack.push(currentState);
    if (undoStack.length > MAX_STACK_SIZE) undoStack.shift();

    // Setiap aksi baru menghapus kemungkinan Redo
    redoStack = [];
    updateUndoRedoButtons();
    autoSaveBackup(currentState);
}

function autoSaveBackup(state) {
    localStorage.setItem('kensho_builder_backup', state);
    localStorage.setItem('kensho_builder_backup_time', new Date().getTime());
}

function serializeCanvas() {
    const items = [];
    document.querySelectorAll('.draggable-item').forEach(el => {
        let type = 'atlet';
        if (el.classList.contains('title-box')) type = 'title';
        else if (el.classList.contains('header-pair-box')) type = 'pair';
        else if (el.classList.contains('event-header-box')) type = 'event-header';
        else if (el.classList.contains('winner-table-box')) type = 'winner-table';
        else if (el.classList.contains('image-box')) type = 'image';
        else if (el.querySelector('.score-input')) type = 'atlet-score';

        const textInputs = el.querySelectorAll('input, textarea');
        const textValue = Array.from(textInputs).map(i => i.value).join('|');

        items.push({
            id: el.id,
            type: type,
            x: el.dataset.x,
            y: el.dataset.y,
            width: el.style.width,
            height: el.style.height,
            text: textValue,
            imageSrc: el.querySelector('img')?.src || "", // For logos
            color: el.querySelector('.indicator')?.classList.contains('red') ? 'red' :
                (el.querySelector('.indicator')?.classList.contains('blue') ? 'blue' : 'neutral'),
            hasBorder: el.classList.contains('has-border'),
            textAlign: el.querySelector('input, textarea') ? el.querySelector('input, textarea').style.textAlign : 'center',
            alignItems: el.style.alignItems,
            idLabel: el.dataset.idLabel || "",
            isLocked: el.classList.contains('is-locked')
        });
    });
    return JSON.stringify({ items, connections });
}

function undo() {
    if (undoStack.length <= 1) return; // Sisakan 1 state awal

    const currentState = undoStack.pop();
    redoStack.push(currentState);

    const targetState = undoStack[undoStack.length - 1];
    applyState(targetState);
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;

    const targetState = redoStack.pop();
    undoStack.push(targetState);

    applyState(targetState);
    updateUndoRedoButtons();
}

function applyState(stateJson) {
    try {
        const state = JSON.parse(stateJson);
        const items = Array.isArray(state) ? state : state.items;
        const newConnections = state.connections || [];

        // Bersihkan canvas
        const canvas = document.getElementById('canvas');
        canvas.querySelectorAll('.draggable-item').forEach(el => el.remove());

        // Gambar ulang item
        items.forEach(item => {
            restoreItemFromBackup(item);
        });

        // Restore connections
        connections = [...newConnections];

        setTimeout(drawLines, 50);
    } catch (e) {
        console.error("Error applying state", e);
    }
}

function updateUndoRedoButtons() {
    const uBtn = document.getElementById('undoBtn');
    const rBtn = document.getElementById('redoBtn');

    if (uBtn) {
        uBtn.disabled = undoStack.length <= 1;
        uBtn.classList.toggle('opacity-50', undoStack.length <= 1);
        uBtn.classList.toggle('cursor-not-allowed', undoStack.length <= 1);
    }

    if (rBtn) {
        rBtn.disabled = redoStack.length === 0;
        rBtn.classList.toggle('opacity-50', redoStack.length === 0);
        rBtn.classList.toggle('cursor-not-allowed', redoStack.length === 0);
    }
}

// --- EXPORT AS IMAGE (Optimized Zero-Padding) ---
async function exportAsImage() {
    const canvasEl = document.getElementById('canvas');
    const allItems = canvasEl.querySelectorAll('.draggable-item');
    if (allItems.length === 0) {
        alert("Tidak ada elemen di canvas untuk diekspor.");
        return;
    }

    const zoomBefore = currentZoom;
    const originalTransform = canvasEl.style.transform;
    const originalW = canvasEl.style.width;
    const originalH = canvasEl.style.height;

    // 1. Hitung Bounding Box Elemen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allItems.forEach(el => {
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    // Berikan ruang aesthetic (padding)
    const padding = 50;
    const captureW = (maxX - minX) + (padding * 2);
    const captureH = (maxY - minY) + (padding * 2);

    // 2. Persiapan Capture (Shift ke 0,0)
    const dx = -minX + padding;
    const dy = -minY + padding;

    // Sembunyikan aksesoris builder
    document.querySelectorAll('.resize-handle, .box-actions, .move-handle').forEach(el => el.style.display = 'none');

    // Simpan posisi asli and geser sementara
    allItems.forEach(el => {
        el.dataset.origX = el.dataset.x;
        el.dataset.origY = el.dataset.y;
        const newX = parseFloat(el.dataset.x) + dx;
        const newY = parseFloat(el.dataset.y) + dy;
        el.dataset.x = newX;
        el.dataset.y = newY;
        el.style.transform = `translate(${newX}px, ${newY}px)`;
    });

    // Reset Zoom and Atur Ukuran Canvas untuk Capture
    canvasEl.style.transformOrigin = '0 0';
    canvasEl.style.transform = 'scale(1)';
    canvasEl.style.width = `${captureW}px`;
    canvasEl.style.height = `${captureH}px`;
    drawLines(); // Gambar ulang garis di posisi baru

    // Tunggu render stabil
    await new Promise(r => setTimeout(r, 600));

    try {
        const canvasImage = await html2canvas(canvasEl, {
            backgroundColor: '#ffffff',
            scale: 2, // Kualitas HD
            useCORS: true,
            logging: false,
            width: captureW,
            height: captureH
        });

        const link = document.createElement('a');
        link.download = `kensho-bracket-${activeTemplateId || 'draft'}.png`;
        link.href = canvasImage.toDataURL('image/png');
        link.click();
        alert('✅ Gambar berhasil diekspor dengan teknik Zero-Padding!');
    } catch (err) {
        console.error("Export error:", err);
        alert('❌ Gagal mengekspor gambar.');
    } finally {
        // 3. Kembalikan Posisi and Status Semula
        allItems.forEach(el => {
            el.dataset.x = el.dataset.origX;
            el.dataset.y = el.dataset.origY;
            delete el.dataset.origX;
            delete el.dataset.origY;
            el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px)`;
        });

        canvasEl.style.transform = originalTransform;
        canvasEl.style.width = originalW;
        canvasEl.style.height = originalH;

        document.querySelectorAll('.resize-handle, .box-actions, .move-handle').forEach(el => el.style.display = '');
        drawLines();
    }
}

// --- ZOOM LOGIC ---
const GRID = 20;

let connections = [];

let sourceDotId = null;

let activeStroke = '#3b82f6'; // Default Blue (lebih terlihat daripada putih)

let selectedItems = [];

// --- SYNC TRANSFORMATION STATE ---
let isSyncMoveEnabled = false;
let isSyncResizeEnabled = false;

function getConnectedChain(startId) {
    const chain = new Set();
    const queue = [startId];
    chain.add(startId);

    let i = 0;
    while (i < queue.length) {
        const id = queue[i++];
        connections.forEach(conn => {
            if (conn.from === id && !chain.has(conn.to)) {
                chain.add(conn.to);
                queue.push(conn.to);
            }
            if (conn.to === id && !chain.has(conn.from)) {
                chain.add(conn.from);
                queue.push(conn.from);
            }
        });
    }
    console.log("Connected chain for", startId, ":", Array.from(chain));
    return Array.from(chain);
}



// MODAL FUNCTIONS

let selectedTemplateToLoad = null;



function saveTemplate() {

    document.getElementById('saveModal').classList.add('show');

    document.getElementById('saveTemplateName').value = '';

    document.getElementById('saveTemplateName').focus();

}



function closeSaveModal() {

    document.getElementById('saveModal').classList.remove('show');

}



async function saveProgress() {
    if (!activeTemplateId) {
        saveTemplate();
        return;
    }

    const items = [];
    document.querySelectorAll('.draggable-item').forEach(el => {
        let type = 'atlet';
        if (el.classList.contains('title-box')) type = 'title';
        else if (el.classList.contains('header-pair-box')) type = 'pair';
        else if (el.classList.contains('event-header-box')) type = 'event-header';
        else if (el.classList.contains('winner-table-box')) type = 'winner-table';
        else if (el.querySelector('.score-input')) type = 'atlet-score';

        const textInputs = el.querySelectorAll('input, textarea');
        const textValue = Array.from(textInputs).map(i => i.value).join('|');

        items.push({
            id: el.id,
            type: type,
            x: el.dataset.x,
            y: el.dataset.y,
            width: el.style.width,
            height: el.style.height,
            text: textValue,
            color: el.querySelector('.indicator')?.classList.contains('red') ? 'red' :
                (el.querySelector('.indicator')?.classList.contains('blue') ? 'blue' : 'neutral'),
            hasBorder: el.classList.contains('has-border'),
            textAlign: el.querySelector('input, textarea') ? el.querySelector('input, textarea').style.textAlign : 'center',
            alignItems: el.style.alignItems,
            idLabel: el.dataset.idLabel || ""
        });
    });

    try {
        await db.collection("templates").doc(activeTemplateId).set({
            name: activeTemplateId,
            items: items,
            lastSaved: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert(`✅ Progres '${activeTemplateId}' berhasil diperbarui!`);
    } catch (error) {
        console.error("Error updating progress: ", error);
        alert('❌ Gagal memperbarui progres.');
    }
}

async function confirmSaveTemplate() {

    const templateName = document.getElementById('saveTemplateName').value.trim();

    if (!templateName) {

        alert('Masukkan nama template!');

        return;

    }



    const items = [];

    document.querySelectorAll('.draggable-item').forEach(el => {

        let type = 'atlet';
        if (el.classList.contains('title-box')) type = 'title';
        else if (el.classList.contains('header-pair-box')) type = 'pair';
        else if (el.classList.contains('event-header-box')) type = 'event-header';
        else if (el.classList.contains('winner-table-box')) type = 'winner-table';
        else if (el.querySelector('.score-input')) type = 'atlet-score';

        const textInputs = el.querySelectorAll('input, textarea');
        const textValue = Array.from(textInputs).map(i => i.value).join('|');

        items.push({

            id: el.id,

            type: type,

            x: el.dataset.x,

            y: el.dataset.y,

            width: el.style.width,

            height: el.style.height,

            text: textValue,

            color: el.querySelector('.indicator')?.classList.contains('red') ? 'red' :

                (el.querySelector('.indicator')?.classList.contains('blue') ? 'blue' : 'neutral'),

            hasBorder: el.classList.contains('has-border'),

            textAlign: el.querySelector('input, textarea') ? el.querySelector('input, textarea').style.textAlign : 'center',

            alignItems: el.style.alignItems,
            idLabel: el.dataset.idLabel || ""

        });

    });




    try {

        await db.collection("templates").doc(templateName).set({

            name: templateName,

            items: items,

            connections: connections,

            lastSaved: firebase.firestore.FieldValue.serverTimestamp()

        });

        activeTemplateId = templateName;
        updateTemplateStatusUI(templateName);
        alert('✅ Template berhasil disimpan!');
        closeSaveModal();

    } catch (error) {

        console.error("Error saving: ", error);

        alert("❌ Gagal menyimpan template.");

    }

}



async function deleteTemplate(templateId, event) {
    if (event) event.stopPropagation();

    const confirmed = confirm(`Apakah Anda yakin ingin menghapus template "${templateId}"?\r\nTindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    try {
        await db.collection("templates").doc(templateId).delete();
        alert("✅ Template berhasil dihapus!");
        loadTemplate(); // Refresh list
    } catch (error) {
        console.error("Error deleting template:", error);
        alert("❌ Gagal menghapus template.");
    }
}

let cachedTemplates = [];

async function loadTemplate() {
    document.getElementById('loadModal').classList.add('show');
    selectedTemplateToLoad = null;
    document.getElementById('confirmLoadBtn').disabled = true;
    document.getElementById('templateSearchInput').value = '';

    const listContainer = document.getElementById('templateList');
    listContainer.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Loading...</div>';

    try {
        const snapshot = await db.collection("templates").orderBy("lastSaved", "desc").get();
        cachedTemplates = [];
        snapshot.forEach(doc => {
            cachedTemplates.push({ id: doc.id, ...doc.data() });
        });
        renderTemplateList(cachedTemplates);
    } catch (error) {
        console.error("Error loading templates: ", error);
        listContainer.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 20px;">Error loading templates</div>';
    }
}

function renderTemplateList(templates) {
    const listContainer = document.getElementById('templateList');
    if (templates.length === 0) {
        listContainer.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">Tidak ada template cocok</div>';
        return;
    }

    listContainer.innerHTML = '';
    templates.forEach(t => {
        const date = t.lastSaved ? new Date(t.lastSaved.toDate()).toLocaleString('id-ID') : 'Tanggal tidak tersedia';
        const item = document.createElement('div');
        item.className = 'template-item';
        item.onclick = () => selectTemplate(t.id, item);
        item.innerHTML = `
            <div class="template-info">
                <div class="template-name">${t.name || t.id}</div>
                <div class="template-date">Disimpan: ${date}</div>
            </div>
            <button class="btn-delete-template" onclick="deleteTemplate('${t.id}', event)" title="Hapus Template">
                🗑️
            </button>
        `;
        listContainer.appendChild(item);
    });
}

function filterTemplates(query) {
    const q = query.toLowerCase();
    const filtered = cachedTemplates.filter(t =>
        (t.name || t.id).toLowerCase().includes(q)
    );
    renderTemplateList(filtered);
}



function selectTemplate(templateId, element) {

    // Remove previous selection

    document.querySelectorAll('.template-item').forEach(el => el.classList.remove('selected'));

    // Add selection

    element.classList.add('selected');

    selectedTemplateToLoad = templateId;

    document.getElementById('confirmLoadBtn').disabled = false;

}



function closeLoadModal() {

    document.getElementById('loadModal').classList.remove('show');

}



async function confirmLoadTemplate() {

    if (!selectedTemplateToLoad) return;




    try {

        const doc = await db.collection("templates").doc(selectedTemplateToLoad).get();

        if (!doc.exists) {

            alert("❌ Template tidak ditemukan.");

            return;

        }



        const data = doc.data();



        // Clear canvas

        document.getElementById('canvas').querySelectorAll('.draggable-item').forEach(e => e.remove());

        connections = [];



        // Load Items

        data.items.forEach(item => {

            const div = document.createElement('div');
            const id = item.id;
            div.id = id;
            let classNames = `draggable-item ${item.type === 'title' ? 'title-box' : 'atlet-box'}`;
            if (item.type === 'pair') classNames = 'draggable-item header-pair-box';
            if (item.type === 'event-header') classNames = 'draggable-item event-header-box';
            div.className = classNames;

            if (item.hasBorder) div.classList.add('has-border');

            div.style.width = item.width;
            div.style.height = item.height;
            div.style.transform = `translate(${item.x}px, ${item.y}px)`;
            div.style.alignItems = item.alignItems || 'center';
            div.dataset.x = item.x;
            div.dataset.y = item.y;
            div.dataset.idLabel = item.idLabel || "";

            // New logic: Just dots and resize handle (same as addItem)
            const connDots = (item.type !== 'pair' && item.type !== 'title' && item.type !== 'event-header') ? `
                    <div class="conn-dot dot-left" onclick="handleDotClick('${id}', 'left')"></div>
                    <div class="conn-dot dot-right" onclick="handleDotClick('${id}', 'right')"></div>
                ` : '';

            div.innerHTML = `
                <div class="move-handle">⠿</div>
                ${connDots}
                <div class="resize-handle"></div>
            `;

            if (item.type === 'pair') {

                const texts = (item.text || "").split('|');
                const input1 = document.createElement('textarea');
                input1.className = 'header-input';
                input1.value = texts[0] || "";
                input1.placeholder = "JUDUL KELAS...";

                const divider = document.createElement('div');
                divider.className = 'header-divider';

                const input2 = document.createElement('textarea');
                input2.className = 'header-input';
                input2.value = texts[1] || "";
                input2.placeholder = "NAMA EVENT...";

                div.appendChild(input1);
                div.appendChild(divider);
                div.appendChild(input2);

            } else if (item.type === 'atlet-score') {
                const texts = (item.text || "").split('|');

                const ind = document.createElement('div');
                ind.className = `indicator ${item.color}`;
                div.appendChild(ind);

                const nameInput = document.createElement('textarea');
                nameInput.className = 'name-input';
                nameInput.value = texts[0] || "";
                nameInput.style.paddingLeft = '40px';
                nameInput.style.textAlign = item.textAlign || 'center';

                const divider = document.createElement('div');
                divider.className = 'score-divider';

                const scoreInput = document.createElement('textarea');
                scoreInput.className = 'score-input';
                scoreInput.value = texts[1] || "";
                scoreInput.style.color = item.color === 'red' ? '#ef4444' : '#3b82f6';

                div.appendChild(nameInput);
                div.appendChild(divider);
                div.appendChild(scoreInput);

            } else if (item.type === 'event-header') {
                const texts = (item.text || "").split('|');
                const container = document.createElement('div');
                container.className = 'eh-container';
                container.innerHTML = `
                    <div class="eh-col eh-main">
                        <input class="eh-input eh-input-large" placeholder="NAMA KELAS PERTANDINGAN" value="${texts[0] || ''}">
                        <div class="eh-divider-h"></div>
                        <input class="eh-input" placeholder="NAMA EVENT" value="${texts[1] || ''}">
                    </div>
                    <div class="eh-col eh-date">
                        <input class="eh-input" placeholder="TANGGAL" value="${texts[2] || ''}">
                        <div class="eh-divider-h"></div>
                        <input class="eh-input" placeholder="JAM MULAI - SELESAI" value="${texts[3] || ''}">
                    </div>
                    <div class="eh-col eh-small">
                        <div class="eh-label">TATAMI</div>
                        <input class="eh-input text-center" placeholder="0" value="${texts[4] || ''}">
                    </div>
                    <div class="eh-col eh-small">
                        <div class="eh-label">POOL</div>
                        <input class="eh-input text-center" placeholder="X" value="${texts[5] || ''}">
                    </div>
                `;
                div.appendChild(container);
            } else if (item.type === 'winner-table') {
                const texts = (item.text || "").split('|');
                const container = document.createElement('div');
                container.className = 'wt-container';

                let rowsHTML = `
                    <div class="wt-row wt-header">
                        <div class="wt-col wt-col-rank">JUARA</div>
                        <div class="wt-col wt-col-name">NAMA</div>
                        <div class="wt-col wt-col-team">KONTINGEN</div>
                    </div>
                `;

                // data starts from index 0 in parts? actually texts contains ALL inputs.
                // wt-input in table starts from first row rank.
                // 4 rows * 3 inputs = 12 total inputs (actually 1st col is input too)
                for (let i = 0; i < 4; i++) {
                    const base = i * 3;
                    rowsHTML += `
                        <div class="wt-row">
                            <div class="wt-col wt-col-rank"><input class="wt-input wt-input-rank" value="${texts[base] || (i === 2 || i === 3 ? '3' : i + 1)}"></div>
                            <div class="wt-col wt-col-name"><textarea class="wt-input" placeholder="NAMA Pemenang">${texts[base + 1] || ''}</textarea></div>
                            <div class="wt-col wt-col-team"><textarea class="wt-input" placeholder="KONTINGEN">${texts[base + 2] || ''}</textarea></div>
                        </div>
                    `;
                }
                container.innerHTML = rowsHTML;
                div.appendChild(container);
            } else {

                const field = document.createElement('textarea');
                field.className = item.type === 'title' ? 'title-input' : 'name-input';
                field.value = item.text;
                field.style.textAlign = item.textAlign || 'center';
                if (item.type === 'atlet') field.style.paddingLeft = '40px';

                if (item.type === 'atlet') {
                    const ind = document.createElement('div');
                    ind.className = `indicator ${item.color}`;
                    div.appendChild(ind);
                }

                div.appendChild(field);

            }

            if (item.isLocked) {
                div.classList.add('is-locked');
                const lockInd = document.createElement('div');
                lockInd.className = 'lock-indicator';
                lockInd.innerHTML = '🔒';
                div.appendChild(lockInd);
            }

            document.getElementById('canvas').appendChild(div);

            initInteract(div);

            // Ensure Static Placeholder remains interactive
            // No need to disable interact anymore


            // Add click handler for selection

            div.addEventListener('click', (e) => {

                if (e.target.closest('.box-actions') || e.target.closest('.conn-dot') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

                div.classList.toggle('selected');

                if (div.classList.contains('selected')) {

                    selectedItems.push(id);

                } else {

                    selectedItems = selectedItems.filter(item => item !== id);

                }

            });

        });



        // Load Connections

        connections = data.connections || [];

        drawLines();


        activeTemplateId = selectedTemplateToLoad;
        updateTemplateStatusUI(selectedTemplateToLoad);
        closeLoadModal();

        alert("✅ Template berhasil dimuat!");



    } catch (error) {

        console.error("Error loading: ", error);

        alert("❌ Gagal memuat template.");

    }

}



function updateItemId(boxId, newValue) {
    const el = document.getElementById(boxId);
    if (el) {
        el.dataset.idLabel = newValue.trim().toUpperCase();
    }
}

function toggleFlyout(id, btn) {
    const panel = document.getElementById(id);
    const isShowing = panel.classList.contains('show');

    // Close all first
    closeAllFlyouts();

    if (!isShowing) {
        panel.classList.add('show');
        btn.classList.add('active');
    }
}

function closeAllFlyouts() {
    document.querySelectorAll('.flyout-panel').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.side-icon-btn').forEach(b => b.classList.remove('active'));
}

// Close flyouts when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sidebar') && !e.target.closest('.flyout-panel')) {
        closeAllFlyouts();
    }
});

function cycleBoxColor(id) {
    const box = document.getElementById(id);
    const indicator = box.querySelector('.indicator');
    if (!indicator) return;

    const isScoreBox = !!box.querySelector('.score-input');
    const scoreInput = box.querySelector('.score-input');

    if (indicator.classList.contains('neutral')) {
        indicator.classList.replace('neutral', 'red');
        if (isScoreBox) scoreInput.style.color = '#ef4444';
    } else if (indicator.classList.contains('red')) {
        indicator.classList.replace('red', 'blue');
        if (isScoreBox) scoreInput.style.color = '#3b82f6';
    } else {
        indicator.classList.replace('blue', 'neutral');
        if (isScoreBox) scoreInput.style.color = '#000';
    }
    drawLines(); // Re-draw to update connection colors if needed
    saveState();
}

// TOGGLE LOCK/UNLOCK PER BOX

function toggleBoxLock(id) {
    const box = document.getElementById(id);
    if (!box) return;

    const isLocked = box.classList.toggle('is-locked');

    // Static Placeholder: Keep interaction ENABLED but mark it visually
    // interact(box).draggable({ enabled: true }); // No need to disable/enable anymore

    // Visual Indicator
    let lockInd = box.querySelector('.lock-indicator');
    if (isLocked) {
        if (!lockInd) {
            lockInd = document.createElement('div');
            lockInd.className = 'lock-indicator';
            lockInd.innerHTML = '🔒';
            box.appendChild(lockInd);
        }
    } else if (lockInd) {
        lockInd.remove();
    }

    saveState();
}




function distributeItems() {
    if (selectedItems.length < 3) return;

    const elements = selectedItems
        .map(id => document.getElementById(id))
        .filter(el => el !== null)
        .sort((a, b) => parseFloat(a.dataset.y) - parseFloat(b.dataset.y));

    if (elements.length < 3) return;

    const firstY = parseFloat(elements[0].dataset.y);
    const lastY = parseFloat(elements[elements.length - 1].dataset.y);
    const totalDist = lastY - firstY;
    const step = totalDist / (elements.length - 1);

    elements.forEach((el, i) => {
        const newY = Math.round((firstY + (step * i)) / GRID) * GRID;
        el.style.transform = `translate(${el.dataset.x}px, ${newY}px)`;
        el.dataset.y = newY;
    });

    drawLines();
    saveState();
}

function alignSelected(type) {
    if (selectedItems.length < 2) return;

    const elements = selectedItems
        .map(id => document.getElementById(id))
        .filter(el => el !== null);

    if (type === 'left') {
        const minX = Math.min(...elements.map(el => parseFloat(el.dataset.x)));
        elements.forEach(el => {
            el.dataset.x = minX;
            el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px)`;
        });
    } else if (type === 'right') {
        const maxX = Math.max(...elements.map(el => parseFloat(el.dataset.x) + el.offsetWidth));
        elements.forEach(el => {
            const newX = maxX - el.offsetWidth;
            el.dataset.x = newX;
            el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px)`;
        });
    } else if (type === 'center') {
        const centers = elements.map(el => parseFloat(el.dataset.x) + el.offsetWidth / 2);
        const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
        elements.forEach(el => {
            const newX = Math.round((avgCenter - el.offsetWidth / 2) / GRID) * GRID;
            el.dataset.x = newX;
            el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px)`;
        });
    }

    drawLines();
    saveState();
}




function clearSelection() {
    selectedItems.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('selected'); });
    selectedItems = [];
    updatePropertySidebar();
}



// TRACK MOUSE POSITION & SELECTION BOX
let lastMouseX = 100, lastMouseY = 100;
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBox = null;

const canvasContainer = document.getElementById('canvas-container');
const canvasEl = document.getElementById('canvas');

canvasContainer.addEventListener('mousedown', (e) => {
    // Only select if clicking on canvas background or SVG, not on a box or UI
    if (e.target.closest('.draggable-item') ||
        e.target.closest('.sidebar') ||
        e.target.closest('.flyout-panel') ||
        e.target.closest('.top-toolbar') ||
        e.target.closest('.box-actions') ||
        e.target.closest('.property-sidebar') ||
        e.target.closest('.context-menu')) return;

    if (e.button !== 0) return; // Left click only

    isSelecting = true;
    const rect = canvasEl.getBoundingClientRect();
    selectionStart = {
        x: (e.clientX - rect.left) / currentZoom,
        y: (e.clientY - rect.top) / currentZoom
    };

    // Clear previous selection if not holding shift
    if (!e.shiftKey) {
        clearSelection();
    }

    selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    canvasEl.appendChild(selectionBox);
});

canvasContainer.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    lastMouseX = Math.round(((e.clientX - rect.left) / currentZoom) / GRID) * GRID;
    lastMouseY = Math.round(((e.clientY - rect.top) / currentZoom) / GRID) * GRID;

    if (!isSelecting || !selectionBox) return;

    const currentX = (e.clientX - rect.left) / currentZoom;
    const currentY = (e.clientY - rect.top) / currentZoom;

    const left = Math.min(selectionStart.x, currentX);
    const top = Math.min(selectionStart.y, currentY);
    const width = Math.abs(selectionStart.x - currentX);
    const height = Math.abs(selectionStart.y - currentY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    // Visual feedback: select items while dragging
    const items = document.querySelectorAll('.draggable-item');
    items.forEach(el => {
        const itemX = parseFloat(el.dataset.x);
        const itemY = parseFloat(el.dataset.y);
        const itemW = el.offsetWidth;
        const itemH = el.offsetHeight;

        const isColliding = (
            itemX < left + width &&
            itemX + itemW > left &&
            itemY < top + height &&
            itemY + itemH > top
        );

        if (isColliding) {
            el.classList.add('selected');
        } else {
            // Only remove if it wasn't selected before this drag started 
            // (Simple version: just toggle based on current collision)
            el.classList.remove('selected');
        }
    });
});

window.addEventListener('mouseup', () => {
    if (isSelecting) {
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
        isSelecting = false;

        // Finalize selectedItems array
        selectedItems = Array.from(document.querySelectorAll('.draggable-item.selected')).map(el => el.id);
        updatePropertySidebar();
    }
});

function addItem(type, color, w, h, existingIdLabel = null, textAlign = 'center', startX = null, startY = null, forceId = null) {

    const id = forceId || ('item-' + Date.now());
    const idLabel = existingIdLabel || (type === 'title' ? '' : (type === 'header-pair' ? '' : (type === 'event-header' ? '' : '')));

    const div = document.createElement('div');

    div.id = id;

    let classNames = `draggable-item ${type === 'title' ? 'title-box' : 'atlet-box'}`;
    if (type === 'header-pair') classNames = 'draggable-item header-pair-box';
    if (type === 'event-header') classNames = 'draggable-item event-header-box';
    if (type === 'winner-table') classNames = 'draggable-item winner-table-box';
    div.className = classNames;

    // Save state BEFORE adding to capture baseline if first item, 
    // but better save AFTER to capture the new item.
    saveState();

    const posX = startX !== null ? startX : lastMouseX;
    const posY = startY !== null ? startY : lastMouseY;

    div.style.width = `${w}px`; div.style.height = `${h}px`;

    div.style.transform = `translate(${posX}px, ${posY}px)`;

    div.dataset.x = posX; div.dataset.y = posY;
    div.dataset.idLabel = idLabel;

    let contentHTML = '';
    if (type === 'title') {
        contentHTML = '<textarea class="title-input" placeholder="JUDUL..."></textarea>';
    } else if (type === 'header-pair') {
        contentHTML = `
            <textarea class="header-input" placeholder="JUDUL KELAS..."></textarea>
            <div class="header-divider"></div>
            <textarea class="header-input" placeholder="NAMA EVENT..."></textarea>
        `;
    } else if (type === 'atlet-score') {
        contentHTML = `
            <div class="indicator ${color}"></div>
            <textarea class="name-input" placeholder="NAMA ATLET" style="padding-left: 40px"></textarea>
            <div class="score-divider"></div>
            <textarea class="score-input" placeholder="0" style="color: ${color === 'red' ? '#ef4444' : '#3b82f6'}"></textarea>
        `;
    } else if (type === 'event-header') {
        contentHTML = `
            <div class="eh-container">
                <div class="eh-col eh-main">
                    <input class="eh-input eh-input-large" placeholder="NAMA KELAS PERTANDINGAN">
                    <div class="eh-divider-h"></div>
                    <input class="eh-input" placeholder="NAMA EVENT">
                </div>
                <div class="eh-col eh-date">
                    <input class="eh-input" placeholder="TANGGAL">
                    <div class="eh-divider-h"></div>
                    <input class="eh-input" placeholder="JAM MULAI - SELESAI">
                </div>
                <div class="eh-col eh-small">
                    <div class="eh-label">TATAMI</div>
                    <input class="eh-input text-center" placeholder="0">
                </div>
                <div class="eh-col eh-small">
                    <div class="eh-label">POOL</div>
                    <input class="eh-input text-center" placeholder="X">
                </div>
            </div>
        `;
    } else if (type === 'winner-table') {
        const rowsHTML = ['1', '2', '3', '3'].map((rank, i) => `
            <div class="wt-row">
                <div class="wt-col wt-col-rank"><input class="wt-input wt-input-rank" value="${rank}"></div>
                <div class="wt-col wt-col-name"><textarea class="wt-input" placeholder="NAMA Pemenang"></textarea></div>
                <div class="wt-col wt-col-team"><textarea class="wt-input" placeholder="KONTINGEN"></textarea></div>
            </div>
        `).join('');
        contentHTML = `
            <div class="wt-container">
                <div class="wt-row wt-header">
                    <div class="wt-col wt-col-rank">JUARA</div>
                    <div class="wt-col wt-col-name">NAMA</div>
                    <div class="wt-col wt-col-team">KONTINGEN</div>
                </div>
                ${rowsHTML}
            </div>
        `;
    } else {
        contentHTML = `<div class="indicator ${color}"></div><textarea class="name-input" placeholder="NAMA ATLET" style="padding-left: 40px"></textarea>`;
    }

    div.innerHTML = `
        <div class="move-handle">⠿</div>
        ${contentHTML}
        <div class="resize-handle"></div>
        ${(type !== 'header-pair' && type !== 'title' && type !== 'event-header') ? `
            <div class="conn-dot dot-left" onclick="handleDotClick('${id}', 'left')"></div>
            <div class="conn-dot dot-right" onclick="handleDotClick('${id}', 'right')"></div>
        ` : ''
        }
        `;

    // Apply text alignment to inputs/textareas
    const inputs = div.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.style.textAlign = textAlign;
    });

    div.addEventListener('click', (e) => {
        const isAction = e.target.closest('.box-actions') || e.target.closest('.conn-dot');
        if (isAction) return;

        // If clicking on input/textarea, only select if NOT already selected
        // This allows user to focus text on 2nd click, but first click selects the box
        if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && div.classList.contains('selected')) {
            return;
        }

        // Toggle selection
        div.classList.toggle('selected');

        if (div.classList.contains('selected')) {
            selectedItems.push(id);
        } else {
            selectedItems = selectedItems.filter(item => item !== id);
        }

        updatePropertySidebar();
    });



    document.getElementById('canvas').appendChild(div);

    initInteract(div);

    drawLines();

}



function toggleBorder(id) { document.getElementById(id).classList.toggle('has-border'); }



function toggleAlignMenu(id, e) {

    e.stopPropagation();

    document.querySelectorAll('.align-dropdown').forEach(menu => menu.classList.remove('show'));

    const menu = document.getElementById(`align - menu - ${id} `);

    menu.classList.toggle('show');

}



function alignSingleItem(id, type, e) {

    e.stopPropagation();

    const el = document.getElementById(id);

    const input = el.querySelector('input, textarea');

    if (input) {

        input.style.width = '100%';

        if (type === 'left') { input.style.textAlign = 'left'; input.style.paddingLeft = '40px'; }

        else if (type === 'center-h') { input.style.textAlign = 'center'; input.style.paddingLeft = '10px'; }

        else if (type === 'right') { input.style.textAlign = 'right'; input.style.paddingRight = '24px'; }

        if (type === 'top') { el.style.alignItems = 'flex-start'; }

        else if (type === 'center-v') { el.style.alignItems = 'center'; }

        else if (type === 'bottom') { el.style.alignItems = 'flex-end'; }

    }

    document.getElementById(`align - menu - ${id} `).classList.remove('show');

}



function handleDotClick(boxId, side) {

    const dotEl = document.querySelector(`#${boxId} .dot-${side}`);

    if (!sourceDotId) {
        sourceDotId = { boxId, side };
        if (dotEl) dotEl.classList.add('dot-active');
    } else {
        if (sourceDotId.boxId !== boxId) {
            connections.push({ from: sourceDotId.boxId, fromSide: sourceDotId.side, to: boxId, toSide: side, color: activeStroke });
            saveState(); // Record connection creation
        }
        document.querySelectorAll('.conn-dot').forEach(d => d.classList.remove('dot-active'));
        sourceDotId = null;
        drawLines();
    }

}



function duplicateItem(id) {
    const original = document.getElementById(id);
    if (!original) return;

    let type = 'atlet';
    if (original.classList.contains('title-box')) type = 'title';
    else if (original.classList.contains('header-pair-box')) type = 'header-pair';
    else if (original.querySelector('.score-input')) type = 'atlet-score';

    const color = original.querySelector('.indicator')?.classList[1] || 'neutral';

    addItem(type, color, original.offsetWidth, original.offsetHeight);

    // Copy values and styles from original to the newly added item (last child of canvas)
    const newItem = document.getElementById('canvas').lastElementChild;
    if (newItem) {
        // Offset slightly from original if possible
        const origX = parseFloat(original.dataset.x) || 0;
        const origY = parseFloat(original.dataset.y) || 0;
        const newX = origX + 20;
        const newY = origY + 20;

        newItem.style.transform = `translate(${newX}px, ${newY}px)`;
        newItem.dataset.x = newX;
        newItem.dataset.y = newY;
        drawLines();
        // Copy text values
        const oldTextareas = original.querySelectorAll('textarea');
        const newTextareas = newItem.querySelectorAll('textarea');
        oldTextareas.forEach((ta, i) => {
            if (newTextareas[i]) {
                newTextareas[i].value = ta.value;
                // Copy styling
                newTextareas[i].style.textAlign = ta.style.textAlign;
                newTextareas[i].style.paddingLeft = ta.style.paddingLeft;
                newTextareas[i].style.paddingRight = ta.style.paddingRight;
            }
        });

        // Copy idLabel exact (no suffix)
        const oldId = original.dataset.idLabel || "";
        if (oldId) {
            newItem.dataset.idLabel = oldId;
        }

        // Copy container styling
        newItem.style.alignItems = original.style.alignItems;
    }
    saveState();
}

function duplicateSelected() {
    if (selectedItems.length === 0) {
        alert("Pilih satu atau lebih kotak terlebih dahulu!");
        return;
    }

    const idsToDuplicate = [...selectedItems];
    clearSelection();

    idsToDuplicate.forEach(id => {
        duplicateItem(id);
        // The new item is at lastMouseX/Y. If we want them offset from each other, 
        // we might need to adjust their transform, but addItem uses lastMouseX/Y
    });

    alert(`✅ ${idsToDuplicate.length} item berhasil diduplikasi ke posisi kursor.`);
}



function deleteItem(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    connections = connections.filter(c => c.from !== id && c.to !== id);
    selectedItems = selectedItems.filter(item => item !== id);
    drawLines();
    saveState();
}



function initInteract(el) {
    interact(el).draggable({
        modifiers: [interact.modifiers.snap({ targets: [interact.snappers.grid({ x: GRID, y: GRID })] })],
        listeners: {
            move(event) {
                const t = event.target;
                const tid = t.id;

                let itemsToMove = [];
                if (selectedItems.includes(tid) && selectedItems.length > 1) {
                    itemsToMove = selectedItems;
                } else if (isSyncMoveEnabled) {
                    itemsToMove = getConnectedChain(tid);
                } else {
                    itemsToMove = [tid];
                }

                itemsToMove.forEach(id => {
                    const selEl = document.getElementById(id);
                    if (selEl) {
                        const x = Math.round(((parseFloat(selEl.dataset.x) || 0) + (event.dx / currentZoom)) / GRID) * GRID;
                        const y = Math.round(((parseFloat(selEl.dataset.y) || 0) + (event.dy / currentZoom)) / GRID) * GRID;
                        selEl.style.transform = `translate(${x}px, ${y}px)`;
                        selEl.dataset.x = x;
                        selEl.dataset.y = y;
                    }
                });

                // --- MAGNET / SNAP TO ELEMENT ---
                if (selectedItems.length <= 1 && !isSyncMoveEnabled) { // Only show guides for single non-sync drag
                    updateAlignmentGuides(t);
                }

                drawLines();
            }
        },
        onend: (event) => {
            document.getElementById('guide-lines').innerHTML = '';
            saveState();
        }
    }).resizable({
        allowFrom: '.resize-handle',
        edges: { right: true, bottom: true },
        modifiers: [interact.modifiers.snapSize({ targets: [interact.snappers.grid({ x: GRID, y: GRID })] })],
        listeners: {
            move(event) {
                const t = event.target;
                const tid = t.id;
                const w = Math.round((event.rect.width / currentZoom) / GRID) * GRID;
                const h = Math.round((event.rect.height / currentZoom) / GRID) * GRID;

                let itemsToResize = [];
                if (isSyncResizeEnabled) {
                    itemsToResize = getConnectedChain(tid);
                } else {
                    itemsToResize = [tid];
                }

                itemsToResize.forEach(id => {
                    const selEl = document.getElementById(id);
                    if (selEl) {
                        selEl.style.width = `${w}px`;
                        selEl.style.height = `${h}px`;
                    }
                });

                drawLines();
            }
        },
        onend: () => saveState()
    });

}



function drawLines(isPrinting = false) {
    const svg = document.getElementById('line-canvas');
    if (!svg) return;
    svg.innerHTML = '';

    connections.forEach(c => {
        const f = document.getElementById(c.from);
        const t = document.getElementById(c.to);

        if (!f || !t) return;

        // Logical coordinates (immune to zoom/CSS scale)
        const fx = parseFloat(f.dataset.x) || 0;
        const fy = parseFloat(f.dataset.y) || 0;
        const tx = parseFloat(t.dataset.x) || 0;
        const ty = parseFloat(t.dataset.y) || 0;
        const fw = f.offsetWidth;
        const fh = f.offsetHeight;
        const tw = t.offsetWidth;
        const th = t.offsetHeight;

        const x1 = (c.fromSide === 'left' ? fx : fx + fw);
        const y1 = fy + fh / 2;
        const x2 = (c.toSide === 'left' ? tx : tx + tw);
        const y2 = ty + th / 2;

        // --- U-SHAPE CONNECTOR LOGIC (Fixed Step-Out) ---
        const stepOut = 30; // Jarak horizontal sebelum membelok siku
        let midX;

        if (c.fromSide === 'right' && c.toSide === 'left') {
            // Standar: Dari kanan ke kiri (Bracket flow)
            midX = x1 + stepOut;
        } else if (c.fromSide === 'left' && c.toSide === 'right') {
            // Reverse flow
            midX = x1 - stepOut;
        } else if (c.fromSide === c.toSide) {
            // Sama sisi (loopback/fork)
            const offset = 40;
            midX = c.fromSide === 'right' ? Math.max(x1, x2) + offset : Math.min(x1, x2) - offset;
        } else {
            // Default midpoint
            midX = x1 + (x2 - x1) / 2;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Pola: M(start) -> L(step-out) -> L(vertical spine) -> L(end)
        const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2} `;

        path.setAttribute('d', d);
        path.setAttribute('stroke', isPrinting ? 'black' : c.color);
        path.setAttribute('stroke-width', '3'); // Tebalkan sedikit tapi elegan
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-linecap', 'round');

        // Ensure it shows up in print
        path.style.vectorEffect = 'non-scaling-stroke';
        svg.appendChild(path);
    });
}

function printDesignedBracket() {
    const items = document.querySelectorAll('.draggable-item');
    if (items.length === 0) {
        window.print();
        return;
    }

    // 1. Cari Bounding Box + Connection Lines + Padding
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    items.forEach(el => {
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
    });

    // Include garis koneksi yang extend keluar
    connections.forEach(c => {
        const f = document.getElementById(c.from);
        const t = document.getElementById(c.to);
        if (!f || !t) return;

        const fx = parseFloat(f.dataset.x) || 0;
        const fy = parseFloat(f.dataset.y) || 0;
        const tx_node = parseFloat(t.dataset.x) || 0;
        const ty_node = parseFloat(t.dataset.y) || 0;
        const fw = f.offsetWidth;
        const fh = f.offsetHeight;
        const tw = t.offsetWidth;
        const th = t.offsetHeight;

        const x1 = (c.fromSide === 'left' ? fx : fx + fw);
        const y1 = fy + fh / 2;
        const x2 = (c.toSide === 'left' ? tx_node : tx_node + tw);
        const y2 = ty_node + th / 2;

        let midX;
        if (c.fromSide === c.toSide) {
            const offset = 40;
            midX = c.fromSide === 'right' ? Math.max(x1, x2) + offset : Math.min(x1, x2) - offset;
        } else {
            midX = x1 + (x2 - x1) / 2;
        }

        minX = Math.min(minX, x1, x2, midX);
        minY = Math.min(minY, y1, y2);
        maxX = Math.max(maxX, x1, x2, midX);
        maxY = Math.max(maxY, y1, y2);
    });

    // Padding seimbang (v17 - Anti Blank)
    const padding = 20;
    const designW = (maxX - minX) + (padding * 2);
    const designH = (maxY - minY) + (padding * 2);

    if (designW <= 20 || designH <= 20 || isNaN(designW) || isNaN(designH)) {
        window.print();
        return;
    }

    // 2. Kertas Legal Landscape
    const paperW = 1344;
    const paperH = 816;

    // Margin keamanan Seimbang (v17) - Memberikan ruang ekstra vertikal (0.93)
    const availableW = paperW * 0.96;
    const availableH = paperH * 0.93;

    // 3. Hitung Rasio Skala
    const scaleW = availableW / designW;
    const scaleH = availableH / designH;

    // Gunakan rasio terkecil agar PAS di 1 halaman
    const finalScale = Math.min(scaleW, scaleH);

    // 4. Hitung Offset - Rata Tengah Presisi
    const actualW = designW * finalScale;
    const actualH = designH * finalScale;

    const marginLeft = (paperW - actualW) / 2;
    const marginTop = (paperH - actualH) / 2;

    const tx = (marginLeft / finalScale) - minX;
    const ty = (marginTop / finalScale) - minY;

    // 5. Terapkan Transformasi and Paksa Ukuran Canvas
    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('canvas');
    const svg = document.getElementById('line-canvas');

    const originalTransform = canvas.style.transform;
    const originalTransformOrigin = canvas.style.transformOrigin;
    const originalContainerOverflow = container.style.overflow;
    const originalW = canvas.style.width;
    const originalH = canvas.style.height;

    // PAKSA ukuran canvas agar elemen absolute tidak terpotong (!important)
    canvas.style.setProperty('width', (maxX + padding) + 'px', 'important');
    canvas.style.setProperty('height', (maxY + padding) + 'px', 'important');

    if (svg) {
        svg.style.setProperty('width', '100%', 'important');
        svg.style.setProperty('height', '100%', 'important');
    }

    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `scale(${finalScale}) translate(${tx}px, ${ty}px)`;
    container.style.overflow = 'visible';
    document.body.classList.add('is-printing');

    // 6. Eksekusi Print
    setTimeout(() => {
        drawLines(true); // Force black strokes for print
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                canvas.style.transform = originalTransform;
                canvas.style.transformOrigin = originalTransformOrigin;
                container.style.overflow = originalContainerOverflow;
                canvas.style.setProperty('width', originalW);
                canvas.style.setProperty('height', originalH);
                document.body.classList.remove('is-printing');
                drawLines();
            }, 1000);
        }, 1500); // Tunggu sampai render stabil
    }, 1000);
}

function clearCanvas() {
    if (confirm('Bersihkan semua item?')) {
        // Simpan state sebelum dihapus agar bisa Undo
        saveState();

        document.getElementById('canvas').innerHTML = '<svg id="line-canvas"></svg>';
        activeTemplateId = null;
        updateTemplateStatusUI(null);
        drawLines();

        // Simpan state sesudah dihapus
        saveState();
        alert('🎨 Canvas dibersihkan!');
    }
}

// KEYBOARD NAVIGATION (ARROW KEYS) & SHORTCUTS
window.addEventListener('keydown', (e) => {
    // Intercept Ctrl+P to use optimized print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        printDesignedBracket();
        return;
    }

    // --- UNDO / REDO ---
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
    }

    // --- DELETE ITEM ---
    if (e.key === 'Delete') {
        // Jangan hapus jika sedang mengetik
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;

        if (selectedItems.length > 0) {
            if (confirm(`Hapus ${selectedItems.length} item yang dipilih?`)) {
                selectedItems.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.remove();
                    connections = connections.filter(c => c.from !== id && c.to !== id);
                });
                selectedItems = [];
                drawLines();
                saveState();
            }
        }
        return;
    }

    if (selectedItems.length === 0) return;

    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrows.includes(e.key)) {
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;

        e.preventDefault();

        // SHIFT for larger nudge (10px baseline vs GRID)
        const step = e.shiftKey ? GRID * 5 : GRID;

        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;

        selectedItems.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const x = (parseFloat(el.dataset.x) || 0) + dx;
                const y = (parseFloat(el.dataset.y) || 0) + dy;
                el.style.transform = `translate(${x}px, ${y}px)`;
                el.dataset.x = x;
                el.dataset.y = y;
            }
        });

        drawLines();
        saveState(); // Record nudge movement
    }
});

drawLines();

// --- CONTEXT MENU LOGIC ---
let contextMenuTargetId = null;
const contextMenu = document.getElementById('contextMenu');

window.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.draggable-item');
    if (item) {
        e.preventDefault();
        contextMenuTargetId = item.id;

        // Update menu icon based on current state
        const lockIcon = document.getElementById('menuLockIcon');
        if (lockIcon) {
            lockIcon.textContent = item.classList.contains('is-locked') ? '🔓' : '🔒';
        }

        // Position menu
        contextMenu.style.display = 'block';

        // Ensure menu stays within viewport
        let posX = e.clientX;
        let posY = e.clientY;

        if (posX + contextMenu.offsetWidth > window.innerWidth) posX -= contextMenu.offsetWidth;
        if (posY + contextMenu.offsetHeight > window.innerHeight) posY -= contextMenu.offsetHeight;

        contextMenu.style.left = `${posX}px`;
        contextMenu.style.top = `${posY}px`;
    } else {
        contextMenu.style.display = 'none';
        contextMenuTargetId = null;
    }
});

window.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
        contextMenu.style.display = 'none';
    }
});

function menuAction(action) {
    if (!contextMenuTargetId) return;
    const id = contextMenuTargetId;
    contextMenu.style.display = 'none';

    if (action === 'duplicate') {
        duplicateItem(id);
    } else if (action === 'delete') {
        deleteItem(id);
    } else if (action === 'lock') {
        toggleBoxLock(id);
    } else if (action.startsWith('color-')) {
        const color = action.replace('color-', '');
        // Apply to selection if target is part of it, otherwise just target
        const targets = selectedItems.includes(id) ? selectedItems : [id];
        targets.forEach(tid => {
            const el = document.getElementById(tid);
            if (!el) return;
            const ind = el.querySelector('.indicator');
            if (ind) {
                ind.className = `indicator ${color}`;
                // Also update score color if it exists
                const scoreInput = el.querySelector('.score-input');
                if (scoreInput) {
                    scoreInput.style.color = (color === 'red') ? '#ef4444' : (color === 'blue' ? '#3b82f6' : '#000');
                }
            }
        });
    } else if (action === 'front') {
        const el = document.getElementById(id);
        if (el) {
            // Get highest z-index on canvas
            const items = document.querySelectorAll('.draggable-item');
            let maxZ = 10;
            items.forEach(item => {
                const z = parseInt(window.getComputedStyle(item).zIndex) || 0;
                if (z > maxZ) maxZ = z;
            });
            el.style.zIndex = maxZ + 1;
        }
    } else if (action === 'back') {
        const el = document.getElementById(id);
        if (el) {
            const items = document.querySelectorAll('.draggable-item');
            let minZ = 10;
            items.forEach(item => {
                const z = parseInt(window.getComputedStyle(item).zIndex) || 0;
                if (z < minZ) minZ = z;
            });
            el.style.zIndex = Math.max(1, minZ - 1);
        }
    }

    saveState();
}



// --- PROPERTY SIDEBAR LOGIC ---
function updatePropertySidebar() {
    const sidebar = document.getElementById('propertySidebar');
    if (selectedItems.length === 0) {
        sidebar.classList.remove('show');
        return;
    }

    sidebar.classList.add('show');

    // Use first selected item as reference
    const el = document.getElementById(selectedItems[0]);
    if (!el) return;

    // Sync ID Label
    const idInput = document.getElementById('propIdLabel');
    if (idInput) idInput.value = el.dataset.idLabel || "";

    // Sync Alignment Buttons Visual State
    const input = el.querySelector('input, textarea');
    const textAlign = (input && input.style.textAlign) ? input.style.textAlign : 'center';
    const alignItems = el.style.alignItems || 'center';

    document.querySelectorAll('.prop-btn').forEach(btn => btn.classList.remove('active'));

    const alignBtn = document.getElementById('align-' + textAlign);
    if (alignBtn) alignBtn.classList.add('active');

    const vAlign = alignItems === 'flex-start' ? 'top' : (alignItems === 'flex-end' ? 'bottom' : 'middle');
    const vAlignBtn = document.getElementById('align-' + vAlign);
    if (vAlignBtn) vAlignBtn.classList.add('active');

    // Sync Border Button
    const borderBtn = document.getElementById('propBorderBtn');
    if (borderBtn) {
        const hasBorder = el.classList.contains('has-border');
        borderBtn.textContent = hasBorder ? 'Sembunyikan Border' : 'Tampilkan Border';
        borderBtn.classList.toggle('active', hasBorder);
    }

    // Sync Toggles (Relasi)
    const syncMoveBtn = document.getElementById('syncMoveBtn');
    const syncResizeBtn = document.getElementById('syncResizeBtn');
    if (syncMoveBtn) syncMoveBtn.classList.toggle('active', isSyncMoveEnabled);
    if (syncResizeBtn) syncResizeBtn.classList.toggle('active', isSyncResizeEnabled);
}

function toggleSync(type) {
    if (type === 'move') isSyncMoveEnabled = !isSyncMoveEnabled;
    if (type === 'resize') isSyncResizeEnabled = !isSyncResizeEnabled;
    updatePropertySidebar();
}

function closePropertySidebar() {
    document.getElementById('propertySidebar').classList.remove('show');
}

function updateProp(key, value) {
    if (selectedItems.length === 0) return;

    selectedItems.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (key === 'idLabel') {
            el.dataset.idLabel = value;
            const badgeInput = el.querySelector('.id-badge-input');
            if (badgeInput) badgeInput.value = value;
        } else if (key === 'textAlign') {
            const input = el.querySelector('input, textarea');
            if (input) {
                input.style.textAlign = value;
                if (value === 'left') input.style.paddingLeft = '40px';
                else if (value === 'right') input.style.paddingRight = '10px';
                else input.style.paddingLeft = '10px';
            }
        } else if (key === 'alignItems') {
            el.style.alignItems = value;
        } else if (key === 'border') {
            el.classList.toggle('has-border');
        } else if (key === 'color') {
            const ind = el.querySelector('.indicator');
            if (ind) {
                ind.className = `indicator ${value}`;
                const scoreInput = el.querySelector('.score-input');
                if (scoreInput) {
                    scoreInput.style.color = (value === 'red') ? '#ef4444' : (value === 'blue' ? '#3b82f6' : '#000');
                }
            }
        }
    });

    updatePropertySidebar();
    saveState();
}

// --- RECOVERY SYSTEM LOGIC ---
function checkRecovery() {
    const backup = localStorage.getItem('kensho_builder_backup');
    if (backup) {
        document.getElementById('recoveryModal').classList.add('show');
    }
}

function applyRecovery() {
    const backup = localStorage.getItem('kensho_builder_backup');
    if (backup) {
        try {
            applyState(backup);
            document.getElementById('recoveryModal').classList.remove('show');
            alert("✅ Desain berhasil dipulihkan!");
            saveState();
        } catch (e) {
            console.error("Recovery failed", e);
            alert("❌ Gagal memulihkan desain.");
        }
    }
}

function restoreItemFromBackup(item) {
    const div = document.createElement('div');
    const id = item.id;
    div.id = id;
    let classNames = `draggable-item ${item.type === 'title' ? 'title-box' : 'atlet-box'}`;
    if (item.type === 'pair') classNames = 'draggable-item header-pair-box';
    if (item.type === 'event-header') classNames = 'draggable-item event-header-box';
    if (item.type === 'image') classNames = 'draggable-item image-box';
    div.className = classNames;

    if (item.hasBorder) div.classList.add('has-border');

    div.style.width = item.width;
    div.style.height = item.height;
    div.style.transform = `translate(${item.x}px, ${item.y}px)`;
    div.style.alignItems = item.alignItems || 'center';
    div.dataset.x = item.x;
    div.dataset.y = item.y;
    div.dataset.idLabel = item.idLabel || "";

    const connDots = (item.type !== 'pair' && item.type !== 'title' && item.type !== 'event-header' && item.type !== 'image') ? `
            <div class="conn-dot dot-left" onclick="handleDotClick('${id}', 'left')"></div>
            <div class="conn-dot dot-right" onclick="handleDotClick('${id}', 'right')"></div>
        ` : '';

    div.innerHTML = `
        <div class="move-handle">⠿</div>
        ${connDots}
        <div class="resize-handle"></div>
    `;

    // Reconstruct internal content based on type
    if (item.type === 'atlet') {
        const ind = document.createElement('div');
        ind.className = `indicator ${item.color}`;
        div.appendChild(ind);
        const nameInput = document.createElement('textarea');
        nameInput.className = 'name-input';
        nameInput.value = item.text;
        nameInput.style.textAlign = item.textAlign || 'center';
        nameInput.style.paddingLeft = '40px';
        div.appendChild(nameInput);
    } else if (item.type === 'atlet-score') {
        const texts = (item.text || "").split('|');
        const ind = document.createElement('div');
        ind.className = `indicator ${item.color}`;
        div.appendChild(ind);
        const nameInput = document.createElement('textarea');
        nameInput.className = 'name-input';
        nameInput.value = texts[0] || "";
        nameInput.style.textAlign = item.textAlign || 'center';
        nameInput.style.paddingLeft = '40px';
        const divider = document.createElement('div');
        divider.className = 'score-divider';
        const scoreInput = document.createElement('textarea');
        scoreInput.className = 'score-input';
        scoreInput.value = texts[1] || "";
        scoreInput.style.color = item.color === 'red' ? '#ef4444' : '#3b82f6';
        div.appendChild(nameInput);
        div.appendChild(divider);
        div.appendChild(scoreInput);
    } else if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.imageSrc;
        img.style.width = '1000%'; // Stretch to fit resizeable box but object-fit will contain it
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none';
        div.appendChild(img);
    } else {
        const field = document.createElement(item.type === 'title' ? 'input' : 'textarea');
        field.className = item.type === 'title' ? 'title-input' : 'name-input';
        field.value = item.text;
        field.style.textAlign = item.textAlign || 'center';
        div.appendChild(field);
    }

    if (item.isLocked) {
        div.classList.add('is-locked');
        const lockInd = document.createElement('div');
        lockInd.className = 'lock-indicator';
        lockInd.innerHTML = '🔒';
        div.appendChild(lockInd);
    }

    document.getElementById('canvas').appendChild(div);
    initInteract(div);
}

function discardRecovery() {
    if (confirm("Apakah Anda yakin ingin menghapus data cadangan ini?")) {
        localStorage.removeItem('kensho_builder_backup');
        localStorage.removeItem('kensho_builder_backup_time');
        document.getElementById('recoveryModal').classList.remove('show');
    }
}

// Start checking on load
window.addEventListener('load', checkRecovery);

// --- KEYBOARD SHORTCUTS ---
window.addEventListener('keydown', (e) => {
    const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    if (isInput) return; // Don't trigger shortcuts when typing

    if (e.code === 'Space') {
        e.preventDefault();
        if (!isPanning) {
            isPanning = true;
            document.body.style.cursor = 'grab';
        }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItems.length > 0) {
            if (confirm(`Hapus ${selectedItems.length} elemen terpilih?`)) {
                selectedItems.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.remove();
                });
                selectedItems = [];
                drawLines();
                saveState();
            }
        }
    }

    if (e.key.startsWith('Arrow')) {
        if (selectedItems.length > 0) {
            e.preventDefault();
            const moveAmount = e.shiftKey ? 20 : 2;
            selectedItems.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    let lx = parseFloat(el.dataset.x) || 0;
                    let ly = parseFloat(el.dataset.y) || 0;
                    if (e.key === 'ArrowLeft') lx -= moveAmount;
                    if (e.key === 'ArrowRight') lx += moveAmount;
                    if (e.key === 'ArrowUp') ly -= moveAmount;
                    if (e.key === 'ArrowDown') ly += moveAmount;
                    el.style.transform = `translate(${lx}px, ${ly}px)`;
                    el.dataset.x = lx;
                    el.dataset.y = ly;
                }
            });
            drawLines();
        }
    }

    // Ctrl + D (Duplicate)
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (selectedItems.length > 0) {
            const itemsToDup = [...selectedItems];
            itemsToDup.forEach(id => {
                const el = document.getElementById(id);
                if (el) duplicateItem(id);
            });
            saveState();
        }
    }
});

const SNAP_THRESHOLD = 5;

function updateAlignmentGuides(target) {
    const guideContainer = document.getElementById('guide-lines');
    guideContainer.innerHTML = '';

    const targetRect = {
        left: parseFloat(target.dataset.x),
        top: parseFloat(target.dataset.y),
        right: parseFloat(target.dataset.x) + target.offsetWidth,
        bottom: parseFloat(target.dataset.y) + target.offsetHeight,
        centerX: parseFloat(target.dataset.x) + target.offsetWidth / 2,
        centerY: parseFloat(target.dataset.y) + target.offsetHeight / 2
    };

    let snappedX = null;
    let snappedY = null;

    document.querySelectorAll('.draggable-item').forEach(other => {
        if (other === target) return;

        const otherRect = {
            left: parseFloat(other.dataset.x),
            top: parseFloat(other.dataset.y),
            right: parseFloat(other.dataset.x) + other.offsetWidth,
            bottom: parseFloat(other.dataset.y) + other.offsetHeight,
            centerX: parseFloat(other.dataset.x) + other.offsetWidth / 2,
            centerY: parseFloat(other.dataset.y) + other.offsetHeight / 2
        };

        // Vertical Guides (Snap X)
        const vMatches = [
            { t: 'left', o: 'left' }, { t: 'left', o: 'right' },
            { t: 'right', o: 'left' }, { t: 'right', o: 'right' },
            { t: 'centerX', o: 'centerX' }
        ];

        vMatches.forEach(m => {
            if (Math.abs(targetRect[m.t] - otherRect[m.o]) < SNAP_THRESHOLD) {
                let delta = otherRect[m.o] - targetRect[m.t];
                snappedX = parseFloat(target.dataset.x) + delta;
                showGuide(otherRect[m.o], 'v');
            }
        });

        // Horizontal Guides (Snap Y)
        const hMatches = [
            { t: 'top', o: 'top' }, { t: 'top', o: 'bottom' },
            { t: 'bottom', o: 'top' }, { t: 'bottom', o: 'bottom' },
            { t: 'centerY', o: 'centerY' }
        ];

        hMatches.forEach(m => {
            if (Math.abs(targetRect[m.t] - otherRect[m.o]) < SNAP_THRESHOLD) {
                let delta = otherRect[m.o] - targetRect[m.t];
                snappedY = parseFloat(target.dataset.y) + delta;
                showGuide(otherRect[m.o], 'h');
            }
        });
    });

    if (snappedX !== null) {
        target.dataset.x = snappedX;
        target.style.transform = `translate(${snappedX}px, ${parseFloat(target.dataset.y)}px)`;
    }
    if (snappedY !== null) {
        target.dataset.y = snappedY;
        target.style.transform = `translate(${parseFloat(target.dataset.x)}px, ${snappedY}px)`;
    }
}

function showGuide(coord, orientation) {
    const guideContainer = document.getElementById('guide-lines');
    const line = document.createElement('div');
    line.className = `guide-line ${orientation}-line`;
    if (orientation === 'v') {
        line.style.left = coord + 'px';
    } else {
        line.style.top = coord + 'px';
    }
    guideContainer.appendChild(line);
}

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isPanning = false;
        document.body.style.cursor = 'default';
    }
});

if (canvasContainer) {
    canvasContainer.addEventListener('mousedown', (e) => {
        if (isPanning) {
            startPanX = e.clientX - canvasOffsetX;
            startPanY = e.clientY - canvasOffsetY;
            document.body.style.cursor = 'grabbing';
        }
    });
}

window.addEventListener('mousemove', (e) => {
    if (isPanning && e.buttons === 1) {
        canvasOffsetX = e.clientX - startPanX;
        canvasOffsetY = e.clientY - startPanY;
        const canvas = document.getElementById('canvas');
        canvas.style.transform = `scale(${currentZoom}) translate(${canvasOffsetX}px, ${canvasOffsetY}px)`;
    }
});

window.addEventListener('mouseup', () => {
    if (isPanning) document.body.style.cursor = 'grab';
});

function changeZoom(delta) {
    currentZoom = Math.min(Math.max(0.1, currentZoom + delta), 3);
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.transform = `scale(${currentZoom}) translate(${canvasOffsetX}px, ${canvasOffsetY}px)`;
    }
    const zoomVal = document.getElementById('zoomText');
    if (zoomVal) zoomVal.textContent = Math.round(currentZoom * 100) + '%';
    drawLines();
}

// --- IMAGE UPLOAD LOGIC ---
function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const imgSrc = e.target.result;
            // Create a new image box
            const id = 'img_' + Date.now();
            const div = document.createElement('div');
            div.id = id;
            div.className = 'draggable-item image-box';
            div.style.width = '150px';
            div.style.height = '100px';
            div.style.transform = `translate(200px, 100px)`;
            div.dataset.x = 200;
            div.dataset.y = 100;

            div.innerHTML = `
                <div class="move-handle">⠿</div>
                <img src="${imgSrc}" style="width:100%; height:100%; object-fit:contain; pointer-events:none;">
                <div class="resize-handle"></div>
            `;

            document.getElementById('canvas').appendChild(div);
            initInteract(div);
            saveState();
            input.value = ''; // Reset input
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- GENERATOR LOGIC ---
function openGeneratorModal() {
    document.getElementById('generatorModal').classList.add('show');
}
function closeGeneratorModal() {
    document.getElementById('generatorModal').classList.remove('show');
}

function confirmGenerate() {
    const count = parseInt(document.getElementById('genCount').value);
    if (!confirm(`Generate bracket untuk ${count} peserta? Canvas saat ini akan dihapus.`)) return;

    // Reset Canvas
    document.getElementById('canvas').querySelectorAll('.draggable-item').forEach(el => el.remove());
    connections = [];
    activeTemplateId = null;
    updateTemplateStatusUI(null);

    const startX = 100;
    const startY = 100;
    const boxWidth = 160;
    const boxHeight = 50;
    const verticalGap = 40;
    const horizontalGap = 100;

    let currentRoundItems = [];
    let itemsInRound = count;
    let roundNum = 1;

    const getPrefix = (num) => {
        if (num === 1) return "WINNER";
        if (num === 2) return "F";
        if (num === 4) return "SM";
        return num + "B";
    };

    // Round 1
    let prefix = getPrefix(itemsInRound);
    for (let i = 0; i < count; i++) {
        const x = startX;
        const y = startY + (i * (boxHeight + verticalGap));
        const id = `${prefix}-${(i + 1).toString().padStart(2, '0')}`;
        // Set idLabel = id
        addItem('atlet-score', 'neutral', boxWidth, boxHeight, id, 'center', x, y, id);
        currentRoundItems.push(id);
    }

    // Subsequent Rounds
    let prevRoundItems = [...currentRoundItems];
    itemsInRound /= 2;
    roundNum = 2;

    while (itemsInRound >= 1) {
        currentRoundItems = [];
        const x = startX + ((roundNum - 1) * (boxWidth + horizontalGap));
        prefix = getPrefix(itemsInRound);

        for (let i = 0; i < itemsInRound; i++) {
            const b1 = document.getElementById(prevRoundItems[i * 2]);
            const b2 = document.getElementById(prevRoundItems[i * 2 + 1]);
            const y1 = parseFloat(b1.dataset.y);
            const y2 = parseFloat(b2.dataset.y);
            const midY = (y1 + y2) / 2;

            const id = itemsInRound === 1 ? "WINNER" : `${prefix}-${(i + 1).toString().padStart(2, '0')}`;
            // Set idLabel = id
            addItem('atlet-score', 'neutral', boxWidth, boxHeight, id, 'center', x, midY, id);
            currentRoundItems.push(id);

            connections.push({ from: prevRoundItems[i * 2], fromSide: 'right', to: id, toSide: 'left', color: '#64748b' });
            connections.push({ from: prevRoundItems[i * 2 + 1], fromSide: 'right', to: id, toSide: 'left', color: '#64748b' });
        }

        prevRoundItems = [...currentRoundItems];
        itemsInRound /= 2;
        roundNum++;
    }

    closeGeneratorModal();
    drawLines();
    saveState();
}
