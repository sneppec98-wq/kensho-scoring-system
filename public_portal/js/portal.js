import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { bulkPrintBrackets } from './modules/print/bulk-print-brackets.js';

// Global data store
let allAthletes = [];
let allClasses = [];
let eventName = "";
let eventLogo = "";

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id') || 'WgVTkA88gmI6ogrW39hf';

// Global Event State
let currentEventData = null;
let activeTab = 'roster';

// Bracket State
let svgDoc = null;
const GOLDEN_PRESETS = {
    2: ['fn1', 'fn2'],
    3: ['sn3', 'sn4', 'fn1'],
    4: ['sn1', 'sn2', 'sn3', 'sn4'],
    5: ['qn7', 'qn8', 'sn1', 'sn2', 'sn3'],
    6: ['qn3', 'qn4', 'qn7', 'qn8', 'sn1', 'sn3'],
    7: ['qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8', 'sn1'],
    8: ['qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8'],
    9: ['p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7'],
    10: ['p_n_7', 'p_n_8', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn6', 'qn7'],
    11: ['p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn7'],
    12: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5', 'qn7'],
    13: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5'],
    14: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn5'],
    15: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1'],
    16: ['p_n_1', 'p_n_2', 'p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16']
};

async function init() {
    if (!eventId) {
        document.getElementById('participantList').innerHTML = `
            <div class="neu-flat p-20 rounded-[2.5rem] text-center">
                <h3 class="text-xl font-bold text-red-400 uppercase italic">Event ID Tidak Ditemukan</h3>
                <p class="text-xs opacity-50 mt-4">Pastikan Anda menggunakan link yang valid dari panitia.</p>
            </div>
        `;
        return;
    }

    try {
        // Fetch Event Data
        const eventDoc = await getDoc(doc(db, "events", eventId));
        const logoImg = document.getElementById('mainLogo');
        const logoContainer = document.getElementById('eventLogoContainer');

        if (eventDoc.exists()) {
            const data = eventDoc.data();
            eventName = data.name || "NAMA EVENT TIDAK TERSEDIA";
            document.getElementById('eventName').innerText = eventName;
            document.title = `${eventName} | Official Portal`;

            if (data.logo) {
                eventLogo = data.logo;
                logoImg.src = data.logo;
                logoContainer.classList.remove('opacity-0');
            }
        } else {
            document.getElementById('eventName').innerText = "LINK EVENT TIDAK VALID";
            logoContainer.classList.add('hidden');
        }

        // --- Real-time Event Listener (for Locking) ---
        onSnapshot(doc(db, "events", eventId), (snap) => {
            if (snap.exists()) {
                const newData = snap.data();

                // If visibility changed, we might need to refresh the current view
                const flagsChanged = currentEventData && (
                    newData.isBracketPublic !== currentEventData.isBracketPublic ||
                    newData.isWinnersPublic !== currentEventData.isWinnersPublic ||
                    newData.isMedalsPublic !== currentEventData.isMedalsPublic ||
                    newData.isSchedulePublic !== currentEventData.isSchedulePublic
                );

                currentEventData = newData;

                // Sync UI elements
                eventName = newData.name || eventName;
                document.getElementById('eventName').innerText = eventName;

                if (flagsChanged) {
                    console.log("🔒 Public access flags updated, re-evaluating current tab...");
                    // Reset cache if winners/medals become locked
                    if (!newData.isWinnersPublic || !newData.isMedalsPublic) cachedWinners = null;

                    // Re-trigger current tab logic
                    switchTab(activeTab);
                }
            }
        });

        // Fetch Classes (for lookup)
        const classSnap = await getDocs(collection(db, `events/${eventId}/classes`));
        allClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch Athletes
        const athleteSnap = await getDocs(query(collection(db, `events/${eventId}/athletes`), orderBy("name", "asc")));
        allAthletes = athleteSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // --- Bracket Initialization ---
        async function initializeBrackets() {
            const openSelector = document.getElementById('bracketClassSelectorOpen');
            const festivalSelector = document.getElementById('bracketClassSelectorFestival');

            // 1. Fetch ALL brackets to see which classes have participants
            const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
            const activeClassNames = bracketSnap.docs.map(doc => doc.id); // Firestore IDs are class names

            // 2. Filter allClasses to only include those that are "Active"
            const activeClasses = allClasses.filter(c => activeClassNames.includes(c.name));

            // 3. Split into Open and Festival
            const openClasses = activeClasses.filter(c => !c.code.toString().toUpperCase().startsWith('F'));
            const festivalClasses = activeClasses.filter(c => c.code.toString().toUpperCase().startsWith('F'));

            // Populate Open Selector
            openSelector.innerHTML = '<option value="">-- PILIH KELAS OPEN --</option>' +
                openClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            // Populate Festival Selector
            festivalSelector.innerHTML = '<option value="">-- PILIH KELAS FESTIVAL --</option>' +
                festivalClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

            // Event Listeners
            openSelector.onchange = (e) => {
                if (e.target.value) {
                    festivalSelector.value = ""; // Clear other selector
                    loadBracket(e.target.value);
                }
            };

            festivalSelector.onchange = (e) => {
                if (e.target.value) {
                    openSelector.value = ""; // Clear other selector
                    loadBracket(e.target.value);
                }
            };
        }
        await initializeBrackets();

        render(allAthletes);

    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('participantList').innerHTML = `
            <div class="neu-flat p-20 rounded-[2.5rem] text-center">
                <h3 class="text-xl font-bold text-red-400 uppercase italic">Gagal Memuat Data</h3>
                <p class="text-xs opacity-50 mt-4">${err.message}</p>
            </div>
        `;
    }
}

function render(athletes) {
    const listContainer = document.getElementById('participantList');
    const totalCountEl = document.getElementById('totalCount');
    const filterValue = document.getElementById('contingentFilter').value.toUpperCase();

    // Filtering by Contingent (Searchable)
    const filtered = athletes.filter(a => {
        if (!filterValue) return true;
        return (a.team || "LAINNYA").toUpperCase().includes(filterValue);
    });

    totalCountEl.innerText = filtered.length;

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">
                Tidak ada data peserta yang cocok.
            </div>
        `;
        return;
    }

    // Grouping by Team
    const grouped = {};
    filtered.forEach(a => {
        const team = (a.team || "LAINNYA").toUpperCase();
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(a);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(team => {
        html += `
            <div class="stagger-card">
                <div class="flex items-center gap-4 mb-6">
                    <h4 class="text-xl font-black uppercase text-slate-800 tracking-tighter">${team}</h4>
                    <div class="flex-1 h-[1px] bg-slate-200"></div>
                    <span class="text-[10px] font-black text-slate-400 border border-slate-200 px-4 py-1.5 rounded-full">${grouped[team].length} ATLET TERDAFTAR</span>
                </div>
                
                <div class="premium-card overflow-hidden">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left">
                            <thead class="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                <tr>
                                    <th class="py-5 pl-8 w-20">NO</th>
                                    <th class="py-5">PESERTA / TIM</th>
                                    <th class="py-5 text-center">GENDER</th>
                                    <th class="py-5">KELAS & KATEGORI</th>
                                    <th class="py-5 text-right pr-8">TTL</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${grouped[team].map((a, idx) => {
            const classInfo = allClasses.find(c =>
                (c.code && a.classCode && c.code.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
                (c.name && a.className && c.name.toString().trim().toUpperCase() === a.className.toString().trim().toUpperCase())
            );

            return `
                                        <tr class="hover:bg-slate-50 transition-colors group">
                                            <td class="py-6 pl-8 font-black text-slate-300 text-xs">#${(idx + 1).toString().padStart(2, '0')}</td>
                                            <td class="py-6">
                                                <div class="font-extrabold text-slate-900 uppercase text-sm tracking-tight">${a.name}</div>
                                                ${a.members ? `<div class="text-[10px] text-slate-400 font-bold mt-1 uppercase">${a.members.join(', ')}</div>` :
                    (a.name2 ? `<div class="text-[10px] text-slate-400 font-bold mt-1 uppercase">${[a.name, a.name2, a.name3].filter(n => n).join(' & ')}</div>` : '')}
                                            </td>
                                            <td class="py-6 text-center">
                                                <span class="px-3 py-1 rounded-lg text-[10px] font-black ${a.gender === 'PUTRA' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}">
                                                    ${a.gender}
                                                </span>
                                            </td>
                                            <td class="py-6">
                                                <div class="flex flex-col">
                                                    <span class="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">${classInfo?.code || a.classCode || '-'}</span>
                                                    <span class="text-[11px] font-bold uppercase text-slate-600">${a.className}</span>
                                                </div>
                                            </td>
                                            <td class="py-6 text-right pr-8">
                                                <span class="text-[11px] font-bold text-slate-500">${a.birthDate || '-'}</span>
                                            </td>
                                        </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

// --- Tab System ---
window.switchTab = (tab) => {
    activeTab = tab;

    // Hide all tab content containers
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // Check if the tab is publicly available (except roster which is always public)
    let isLocked = false;
    if (currentEventData) {
        if (tab === 'bracket' && !currentEventData.isBracketPublic) isLocked = true;
        if (tab === 'winners' && !currentEventData.isWinnersPublic) isLocked = true;
        if (tab === 'medals' && !currentEventData.isMedalsPublic) isLocked = true;
        if (tab === 'schedule' && !currentEventData.isSchedulePublic) isLocked = true;
    }

    // Determine which view to show
    const targetId = isLocked ? 'view-locked' : `view-${tab}`;
    const activeView = document.getElementById(targetId);
    if (activeView) activeView.classList.remove('hidden');

    // Update buttons state
    const tabs = ['roster', 'bracket', 'winners', 'medals', 'schedule'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;

        if (t === tab) {
            btn.className = 'px-6 md:px-10 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all bg-white text-blue-600 shadow-sm';
        } else {
            btn.className = 'px-6 md:px-10 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all text-slate-400 hover:text-slate-600';
        }
    });

    // Load data if needed (only if UNLOCKED)
    if (!isLocked) {
        if (tab === 'winners') {
            loadWinnersData('winners');
        } else if (tab === 'medals') {
            loadWinnersData('medals');
        } else if (tab === 'schedule') {
            loadScheduleData();
        }
    }
};

// --- Bracket Engine ---
async function loadBracket(className) {
    const container = document.getElementById('bracketContainer');
    container.innerHTML = `<div class="animate-pulse flex flex-col items-center gap-4 py-20">
        <div class="w-12 h-12 bg-blue-100 rounded-full"></div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Menyiapkan Bagan...</p>
    </div>`;

    try {
        // Find class info to check if Festival
        const clsInfo = allClasses.find(c => c.name === className);
        const isFestival = (clsInfo?.code || "").toString().toUpperCase().startsWith('F');

        // Fetch Bracket Data from Firestore
        const bracketDoc = await getDoc(doc(db, `events/${eventId}/brackets`, className));
        if (!bracketDoc.exists()) {
            container.innerHTML = `<div class="text-center py-20">
                <p class="text-xs font-black text-slate-300 uppercase italic">Bagan Pertandingan Belum Digenerate Panitia</p>
            </div>`;
            return;
        }

        const bracketData = bracketDoc.data();
        const participants = bracketData.participants || [];

        if (isFestival) {
            renderFestivalTable(container, className, participants, bracketData.festivalResults || {});
            return;
        }

        // Load SVG
        const response = await fetch('assets/Master.svg');
        const svgText = await response.text();
        container.innerHTML = svgText;
        svgDoc = container.querySelector('svg');

        // Final Display Adjustments
        svgDoc.style.width = '100%';
        svgDoc.style.height = 'auto';
        svgDoc.style.maxWidth = '1000px';

        // Clean & Sync
        cleanSVG();
        syncHeaders(className);

        // Render Participants based on pattern
        const pattern = GOLDEN_PRESETS[participants.length] || [];
        toggleAllSlots(false);

        participants.forEach((p, idx) => {
            const slotId = pattern[idx];
            if (!slotId) return;

            // Fill Name & Team
            const nameEl = svgDoc.getElementById(slotId);
            if (nameEl) (nameEl.querySelector('tspan') || nameEl).textContent = p.name;

            // Fill Kontingen
            const num = slotId.match(/\d+/) ? slotId.match(/\d+/)[0] : "";
            const teamId = slotId.startsWith('p_n_') ? `p_k_${num}` : "";
            if (teamId) {
                const teamEl = svgDoc.getElementById(teamId);
                if (teamEl) (teamEl.querySelector('tspan') || teamEl).textContent = p.team || "-";
            }

            // Show Path
            showPath(slotId);
        });

        // Fill Matches/Winners if available
        if (bracketData.winners) {
            Object.keys(bracketData.winners).forEach(id => {
                const el = svgDoc.getElementById(id);
                if (el) (el.querySelector('tspan') || el).textContent = bracketData.winners[id];
            });
        }

    } catch (err) {
        console.error("Bracket Load Error:", err);
        container.innerHTML = `<p class="text-red-400 text-xs font-bold">Gagal memuat bagan: ${err.message}</p>`;
    }
}

function renderFestivalTable(container, className, participants, results) {
    let html = `
        <div class="w-full p-4 md:p-10 overflow-x-auto custom-scrollbar">
            <div class="mb-10 border-b border-slate-100 pb-8 text-center md:text-left">
                <h3 class="text-2xl font-black italic uppercase text-slate-900">${className}</h3>
                <p class="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2">KATEGORI FESTIVAL (HASIL PERTANDINGAN)</p>
            </div>
            <table class="w-full border-collapse border-[3px] border-slate-900 text-slate-900">
                <thead class="bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white">
                    <tr>
                        <th class="p-4 border-2 border-slate-700 w-24 text-center">HASIL AKA</th>
                        <th class="p-4 border-2 border-slate-700 bg-red-600">AKA (MERAH)</th>
                        <th class="p-4 border-2 border-slate-700 w-12 bg-slate-800 text-center">VS</th>
                        <th class="p-4 border-2 border-slate-700 bg-blue-600">AO (BIRU)</th>
                        <th class="p-4 border-2 border-slate-700 w-24 text-center">HASIL AO</th>
                    </tr>
                </thead>
                <tbody class="font-black uppercase text-[11px] italic">
    `;

    for (let i = 0; i < participants.length; i += 2) {
        const matchIdx = i / 2;
        const aka = participants[i];
        const ao = participants[i + 1] || { name: "BYE", team: "-" };
        const winnerSide = results[matchIdx];

        let akaBadge = '<div class="opacity-10">. . .</div>';
        let aoBadge = '<div class="opacity-10">. . .</div>';

        if (winnerSide === 'aka') {
            akaBadge = '<div class="px-3 py-1 bg-yellow-400 text-black text-[9px] rounded shadow-sm">JUARA 1</div>';
            aoBadge = '<div class="px-3 py-1 bg-slate-200 text-slate-600 text-[9px] rounded">JUARA 2</div>';
        } else if (winnerSide === 'ao') {
            aoBadge = '<div class="px-3 py-1 bg-yellow-400 text-black text-[9px] rounded shadow-sm">JUARA 1</div>';
            akaBadge = '<div class="px-3 py-1 bg-slate-200 text-slate-600 text-[9px] rounded">JUARA 2</div>';
        }

        html += `
            <tr class="border-b-2 border-slate-900 hover:bg-slate-50 transition-colors">
                <td class="p-6 border-r-2 border-slate-900 text-center">${akaBadge}</td>
                <td class="p-6 border-r-2 border-slate-900">
                    <div class="text-red-600">${aka.name}</div>
                    <div class="text-[9px] text-slate-400 non-italic">${aka.team}</div>
                </td>
                <td class="p-6 border-r-2 border-slate-900 bg-slate-50 text-center text-slate-400">VS</td>
                <td class="p-6 border-r-2 border-slate-900">
                    <div class="text-blue-600">${ao.name}</div>
                    <div class="text-[9px] text-slate-400 non-italic">${ao.team}</div>
                </td>
                <td class="p-6 text-center">${aoBadge}</td>
            </tr>
        `;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function cleanSVG() {
    if (!svgDoc) return;
    const placeholders = ["NAMA PESERTA", "SKOR", "NAMA EVENT", "KONTINGEN PESERTA", "KELAS KATEGORI", "1/1"];
    svgDoc.querySelectorAll('text, tspan').forEach(el => {
        if (placeholders.includes(el.textContent.trim())) el.textContent = "";
    });
}

function syncHeaders(className) {
    const eventEl = svgDoc.querySelector('#Nama_event');
    if (eventEl) (eventEl.querySelector('tspan') || eventEl).textContent = eventName;
    const classEl = svgDoc.querySelector('#Kelas_Kategori');
    if (classEl) (classEl.querySelector('tspan') || classEl).textContent = className;
}

function toggleAllSlots(active) {
    for (let i = 1; i <= 16; i++) {
        // P Round
        const pIds = [`p_n_${i}`, `p_k_${i}`, `n_k_${i}`, `S_${i}`, `sp_${i}`, `p_nama_1`];
        pIds.forEach(id => { const el = svgDoc.getElementById(id); if (el) el.style.opacity = active ? "1" : "0"; });
        // Bonus Q/S/F rounds for clearing
        if (i <= 8) [`qn${i}`, `qk${i}`, `qnk${i}`, `qs${i}`, `qsp${i}`].forEach(id => { const el = svgDoc.getElementById(id); if (el) el.style.opacity = active ? "1" : "0"; });
        if (i <= 4) [`sn${i}`, `sk${i}`, `snk${i}`, `ss${i}`, `ssp${i}`].forEach(id => { const el = svgDoc.getElementById(id); if (el) el.style.opacity = active ? "1" : "0"; });
        if (i <= 2) [`fn${i}`, `fk${i}`, `fnk${i}`, `fs${i}`, `fsp${i}`, `text5989`, `text5993`, `text5997`].forEach(id => { const el = svgDoc.getElementById(id); if (el) el.style.opacity = active ? "1" : "0"; });
    }
}

function showPath(startId) {
    let current = startId;
    const show = (id) => { const el = svgDoc.getElementById(id); if (el) el.style.opacity = "1"; };

    // Logic for downstream path
    const components = getSlotComponents(current);
    components.forEach(show);

    if (current.startsWith('p_n_')) {
        let x = parseInt(current.replace('p_n_', ''));
        showPath(`qn${Math.ceil(x / 2)}`);
    } else if (current.startsWith('qn')) {
        let x = parseInt(current.replace('qn', ''));
        showPath(`sn${Math.ceil(x / 2)}`);
    } else if (current.startsWith('sn')) {
        let x = parseInt(current.replace('sn', ''));
        showPath(`fn${x <= 2 ? '1' : '2'}`);
    }
}

function getSlotComponents(slotId) {
    if (slotId.startsWith('p_n_')) {
        const x = slotId.replace('p_n_', '');
        return [slotId, `p_k_${x}`, `n_k_${x}`, `S_${x}`, `sp_${x}`, (x === "1" ? "p_nama_1" : "")];
    }
    if (slotId.startsWith('qn')) {
        const x = slotId.replace('qn', '');
        return [`qn${x}`, `qk${x}`, `qnk${x}`, `qs${x}`, `qsp${x}`];
    }
    if (slotId.startsWith('sn')) {
        const x = slotId.replace('sn', '');
        return [`sn${x}`, `sk${x}`, `snk${x}`, `ss${x}`, `ssp${x}`];
    }
    if (slotId.startsWith('fn')) {
        return slotId === 'fn1' ? [`text5989`, `text5993`, `text5997`, `fs1`, `text5985`] : [`fn2`, `fk2`, `fnk2`, `fs2`, `fsp2`];
    }
    return [];
}

// --- Winners & Medals Engine ---
let cachedWinners = null;

async function loadWinnersData(mode = 'both') {
    if (cachedWinners) {
        if (mode === 'winners' || mode === 'both') renderWinnersList(cachedWinners);
        if (mode === 'medals' || mode === 'both') renderMedalTallyTable(cachedWinners);
        return;
    }

    const winnersList = document.getElementById('winnersList');
    const medalTally = document.getElementById('medalTally');

    if (winnersList) winnersList.innerHTML = `<div class="animate-pulse flex flex-col items-center gap-4 py-20">
        <div class="w-12 h-12 bg-blue-100 rounded-full"></div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">MENGUMPULKAN DATA JUARA...</p>
    </div>`;

    try {
        const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        const results = [];

        bracketSnap.forEach(docSnap => {
            const b = docSnap.data();
            const className = docSnap.id;
            const classInfo = allClasses.find(c => c.name === className);
            const isFestival = (classInfo?.code || "").toString().toUpperCase().startsWith('F');

            const classWinners = {
                className: className,
                classCode: classInfo?.code || "-",
                isFestival: isFestival,
                winners: [] // { rank: 1, name: '', team: '' }
            };

            if (isFestival) {
                // Festival logic: Gold for each match winner, Silver for loser
                const participants = b.participants || [];
                const res = b.festivalResults || {};

                for (let i = 0; i < participants.length; i += 2) {
                    const matchIdx = i / 2;
                    const aka = participants[i];
                    const ao = participants[i + 1];
                    const winnerSide = res[matchIdx];

                    if (winnerSide === 'aka') {
                        classWinners.winners.push({ rank: 1, name: aka.name, team: aka.team });
                        if (ao && ao.name !== "BYE") classWinners.winners.push({ rank: 2, name: ao.name, team: ao.team });
                    } else if (winnerSide === 'ao') {
                        classWinners.winners.push({ rank: 1, name: ao.name, team: ao.team });
                        classWinners.winners.push({ rank: 2, name: aka.name, team: aka.team });
                    }
                }
            } else {
                // Prestasi logic: Gold, Silver, Bronze from SVG IDs
                const d = b.data || {};

                // Gold
                const goldName = d['winner_nama'] || d['nama_juara_1'] || d['text5989'] || d['fn1'];
                // Note: text5989 is fn1 in Master.svg, fn1 is also a possible handle
                if (goldName && goldName !== "-" && goldName !== "NAMA PESERTA") {
                    const goldTeam = d['winner_kontingen'] || d['kontingen_juara_1'] || d['text5993'] || d['fk1'] || "-";
                    classWinners.winners.push({ rank: 1, name: goldName, team: goldTeam });
                }

                // Silver
                const silverName = d['nama_juara_2'] || d['fn2'];
                if (silverName && silverName !== "-" && silverName !== "NAMA PESERTA") {
                    const silverTeam = d['kontingen_juara_2'] || d['fk2'] || "-";
                    classWinners.winners.push({ rank: 2, name: silverName, team: silverTeam });
                }

                // Bronze A
                const bronzeAName = d['nama_juara_3_a'] || d['sn1']; // Fallback is simplified
                if (bronzeAName && bronzeAName !== "-" && bronzeAName !== "NAMA PESERTA") {
                    const bronzeATeam = d['kontingen_juara_3_a'] || d['sk1'] || "-";
                    classWinners.winners.push({ rank: 3, name: bronzeAName, team: bronzeATeam });
                }

                // Bronze B
                const bronzeBName = d['nama_juara_3_b'] || d['sn3'];
                if (bronzeBName && bronzeBName !== "-" && bronzeBName !== "NAMA PESERTA") {
                    const bronzeBTeam = d['kontingen_juara_3_b'] || d['sk3'] || "-";
                    classWinners.winners.push({ rank: 3, name: bronzeBName, team: bronzeBTeam });
                }
            }

            if (classWinners.winners.length > 0) {
                results.push(classWinners);
            }
        });

        // Sort results by class code or name
        results.sort((a, b) => a.className.localeCompare(b.className));

        cachedWinners = results;
        if (mode === 'winners' || mode === 'both') renderWinnersList(results);
        if (mode === 'medals' || mode === 'both') renderMedalTallyTable(results);

    } catch (err) {
        console.error("Load Winners Error:", err);
        winnersList.innerHTML = `<p class="text-red-400 text-xs font-bold text-center">Gagal memuat data juara: ${err.message}</p>`;
    }
}

function renderWinnersList(data) {
    const container = document.getElementById('winnersList');
    if (data.length === 0) {
        container.innerHTML = `<div class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">Belum ada data juara yang masuk.</div>`;
        return;
    }

    let html = '';
    data.forEach(item => {
        html += `
            <div class="stagger-card">
                <div class="flex items-center gap-4 mb-4">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-blue-600 uppercase tracking-widest">${item.classCode}</span>
                        <h4 class="text-lg font-black uppercase text-slate-800 tracking-tighter leading-none">${item.className}</h4>
                    </div>
                </div>
                <div class="premium-card p-6 md:p-8 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    ${item.winners.sort((a, b) => a.rank - b.rank).map(w => `
                        <div class="flex items-center gap-4 p-4 rounded-2xl ${w.rank === 1 ? 'bg-yellow-50/50 border border-yellow-100' : (w.rank === 2 ? 'bg-slate-50/50 border border-slate-100' : 'bg-orange-50/30 border border-orange-100/50')} transition-all hover:scale-[1.02]">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm
                                ${w.rank === 1 ? 'bg-yellow-400 text-yellow-900' : (w.rank === 2 ? 'bg-slate-300 text-slate-700' : 'bg-orange-400 text-orange-900')}">
                                <span class="text-xs font-black">${w.rank === 1 ? '🥇' : (w.rank === 2 ? '🥈' : '🥉')}</span>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[11px] font-black text-slate-900 uppercase truncate leading-tight">${w.name}</div>
                                <div class="text-[9px] font-bold text-slate-400 uppercase truncate mt-0.5">${w.team}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderMedalTallyTable(data) {
    const container = document.getElementById('medalTally');

    // Aggregate medals
    const tallies = {}; // { Team: { gold: 0, silver: 0, bronze: 0 } }

    data.forEach(cls => {
        cls.winners.forEach(w => {
            const team = (w.team || "LAINNYA").toUpperCase().trim();
            if (team === "-" || team === "") return;

            if (!tallies[team]) tallies[team] = { gold: 0, silver: 0, bronze: 0 };

            if (w.rank === 1) tallies[team].gold++;
            else if (w.rank === 2) tallies[team].silver++;
            else if (w.rank === 3) tallies[team].bronze++;
        });
    });

    const sortedTeams = Object.keys(tallies).map(team => ({
        name: team,
        ...tallies[team],
        total: tallies[team].gold + tallies[team].silver + tallies[team].bronze
    })).sort((a, b) => {
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.silver !== a.silver) return b.silver - a.silver;
        if (b.bronze !== a.bronze) return b.bronze - a.bronze;
        return a.name.localeCompare(b.name);
    });

    if (sortedTeams.length === 0) {
        container.innerHTML = `<div class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">Belum ada perolehan medali.</div>`;
        return;
    }

    let html = `
        <div class="premium-card overflow-hidden mt-10">
            <div class="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-black uppercase tracking-tighter text-slate-900">KLASEMEN PEROLEHAN MEDALI</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">REAL-TIME HASIL PERTANDINGAN</p>
                </div>
                <div class="bg-blue-600 px-4 py-2 rounded-xl">
                    <span class="text-[10px] font-black text-white uppercase tracking-widest">${sortedTeams.length} KONTINGEN</span>
                </div>
            </div>
            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full text-left">
                    <thead class="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/30">
                        <tr>
                            <th class="py-6 pl-8 w-20">POS</th>
                            <th class="py-6">KONTINGEN / DOJO</th>
                            <th class="py-6 text-center w-24">🥇</th>
                            <th class="py-6 text-center w-24">🥈</th>
                            <th class="py-6 text-center w-24">🥉</th>
                            <th class="py-6 text-center w-24 bg-slate-50/50">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${sortedTeams.map((t, idx) => `
                            <tr class="hover:bg-slate-50/50 transition-colors">
                                <td class="py-6 pl-8">
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs
                                        ${idx === 0 ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-100' : 'bg-slate-100 text-slate-400'}">
                                        ${idx + 1}
                                    </div>
                                </td>
                                <td class="py-6">
                                    <div class="font-extrabold text-slate-900 uppercase text-sm tracking-tight">${t.name}</div>
                                </td>
                                <td class="py-6 text-center font-black text-slate-700">${t.gold}</td>
                                <td class="py-6 text-center font-black text-slate-700">${t.silver}</td>
                                <td class="py-6 text-center font-black text-slate-700">${t.bronze}</td>
                                <td class="py-6 text-center font-black text-blue-600 bg-slate-50/30">${t.total}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

// --- Schedule Engine ---
async function loadScheduleData() {
    const listContainer = document.getElementById('scheduleList');
    if (!listContainer) return;

    listContainer.innerHTML = `<div class="animate-pulse flex flex-col items-center gap-4 py-20">
        <div class="w-12 h-12 bg-indigo-100 rounded-full"></div>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">MENGAMBIL JADWAL PERTANDINGAN...</p>
    </div>`;

    try {
        const snap = await getDoc(doc(db, `events/${eventId}/metadata`, 'schedule'));
        if (!snap.exists()) {
            listContainer.innerHTML = `<div class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">Jadwal belum dikonfigurasi oleh panitia.</div>`;
            return;
        }

        const data = snap.data();
        const flattened = data.schedule;
        const { days, arenas } = data.config;

        // Reconstruct 2D array Day -> Arena
        const schedule = [];
        for (let d = 1; d <= days; d++) {
            const dayData = flattened.filter(b => b.day === d);
            dayData.sort((a, b) => a.arena - b.arena);
            schedule.push(dayData);
        }

        renderPublicSchedule(schedule);

    } catch (err) {
        console.error("Load Schedule Error:", err);
        listContainer.innerHTML = `<p class="text-red-400 text-xs font-bold text-center">Gagal memuat jadwal: ${err.message}</p>`;
    }
}

function renderPublicSchedule(schedule) {
    const output = document.getElementById('scheduleList');
    if (!output) return;

    let html = '';
    schedule.forEach((dayData, dayIdx) => {
        html += `
            <div class="mb-16 stagger-card">
                <div class="flex items-center gap-4 mb-8">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black italic shadow-lg shadow-indigo-100">D${dayIdx + 1}</div>
                    <div>
                        <h3 class="text-xl font-black uppercase tracking-tighter text-slate-900">JADWAL HARI KE-${dayIdx + 1}</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">REAL-TIME MATCH FLOW</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        `;

        dayData.forEach((arena, arenaIdx) => {
            const totalLoad = arena.classes.reduce((sum, cls) => sum + (cls.athleteCount || 0), 0);
            html += `
                <div class="premium-card overflow-hidden">
                    <div class="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">TATAMI ${arenaIdx + 1}</span>
                        <div class="bg-white px-3 py-1 rounded-lg border border-slate-200">
                             <span class="text-[9px] font-black text-slate-500 uppercase">${arena.classes.length} KELAS</span>
                        </div>
                    </div>
                    <div class="p-6 space-y-4">
                        ${arena.classes.map((cls, idx) => `
                            <div class="flex items-start justify-between p-4 rounded-2xl bg-white border border-slate-100 transition-all hover:border-indigo-100 group">
                                <div class="flex-1">
                                    <span class="text-[8px] font-black text-indigo-500 uppercase tracking-widest block mb-1 opacity-60">${cls.code}</span>
                                    <h5 class="text-[11px] font-extrabold uppercase leading-tight text-slate-800">${cls.name}</h5>
                                </div>
                                <div class="flex flex-col items-center justify-center ml-4">
                                    <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-900 text-[10px] font-black group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                                        ${cls.athleteCount}
                                    </div>
                                    <span class="text-[7px] font-black text-slate-300 uppercase mt-1">MATCH</span>
                                </div>
                            </div>
                        `).join('')}
                        ${arena.classes.length === 0 ? '<p class="text-[10px] italic opacity-20 py-4 text-center">Tidak ada jadwal</p>' : ''}
                    </div>
                    ${arena.classes.length > 0 ? `
                        <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                            <span class="text-[9px] font-black uppercase text-slate-400 tracking-widest">ESTIMASI BEBAN</span>
                            <span class="text-xs font-black text-indigo-600">${totalLoad} PERTANDINGAN</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div></div>';
    });

    output.innerHTML = html;
}

// --- Bulk Print ---
window.handleBulkPrint = (type) => {
    if (!eventId) return;
    bulkPrintBrackets(eventId, eventName, eventLogo, type);
};

// Event Listeners
document.getElementById('contingentFilter').addEventListener('input', () => render(allAthletes));

// Run
init();
