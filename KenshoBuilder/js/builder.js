// --- PREMIER UI ENGINE ---
const style = document.createElement('style');
style.textContent = `
    .selected-svg-node {
        stroke: #6366f1 !important;
        stroke-width: 1px !important;
        filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.4));
    }
`;
document.head.appendChild(style);

// --- KONFIGURASI FIREBASE ---
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

let activeTemplateId = null;
let connections = [];
let sourceDotId = null;
let selectedItems = [];
let selectedSVGElement = null; // --- SVG MAPPER STATE ---
let lastSVGClickCoord = null; // --- PRECISION TAGGER STATE ---
let isDraggingSVG = false; // --- DRAG STATE ---
let lastSpawnedSVGId = null; // --- SMART INCREMENT STATE ---
let itemCounter = Date.now(); // Global Counter for Absolute Uniqueness

// --- SEQUENTIAL MAPPER (WIZARD) STATE ---
let isWizardMode = false;
let wizardQueue = [];
let wizardIndex = 0;

// --- GIGA SPACE GLOBAL STANDARDS ---
const GIGA_BOX_W = 500;
const GIGA_BOX_H = 120;
const GIGA_V_GAP = 60; // BALANCED FIT: Kompak namun jelas
const GIGA_THRESHOLD = 150; // BALANCED FIT: Top-to-top (90h + 60gap)

