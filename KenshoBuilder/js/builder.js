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
            imageSrc: el.querySelector('img')?.src || "",
            color: el.querySelector('.indicator')?.classList.contains('red') ? 'red' : (el.querySelector('.indicator')?.classList.contains('blue') ? 'blue' : 'neutral'),
            hasBorder: el.classList.contains('has-border'),
            textAlign: el.querySelector('input, textarea') ? el.querySelector('input, textarea').style.textAlign : 'center',
            alignItems: el.style.alignItems,
            idLabel: el.dataset.idLabel || "",
            isLocked: el.classList.contains('is-locked')
        });
    });
    return JSON.stringify({ items, connections });
}

// (Remaining logic from build.js will be merged here or kept in organized chunks)
// For brevity and to ensure correctness, I will copy the essential functions now.

// --- ENGINE CORE ---

let connections = [];
let sourceDotId = null;
let selectedItems = [];

// ADD ITEM (NEXUS SMART-CARD: FLOATING EDITION v2)
function addItem(type, color, w = 400, h = 75, idLabel = "", textAlign = 'center', startX = null, startY = null, forceId = null) {
    // SMART SIZE INHERITANCE: Follow existing box size if available
    const existingRef = document.querySelector(type === 'title' ? '.title-box' : '.smart-atlet-box');
    if (existingRef) {
        w = parseFloat(existingRef.style.width) || w;
        h = parseFloat(existingRef.style.height) || h;
    }

    const id = forceId || ('item-' + Date.now());
    const div = document.createElement('div');
    div.id = id;

    let classNames = 'draggable-item';
    if (type === 'title') classNames += ' title-box';
    else if (type === 'atlet-score') classNames += ' smart-atlet-box';

    div.className = classNames;
    div.dataset.idLabel = idLabel;

    const posX = startX !== null ? startX : 100;
    const posY = startY !== null ? startY : 100;

    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
    div.style.transform = `translate(${posX}px, ${posY}px)`;
    div.dataset.x = posX;
    div.dataset.y = posY;

    let contentHTML = `
        <div class="move-handle">⠿ MOVE</div>
        <div class="conn-dot dot-left" onclick="handleDotClick('${id}', 'left')"></div>
        <div class="conn-dot dot-right" onclick="handleDotClick('${id}', 'right')"></div>
    `;

    if (type === 'atlet-score') {
        const indicatorColor = color === 'red' ? 'red' : (color === 'blue' ? 'blue' : 'neutral');
        contentHTML += `
            <!-- Floating Labels (Semantic Edition) -->
            <div class="n-floating-label label-senshu-penalty">
                <span class="senshu-bold">SENSHU</span> 
                <span class="sep-black">|</span> 
                <span class="penalty-bold">PENALTY</span>
            </div>
            <div class="n-floating-label label-kata">NAMA KATA</div>

            <div class="indicator ${indicatorColor}"></div>
            <div class="n-info-section">
                <input class="n-top-meta" value="${idLabel || id.toUpperCase()}">
                <textarea class="n-name-input" placeholder="NAMA PESERTA"></textarea>
                <div class="n-info-divider"></div>
                <input class="n-contingent-input" placeholder="KONTINGEN">
            </div>
            <div class="n-score-box">
                <input class="n-score-input" placeholder="0">
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
    const boxW = 260;
    const boxH = 75;
    const vGap = 100;
    const hGap = 300;

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
        const item = addItem('atlet-score', color, boxW, boxH, label, 'left', x, y);
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

    if (selectedItems.length === 0) {
        propContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full opacity-30 py-20 text-center">
                <svg class="w-10 h-10 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p class="text-[9px] font-bold uppercase tracking-widest leading-relaxed">Pilih elemen untuk<br>mengatur detil</p>
            </div>`;
        return;
    }

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
    if (el.classList.contains('smart-atlet-box')) {
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

function updateItemData(id, key, val) {
    const el = document.getElementById(id);
    if (!el) return;

    if (key === 'name') {
        const input = el.querySelector('.n-name-input');
        if (input) input.value = val;
    } else if (key === 'contingent') {
        const input = el.querySelector('.n-contingent-input');
        if (input) input.value = val;
    } else if (key === 'width') {
        el.style.width = val + 'px';
        const badge = el.querySelector('.n-size-badge');
        if (badge) badge.textContent = `${Math.round(val)}px × ${Math.round(parseFloat(el.style.height))}px`;
    } else if (key === 'height') {
        el.style.height = val + 'px';
        const badge = el.querySelector('.n-size-badge');
        if (badge) badge.textContent = `${Math.round(parseFloat(el.style.width))}px × ${Math.round(val)}px`;
    }

    drawLines();
    saveState();
}

function deleteItem(id) {
    if (confirm("Hapus elemen ini dari canvas?")) {
        const el = document.getElementById(id);
        if (el) el.remove();
        selectedItems = [];
        updateInspector();
        drawLines();
        saveState();
    }
}

let sourceConn = null;

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

// --- MAGIC AUTO-PAIRING ENGINE v4.5 (F4 Optimized & Smart Sync) ---
function magicAutoPair() {
    // 1. Dapatkan semua kotak yang belum punya koneksi keluar
    const allItems = Array.from(document.querySelectorAll('.smart-atlet-box'));
    const connectedFromIds = connections.map(c => c.from);

    const candidates = allItems.filter(item => !connectedFromIds.includes(item.id))
        .sort((a, b) => parseFloat(a.dataset.y) - parseFloat(b.dataset.y));

    if (candidates.length < 2) {
        alert("Butuh minimal sepasang (Lengkap) untuk membuat babak baru! ✨");
        return;
    }

    let pairedThisRun = 0;
    const boxW = 400;
    const boxH = 75;
    const xGap = 60;

    // ATURAN JARAK (F4 Optimization)
    const gapInsideMatch = 30; // Jarak antar kotak merah & biru dalam 1 match
    const gapBetweenMatches = 50; // Jarak antar rombongan match (mencegah garis menempel)

    let currentRefY = parseFloat(candidates[0].dataset.y);

    // LOGIKA PAIRING: SI MERAH (GANJIL) MENCARI SI BIRU (GENAP) DI BAWAHNYA
    for (let i = 0; i < candidates.length - 1; i++) {
        const currentBox = candidates[i];
        const currentIndicator = currentBox.querySelector('.indicator');

        // Cek apakah kotak ini MERAH (Starter Pasangan)
        if (!currentIndicator || !currentIndicator.classList.contains('red')) {
            continue;
        }

        // Cari pasangan BIRU (Genap) yang tepat di bawahnya
        const nextBox = candidates[i + 1];
        const nextIndicator = nextBox?.querySelector('.indicator');

        if (!nextIndicator || !nextIndicator.classList.contains('blue')) {
            continue;
        }

        const parent1 = currentBox; // MERAH (Atas)
        const parent2 = nextBox;    // BIRU (Bawah)

        // DETEKSI LABEL INDUK
        const parentLabel = parent1.querySelector('.n-top-meta')?.value || '';
        const shouldSnap = parentLabel.includes("PENYISIHAN") || parentLabel.startsWith("ITEM-") || !parentLabel;

        let p1Y, p2Y;

        if (shouldSnap) {
            // --- SNAP TO GRID (Merapikan Parent Manual/Penyisihan Only) ---
            if (pairedThisRun > 0) {
                currentRefY += boxH + gapBetweenMatches;
            }
            p1Y = currentRefY;
            p2Y = p1Y + boxH + gapInsideMatch;

            parent1.style.transform = `translate(${parent1.dataset.x}px, ${p1Y}px)`;
            parent1.dataset.y = p1Y;

            parent2.style.transform = `translate(${parent2.dataset.x}px, ${p2Y}px)`;
            parent2.dataset.y = p2Y;

            currentRefY = p2Y;
        } else {
            // --- RESPECT EXISTING POSITIONS (Babak Lanjutan) ---
            p1Y = parseFloat(parent1.dataset.y);
            p2Y = parseFloat(parent2.dataset.y);
            currentRefY = Math.max(currentRefY, p2Y);
        }

        // --- PROGRESI ANAK ---
        const x1 = parseFloat(parent1.dataset.x);
        const spawnX = x1 + boxW + xGap;
        const spawnY = (p1Y + p2Y) / 2;
        let roundBase = "QUARTER";

        if (parentLabel.includes("PENYISIHAN")) roundBase = "QUARTER";
        else if (parentLabel.includes("QUARTER")) roundBase = "SEMI";
        else if (parentLabel.includes("SEMI")) roundBase = "FINAL";
        else if (parentLabel.includes("FINAL")) roundBase = "WINNER";

        // Hitung index untuk pelabelan & warna
        const existingOfSameRound = Array.from(document.querySelectorAll('.n-top-meta'))
            .filter(input => input.value.startsWith(roundBase)).length;

        const nextIndex = existingOfSameRound + 1;

        // Label & Warna Cerdas
        let fullLabel = roundBase === "WINNER" ? "WINNER" : `${roundBase}_${nextIndex < 10 ? '0' + nextIndex : nextIndex}`;
        const childColor = (nextIndex % 2 !== 0) ? 'red' : 'blue';

        // LAHIRKAN ANAK
        const childBox = addItem('atlet-score', childColor, boxW, boxH, fullLabel, 'left', spawnX, spawnY);

        // PENTING: Isi Smart ID agar tidak kosong di Inspector
        childBox.dataset.smartId = fullLabel;

        // AUTO-CONNECT
        connections.push({ from: parent1.id, fromSide: 'right', to: childBox.id, toSide: 'left', color: '#cbd5e1' });
        connections.push({ from: parent2.id, fromSide: 'right', to: childBox.id, toSide: 'left', color: '#cbd5e1' });

        i++;
        pairedThisRun++;
    }

    if (pairedThisRun > 0) {
        drawLines();
        saveState();
    } else {
        alert("Tidak ditemukan pasangan Merah-Biru yang valid untuk dipasangkan! 🥋");
    }
}

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

    state.items.forEach(item => {
        // Reuse addItem logic with forceId
        addItem(item.type, item.color, parseFloat(item.width), parseFloat(item.height), item.idLabel, item.textAlign, parseFloat(item.x), parseFloat(item.y), item.id);
    });

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


// Initialize on start
window.onload = () => {
    saveState(); // Initial state
    drawLines();
};