function updateTemplateStatusUI(templateName) {
    const statusName = document.getElementById('activeTemplateName');
    const statusDot = document.getElementById('activeTemplateDot');
    const saveProgressBtn = document.getElementById('saveProgressBtn');

    if (templateName) {
        statusName.textContent = templateName;
        statusDot.style.backgroundColor = '#10b981'; // Success Green
        saveProgressBtn.disabled = false;
        saveProgressBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        statusName.textContent = 'Draft Template';
        statusDot.style.backgroundColor = '#cbd5e1'; // Slate 300
        saveProgressBtn.disabled = true;
        saveProgressBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// NAVIGATION & UNDO STATE
let currentZoom = 1;
let undoStack = [];
let redoStack = [];
const MAX_STACK_SIZE = 50;
const GRID = 20;

let isPanning = false;
let startPanX = 0, startPanY = 0;
let canvasOffsetX = 0, canvasOffsetY = 0;

function saveState() {
    const currentState = serializeCanvas();
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === currentState) return;
    undoStack.push(currentState);
    if (undoStack.length > MAX_STACK_SIZE) undoStack.shift();
    redoStack = [];
    autoSaveBackup(currentState);
}

function autoSaveBackup(state) {
    localStorage.setItem('kensho_builder_backup', state);
}

function serializeCanvas() {
    const items = [];
    document.querySelectorAll('.draggable-item').forEach(el => {
        let type = el.dataset.type || 'atlet';
        if (!type || type === 'atlet') {
            if (el.classList.contains('title-box')) type = 'title';
            else if (el.querySelector('.n-score-input')) type = 'atlet-score';
        }

        const textInputs = el.querySelectorAll('input, textarea, [contenteditable="true"]');
        const textValue = Array.from(textInputs).map(i => i.classList.contains('master-header-event-name') || i.classList.contains('master-header-title') ? i.textContent : i.value).join('|');

        items.push({
            id: el.id,
            type: type,
            x: el.dataset.x,
            y: el.dataset.y,
            width: el.style.width,
            height: el.style.height,
            text: textValue,
            imageSrc: el.querySelector('img')?.src || "",
            color: el.querySelector('.indicator')?.classList.contains('red') ? 'red' : (el.querySelector('.indicator')?.classList.contains('blue') ? 'blue' : 'neutral'),
            hasBorder: el.classList.contains('has-border'),
            textAlign: el.querySelector('input, textarea') ? el.querySelector('input, textarea').style.textAlign : 'center',
            alignItems: el.style.alignItems,
            isLocked: el.classList.contains('is-locked'),
            logicalId: el.dataset.logicalId || ""
        });
    });
    return JSON.stringify({
        items,
        connections,
        svgContent: document.getElementById('template-svg-layer')?.innerHTML || ""
    });
}

// (Remaining logic from build.js will be merged here or kept in organized chunks)
// For brevity and to ensure correctness, I will copy the essential functions now.

// --- CLOUD STORAGE FUNCTIONS (FIREBASE) ---

async function saveTemplate() {
    const templateName = prompt("Masukkan nama template baru:");
    if (!templateName) return;

    // --- ALWAYS SAVE LOCAL FALLBACK ---
    localStorage.setItem('kensho_builder_backup', state);

    try {
        const docRef = await db.collection("kensho_templates").add({
            name: templateName,
            data: state,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        activeTemplateId = docRef.id;
        updateTemplateStatusUI(templateName);
        alert("Template berhasil disimpan ke cloud! ☁️✨");
        loadTemplates(); // Refresh list
    } catch (error) {
        console.error("Error saving template:", error);
        alert("Gagal menyimpan ke cloud. Cek koneksi Anda.");
    }
}

async function saveProgress() {
    const state = serializeCanvas();
    localStorage.setItem('kensho_builder_backup', state); // Local persistence first

    if (!activeTemplateId) {
        // Fallback for when cloud isn't connected but user clicks save
        saveLocal();
        return;
    }

    try {
        await db.collection("kensho_templates").doc(activeTemplateId).update({
            data: state,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Visual feedback on button
        const btn = document.getElementById('saveProgressBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'CLOUD SAVED! ✅';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    } catch (error) {
        console.error("Error updating progress:", error);
        // We don't alert error here because local save already succeeded above
        const btn = document.getElementById('saveProgressBtn');
        btn.innerHTML = 'LOCAL SAVED 💾';
        setTimeout(() => btn.innerHTML = 'SAVE PROGRESS', 2000);
    }
}

function saveLocal() {
    const state = serializeCanvas();
    localStorage.setItem('kensho_builder_backup', state);

    // Update UI Status
    const statusName = document.getElementById('activeTemplateName');
    if (statusName) {
        statusName.textContent = "Draft (Protected Locally 💾)";
        statusName.style.color = "#6366f1";
    }

    // Alert for peace of mind
    alert("Berhasil disimpan ke memori lokal! 💾✨\nData Master aman meskipun Cloud belum tersambung.");
}

async function loadTemplates() {
    const listContainer = document.getElementById('templateList');
    listContainer.innerHTML = '<div class="text-[10px] text-slate-400 text-center py-8">Mensinkronkan awan... ☁️</div>';

    try {
        const snapshot = await db.collection("kensho_templates").orderBy("updatedAt", "desc").get();
        listContainer.innerHTML = '';

        if (snapshot.empty) {
            listContainer.innerHTML = '<div class="text-[10px] text-slate-400 text-center py-8">Belum ada template.</div>';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.updatedAt ? new Date(data.updatedAt.seconds * 1000).toLocaleDateString() : 'Baru';

            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 cursor-pointer group';
            item.onclick = () => selectTemplate(doc.id, data.name, data.data);

            item.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-slate-700 group-hover:text-blue-600">${data.name}</span>
                    <span class="text-[8px] text-slate-400">${date}</span>
                </div>
                <button onclick="deleteTemplate(event, '${doc.id}')" class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error("Error loading templates:", error);
        listContainer.innerHTML = '<div class="text-[10px] text-red-400 text-center py-8">Gagal memuat data.</div>';
    }
}

function selectTemplate(id, name, data) {
    if (confirm(`Buka template "${name}"? Perubahan yang belum disimpan pada canvas saat ini akan hilang.`)) {
        activeTemplateId = id;
        applyState(data);
        updateTemplateStatusUI(name);
        closeFlyout();

        // Hide launcher if open
        document.getElementById('studio-launcher').style.opacity = '0';
        setTimeout(() => document.getElementById('studio-launcher').style.display = 'none', 300);
        document.getElementById('activeModuleName').textContent = 'BRACKET BUILDER (16-MAX)';
    }
}

async function deleteTemplate(event, id) {
    event.stopPropagation();
    if (confirm("Hapus template ini secara permanen dari cloud?")) {
        await db.collection("kensho_templates").doc(id).delete();
        loadTemplates();
        if (activeTemplateId === id) {
            activeTemplateId = null;
            updateTemplateStatusUI(null);
        }
    }
}

function filterTemplates(query) {
    const list = document.getElementById('templateList');
    const items = list.getElementsByTagName('div');
    const q = query.toLowerCase();

    for (let i = 0; i < items.length; i++) {
        const name = items[i].querySelector('span')?.textContent || "";
        if (name.toLowerCase().includes(q)) {
            items[i].classList.remove('hidden');
        } else {
            items[i].classList.add('hidden');
        }
    }
}

function closeFlyout() {
    document.querySelectorAll('.flyout-panel').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.side-icon-btn').forEach(b => b.classList.remove('active'));
}

// Consolidation: Root window.onload will be defined at the end of the file

// --- STUDIO MODULE ENGINE (Plug-and-Play Architecture) ---

function selectModule(mode) {
    const launcher = document.getElementById('studio-launcher');
    if (mode === 'bracket') {
        launcher.style.opacity = '0';
        setTimeout(() => launcher.style.display = 'none', 500);
    }
}

// Master Header Removed

// ADD ITEM (NEXUS SMART-CARD: FLOATING EDITION v2)
function addItem(type, color, w = null, h = null, idLabel = "", textAlign = 'center', startX = null, startY = null, forceId = null, logicalId = "") {
    // Apply Giga Standards if no specific size provided
    w = w || GIGA_BOX_W;
    h = h || GIGA_BOX_H;

    // SMART SIZE INHERITANCE: Follow existing box height
    const existingRef = document.querySelector(type === 'title' ? '.title-box' : '.smart-atlet-box');
    if (existingRef && !h) {
        h = parseFloat(existingRef.style.height) || h;
    }

    const id = forceId || ('item-' + (itemCounter++));
    const div = document.createElement('div');
    div.id = id;

    let classNames = 'draggable-item';
    if (type === 'title') classNames += ' title-box';
    else if (type === 'atlet-score') classNames += ' smart-atlet-box';
    else if (type === 'master-header') classNames += ' master-header-item';

    div.className = classNames;
    if (idLabel === 'WINNER') div.classList.add('is-winner');
    div.dataset.idLabel = idLabel;
    div.dataset.type = type;
    div.dataset.logicalId = logicalId;
    div.dataset.senshu = "false";
    div.dataset.penalty = "";

    // --- SMART POSITIONING v3.0 (Header-Aware) ---
    let posX = startX;
    let posY = startY;

    if (posX === null || posY === null) {
        // Cek apakah ada Master Header
        const masterHeader = document.querySelector('.master-header-item');
        const allBoxes = Array.from(document.querySelectorAll('.smart-atlet-box'));

        if (allBoxes.length === 0) {
            if (masterHeader) {
                // Taruh di bawah Header (Offset Mega Gap)
                posX = parseFloat(masterHeader.dataset.x);
                posY = parseFloat(masterHeader.dataset.y) + (masterHeader.offsetHeight || 120) + 150; // Gap 150px
            } else {
                posX = 4;
                posY = 59;
            }
        } else {
            // Cari kotak terbawah (Max Y)
            const maxY = Math.max(...allBoxes.map(b => parseFloat(b.dataset.y || 0)));
            const lastBox = allBoxes.find(b => parseFloat(b.dataset.y) === maxY);
            posX = parseFloat(lastBox.dataset.x || 4);
            posY = maxY + h + GIGA_V_GAP;
        }
    }

    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
    div.style.transform = `translate(${posX}px, ${posY}px)`;
    div.dataset.x = posX;
    div.dataset.y = posY;

    let contentHTML = `
        <div class="move-handle">⠿ MOVE</div>
        <div class="logical-id-tag">${logicalId}</div>
        <div class="box-actions">
            <div class="action-btn-mini" onclick="duplicateItem('${id}')" title="Duplicate">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            </div>
        </div>
        <div class="conn-dot dot-left" onclick="handleDotClick('${id}', 'left')"></div>
        <div class="conn-dot dot-right" onclick="handleDotClick('${id}', 'right')"></div>
    `;

    if (type === 'atlet-score') {
        const indicatorColor = color === 'red' ? 'red' : (color === 'blue' ? 'blue' : 'neutral');
        contentHTML += `
            <!-- Floating Labels (Semantic Edition) - BIGGER FONT -->
            <div class="n-floating-label label-senshu-penalty" style="font-size: 11px; font-weight: 900; letter-spacing: 0.1em; color: #64748b;">
                <span class="senshu-bold">SENSHU</span> 
                <span class="sep-black">|</span> 
                <span class="penalty-bold" style="color: #f87171;">PENALTY</span>
            </div>
            <div class="n-floating-label label-kata" style="font-size: 10px; font-weight: 800; color: #94a3b8; margin-top: 4px;">NAMA KATA</div>

            <div class="indicator ${indicatorColor}"></div>
            <div class="n-info-section" style="padding: 10px 15px;">
                <input class="n-top-meta" value="${idLabel || id.toUpperCase()}" style="font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 2px;">
                <textarea class="n-name-input" placeholder="NAMA PESERTA" style="font-size: 20px; font-weight: 900; line-height: 1.1; color: #1e293b; height: 44px;"></textarea>
                <div class="n-info-divider" style="margin: 4px 0;"></div>
                <input class="n-contingent-input" placeholder="KONTINGEN" style="font-size: 12px; font-weight: 700; color: #64748b; margin-top: 2px;">
            </div>
            <div class="n-score-box" style="width: 60px;">
                <input class="n-score-input" placeholder="0" style="font-size: 32px; font-weight: 900; color: #94a3b8;">
            </div>
        `;
    } else if (type === 'title') {
        contentHTML += `<textarea class="title-input" placeholder="JUDUL..." style="text-align: ${textAlign}; width: 100%; border:none; background:transparent; font-weight:900;"></textarea>`;
    }

    div.innerHTML = contentHTML + `<div class="n-size-badge">${Math.round(w)}px × ${Math.round(h)}px</div>`;
    document.getElementById('canvas').appendChild(div);

    initInteract(div);
    updateSmartData(div); // Apply Smart ID & Color on creation
    saveState();
    closeAllFlyouts(); // Auto-close flyout after adding item
    return div;
}

// SMART DATA ENGINE (REFINED: AUTO-LABEL PENYISIHAN)
function updateSmartData(el) {
    if (!el.classList.contains('smart-atlet-box')) return;

    const metaInput = el.querySelector('.n-top-meta');
    if (!metaInput) return;

    // Jika kotak sudah punya label khusus (dari Magic atau user), jangan timpa
    const currentValue = metaInput.value.trim();
    if (currentValue && !currentValue.startsWith('ITEM-') && !currentValue.startsWith('PENYISIHAN')) {
        return; // Hormati label khusus (QUARTER, SEMI, FINAL, dsb)
    }

    // Auto-label untuk kotak awal sebagai PENYISIHAN_XX
    const allPenyisihanBoxes = Array.from(document.querySelectorAll('.smart-atlet-box'))
        .filter(box => {
            const meta = box.querySelector('.n-top-meta')?.value || '';
            return !meta || meta.startsWith('ITEM-') || meta.startsWith('PENYISIHAN');
        })
        .sort((a, b) => parseFloat(a.dataset.y) - parseFloat(b.dataset.y));

    const myIndex = allPenyisihanBoxes.indexOf(el) + 1;
    const smartId = `PENYISIHAN_${myIndex < 10 ? '0' + myIndex : myIndex}`;

    metaInput.value = smartId;
    el.dataset.smartId = smartId;
}

// DRAW LINES (SVG ENGINE - SIMPLE U-SHAPE BRACKET STYLE)
function drawLines() {
    const svg = document.getElementById('line-canvas');
    if (!svg) return;
    svg.innerHTML = '';
    // Ensure line-canvas stays behind boxes
    svg.style.zIndex = '1';

    connections.forEach(conn => {
        const fromEl = document.getElementById(conn.from);
        const toEl = document.getElementById(conn.to);

        if (!fromEl || !toEl) return;

        // Logical coordinates (dari dataset)
        const fx = parseFloat(fromEl.dataset.x) || 0;
        const fy = parseFloat(fromEl.dataset.y) || 0;
        const tx = parseFloat(toEl.dataset.x) || 0;
        const ty = parseFloat(toEl.dataset.y) || 0;

        const fw = fromEl.offsetWidth;
        const fh = fromEl.offsetHeight;
        const tw = toEl.offsetWidth;
        const th = toEl.offsetHeight;

        // Calculate start and end points
        const x1 = (conn.fromSide === 'left' ? fx : fx + fw);
        const y1 = fy + fh / 2;
        const x2 = (conn.toSide === 'left' ? tx : tx + tw);
        const y2 = ty + th / 2;

        // --- U-SHAPE CONNECTOR LOGIC (Fixed Step-Out) ---
        const stepOut = 30; // Jarak horizontal sebelum membelok siku
        let midX;

        if (conn.fromSide === 'right' && conn.toSide === 'left') {
            // Standard bracket flow: kanan ke kiri
            midX = x1 + stepOut;
        } else if (conn.fromSide === 'left' && conn.toSide === 'right') {
            // Reverse flow
            midX = x1 - stepOut;
        } else {
            // Default midpoint
            midX = x1 + (x2 - x1) / 2;
        }

        // Create path: Start → Step-out → Vertical → End
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;

        path.setAttribute('d', d);
        path.setAttribute('stroke', conn.color || '#cbd5e1');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('class', 'bracket-line');

        svg.appendChild(path);
    });
}

// FIXED 16 SLOT GENERATOR (Standard Tournament Seeding)
function generateFixedBracket(count = 16) {
    if (!confirm(`Generate bagan ${count} slot dengan Seeding Standar? Progres saat ini akan dihapus.`)) return;

    // Reset Canvas
    document.getElementById('canvas').querySelectorAll('.draggable-item').forEach(el => el.remove());
    connections = [];
    activeTemplateId = null;
    updateTemplateStatusUI(null);

    const startX = 300;
    const startY = 300;
    const boxH = 90;
    const vGap = 150; // Balanced Fit
    const hGap = 150; // Compact horizontal

    // Standard Seeding for 16 (Pairs: 1-16, 9-8, 5-12, 13-4, 3-14, 11-6, 7-10, 15-2)
    const seeding16 = [
        "01", "16", "09", "08", "05", "12", "13", "04",
        "03", "14", "11", "06", "07", "10", "15", "02"
    ];

    let prevRoundIds = [];

    // ROUND 1: Placement with Seeding
    for (let i = 0; i < 16; i++) {
        const x = startX;
        const y = startY + (i * (boxH + vGap));
        const color = (i % 2 === 0) ? 'red' : 'blue';
        const label = seeding16[i];
        const logId = `P${i + 1}`; // Auto Logical ID: P1, P2...
        const item = addItem('atlet-score', color, boxW, boxH, label, 'left', x, y, null, logId);
        prevRoundIds.push(item.id);
    }

    // SUBSEQUENT ROUNDS (Auto-calculation)
    let itemsInRound = 8; // Next round has 8 boxes
    let round = 2;

    while (itemsInRound >= 1) {
        let currentRoundIds = [];
        const x = startX + ((round - 1) * (boxW + hGap));

        for (let i = 0; i < itemsInRound; i++) {
            const b1 = document.getElementById(prevRoundIds[i * 2]);
            const b2 = document.getElementById(prevRoundIds[i * 2 + 1]);
            const midY = (parseFloat(b1.dataset.y) + parseFloat(b2.dataset.y)) / 2;

            const color = (i % 2 === 0) ? 'red' : 'blue';
            const label = itemsInRound === 1 ? "W" : "";
            const item = addItem('atlet-score', color, boxW, boxH, label, 'left', x, midY);
            currentRoundIds.push(item.id);

            // Create Connections with Nexus Studio Style
            connections.push({ from: prevRoundIds[i * 2], fromSide: 'right', to: item.id, toSide: 'left', color: '#cbd5e1' });
            connections.push({ from: prevRoundIds[i * 2 + 1], fromSide: 'right', to: item.id, toSide: 'left', color: '#cbd5e1' });
        }

        prevRoundIds = [...currentRoundIds];
        itemsInRound /= 2;
        round++;
    }

    drawLines();
    saveState();
}

// INTERACT JS INITIALIZATION
function initInteract(el) {
    interact(el)
        .draggable({
            handle: '.move-handle',
            inertia: true,
            modifiers: [
                interact.modifiers.snap({
                    targets: [interact.snappers.grid({ x: 10, y: 10 })],
                    range: Infinity,
                    relativePoints: [{ x: 0, y: 0 }]
                }),
                interact.modifiers.restrictRect({
                    restriction: 'parent',
                    endOnly: true
                })
            ],
            onmove: (event) => {
                const target = event.target;
                const x = (parseFloat(target.dataset.x) || 0) + event.dx;
                const y = (parseFloat(target.dataset.y) || 0) + event.dy;

                target.style.transform = `translate(${x}px, ${y}px)`;
                target.dataset.x = x;
                target.dataset.y = y;

                const masterHeader = document.querySelector('.master-header-item');

                // --- MAGNETIC MOVEMENT (Logic to move all children with Master Header) ---
                if (target.dataset.type === 'master-header') {
                    document.querySelectorAll('.draggable-item').forEach(el => {
                        if (el.id !== target.id) {
                            const ex = (parseFloat(el.dataset.x) || 0) + event.dx;
                            const ey = (parseFloat(el.dataset.y) || 0) + event.dy;
                            el.style.transform = `translate(${ex}px, ${ey}px)`;
                            el.dataset.x = ex;
                            el.dataset.y = ey;
                        }
                    });
                }

                // --- SMART UMBRELLA SYNC (Real-time width stretch) ---
                if (masterHeader) {
                    // Update dataset carefully
                    target.dataset.x = x;
                    target.dataset.y = y;
                    syncMasterHeaderWidth(masterHeader);
                }

                drawLines();
            },
            onend: (event) => {
                // Re-sort all items to maintain correct numbering/coloring
                document.querySelectorAll('.smart-atlet-box').forEach(item => updateSmartData(item));
                saveState();
            }
        })
        .resizable({
            edges: { right: true, bottom: true, left: false, top: false },
            ignoreFrom: '.move-handle, .conn-dot, input, textarea, .indicator',
            listeners: {
                move(event) {
                    let { x, y } = event.target.dataset;
                    x = (parseFloat(x) || 0) + event.deltaRect.left;
                    y = (parseFloat(y) || 0) + event.deltaRect.top;

                    const width = Math.round(event.rect.width);
                    const height = Math.round(event.rect.height);

                    Object.assign(event.target.style, {
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `translate(${x}px, ${y}px)`
                    });

                    // Update Size Badge
                    const badge = event.target.querySelector('.n-size-badge');
                    if (badge) badge.textContent = `${width}px × ${height}px`;

                    Object.assign(event.target.dataset, { x, y });
                    drawLines();
                },
                end: () => saveState()
            }
        })
        .on('tap', (event) => {
            if (event.double) {
                // Future: Toggle color?
            } else {
                selectItem(event.currentTarget.id, event.shiftKey);
            }
        });
}

function selectItem(id, isMulti) {
    if (!isMulti) {
        document.querySelectorAll('.draggable-item').forEach(el => el.classList.remove('selected'));
        selectedItems = [id];
    } else {
        if (selectedItems.includes(id)) {
            selectedItems = selectedItems.filter(i => i !== id);
        } else {
            selectedItems.push(id);
        }
    }

    selectedItems.forEach(tid => {
        const el = document.getElementById(tid);
        if (el) el.classList.add('selected');
    });

    updateInspector();
}

// INSPECTOR ENGINE (LIVE CONTROLS)
function updateInspector() {
    const propContent = document.getElementById('propContent');
    if (!propContent) return;

    // CASE A: SVG Element Selected OR Background Clicked (Precision Mapping)
    if (selectedSVGElement || lastSVGClickCoord) {
        updateSVGInspector();
        return;
    }

    // CASE B: Empty Selection
    if (selectedItems.length === 0) {
        propContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full opacity-30 py-20 text-center">
                <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p class="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Pilih elemen untuk<br>mengatur detil</p>
            </div>
        `;
        return;
    }

    // CASE C: Multiple Selection
    if (selectedItems.length > 1) {
        propContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full opacity-30 py-20 text-center">
                <p class="text-[10px] font-bold uppercase tracking-widest leading-relaxed">${selectedItems.length} elemen terpilih</p>
            </div>
        `;
        return;
    }

    // CASE D: Single Item Selection
    const targetId = selectedItems[0];
    const el = document.getElementById(targetId);
    if (!el) return;

    let inspectorHTML = "";

    // Header Info
    inspectorHTML += `
        <div class="mb-6">
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target ID</span>
            <div class="text-[10px] font-mono font-bold text-slate-600 bg-slate-900/5 px-2 py-1 rounded-md inline-block">${targetId}</div>
        </div>
    `;

    // Dynamic Controls
    if (el.dataset.type === 'master-header') {
        const eventVal = el.querySelector('.master-header-event-name')?.textContent || "";
        const titleVal = el.querySelector('.master-header-title')?.textContent || "";
        const tatamiVal = el.querySelector('.master-meta-input')?.value || "";
        const poolVal = el.querySelectorAll('.master-meta-input')[1]?.value || "";
        const dateVal = el.querySelectorAll('.master-meta-input')[2]?.value || "";
        const durationVal = el.querySelectorAll('.master-meta-input')[3]?.value || "";

        inspectorHTML += `
            <div class="space-y-5">
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Nama Event / Kejuaraan</label>
                    <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'master-event', this.value)" value="${eventVal}">
                </div>
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Kategori Pertandingan</label>
                    <textarea class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'master-title', this.value)">${titleVal}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tatami</label>
                        <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 text-center" 
                            oninput="updateItemData('${targetId}', 'master-tatami', this.value)" value="${tatamiVal}">
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Pool</label>
                        <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 text-center" 
                            oninput="updateItemData('${targetId}', 'master-pool', this.value)" value="${poolVal}">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tanggal</label>
                        <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700" 
                            oninput="updateItemData('${targetId}', 'master-date', this.value)" value="${dateVal}">
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Durasi</label>
                        <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700" 
                            oninput="updateItemData('${targetId}', 'master-duration', this.value)" value="${durationVal}">
                    </div>
                </div>
            </div>
        `;
    } else if (el.classList.contains('smart-atlet-box')) {
        const nameVal = el.querySelector('.n-name-input')?.value || "";
        const contVal = el.querySelector('.n-contingent-input')?.value || "";
        const smartId = el.dataset.smartId || "";

        inspectorHTML += `
            <div class="space-y-5">
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Nama Peserta</label>
                    <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'name', this.value)" value="${nameVal}">
                </div>
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Kontingen</label>
                    <input type="text" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'contingent', this.value)" value="${contVal}">
                </div>
                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Zona ID (Auto)</label>
                    <input type="text" disabled class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-400 cursor-not-allowed" value="${smartId.toUpperCase()}">
                </div>
                <div class="grid grid-cols-2 gap-3 py-2 border-t border-slate-50 mt-4">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" id="senshu-toggle" ${el.dataset.senshu === 'true' ? 'checked' : ''} 
                            onchange="updateItemData('${targetId}', 'senshu', this.checked)"
                            class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        <label for="senshu-toggle" class="text-[10px] font-black text-slate-600 uppercase tracking-widest">SENSHU (S)</label>
                    </div>
                    <div>
                        <select onchange="updateItemData('${targetId}', 'penalty', this.value)" 
                            class="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-red-500">
                            <option value="">-- PENALTY --</option>
                            <option value="C1" ${el.dataset.penalty === 'C1' ? 'selected' : ''}>C1</option>
                            <option value="C2" ${el.dataset.penalty === 'C2' ? 'selected' : ''}>C2</option>
                            <option value="C3" ${el.dataset.penalty === 'C3' ? 'selected' : ''}>C3</option>
                            <option value="HC" ${el.dataset.penalty === 'HC' ? 'selected' : ''}>HC</option>
                            <option value="H" ${el.dataset.penalty === 'H' ? 'selected' : ''}>H</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    // Geometry
    const w = Math.round(parseFloat(el.style.width));
    const h = Math.round(parseFloat(el.style.height));

    inspectorHTML += `
        <div class="mt-8 pt-6 border-t border-slate-100">
             <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-3">Dimensi Kotak (Px)</label>
             <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                    <span class="text-[7px] text-slate-400 font-bold uppercase ml-1">Width</span>
                    <input type="number" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'width', this.value)" value="${w}">
                </div>
                <div class="flex flex-col gap-1">
                    <span class="text-[7px] text-slate-400 font-bold uppercase ml-1">Height</span>
                    <input type="number" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-blue-500 outline-none transition-all" 
                        oninput="updateItemData('${targetId}', 'height', this.value)" value="${h}">
                </div>
             </div>
             
             <!-- Position Coordinates (Debugging) -->
             <div class="mt-6 grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                    <span class="text-[7px] text-slate-400 font-bold uppercase ml-1">Koordinat X</span>
                    <div class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600">${Math.round(parseFloat(el.dataset.x) || 0)}</div>
                </div>
                <div class="flex flex-col gap-1">
                    <span class="text-[7px] text-slate-400 font-bold uppercase ml-1">Koordinat Y</span>
                    <div class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600">${Math.round(parseFloat(el.dataset.y) || 0)}</div>
                </div>
             </div>
        </div>
        
        <div class="mt-12">
            <button onclick="deleteItem('${targetId}')" class="w-full bg-red-50 hover:bg-red-500 hover:text-white text-red-500 py-4 rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all uppercase">
                Hapus Elemen
            </button>
        </div>
    `;

    propContent.innerHTML = inspectorHTML;
}

// --- SVG ELEMENT INSPECTOR ---
function updateSVGInspector() {
    const propContent = document.getElementById('propContent');

    // STATE 1: CLICKED ON EMPTY SPACE (READY TO SPAWN)
    if (!selectedSVGElement && lastSVGClickCoord) {
        propContent.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center gap-2 mb-6">
                     <div class="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                     </div>
                     <h3 class="font-black text-xs tracking-widest text-slate-800 uppercase">READY TO PLACE TAG</h3>
                </div>

                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">SVG X</label>
                            <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-600">${Math.round(lastSVGClickCoord.x)}</div>
                        </div>
                        <div>
                            <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">SVG Y</label>
                            <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-600">${Math.round(lastSVGClickCoord.y)}</div>
                        </div>
                    </div>

                    <div>
                        <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Pilih Data Untuk Ditempel</label>
                        <select id="spawnIdSelector" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-red-500 outline-none transition-all shadow-sm">
                            <option value="">-- PILIH ID --</option>
                            ${getSpawnOptionsHTML()}
                        </select>
                    </div>

                    <button onclick="spawnSVGTag(document.getElementById('spawnIdSelector').value)" class="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all uppercase shadow-lg">
                        TEMPELKAN TAG SEKARANG
                    </button>

                    <button onclick="saveLocal()" class="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all uppercase border border-emerald-100 flex items-center justify-center gap-2">
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                         AMANKAN KE LOKAL 💾
                    </button>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-100">
                <button onclick="startWizard()" class="w-full bg-indigo-50 hover:bg-indigo-500 hover:text-white text-indigo-600 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all uppercase border border-indigo-100 flex items-center justify-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    MULAI QUICK-MAP WIZARD 🧙‍♂️
                </button>
            </div>
        `;
        return;
    }

    // STATE 2: WIZARD MODE ACTIVE
    if (isWizardMode) {
        const currentTarget = wizardQueue[wizardIndex];
        const progress = Math.round((wizardIndex / wizardQueue.length) * 100);

        propContent.innerHTML = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 class="font-black text-xs tracking-widest text-slate-800 uppercase">WIZARD MODE</h3>
                    </div>
                    <button onclick="stopWizard()" class="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest">EXIT</button>
                </div>

                <div class="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 mb-6">
                    <span class="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-2">TARGET SEKARANG</span>
                    <div class="text-xl font-black text-indigo-800 leading-tight mb-2">${currentTarget.label}</div>
                    <div class="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">${currentTarget.id}</div>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between px-1">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progress: ${wizardIndex}/${wizardQueue.length}</span>
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${progress}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-500 transition-all duration-500" style="width: ${progress}%"></div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 mt-8">
                        <button onclick="wizardStep(-1)" ${wizardIndex === 0 ? 'disabled' : ''} class="w-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all uppercase disabled:opacity-30">BACK</button>
                        <button onclick="wizardStep(1)" class="w-full bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all uppercase">SKIP</button>
                    </div>
                </div>

                <div class="mt-10 p-4 bg-slate-900 rounded-2xl text-white">
                    <p class="text-[10px] font-bold leading-relaxed opacity-80 uppercase tracking-wider">
                        💡 Klik elemen teks pada desain SVG untuk memasangkan ID <span class="text-indigo-300">${currentTarget.id}</span>
                    </p>
                </div>
            </div>
        `;
        return;
    }

    if (!selectedSVGElement) return;

    const currentId = selectedSVGElement.id || "";
    const currentText = selectedSVGElement.textContent || "";

    // Kamus ID Options
    const idOptions = [
        { groupName: "HEADER", ids: ["h_event", "h_class", "h_tatami", "h_pool", "h_date", "h_duration"] },
        { groupName: "PESERTA (P1-P8)", ids: ["p1_name", "p1_cont", "p1_score", "p1_sp", "p2_name", "p2_cont", "p2_score", "p2_sp", "p3_name", "p3_cont", "p3_score", "p3_sp", "p4_name", "p4_cont", "p4_score", "p4_sp"] },
        { groupName: "JUARA", ids: ["win1_name", "win1_cont", "win2_name", "win2_cont", "win3_name", "win3_cont", "win4_name", "win4_cont"] },
        { groupName: "ADVANCED", ids: ["p1_label_sp", "p1_label_k", "p2_label_sp", "p2_label_k"] }
    ];

    let optionsHTML = '<option value="">-- PILIH ID KAMUS --</option>';
    idOptions.forEach(group => {
        optionsHTML += `<optgroup label="${group.groupName}">`;
        group.ids.forEach(id => {
            optionsHTML += `<option value="${id}" ${currentId === id ? 'selected' : ''}>${id.toUpperCase()}</option>`;
        });
        optionsHTML += `</optgroup>`;
    });

    propContent.innerHTML = `
        <div class="mb-8">
            <div class="flex items-center gap-2 mb-6">
                 <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                 </div>
                 <h3 class="font-black text-xs tracking-widest text-slate-800 uppercase">SVG MAPPER</h3>
            </div>

            <div class="space-y-6">
                <div>
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Isi Teks Sekarang</label>
                    <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-400 italic">"${currentText}"</div>
                </div>

                <!-- PRECISION COORDINATE NUDGING -->
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Posisi X</label>
                        <input type="number" id="svgPropX" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-500" 
                            oninput="updateSVGNodePos('x', this.value)" value="${Math.round(parseFloat(selectedSVGElement.getAttribute('x')) || 0)}">
                    </div>
                    <div>
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Posisi Y</label>
                        <input type="number" id="svgPropY" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-500" 
                            oninput="updateSVGNodePos('y', this.value)" value="${Math.round(parseFloat(selectedSVGElement.getAttribute('y')) || 0)}">
                    </div>
                </div>

                <div>
                    <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ukuran Teks</label>
                    <input type="number" id="svgFontSize" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-500" 
                        oninput="updateSVGFontSize(this.value)" value="${selectedSVGElement.getAttribute('font-size') || 14}">
                </div>

                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Ganti Logical ID</label>
                    <select class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all shadow-sm"
                        onchange="setSVGElementId(this.value)">
                        ${optionsHTML}
                    </select>
                </div>

                <div>
                    <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Input ID Manual (Opsional)</label>
                    <input type="text" placeholder="misal: p9_name" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-500" 
                        oninput="setSVGElementId(this.value)" value="${currentId}">
                </div>

                <div class="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p class="text-[9px] font-bold text-blue-700 leading-relaxed uppercase">
                        💡 Gunakan drag untuk menggeser, atau input angka untuk presisi.
                    </p>
                </div>

                <button onclick="deleteSVGElement()" class="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-[9px] font-black tracking-widest transition-all uppercase border border-red-100">
                    Hapus Tag Ini
                </button>
            </div>
        </div>
    `;
}

function updateSVGFontSize(val) {
    if (!selectedSVGElement) return;
    selectedSVGElement.setAttribute('font-size', val);
    saveState();
}

function deleteSVGElement() {
    if (!selectedSVGElement) return;
    if (confirm("Hapus tag ini dari desain?")) {
        selectedSVGElement.remove();
        selectedSVGElement = null;
        saveState();
        updateInspector();
    }
}

function setSVGElementId(newId) {
    if (!selectedSVGElement) return;
    selectedSVGElement.id = newId.toLowerCase().trim();
    saveState();
    syncDataToSVG();
}

function getNextLogicalId(currentId) {
    if (!currentId) return "";

    // Pattern: ([p|win|h])([0-9]*)(_suffix)
    const match = currentId.match(/^([a-z]+)([0-9]*)(_.*)$/);
    if (!match) return currentId;

    const prefix = match[1];
    const numStr = match[2];
    const suffix = match[3];
    const num = numStr ? parseInt(numStr) : 0;

    // --- SMART SEQUENCE LOGIC ---
    if (prefix === 'p') {
        const sequence = ['_name', '_cont', '_score', '_sp', '_label_k'];
        const currentIndex = sequence.indexOf(suffix);

        if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
            // Same participant, next property
            return `p${num}${sequence[currentIndex + 1]}`;
        } else {
            // Next participant, restart sequence at name
            return `p${num + 1}_name`;
        }
    } else if (prefix === 'win') {
        const sequence = ['_name', '_cont'];
        const currentIndex = sequence.indexOf(suffix);
        if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
            return `win${num}${sequence[currentIndex + 1]}`;
        } else {
            return `win${num + 1}_name`;
        }
    } else if (prefix === 'h') {
        const sequence = ['_event', '_class', '_tatami', '_pool', '_date', '_duration'];
        const currentIndex = sequence.indexOf(suffix);
        if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
            return `h${suffix.startsWith('_') ? suffix.substring(1) : suffix}`; // Simplify if possible or just return next
        }
        // Special case for header sequence
        const hSeq = ['h_event', 'h_class', 'h_tatami', 'h_pool', 'h_date', 'h_duration'];
        const hIdx = hSeq.indexOf(currentId);
        if (hIdx !== -1 && hIdx < hSeq.length - 1) return hSeq[hIdx + 1];
    }

    return currentId;
}

function getSpawnOptionsHTML() {
    const nextId = lastSpawnedSVGId ? getNextLogicalId(lastSpawnedSVGId) : "";

    // Check which IDs are already in the SVG
    const usedIds = new Set();
    if (activeSVGTemplate) {
        activeSVGTemplate.querySelectorAll('[id]').forEach(el => usedIds.add(el.id.toLowerCase()));
    }

    const groups = [
        {
            label: "HEADER", options: [
                { v: "h_event", l: "EVENT NAME" },
                { v: "h_class", l: "CLASS / CATEGORY" },
                { v: "h_tatami", l: "TATAMI" },
                { v: "h_pool", l: "POOL" },
                { v: "h_date", l: "DATE / TANGAL" },
                { v: "h_duration", l: "DURATION / DURASI" }
            ]
        },
        { label: "PESERTA", options: [] },
        { label: "JUARA", options: [] }
    ];

    // Populate Peserta P1-P16 dynamically
    for (let i = 1; i <= 16; i++) {
        groups[1].options.push({ v: `p${i}_name`, l: `P${i}: NAMA` });
        groups[1].options.push({ v: `p${i}_cont`, l: `P${i}: KONTINGEN` });
        groups[1].options.push({ v: `p${i}_score`, l: `P${i}: SKOR` });
        groups[1].options.push({ v: `p${i}_sp`, l: `P${i}: SENSHU/PENALTY` });
        groups[1].options.push({ v: `p${i}_label_k`, l: `P${i}: NAMA KATA` });
    }

    // Populate Juara 1-4
    for (let i = 1; i <= 4; i++) {
        groups[2].options.push({ v: `win${i}_name`, l: `WIN${i}: NAMA` });
        groups[2].options.push({ v: `win${i}_cont`, l: `WIN${i}: KONTINGEN` });
    }

    let html = "";
    groups.forEach(g => {
        html += `<optgroup label="${g.label}">`;
        g.options.forEach(o => {
            const isUsed = usedIds.has(o.v);
            const label = isUsed ? `✅ ${o.l}` : o.l;
            html += `<option value="${o.v}" ${nextId === o.v ? 'selected' : ''} ${isUsed ? 'style="color: #94a3b8;"' : ''}>${label}</option>`;
        });
        html += `</optgroup>`;
    });
    return html;
}

function spawnSVGTag(id, forceX = null, forceY = null) {
    if (!activeSVGTemplate || (!lastSVGClickCoord && forceX === null) || !id) return;

    const x = forceX !== null ? forceX : lastSVGClickCoord.x;
    const y = forceY !== null ? forceY : lastSVGClickCoord.y;

    lastSpawnedSVGId = id; // Store for smart increment
    const newText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    newText.setAttribute('x', x);
    newText.setAttribute('y', y);
    newText.setAttribute('id', id.toLowerCase().trim());
    newText.setAttribute('font-family', 'Roboto, sans-serif');
    newText.setAttribute('font-weight', '700');

    // Smart default font-size based on type
    let fontSize = '14';
    if (id.includes('_cont')) fontSize = '10';
    if (id.includes('_score')) fontSize = '16';
    if (id.includes('h_event') || id.includes('h_class')) fontSize = '20';

    newText.setAttribute('font-size', fontSize);
    newText.textContent = `[ID: ${id}]`;

    // Add interaction
    newText.addEventListener('click', (e) => {
        e.stopPropagation();
        selectSVGElement(newText);
    });
    makeSVGDraggable(newText);

    activeSVGTemplate.appendChild(newText);

    // Clean up marker & update selection
    activeSVGTemplate.querySelectorAll('.svg-click-marker').forEach(m => m.remove());
    selectSVGElement(newText);

    saveState();
    syncDataToSVG();
}

function updateItemData(id, key, val) {
    const el = document.getElementById(id);
    if (!el) return;

    if (key === 'name') {
        const input = el.querySelector('.n-name-input');
        if (input) input.value = val;
    } else if (key === 'contingent') {
        const input = el.querySelector('.n-contingent-input');
        if (input) input.value = val;
    } else if (key === 'master-event') {
        const input = el.querySelector('.master-header-event-name');
        if (input) input.value = val;
    } else if (key === 'master-title') {
        const input = el.querySelector('.master-header-title');
        if (input) input.value = val;
    } else if (key === 'master-tatami') {
        const input = el.querySelector('.master-meta-input');
        if (input) input.value = val;
    } else if (key === 'master-pool') {
        const input = el.querySelectorAll('.master-meta-input')[1];
        if (input) input.value = val;
    } else if (key === 'master-date') {
        const input = el.querySelectorAll('.master-meta-input')[2];
        if (input) input.value = val;
    } else if (key === 'master-duration') {
        const input = el.querySelectorAll('.master-meta-input')[3];
        if (input) input.value = val;
    } else if (key === 'width') {
        el.style.width = val + 'px';
        const badge = el.querySelector('.n-size-badge');
        if (badge) badge.textContent = `${Math.round(val)}px × ${Math.round(parseFloat(el.style.height))}px`;
    } else if (key === 'height') {
        el.style.height = val + 'px';
        const badge = el.querySelector('.n-size-badge');
        if (badge) badge.textContent = `${Math.round(parseFloat(el.style.width))}px × ${Math.round(val)}px`;
    } else if (key === 'senshu') {
        el.dataset.senshu = val;
        const senshuLabel = el.querySelector('.senshu-bold');
        if (senshuLabel) senshuLabel.classList.toggle('active', val === true || val === 'true');
        syncDataToSVG();
    } else if (key === 'penalty') {
        el.dataset.penalty = val;
        const penaltyLabel = el.querySelector('.penalty-bold');
        if (penaltyLabel) {
            penaltyLabel.textContent = val || "PENALTY";
            penaltyLabel.classList.toggle('active', !!val);
        }
        syncDataToSVG();
    }

    drawLines();
    saveState();
}

function deleteItem(id) {
    if (confirm("Hapus elemen ini dari canvas?")) {
        const el = document.getElementById(id);
        const type = el?.dataset.type;
        if (el) el.remove();
        selectedItems = [];
        updateInspector();
        drawLines();
        saveState();

        // Sync header if a bracket item was deleted
        const masterHeader = document.querySelector('.master-header-item');
        if (masterHeader && type !== 'master-header') {
            syncMasterHeaderWidth(masterHeader);
        }
        syncDataToSVG();
    }
}

let sourceConn = null;
// Removed duplicate isDraggingSVG

function handleDotClick(boxId, side) {
    const dotEl = event.target;

    // First Click: Select Source
    if (!sourceConn) {
        sourceConn = { id: boxId, side: side, el: dotEl };
        dotEl.classList.add('active-source');
        console.log("Source selected:", boxId, side);
        return;
    }

    // Secondary Click on Same Dot: Cancel
    if (sourceConn.id === boxId && sourceConn.side === side) {
        sourceConn.el.classList.remove('active-source');
        sourceConn = null;
        console.log("Connection cancelled.");
        return;
    }

    // Second Click: Create Connection
    console.log("Linking to target:", boxId, side);

    // Logic: Connect source to target
    connections.push({
        from: sourceConn.id,
        fromSide: sourceConn.side,
        to: boxId,
        toSide: side,
        color: '#cbd5e1'
    });

    // Cleanup
    sourceConn.el.classList.remove('active-source');
    sourceConn = null;

    drawLines();
    saveState();
}

// Magic Auto-Pair Removed

// --- UI MANAGEMENT ---

function toggleFlyout(id, btn) {
    const wasVisible = document.getElementById(id).classList.contains('show');
    closeAllFlyouts();
    if (!wasVisible) {
        document.getElementById(id).classList.add('show');
        if (btn) btn.classList.add('active');
    }
}

function closeAllFlyouts() {
    document.querySelectorAll('.flyout-panel').forEach(p => p.classList.remove('show'));
    document.querySelectorAll('.side-icon-btn').forEach(b => b.classList.remove('active'));
}

// Close flyouts and Deselect when clicking outside
document.addEventListener('click', (e) => {
    // 1. Handle Flyouts
    if (!e.target.closest('.sidebar') && !e.target.closest('.flyout-panel')) {
        closeAllFlyouts();
    }

    // 2. Handle Deselection (Canvas Area)
    if (!e.target.closest('.draggable-item') && !e.target.closest('.property-sidebar') && !e.target.closest('.sidebar') && !e.target.closest('.top-toolbar')) {
        document.querySelectorAll('.draggable-item').forEach(el => el.classList.remove('selected'));
        selectedItems = [];
        updateInspector();
    }
});

// UNDO / REDO Implementation
function undo() {
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push(current);
    const prev = undoStack[undoStack.length - 1];
    applyState(prev);
}

function redo() {
    if (redoStack.length === 0) return;
    const state = redoStack.pop();
    undoStack.push(state);
    applyState(state);
}

function applyState(stateJson) {
    const state = JSON.parse(stateJson);
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.draggable-item').forEach(el => el.remove());
    connections = state.connections || [];

    // --- ULTRA SPACE MIGRATION ENGINE (Strict Gap Enforcement) ---
    // Sort items by Y to process from top to bottom
    const sortedItems = [...state.items].sort((a, b) => parseFloat(a.y) - parseFloat(b.y));

    // Track vertical accumulation for each column (X position)
    const columnOffsets = {};

    sortedItems.forEach(item => {
        // GIGA-TOLERANCE COLUMN: Group by 200px increments to catch mismatched alignments
        const itemX = Math.round(parseFloat(item.x) / 200) * 200;
        const originalY = parseFloat(item.y);

        let currentYOffset = columnOffsets[itemX] || 0;
        let newY = originalY + currentYOffset;

        if (item.type === 'master-header') {
            const header = spawnMasterHeader(parseFloat(item.x), newY);
            header.id = item.id;
            const vals = (item.text || "").split('|');
            if (vals[0]) header.querySelector('.master-header-event-name').textContent = vals[0];
            if (vals[1]) header.querySelector('.master-header-title').textContent = vals[1];
            if (vals[2]) header.querySelector('.master-meta-input').value = vals[2];
            if (vals[3]) header.querySelectorAll('.master-meta-input')[1].value = vals[3];
            if (vals[4]) header.querySelectorAll('.master-meta-input')[2].value = vals[4];
            if (vals[5]) header.querySelectorAll('.master-meta-input')[3].value = vals[5];
            syncMasterHeaderWidth(header);
        } else {
            let itemW = parseFloat(item.width) || 600;
            let itemH = parseFloat(item.height) || 100;

            // ENFORCEMENT (Nuclear Fix): Target both 'atlet-score' and old 'atlet' type
            const isAtletBox = item.type === 'atlet-score' || item.type === 'atlet';

            if (isAtletBox) {
                if (itemW < 600) itemW = 600;
                if (itemH < 100) itemH = 100;

                // DETECT MEPET (Perfect Balance Check): 
                // We expect 200px between top edges (100px box + 100px gap)
                const prevBottomY = columnOffsets[`${itemX}_lastY`] || -9999;
                const distance = newY - prevBottomY;

                if (distance < GIGA_THRESHOLD && prevBottomY !== -9999) {
                    const correction = GIGA_THRESHOLD - distance;
                    newY += correction;
                    currentYOffset += correction;
                    columnOffsets[itemX] = currentYOffset;
                }

                columnOffsets[`${itemX}_lastY`] = newY;
            }

            addItem(item.type, item.color, itemW, itemH, item.idLabel, item.textAlign, parseFloat(item.x), newY, item.id, item.logicalId || "");
        }
    });

    // --- RESTORE SVG CONTENT ---
    if (state.svgContent) {
        loadSVGTemplate(state.svgContent, true);
    }

    drawLines();
}

function clearCanvas() {
    if (confirm("Bersihkan seluruh canvas?")) {
        document.getElementById('canvas').querySelectorAll('.draggable-item').forEach(el => el.remove());
        connections = [];
        drawLines();
        saveState();
    }
}

// PROPERTY SIDEBAR CONTROLS
function closePropertySidebar() {
    document.getElementById('propertySidebar').classList.remove('show');
}

function updateProp(key, value) {
    if (selectedItems.length === 0) return;
    selectedItems.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // Simplified prop update for now
        if (key === 'idLabel') el.dataset.idLabel = value;
    });
    saveState();
}


// --- PRODUCTIVITY SUITE FUNCTIONS ---

function duplicateItem(boxId) {
    const original = document.getElementById(boxId);
    if (!original) return;

    const type = original.classList.contains('smart-atlet-box') ? 'atlet-score' :
        (original.classList.contains('title-box') ? 'title' : 'custom');

    // Get original data
    const w = parseFloat(original.style.width);
    const h = parseFloat(original.style.height);
    const x = parseFloat(original.dataset.x);
    const y = parseFloat(original.dataset.y);
    const label = original.querySelector('.n-top-meta')?.value || '';

    // Capture user inputs (The Missing Data!)
    const nameVal = original.querySelector('.n-name-input')?.value || '';
    const contingentVal = original.querySelector('.n-contingent-input')?.value || '';
    const scoreVal = original.querySelector('.n-score-input')?.value || '';

    // Determine new color (opposite of original for athletes)
    let newColor = 'neutral';
    if (type === 'atlet-score') {
        const indicator = original.querySelector('.indicator');
        newColor = indicator.classList.contains('red') ? 'blue' : 'red';
    }

    // Spawn exactly below
    const spawnY = y + h + 30;

    const logicalId = original.dataset.logicalId || '';
    const newBox = addItem(type, newColor, w, h, label, 'left', x, spawnY, null, logicalId);

    // Restore user inputs to the new box
    if (newBox) {
        if (nameVal) newBox.querySelector('.n-name-input').value = nameVal;
        if (contingentVal) newBox.querySelector('.n-contingent-input').value = contingentVal;
        if (scoreVal) newBox.querySelector('.n-score-input').value = scoreVal;
    }

    // Select the new one
    document.querySelectorAll('.draggable-item').forEach(el => el.classList.remove('selected'));
    newBox.classList.add('selected');
    selectedItems = [newBox.id];
    updateInspector();
}

// Bulk Add Removed


// MASTER HEADER UTILS
function syncMasterHeaderWidth(header) {
    if (!header) return;

    // Temporarily disable transition for accurate measurement
    const originalTransition = header.style.transition;
    header.style.transition = 'none';

    const hx = parseFloat(header.dataset.x) || 0;

    // Reset to fit-content to measure text breadth
    header.style.width = 'fit-content';
    let baseWidth = header.offsetWidth;

    // Find the furthest right edge of ANY item on canvas
    let maxRight = hx + baseWidth;
    document.querySelectorAll('.draggable-item').forEach(el => {
        if (el.id !== header.id) {
            const ex = parseFloat(el.dataset.x) || 0;
            const ew = el.offsetWidth || 400;
            maxRight = Math.max(maxRight, ex + ew);
        }
    });

    // Umbrella stretch (Exactly aligned with the furthest right edge)
    const extendedWidth = Math.max(baseWidth, maxRight - hx);
    header.style.width = extendedWidth + 'px';

    // Restore transition
    setTimeout(() => {
        header.style.transition = originalTransition;
    }, 0);
}


// Initialize on start
// --- PRINT & EXPORT FUNCTIONS ---

// --- PRINT MODAL FUNCTIONS ---
let selectedPrintScale = 0.5; // Default 50%

// Printer Modal and Gong logic removed
// --- PRINT FUNCTION (Updated with Custom Scale) ---
function printDesignedBracket(customScale = null) {
    const items = document.querySelectorAll('.draggable-item');
    if (items.length === 0) {
        window.print();
        return;
    }

    // 1. Prepare for Print
    const body = document.body;
    const canvas = document.getElementById('canvas');
    const container = document.getElementById('canvas-container');
    const originalZoom = currentZoom;
    const originalTranslateX = canvasOffsetX;
    const originalTranslateY = canvasOffsetY;
    const originalW = canvas.style.width;
    const originalH = canvas.style.height;

    // 2. Calculate Bounding Box (Line-Aware)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(el => {
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + el.offsetWidth);
        maxY = Math.max(maxY, y + el.offsetHeight);
    });

    connections.forEach(c => {
        const f = document.getElementById(c.from);
        const t = document.getElementById(c.to);
        if (!f || !t) return;
        const x1 = (c.fromSide === 'left' ? parseFloat(f.dataset.x) : parseFloat(f.dataset.x) + f.offsetWidth);
        const x2 = (c.toSide === 'left' ? parseFloat(t.dataset.x) : parseFloat(t.dataset.x) + t.offsetWidth);
        let midX = (c.fromSide === c.toSide) ? (c.fromSide === 'right' ? Math.max(x1, x2) + 40 : Math.min(x1, x2) - 40) : (x1 + (x2 - x1) / 2);
        minX = Math.min(minX, x1, x2, midX);
        maxX = Math.max(maxX, x1, x2, midX);
    });

    const designW = (maxX - minX);
    const designH = (maxY - minY);

    // 3. Setup "Golden Frame" Constraints (F4 Landscape @ 96 DPI)
    // F4 = 13in x 8.5in -> 1248px x 816px
    const paperW = 1248;
    const paperH = 816;

    // Force Fit Margin: 1cm ~ 38px
    const margin = 38;
    const areaW = paperW - (margin * 2);
    const areaH = paperH - (margin * 2);

    // 4. Calculate Final Scale & Anchor Left Positioning
    let scale;
    if (customScale) {
        // User memilih manual scale (50%, 60%, 75%, 100%)
        scale = customScale;
    } else {
        // Auto-scale agar muat di area cetak
        scale = Math.min(areaW / designW, areaH / designH);
    }

    // Anchor Left: Position content exactly at the left margin
    const anchoredX = margin;
    const centeredY = (areaH - designH * scale) / 2 + margin;

    // Final Translation in scale units
    const tx = anchoredX / scale - minX;
    const ty = centeredY / scale - minY;

    // 5. Apply Transformation (Force Scale & Center)
    setUIForCapture(true);
    body.classList.add('is-printing');
    canvas.style.setProperty('width', (maxX + 100) + 'px', 'important');
    canvas.style.setProperty('height', (maxY + 100) + 'px', 'important');
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;

    // 6. Execute Print with Stability Delay
    setTimeout(() => {
        window.print();

        // 7. Restore UI
        setTimeout(() => {
            setUIForCapture(false);
            body.classList.remove('is-printing');
            canvas.style.transformOrigin = '';
            canvas.style.transform = `translate(${originalTranslateX}px, ${originalTranslateY}px) scale(${originalZoom})`;
            canvas.style.setProperty('width', originalW);
            canvas.style.setProperty('height', originalH);
            updateCanvasTransform();
        }, 500);
    }, 1000);
}

function updateCanvasTransform() {
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${currentZoom})`;
    }
}

// --- FIT-TO-PAGE ULTRA PRINT "GONG" ---
function printGong() {
    const items = document.querySelectorAll('.draggable-item');
    if (items.length === 0) {
        alert("Canvas kosong! Tidak ada yang bisa dicetak. 🥋");
        return;
    }

    // 1. Calculate Bounding Box of ALL items (including connections)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(el => {
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + el.offsetWidth);
        maxY = Math.max(maxY, y + el.offsetHeight);
    });

    // Expand bounding box for connections
    connections.forEach(c => {
        const f = document.getElementById(c.from);
        const t = document.getElementById(c.to);
        if (!f || !t) return;
        const x1 = (c.fromSide === 'left' ? parseFloat(f.dataset.x) : parseFloat(f.dataset.x) + f.offsetWidth);
        const x2 = (c.toSide === 'left' ? parseFloat(t.dataset.x) : parseFloat(t.dataset.x) + t.offsetWidth);
        let midX = (c.fromSide === c.toSide) ? (c.fromSide === 'right' ? Math.max(x1, x2) + 40 : Math.min(x1, x2) - 40) : (x1 + (x2 - x1) / 2);
        minX = Math.min(minX, x1, x2, midX);
        maxX = Math.max(maxX, x1, x2, midX);
    });

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // 2. Prepare Snapshot for Printing
    const body = document.body;
    const canvas = document.getElementById('canvas');
    const originalZoom = currentZoom;
    const originalTranslateX = canvasOffsetX;
    const originalTranslateY = canvasOffsetY;
    const originalW = canvas.style.width;
    const originalH = canvas.style.height;

    // 3. APPLY FIT-TO-PAGE LOGIC (Dual-Axis Protection)
    // We use a safe landscape reference (Approx F4/A4 ratio at 96dpi)
    const targetPaperW = 1200;
    const targetPaperH = 800; // Reference height for safe landscape fit

    const scaleW = targetPaperW / (contentW + 150); // 150px padding total for safety
    const scaleH = targetPaperH / (contentH + 150);

    // Choose the most restrictive scale to ensure total fit
    const scale = Math.min(scaleW, scaleH);

    // Dynamic Translation: Center content on the virtual paper
    // Padding 75px left/top
    const tx = -minX + 75;
    const ty = -minY + 75;

    // Reset transform for clean capture
    setUIForCapture(true);
    body.classList.add('is-printing');

    // Lock dimensions for print stability
    canvas.style.setProperty('width', (contentW + 200) + 'px', 'important');
    canvas.style.setProperty('height', (contentH + 200) + 'px', 'important');
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;

    // 4. Trigger Print
    setTimeout(() => {
        window.print();

        // 5. Cleanup & Restore
        setTimeout(() => {
            body.classList.remove('is-printing');
            canvas.style.transformOrigin = '';
            canvas.style.transform = `translate(${originalTranslateX}px, ${originalTranslateY}px) scale(${originalZoom})`;
            canvas.style.setProperty('width', originalW);
            canvas.style.setProperty('height', originalH);
            updateCanvasTransform();
        }, 500);
    }, 1000);
}


// --- CLEAN UI & VISUAL SHARPENING HELPERS ---
function setUIForCapture(isHidden) {
    const display = isHidden ? 'none' : '';
    document.querySelectorAll('.move-handle, .conn-dot, .n-size-badge, .parent-indicator, .resize-handle, .logical-id-tag').forEach(el => {
        el.style.setProperty('display', display, 'important');
    });

    // Sharpness Boost (3px borders & 5px connectors)
    const borderWidth = isHidden ? '3px' : '';
    const strokeWidth = isHidden ? '5' : '3';

    document.querySelectorAll('.smart-atlet-box, .master-header-item, .title-box').forEach(el => {
        el.style.borderWidth = borderWidth;
        el.style.borderColor = isHidden ? '#000000' : '';
    });

    document.querySelectorAll('#line-canvas path').forEach(path => {
        path.setAttribute('stroke-width', strokeWidth);
        if (isHidden) path.setAttribute('stroke', '#000000');
        else path.removeAttribute('stroke'); // Restore original color
    });

    // Text Visibility Boost
    document.querySelectorAll('.n-name-input, .n-contingent-input, .n-score-input, .label-senshu-penalty, .label-kata').forEach(el => {
        if (isHidden) {
            el.style.color = '#000000';
            el.style.fontWeight = '950';
        } else {
            el.style.color = '';
            el.style.fontWeight = '';
        }
    });
}

// --- PREMIUM PDF EXPORT ENGINE (Dynamic & High Res) ---
async function exportAsImage() {
    await exportToPDF(true); // Reuse PDF logic but can be tailored if needed
}

async function exportToPDF(asImage = false) {
    const items = document.querySelectorAll('.draggable-item');
    if (items.length === 0 && !activeSVGTemplate) {
        alert("Canvas kosong! Tidak ada yang bisa di-export. 🥋");
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = "PREPARING PRINT... ⏳";
    btn.disabled = true;

    // --- 1. HIDE PLACEHOLDERS (e.g. [ID: p1_name]) ---
    const placeholders = [];
    if (activeSVGTemplate) {
        const textNodes = activeSVGTemplate.querySelectorAll('text, tspan');
        textNodes.forEach(node => {
            if (node.textContent.includes('[ID:')) {
                placeholders.push({ node: node, originalText: node.textContent });
                node.textContent = ""; // Hide
            }
        });
    }

    // --- 2. Calculate Bounding Box & Prep Canvas ---
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(el => {
        const x = parseFloat(el.dataset.x) || 0;
        const y = parseFloat(el.dataset.y) || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + el.offsetWidth);
        maxY = Math.max(maxY, y + el.offsetHeight);
    });

    connections.forEach(c => {
        const f = document.getElementById(c.from);
        const t = document.getElementById(c.to);
        if (!f || !t) return;
        const x1 = (c.fromSide === 'left' ? parseFloat(f.dataset.x) : parseFloat(f.dataset.x) + f.offsetWidth);
        const x2 = (c.toSide === 'left' ? parseFloat(t.dataset.x) : parseFloat(t.dataset.x) + t.offsetWidth);
        let midX = (c.fromSide === c.toSide) ? (c.fromSide === 'right' ? Math.max(x1, x2) + 40 : Math.min(x1, x2) - 40) : (x1 + (x2 - x1) / 2);
        minX = Math.min(minX, x1, x2, midX);
        maxX = Math.max(maxX, x1, x2, midX);
    });

    const contentW = maxX - minX + 100;
    const contentH = maxY - minY + 100;
    const canvas = document.getElementById('canvas');
    const originalZoom = currentZoom;
    const originalTX = canvasOffsetX;
    const originalTY = canvasOffsetY;
    const originalW = canvas.style.width;
    const originalH = canvas.style.height;

    let finalTX = -minX + 50;
    let finalTY = -minY + 50;
    let finalW = contentW;
    let finalH = contentH;

    if (activeSVGTemplate) {
        finalTX = 0;
        finalTY = 0;
        finalW = activeSVGTemplate.viewBox.baseVal.width || activeSVGTemplate.width.baseVal.value || contentW;
        finalH = activeSVGTemplate.viewBox.baseVal.height || activeSVGTemplate.height.baseVal.value || contentH;
    }

    setUIForCapture(true);
    canvas.style.transform = `translate(${finalTX}px, ${finalTY}px) scale(1)`;
    canvas.style.width = finalW + 'px';
    canvas.style.height = finalH + 'px';

    try {
        const capture = await html2canvas(canvas, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            logging: false,
            width: finalW,
            height: finalH
        });

        const imgData = capture.toDataURL('image/png');

        if (asImage) {
            const link = document.createElement('a');
            link.download = `Kensho_Print_F4_${new Date().getTime()}.png`;
            link.href = imgData;
            link.click();
        } else {
            const pdf = new jspdf.jsPDF('l', 'mm', [330, 210]);
            pdf.addImage(imgData, 'PNG', 0, 0, 330, 210);
            pdf.save(`Kensho_Print_F4_${new Date().getTime()}.pdf`);
        }

    } catch (err) {
        console.error("Export failed:", err);
        alert("Gagal mengekspor. Periksa koneksi internet. 🥋");
    } finally {
        // --- 3. RESTORE PLACEHOLDERS ---
        placeholders.forEach(p => {
            p.node.textContent = p.originalText;
        });

        setUIForCapture(false);
        canvas.style.transform = `translate(${originalTX}px, ${originalTY}px) scale(${originalZoom})`;
        canvas.style.width = originalW;
        canvas.style.height = originalH;
        updateCanvasTransform();

        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
window.onload = () => {
    drawLines();

    // STUDIO LAUNCHER AUTO-CHECK
    const lcn = document.getElementById('studio-launcher');
    const masterHeader = document.querySelector('.master-header-item');
    if (lcn) {
        if (!masterHeader) {
            lcn.style.display = 'flex';
            lcn.style.opacity = '1';
        } else {
            lcn.style.display = 'none';
            document.getElementById('activeModuleName').textContent = 'BRACKET BUILDER (16-MAX)';
        }
    }

    // --- AUTO-MIGRATE OLD BOXES ---
    setTimeout(() => {
        const boxes = document.querySelectorAll('.smart-atlet-box');
        boxes.forEach(box => {
            box.style.height = '120px';
            const nameInput = box.querySelector('.n-name-input');
            if (nameInput) nameInput.style.fontSize = '20px';
        });

        // localStorage.removeItem('kensho_builder_backup'); // DISABLED: User wants local storage now

        // --- RESTORE FROM LOCAL BACKUP ---
        const localData = localStorage.getItem('kensho_builder_backup');
        if (localData) {
            console.log("Restoring from local backup... 💾");
            applyState(localData);

            // Visual feedback
            const statusName = document.getElementById('activeTemplateName');
            if (statusName) {
                statusName.textContent = "Draft (Protected Locally 💾)";
                statusName.style.color = "#6366f1";
            }
        }

        drawLines();
    }, 500);

    // --- SYNC FIREBASE AUTH ---
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log("Auth ready, loading templates... ☁️");
            loadTemplates();
        } else {
            console.warn("User not authenticated yet...");
        }
    });
};

// --- SVG TEMPLATE ENGINE (ULTRA SYNC) ---

let activeSVGTemplate = null;

async function handleSVGUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        loadSVGTemplate(content);
    };
    reader.readAsText(file);
}

function loadSVGTemplate(svgContent, isRestoring = false) {
    const layer = document.getElementById('template-svg-layer');
    if (!layer) return;

    // --- SANITIZE SVG CONTENT (Remove invalid height/width="auto") ---
    const sanitized = svgContent.replace(/height=["']auto["']/gi, '').replace(/width=["']auto["']/gi, '');
    layer.innerHTML = sanitized;
    activeSVGTemplate = layer.querySelector('svg');

    if (activeSVGTemplate) {
        // Ensure SVG is responsive within layer
        activeSVGTemplate.setAttribute('width', '100%');
        activeSVGTemplate.removeAttribute('height'); // Height should be auto by default if width is set or handled by CSS
        activeSVGTemplate.style.height = 'auto';
        activeSVGTemplate.style.display = 'block';

        // --- INJECT SVG MAPPER LISTENERS ---
        const textNodes = activeSVGTemplate.querySelectorAll('text, tspan');
        textNodes.forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                selectSVGElement(node);
            });
            makeSVGDraggable(node);
        });

        // --- PRECISION CLICK LISTENER (FOR NEW TAGS) ---
        activeSVGTemplate.addEventListener('click', (e) => {
            // Broaden detection: Click on SVG background or non-text elements
            if (e.target.tagName !== 'text' && e.target.tagName !== 'tspan') {
                const coords = getSVGCoordinates(e);
                lastSVGClickCoord = coords; // CRITICAL: Update global state

                if (isWizardMode) {
                    const currentTarget = wizardQueue[wizardIndex];
                    spawnSVGTag(currentTarget.id, coords.x, coords.y);
                    wizardStep(1); // Advance wizard
                    return;
                }

                // Clear selections
                if (selectedSVGElement) selectedSVGElement.classList.remove('selected-svg-node');
                selectedSVGElement = null;
                selectedItems = [];

                showClickMarker(coords.x, coords.y);
                updateInspector();
            }
        });

        console.log(`SVG Template Loaded with ${textNodes.length} interactive nodes! 🎨`);
        if (!isRestoring) syncDataToSVG(); // Initial sync only if fresh load
    }
}

function getSVGCoordinates(event) {
    if (!activeSVGTemplate) return { x: 0, y: 0 };
    const pt = activeSVGTemplate.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgP = pt.matrixTransform(activeSVGTemplate.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
}

function showClickMarker(x, y) {
    // Remove old marker
    activeSVGTemplate.querySelectorAll('.svg-click-marker').forEach(m => m.remove());

    const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    markerGroup.setAttribute('class', 'svg-click-marker');

    // Simple Static Crosshair
    const size = 8;
    const lines = [
        { x1: x - size, y1: y, x2: x + size, y2: y }, // Horizontal
        { x1: x, y1: y - size, x2: x, y2: y + size }  // Vertical
    ];
    lines.forEach(l => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', l.x1);
        line.setAttribute('y1', l.y1);
        line.setAttribute('x2', l.x2);
        line.setAttribute('y2', l.y2);
        line.setAttribute('stroke', '#6366f1');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', '0.8');
        markerGroup.appendChild(line);
    });

    activeSVGTemplate.appendChild(markerGroup);
}

// --- DRAG-TO-POSITION ENGINE FOR SVG TAGS ---
function makeSVGDraggable(node) {
    node.style.cursor = 'move';
    node.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        e.stopPropagation();

        isDraggingSVG = true;
        selectSVGElement(node);

        const coords = getSVGCoordinates(e);
        const nodeX = parseFloat(node.getAttribute('x')) || 0;
        const nodeY = parseFloat(node.getAttribute('y')) || 0;

        // Store offset
        node.dataset.dragOffsetX = coords.x - nodeX;
        node.dataset.dragOffsetY = coords.y - nodeY;
    });
}

window.addEventListener('mousemove', (e) => {
    if (!isDraggingSVG || !selectedSVGElement) return;

    const coords = getSVGCoordinates(e);
    const offsetX = parseFloat(selectedSVGElement.dataset.dragOffsetX) || 0;
    const offsetY = parseFloat(selectedSVGElement.dataset.dragOffsetY) || 0;

    const newX = coords.x - offsetX;
    const newY = coords.y - offsetY;

    selectedSVGElement.setAttribute('x', newX);
    selectedSVGElement.setAttribute('y', newY);

    // Live update inspector coords if open
    const xInput = document.getElementById('svgPropX');
    const yInput = document.getElementById('svgPropY');
    if (xInput) xInput.value = Math.round(newX);
    if (yInput) yInput.value = Math.round(newY);
});

window.addEventListener('mouseup', () => {
    if (isDraggingSVG) {
        isDraggingSVG = false;
        saveState();
    }
});

function updateSVGNodePos(axis, val) {
    if (!selectedSVGElement) return;
    selectedSVGElement.setAttribute(axis, val);
    saveState();
}

function selectSVGElement(node) {
    // Clear builder selection
    selectedItems = [];
    document.querySelectorAll('.draggable-item.selected').forEach(el => el.classList.remove('selected'));

    // Update SVG selection state
    if (selectedSVGElement) selectedSVGElement.classList.remove('selected-svg-node');
    selectedSVGElement = node;
    selectedSVGElement.classList.add('selected-svg-node');

    updateInspector();
}

// --- 4. GLOBAL CLICK HANDLER (DESELECTION) ---
window.addEventListener('click', (e) => {
    // If clicking on canvas background or outside interactive zones
    if (e.target.id === 'canvas' || e.target.id === 'canvas-container' || e.target.tagName === 'svg') {
        // Clear Builder Selection
        selectedItems = [];
        document.querySelectorAll('.draggable-item.selected').forEach(el => el.classList.remove('selected'));

        // Clear SVG Selection
        if (selectedSVGElement) {
            selectedSVGElement.classList.remove('selected-svg-node');
            selectedSVGElement = null;
        }

        updateInspector();
    }
});

function syncDataToSVG() {
    if (!activeSVGTemplate) return;

    // Helper to force uppercase
    const toUpper = (str) => (str || "").toString().toUpperCase();

    // --- 0. SYNC HEADERS (EVENT, CLASS, TATAMI, POOL, DATE, DURATION) ---
    const masterHeader = document.querySelector('.draggable-item.master-header');
    if (masterHeader) {
        const mappings = {
            'h_event': '.master-header-event-name',
            'h_class': '.master-header-title',
            'h_tatami': '.master-meta-input',
            'h_pool': '.master-meta-input:nth-of-type(2)',
            'h_date': '.master-meta-input:nth-of-type(3)',
            'h_duration': '.master-meta-input:nth-of-type(4)'
        };

        for (const [id, selector] of Object.entries(mappings)) {
            const svgEl = activeSVGTemplate.getElementById(id);
            if (svgEl) {
                const sourceEl = masterHeader.querySelector(selector);
                let val = "";
                if (sourceEl) {
                    val = (sourceEl.tagName === 'INPUT' || sourceEl.tagName === 'TEXTAREA') ? sourceEl.value : sourceEl.textContent;
                }
                svgEl.textContent = id.includes('date') || id.includes('duration') ? val : toUpper(val);
            }
        }
    }

    // --- 1. SYNC BRACKET UNITS (PX_...) ---
    const boxes = document.querySelectorAll('.draggable-item.smart-atlet-box');
    boxes.forEach(box => {
        const logId = box.dataset.logicalId ? box.dataset.logicalId.toLowerCase() : null;
        if (!logId) return;

        // Nama Atlet
        const nameVal = box.querySelector('.n-name-input')?.value || "";
        const nameTarget = activeSVGTemplate.getElementById(`${logId}_name`);
        if (nameTarget) nameTarget.textContent = toUpper(nameVal);

        // Kontingen
        const contVal = box.querySelector('.n-contingent-input')?.value || "";
        const contTarget = activeSVGTemplate.getElementById(`${logId}_cont`);
        if (contTarget) contTarget.textContent = toUpper(contVal);

        // Skor
        const scoreVal = box.querySelector('.n-score-input')?.value || "0";
        const scoreTarget = activeSVGTemplate.getElementById(`${logId}_score`);
        if (scoreTarget) scoreTarget.textContent = scoreVal;

        // --- SENSHU / PENALTY COMBINED (ID: logid_sp) ---
        const spTarget = activeSVGTemplate.getElementById(`${logId}_sp`);
        if (spTarget) {
            const hasSenshu = box.dataset.senshu === 'true';
            const penalty = box.dataset.penalty || "";
            let spText = "";

            if (hasSenshu && penalty) spText = `S / ${penalty}`;
            else if (hasSenshu) spText = "S";
            else if (penalty) spText = penalty;

            spTarget.textContent = spText;
        }
    });

    // --- 3. AUTO-SYNC WINNER TABLE (WINX_...) ---
    // If a box is marked as a winner (e.g., has a check/crown or specific label)
    // We can populate the winner table. This is basic logic:
    const winners = Array.from(document.querySelectorAll('.is-winner'));
    winners.forEach((winBox, index) => {
        const idIdx = (index + 1);
        const name = winBox.querySelector('.n-name-input')?.value || "";
        const cont = winBox.querySelector('.n-contingent-input')?.value || "";

        const winNameTarget = activeSVGTemplate.getElementById(`win${idIdx}_name`);
        const winContTarget = activeSVGTemplate.getElementById(`win${idIdx}_cont`);

        if (winNameTarget) winNameTarget.textContent = toUpper(name);
    });
}

function downloadSVG() {
    if (!activeSVGTemplate) {
        alert("Belum ada SVG yang dimuat! 🎨");
        return;
    }

    // 1. Clone the SVG to manipulate without affecting live view
    const clone = activeSVGTemplate.cloneNode(true);

    // 2. Clean up UI markers and handlers from clone
    clone.querySelectorAll('.svg-click-marker, .selected-svg-node').forEach(el => el.remove());

    // Remove temporary classes
    clone.querySelectorAll('*').forEach(el => {
        el.classList.remove('selected-svg-node');
        if (el.getAttribute('class') === "") el.removeAttribute('class');
    });

    // 3. Prepare text content (Remove [ID: ...] placeholders)
    clone.querySelectorAll('text, tspan').forEach(node => {
        if (node.textContent.includes('[ID:')) {
            node.textContent = "-";
        }
    });

    // 4. Serialize and Trigger Download
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Kensho_Template_Export_${new Date().getTime()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- WIZARD ENGINE ---
function startWizard() {
    isWizardMode = true;
    wizardIndex = 0;
    wizardQueue = [];

    // 1. Generate Headers
    const headers = [
        { id: 'h_event', label: 'Nama Event' },
        { id: 'h_class', label: 'Kategori / Kelas' },
        { id: 'h_tatami', label: 'Tatami' },
        { id: 'h_pool', label: 'Pool' },
        { id: 'h_date', label: 'Tanggal' },
        { id: 'h_duration', label: 'Durasi' }
    ];
    wizardQueue.push(...headers);

    // 2. Generate Athletes P1-P16
    for (let i = 1; i <= 16; i++) {
        wizardQueue.push(
            { id: `p${i}_name`, label: `Atlet ${i}: Nama` },
            { id: `p${i}_cont`, label: `Atlet ${i}: Kontingen` },
            { id: `p${i}_score`, label: `Atlet ${i}: Skor` },
            { id: `p${i}_sp`, label: `Atlet ${i}: Senshu/Penalty` }
        );
    }

    // 3. Generate Winners
    for (let i = 1; i <= 4; i++) {
        wizardQueue.push(
            { id: `win${i}_name`, label: `Pemenang ${i}: Nama` },
            { id: `win${i}_cont`, label: `Pemenang ${i}: Kontingen` }
        );
    }

    updateInspector();
    closeAllFlyouts();
}

function stopWizard() {
    isWizardMode = false;
    updateInspector();
}

function wizardStep(delta) {
    wizardIndex += delta;
    if (wizardIndex < 0) wizardIndex = 0;
    if (wizardIndex >= wizardQueue.length) {
        alert("Wizard Selesai! Semua ID sudah diproses. 🎉");
        stopWizard();
        return;
    }
    updateInspector();
}
