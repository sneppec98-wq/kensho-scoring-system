import { db, auth, rtdb } from './firebase-init.js';
import {
    collection, doc, onSnapshot, getDoc, getDocs, updateDoc, query, where, orderBy, setDoc, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, set, onValue, onDisconnect, get as rtdbGet } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { GOLDEN_PRESETS, ROUND_MATCH_IDS, getNextSlot, getTeamSlot } from './bracket-utils.js';
import { customAlert } from './modules/ui-helpers.js';

// --- STATE MANAGEMENT ---
const urlParams = new URLSearchParams(window.location.search);
const tatamiId = urlParams.get('tatami') || '1';
const eventId = urlParams.get('id') || '';

let currentMatchId = null;
let currentClassId = null;
let matchesQueue = [];
let allMatchesInClass = [];
let unsubMatches = null;
let unsubBracket = null;
let unsubAthletes = null;
let currentActiveTab = 'queue'; // 'queue' or 'history'
let isAutoAdvance = false;
let lastSyncTime = null;
let unsubLiveScore = null;
let liveAkaScore = 0;
let liveAoScore = 0;
let allAthletesCache = []; // Global cache for team lookups

// Helper to reliably find team name from cache (Case Insensitive & Robust)
function resolveTeamFromName(athleteName, currentTeamValue) {
    if (currentTeamValue && currentTeamValue !== '-' && currentTeamValue !== '---') {
        return currentTeamValue;
    }
    if (!athleteName || athleteName === '-' || athleteName === '---') return '-';

    const cleanName = athleteName.trim().toLowerCase();
    const p = allAthletesCache.find(ath => (ath.name || '').trim().toLowerCase() === cleanName);
    if (p) {
        return p.team || p.kontingen || p.teamName || '-';
    }
    return '-';
}

// --- KATA MASTER LIST (1-102) ---
const KATA_MASTER = {
    "1": "Heian Shodan", "2": "Heian Nidan", "3": "Heian Sandan", "4": "Heian Yondan", "5": "Heian Godan",
    "6": "Tekki Shodan", "7": "Tekki Nidan", "8": "Tekki Sandan",
    "9": "Bassai Dai", "10": "Bassai Sho", "11": "Kanku Dai", "12": "Kanku Sho",
    "13": "Empi", "14": "Jion", "15": "Jiin", "16": "Jitte",
    "17": "Hangetsu", "18": "Gankaku", "19": "Chinte", "20": "Sochin",
    "21": "Nijushiho", "22": "Gojushiho Dai", "23": "Gojushiho Sho",
    "24": "Unsu", "25": "Meikyo", "26": "Wankan", "27": "Jiin (Shito)",
    // Add more as needed or load from Firestore...
    "102": "Wankan (Shito-Ryu)"
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!eventId) {
        await customAlert("Event ID tidak ditemukan!", "Error", "danger");
        window.location.href = 'scoring-home.html';
        return;
    }

    document.getElementById('tatamiIdDisplay').innerText = tatamiId;
    initAdminRekap();
    populateClassSelector();
    setupKataInputs();
    setupPresence();
    populateKataGrid(); // Popula kata list grid
});

window.handleClassSelect = (val) => {
    if (val) loadClassData(val);
};

window.toggleSearch = () => {
    const container = document.getElementById('searchContainer');
    container.classList.toggle('hidden');
    if (!container.classList.contains('hidden')) {
        document.getElementById('classSearchInput').focus();
    }
};

window.filterClasses = (query) => {
    const selector = document.getElementById('classSelector');
    const options = selector.querySelectorAll('option');
    options.forEach(opt => {
        if (opt.value === "") return;
        const match = opt.value.toLowerCase().includes(query.toLowerCase());
        opt.style.display = match ? 'block' : 'none';
    });
};

window.switchTab = (tab) => {
    currentActiveTab = tab;
    const tabQueue = document.getElementById('tabQueue');
    const tabHistory = document.getElementById('tabHistory');

    if (tab === 'queue') {
        tabQueue.classList.add('bg-white/5', 'text-cyan-400');
        tabQueue.classList.remove('text-slate-500');
        tabHistory.classList.remove('bg-white/5', 'text-cyan-400');
        tabHistory.classList.add('text-slate-500');
    } else {
        tabHistory.classList.add('bg-white/5', 'text-cyan-400');
        tabHistory.classList.remove('text-slate-500');
        tabQueue.classList.remove('bg-white/5', 'text-cyan-400');
        tabQueue.classList.add('text-slate-500');
    }
    updateQueueDisplay();
};

window.toggleAutoAdvance = () => {
    isAutoAdvance = !isAutoAdvance;
    const indicator = document.getElementById('autoAdvanceIndicator');
    const dot = indicator.querySelector('div');
    if (isAutoAdvance) {
        indicator.classList.replace('bg-white/5', 'bg-cyan-600/20');
        indicator.classList.add('border-cyan-500/50');
        dot.classList.replace('bg-slate-500', 'bg-cyan-500');
        dot.style.transform = 'translateX(16px)';
    } else {
        indicator.classList.replace('bg-cyan-600/20', 'bg-white/5');
        indicator.classList.remove('border-cyan-500/50');
        dot.classList.replace('bg-cyan-500', 'bg-slate-500');
        dot.style.transform = 'translateX(0)';
    }
};

async function populateClassSelector() {
    const selector = document.getElementById('classSelector');
    if (!selector) return;
    try {
        const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        selector.innerHTML = '<option value="">Pilih Kelas</option>';
        bracketSnap.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.innerText = doc.id;
            if (doc.id === currentClassId) option.selected = true;
            selector.appendChild(option);
        });
    } catch (err) {
        console.error("Error populating class selector:", err);
    }
}

// --- PRESENCE SYSTEM ---
function setupPresence() {
    if (!eventId || !tatamiId) return;
    const presenceRef = ref(rtdb, `presence/${eventId}/${tatamiId}/admin`);

    // Set presence on connect
    set(presenceRef, true);

    // Remove presence on disconnect
    onDisconnect(presenceRef).remove();

    console.log(`[Admin Rekap] Presence active for Event ${eventId}, Tatami ${tatamiId}`);
}

// --- CORE FUNCTIONS ---
async function initAdminRekap() {
    console.log(`[Admin Rekap] Initializing for Tatami ${tatamiId}, Event ${eventId}`);

    // 1. Listen to Tatami Metadata
    onSnapshot(doc(db, `events/${eventId}/tatamis`, tatamiId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            updateLiveMonitor(data.currentMatchId);
            updateSyncStatus(); // Update visual indicator
        }
    }, (err) => {
        console.error("[Admin Rekap] Tatami listener error:", err);
        updateSyncStatus(false);
    });

    // 2. Load Classes for this Tatami
    const scheduleDoc = await getDoc(doc(db, `events/${eventId}/metadata`, 'schedule'));
    if (scheduleDoc.exists()) {
        const scheduleData = scheduleDoc.data().schedule || [];
        const classesForTatami = [];
        scheduleData.forEach(block => {
            if (block.arena == tatamiId) {
                (block.classes || []).forEach(cls => {
                    classesForTatami.push({ ...cls, categoryId: cls.category || cls.name });
                });
            }
        });

        // 🆕 PERSISTENCE: Check localStorage first, then falling back to schedule
        const savedClass = localStorage.getItem(`kensho_active_class_${eventId}_${tatamiId}`);
        if (savedClass) {
            console.log(`[Admin Rekap] 💾 Restoring saved class: ${savedClass}`);
            loadClassData(savedClass);
        } else if (classesForTatami.length > 0) {
            loadClassData(classesForTatami[0].categoryId);
        }
    }
}

function updateSyncStatus(ok = true) {
    const statusLabel = document.getElementById('syncStatusLabel');
    const statusDot = document.getElementById('syncStatusDot');
    if (!statusLabel || !statusDot) return;

    if (ok) {
        lastSyncTime = new Date().toLocaleTimeString();
        statusLabel.innerText = `Sync OK - ${lastSyncTime}`;
        statusLabel.classList.replace('text-red-500', 'text-green-500');
        statusDot.classList.replace('bg-red-500', 'bg-green-500');
    } else {
        statusLabel.innerText = "Sync Error / Offline";
        statusLabel.classList.replace('text-green-500', 'text-red-500');
        statusDot.classList.replace('bg-green-500', 'bg-red-500');
    }
}

async function loadClassData(classId) {
    if (!classId) return;

    // Cleanup previous listeners
    if (unsubMatches) unsubMatches();
    if (unsubBracket) unsubBracket();
    if (unsubAthletes) unsubAthletes();

    currentClassId = classId;
    localStorage.setItem(`kensho_active_class_${eventId}_${tatamiId}`, classId);

    document.getElementById('activeClassInfo').querySelector('h2').innerText = classId;

    // Sync Selector UI
    const selector = document.getElementById('classSelector');
    if (selector) selector.value = classId;

    const isKata = classId.toUpperCase().includes('KATA');
    document.getElementById('activeClassMode').innerText = isKata ? 'KATA' : 'KUMITE';

    // 1. Robust Athlete Listener (Handles Name or Code matches)
    unsubAthletes = onSnapshot(collection(db, `events/${eventId}/athletes`), (snap) => {
        allAthletesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const matching = allAthletesCache.filter(a => (a.className === classId) || (a.classCode === classId));
        document.getElementById('activeClassCount').innerText = `${matching.length} Atlet`;

        // Trigger re-resolution if cache arrives AFTER matches
        if (allMatchesInClass.length > 0) {
            allMatchesInClass = allMatchesInClass.map(m => ({
                ...m,
                akaTeam: resolveTeamFromName(m.akaName, m.akaTeam),
                aoTeam: resolveTeamFromName(m.aoName, m.aoTeam)
            }));
            updateQueueDisplay();
            renderBracketView();
        }
    });

    // 2. Listen to Bracket Document (Scenario A & B)
    unsubBracket = onSnapshot(doc(db, `events/${eventId}/brackets`, classId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
                allMatchesInClass = data.matches.map((m, idx) => ({
                    id: m.id || `m-${idx}`,
                    ...m
                }));
            } else if (data.participants && Array.isArray(data.participants)) {
                allMatchesInClass = reconstructMatchesFromBracket(data);
            }

            if (allMatchesInClass.length > 0) {
                updateQueueDisplay();
                if (!currentMatchId) loadNextPendingMatch();
            }
        }
    });

    // 3. Listen to Matches Sub-collection (Scenario C)
    const qMatches = query(
        collection(db, `events/${eventId}/brackets/${classId}/matches`),
        orderBy('matchNumber', 'asc')
    );

    unsubMatches = onSnapshot(qMatches, (snapshot) => {
        if (!snapshot.empty) {
            const firestoreMatches = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    akaTeam: resolveTeamFromName(data.akaName, data.akaTeam || data.akaKontingen || data.teamAka || data.akaTeamName),
                    aoTeam: resolveTeamFromName(data.aoName, data.aoTeam || data.aoKontingen || data.teamAo || data.aoTeamName)
                };
            });

            // 🆕 Intelligent Merging: Don't just overwrite, merge with reconstructed matches
            // This ensures Final match (Scenario B) isn't swallowed by Scenario C
            if (allMatchesInClass.length > 0) {
                const merged = [...allMatchesInClass];
                firestoreMatches.forEach(fm => {
                    const idx = merged.findIndex(m => m.id === fm.id);
                    if (idx !== -1) {
                        merged[idx] = { ...merged[idx], ...fm };
                    } else {
                        merged.push(fm);
                    }
                });
                allMatchesInClass = merged;
            } else {
                allMatchesInClass = firestoreMatches;
            }

            updateQueueDisplay();
            if (!currentMatchId) loadNextPendingMatch();
        }
    });
}

function reconstructMatchesFromBracket(bracketData) {
    const participants = bracketData.participants || [];
    const progression = bracketData.data || {};
    const pattern = GOLDEN_PRESETS[participants.length] || [];
    const reconstructed = [];

    const getAthleteAtSlot = (slotId, originalIdx) => {
        let name = '-';
        let team = '-';

        if (progression[slotId]) {
            name = progression[slotId];
            team = resolveTeamFromName(name, '-');
        } else if (originalIdx !== undefined && participants[originalIdx]) {
            const p = participants[originalIdx];
            name = p.name;
            team = resolveTeamFromName(name, p.team || p.kontingen || p.teamName);
        }
        return { name, team };
    };

    // Detect which round we should START from based on the first slot ID
    let startingRound = 'Penyisihan';
    if (pattern.length > 0) {
        const firstSlot = pattern[0];
        if (firstSlot.startsWith('fn')) startingRound = 'Final';
        else if (firstSlot.startsWith('sn')) startingRound = 'Semi-Final';
        else if (firstSlot.startsWith('qn')) startingRound = 'Perempat Final';
        else if (firstSlot.startsWith('p_n_')) startingRound = 'Penyisihan';
    }

    // Only create initial matches if we're starting from Penyisihan or Quarter
    console.log(`[Reconstruction] Starting Round: ${startingRound}, Participants: ${participants.length}`);

    if (startingRound === 'Penyisihan' || startingRound === 'Perempat Final') {
        for (let i = 0; i < participants.length; i += 2) {
            if (i + 1 >= participants.length) break; // Skip if odd number

            const aka = getAthleteAtSlot(pattern[i], i);
            const ao = getAthleteAtSlot(pattern[i + 1], i + 1);

            // Determine round label based on slot ID prefix
            let roundLabel = 'Penyisihan';
            if (pattern[i] && pattern[i].startsWith('qn')) {
                roundLabel = 'Perempat Final';
            }

            // 🆕 Intelligent Status Detection: Check if winner is already in next slot
            const nextSlot = getNextSlot(pattern[i]);
            const winnerInNext = progression[nextSlot];

            let matchStatus = 'pending';
            let winnerSide = null;

            if (winnerInNext) {
                matchStatus = 'completed';
                winnerSide = (winnerInNext === aka.name) ? 'aka' : 'ao';
            }

            reconstructed.push({
                id: `initial-m${Math.floor(i / 2) + 1}`,
                matchNumber: reconstructed.length + 1,
                round: roundLabel,
                akaName: aka.name,
                akaTeam: aka.team,
                aoName: ao.name,
                aoTeam: ao.team,
                status: matchStatus,
                winnerSide: winnerSide
            });
        }
    }

    // Create Semi Final matches if applicable
    if (startingRound === 'Semi-Final' || participants.length >= 3) {
        const semiMatches = ROUND_MATCH_IDS.semi;
        semiMatches.forEach((m, idx) => {
            const aka = getAthleteAtSlot(m.aka);
            const ao = getAthleteAtSlot(m.ao);

            // 🆕 Intelligent Status Detection for Semi
            const nextSlot = getNextSlot(m.aka);
            const winnerInNext = progression[nextSlot];

            let matchStatus = 'pending';
            let winnerSide = null;

            if (winnerInNext && winnerInNext !== '-') {
                matchStatus = 'completed';
                winnerSide = (winnerInNext === aka.name) ? 'aka' : (winnerInNext === ao.name ? 'ao' : null);
            }

            // Only add if both slots have athletes (for starting from Semi)
            if (startingRound === 'Semi-Final') {
                // When starting from Semi, check if slot is in pattern
                const akaInPattern = pattern.includes(m.aka);
                const aoInPattern = pattern.includes(m.ao);

                if (akaInPattern || aoInPattern) {
                    reconstructed.push({
                        id: `semi-m${idx + 1}`,
                        matchNumber: reconstructed.length + 1,
                        round: 'Semi-Final',
                        akaName: aka.name,
                        akaTeam: aka.team,
                        aoName: ao.name,
                        aoTeam: ao.team,
                        status: matchStatus,
                        winnerSide: winnerSide
                    });
                }
            } else {
                // For progression from earlier rounds, add if winner advanced here
                if (aka.name !== '-' || ao.name !== '-') {
                    reconstructed.push({
                        id: `semi-m${idx + 1}`,
                        matchNumber: reconstructed.length + 1,
                        round: 'Semi-Final',
                        akaName: aka.name,
                        akaTeam: aka.team,
                        aoName: ao.name,
                        aoTeam: ao.team,
                        status: matchStatus,
                        winnerSide: winnerSide
                    });
                }
            }
        });
    }

    // Create Final match
    if (startingRound === 'Final' || participants.length >= 2) {
        const finalMatch = ROUND_MATCH_IDS.final[0];
        const aka = getAthleteAtSlot(finalMatch.aka);
        const ao = getAthleteAtSlot(finalMatch.ao);

        // 🆕 Intelligent Status Detection for Final
        const winnerInNext = progression['winner_nama'];

        // 🆕 ALWAYS create Final match if starting from Semi or earlier
        const shouldCreateFinal =
            startingRound === 'Final' ||
            startingRound === 'Semi-Final' ||
            aka.name !== '-' ||
            ao.name !== '-';

        if (shouldCreateFinal) {
            let matchStatus = (aka.name !== '-' && ao.name !== '-') ? 'pending' : 'waiting';
            let winnerSide = null;

            if (winnerInNext && winnerInNext !== '-') {
                matchStatus = 'completed';
                winnerSide = (winnerInNext === aka.name) ? 'aka' : (winnerInNext === ao.name ? 'ao' : null);
            }

            reconstructed.push({
                id: 'final-m1',
                matchNumber: reconstructed.length + 1,
                round: 'Final',
                akaName: aka.name,
                akaTeam: aka.team,
                aoName: ao.name,
                aoTeam: ao.team,
                status: matchStatus,
                winnerSide: winnerSide
            });
            console.log(`[Reconstruction] ✅ Final match created with status: ${matchStatus}`);
        } else {
            console.log(`[Reconstruction] ⚠️ Final match skipped. shouldCreateFinal was false`);
        }
    }

    console.log(`[Reconstruction] Total reconstructed matches: ${reconstructed.length}`);
    return reconstructed;
}

function updateQueueDisplay() {
    const list = document.getElementById('matchQueueList');
    if (!list) return;

    if (currentActiveTab === 'queue') {
        const pendingMatches = allMatchesInClass.filter(m =>
            m.status === 'pending' ||
            m.status === 'sent_to_scoring' ||
            m.status === 'ongoing' ||
            m.status === 'waiting'
        );

        if (pendingMatches.length === 0) {
            list.innerHTML = `<div class="py-12 text-center opacity-20 italic text-xs">Semua partai selesai!</div>`;
            return;
        }

        list.innerHTML = pendingMatches.map((m, idx) => `
            <div class="px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer queue-item ${m.id === currentMatchId ? 'queue-active' : ''} ${m.status === 'ongoing' ? 'border-yellow-500/30' : ''}" onclick="selectMatchFromQueue('${m.id}')">
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <p class="text-[9px] font-black uppercase text-cyan-400">Partai #${m.matchNumber || (idx + 1)}</p>
                            ${m.status === 'ongoing' ? '<span class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>' : ''}
                        </div>
                        <h5 class="text-[11px] font-black uppercase truncate">${m.akaName || '???'} vs ${m.aoName || '???'}</h5>
                    </div>
                    <span class="text-[9px] font-black opacity-30 italic whitespace-nowrap ml-2">${m.round || 'Penyisihan'}</span>
                </div>
            </div>
        `).join('');
    } else {
        const finishedMatches = allMatchesInClass.filter(m => m.status === 'completed');

        if (finishedMatches.length === 0) {
            list.innerHTML = `<div class="py-12 text-center opacity-20 italic text-xs">Belum ada partai selesai</div>`;
            return;
        }

        list.innerHTML = finishedMatches.map((m, idx) => `
            <div class="px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-green-500/30 transition-all cursor-pointer">
                <div class="flex justify-between items-center mb-2">
                    <p class="text-[8px] font-black uppercase text-green-400">Partai #${m.matchNumber} SELESAI</p>
                    <span class="text-[8px] font-black opacity-30 uppercase">${m.round}</span>
                </div>
                <div class="flex justify-between items-center bg-black/20 p-2 rounded-lg">
                    <div class="text-center flex-1">
                        <p class="text-[9px] font-black ${m.winnerSide === 'aka' ? 'text-red-500' : 'opacity-40'} truncate">${m.akaName}</p>
                        <p class="text-lg font-black italic ${m.winnerSide === 'aka' ? 'text-red-500' : 'opacity-40'}">${m.akaScore || 0}</p>
                    </div>
                    <div class="text-[8px] font-black opacity-10 mx-2">VS</div>
                    <div class="text-center flex-1">
                        <p class="text-[9px] font-black ${m.winnerSide === 'ao' ? 'text-blue-500' : 'opacity-40'} truncate">${m.aoName}</p>
                        <p class="text-lg font-black italic ${m.winnerSide === 'ao' ? 'text-blue-500' : 'opacity-40'}">${m.aoScore || 0}</p>
                    </div>
                </div>
            </div>
        `).reverse().join('');
    }

    // Always render bracket view in right panel
    renderBracketView();
}

// 🆕 Expose to window so HTML can call it
window.renderBracketView = renderBracketView;
window.openKataRef = openKataRef;
window.closeKataRef = closeKataRef;
window.handleClassSelect = (val) => {
    if (val) loadClassData(val);
};

function openKataRef() {
    const modal = document.getElementById('kataReferenceModal');
    if (modal) modal.classList.remove('hidden');
}

function closeKataRef() {
    const modal = document.getElementById('kataReferenceModal');
    if (modal) modal.classList.add('hidden');
}

function populateKataGrid() {
    const grid = document.getElementById('kataGrid');
    if (!grid) return;

    grid.innerHTML = Object.entries(KATA_MASTER).map(([num, name]) => `
        <div class="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center">
            <span class="text-xl font-black text-red-500">${num}</span>
            <span class="text-[8px] font-black uppercase opacity-40">${name}</span>
        </div>
    `).join('');
}

function renderBracketView() {
    const view = document.getElementById('bracketView');
    if (!view) return;

    if (allMatchesInClass.length === 0) {
        view.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center opacity-10 gap-4">
                <i class="fa-solid fa-sitemap text-4xl"></i>
                <p class="text-[9px] font-black uppercase tracking-widest">Pilih kelas rincian</p>
            </div>
        `;
        return;
    }

    // Render a simplified vertical bracket tree (progression list)
    let html = '<div class="space-y-10 pt-4 pb-12">';

    // Group by round
    const rounds = {};
    allMatchesInClass.forEach(m => {
        const r = m.round || 'Lainnya';
        if (!rounds[r]) rounds[r] = [];
        rounds[r].push(m);
    });

    // 🆕 Define logical order for rounds
    const roundOrder = ['Penyisihan', 'Perempat Final', 'Semi-Final', 'Final', 'Lainnya'];
    const sortedRoundNames = Object.keys(rounds).sort((a, b) => {
        const idxA = roundOrder.indexOf(a);
        const idxB = roundOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    sortedRoundNames.forEach((roundName) => {
        const matches = rounds[roundName];
        html += `
            <div class="space-y-6">
                <h4 class="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 border-b border-white/5 pb-2">${roundName}</h4>
                <div class="grid grid-cols-1 gap-4">
                    ${matches.map(m => {
            // 🆕 Use live scores if this is the active match
            const displayAka = (m.id === currentMatchId && m.status !== 'completed') ? liveAkaScore : (m.akaScore || 0);
            const displayAo = (m.id === currentMatchId && m.status !== 'completed') ? liveAoScore : (m.aoScore || 0);

            const tAka = resolveTeamFromName(m.akaName, m.akaTeam || m.akaKontingen);
            const tAo = resolveTeamFromName(m.aoName, m.aoTeam || m.aoKontingen);

            return `
                        <div class="p-6 rounded-[2rem] bg-white/5 border border-white/5 flex flex-col gap-4 ${m.status === 'completed' ? 'opacity-50' : ''}">
                            <div class="flex justify-between items-center">
                                <span class="text-[8px] font-black opacity-30">PARTAI #${m.matchNumber}</span>
                                ${m.status === 'completed' ? '<i class="fa-solid fa-check text-green-500 text-[10px]"></i>' : ''}
                            </div>
                            <div class="flex justify-between items-center group">
                                <div class="flex-1 min-w-0">
                                    <p class="text-[11px] font-black uppercase truncate ${m.winnerSide === 'aka' ? 'text-red-500' : ''}">${m.akaName || '-'}</p>
                                    <div class="flex items-center gap-2">
                                        <p class="text-[7px] font-black opacity-20 uppercase truncate">AKA</p>
                                        <p class="text-[7px] font-bold text-slate-500 uppercase truncate">${tAka}</p>
                                    </div>
                                </div>
                                <span class="text-xl font-black italic ml-4 ${m.winnerSide === 'aka' ? 'text-red-500' : ''}">${displayAka}</span>
                            </div>
                            <div class="h-px bg-white/5"></div>
                            <div class="flex justify-between items-center group">
                                <div class="flex-1 min-w-0">
                                    <p class="text-[11px] font-black uppercase truncate ${m.winnerSide === 'ao' ? 'text-blue-500' : ''}">${m.aoName || '-'}</p>
                                    <div class="flex items-center gap-2">
                                        <p class="text-[7px] font-black opacity-20 uppercase truncate">AO</p>
                                        <p class="text-[7px] font-bold text-slate-500 uppercase truncate">${tAo}</p>
                                    </div>
                                </div>
                                <span class="text-xl font-black italic ml-4 ${m.winnerSide === 'ao' ? 'text-blue-500' : ''}">${displayAo}</span>
                            </div>
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    });

    html += '</div>';
    view.innerHTML = html;
}

window.selectMatchFromQueue = function (matchId) {
    const match = allMatchesInClass.find(m => m.id === matchId);
    if (!match) return;

    currentMatchId = matchId;
    document.getElementById('currentPartaiLabel').innerText = `PARTAI #${match.matchNumber || '?'}`;
    document.getElementById('currentRoundLabel').innerText = (match.round || 'Penyisihan').toUpperCase();

    document.getElementById('akaName').innerText = match.akaName || 'PEMENANG...';
    document.getElementById('akaTeam').innerText = resolveTeamFromName(match.akaName, match.akaTeam || match.akaKontingen || match.teamAka);
    document.getElementById('aoName').innerText = match.aoName || 'PEMENANG...';
    document.getElementById('aoTeam').innerText = resolveTeamFromName(match.aoName, match.aoTeam || match.aoKontingen || match.teamAo);

    // Clear Kata inputs
    document.getElementById('akaKataNum').value = match.akaKataNumber || '';
    document.getElementById('aoKataNum').value = match.aoKataNumber || '';
    updateKataDisplay('aka', match.akaKataNumber);
    updateKataDisplay('ao', match.aoKataNumber);

    updateQueueDisplay();
};

function loadNextPendingMatch() {
    const nextMatch = allMatchesInClass.find(m => m.status === 'pending' || m.status === 'sent_to_scoring');
    if (nextMatch) {
        selectMatchFromQueue(nextMatch.id);
    }
}

// --- KATA SYSTEM ---
function setupKataInputs() {
    const akaInput = document.getElementById('akaKataNum');
    const aoInput = document.getElementById('aoKataNum');

    akaInput.addEventListener('input', (e) => updateKataDisplay('aka', e.target.value));
    aoInput.addEventListener('input', (e) => updateKataDisplay('ao', e.target.value));
}

function updateKataDisplay(side, num) {
    const nameEl = document.getElementById(`${side}KataName`);
    if (KATA_MASTER[num]) {
        nameEl.innerText = KATA_MASTER[num].toUpperCase();
    } else {
        nameEl.innerText = num ? 'INVALID' : '-';
    }
}

// --- ACTIONS ---
document.getElementById('btnSendMatch').addEventListener('click', async () => {
    if (!currentMatchId || !currentClassId) return;

    const akaKataNum = document.getElementById('akaKataNum').value;
    const aoKataNum = document.getElementById('aoKataNum').value;
    const isKata = document.getElementById('activeClassMode').innerText === 'KATA';

    if (isKata && (!akaKataNum || !aoKataNum)) {
        await customAlert("Silakan input nomor Kata dterlebih dahulu!", "Validasi", "info");
        return;
    }

    const matchData = allMatchesInClass.find(m => m.id === currentMatchId);
    if (!matchData) return;

    try {
        const matchRef = doc(db, `events/${eventId}/brackets/${currentClassId}/matches`, currentMatchId);
        const tatamiRef = doc(db, `events/${eventId}/tatamis`, tatamiId);

        // Prepare full match payload (ensures name persist even if it was reconstructed)
        const payload = {
            ...matchData,
            akaTeam: resolveTeamFromName(matchData.akaName, matchData.akaTeam || matchData.akaKontingen || matchData.teamAka),
            aoTeam: resolveTeamFromName(matchData.aoName, matchData.aoTeam || matchData.aoKontingen || matchData.teamAo),
            status: 'sent_to_scoring',
            akaKataNumber: akaKataNum,
            akaKataName: KATA_MASTER[akaKataNum] || '',
            aoKataNumber: aoKataNum,
            aoKataName: KATA_MASTER[aoKataNum] || '',
            assignedTatami: tatamiId,
            sentAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        };

        // Use setDoc with merge to CREATE if doesn't exist (reconstructed) or UPDATE if exists
        await setDoc(matchRef, payload, { merge: true });

        // Update Tatami Current Match (triggers Scoring Panel)
        // 🆕 Send FULL payload so Scoring Panel can auto-load without extra fetch
        await updateDoc(tatamiRef, {
            currentMatchId: currentMatchId,
            currentMatch: payload,
            lastUpdated: serverTimestamp()
        });

        console.log(`[Admin Rekap] Match ${currentMatchId} sent to Scoring (Status: Ready)`);

        // Sound Notification
        new Audio('assets/sounds/send.mp3').play().catch(() => { });

        setTimeout(() => {
            loadNextPendingMatch();
        }, 1000);

    } catch (err) {
        console.error("Error sending match:", err);
        await customAlert("Gagal mengirim match: " + err.message, "Gagal Kirim", "danger");
    }
});

// --- KEYBOARD SHORTCUTS ---
window.addEventListener('keydown', (e) => {
    // Space to Send Match (only if not in input)
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('btnSendMatch').click();
    }
    // Escape to Clear/Batal
    if (e.code === 'Escape') {
        // Optional: Reset selection or close modals
        if (!document.getElementById('kataReferenceModal').classList.contains('hidden')) {
            closeKataRef();
        }
    }
    // 'H' to toggle History tab
    if (e.key.toLowerCase() === 'h' && e.target.tagName !== 'INPUT') {
        window.switchTab(currentActiveTab === 'queue' ? 'history' : 'queue');
    }
});

// --- BRACKET PROGRESSION HELPERS ---

/**
 * Find slot ID for a given match based on pattern and match structure
 * @param {string} matchId - Match ID (e.g., 'semi-m1', 'final-m1')
 * @param {Array} pattern - GOLDEN_PRESETS pattern for participant count
 * @param {Object} bracketData - Bracket data with participants
 * @returns {string|null} Slot ID or null
 */
function findSlotIdForMatch(matchId, pattern, bracketData) {
    if (!matchId || !pattern) return null;

    // For matches generated from initial rounds (Penyisihan, Quarter)
    if (matchId.startsWith('initial-m')) {
        const matchNum = parseInt(matchId.replace('initial-m', ''));
        const slotIndex = (matchNum - 1) * 2; // Each match uses 2 slots
        return pattern[slotIndex] || null;
    }

    // For Semi Final matches
    if (matchId.startsWith('semi-m')) {
        const matchNum = parseInt(matchId.replace('semi-m', ''));
        // Semi-m1 → sn1 atau sn2, Semi-m2 → sn3 atau sn4
        const semiSlots = pattern.filter(s => s.startsWith('sn'));
        if (matchNum === 1) return semiSlots[0] || 'sn1';
        if (matchNum === 2) return semiSlots[2] || 'sn3';
    }

    // For Final match
    if (matchId.startsWith('final-m') || matchId === 'final-m1') {
        return 'fn1'; // Final winner slot
    }

    // For Quarter Final matches
    if (matchId.startsWith('quarter-m')) {
        const matchNum = parseInt(matchId.replace('quarter-m', ''));
        const quarterSlots = pattern.filter(s => s.startsWith('qn'));
        return quarterSlots[(matchNum - 1) * 2] || null;
    }

    return null;
}

/**
 * Advance winner to next slot and update bracket progression
 * @param {Object} match - Match object
 * @param {string} winnerName - Winner name
 * @param {string} winnerTeam - Winner team
 * @param {string} winnerSide - 'aka' or 'ao'
 * @returns {Promise<void>}
 */
async function advanceWinnerAndSetRankings(match, winnerName, winnerTeam, winnerSide) {
    try {
        const bracketRef = doc(db, `events/${eventId}/brackets`, currentClassId);
        const bracketSnap = await getDoc(bracketRef);

        if (!bracketSnap.exists()) {
            console.warn('[Progression] Bracket document not found');
            return;
        }

        const bracketData = bracketSnap.data();
        const pattern = GOLDEN_PRESETS[bracketData.participants?.length] || [];

        if (pattern.length === 0) {
            console.warn('[Progression] No pattern found for participant count');
            return;
        }

        // Find current slot ID
        const currentSlot = findSlotIdForMatch(match.id, pattern, bracketData);
        if (!currentSlot) {
            console.warn('[Progression] Could not find slot ID for match:', match.id);
            return;
        }

        console.log(`[Progression] Match: ${match.id}, Current Slot: ${currentSlot}, Winner: ${winnerName}`);

        // Calculate next slot
        const nextSlot = getNextSlot(currentSlot);
        console.log(`[Progression] Next Slot: ${nextSlot}`);

        const updates = {};

        // 1. Basic Progression: Advance winner to next slot
        if (nextSlot && nextSlot !== 'winner_nama') {
            updates[`data.${nextSlot}`] = winnerName;

            // 🆕 Also propagate Team/Kontingen
            const teamSlot = getTeamSlot(nextSlot);
            if (teamSlot) updates[`data.${teamSlot}`] = winnerTeam;

            console.log(`[Progression] Advancing ${winnerName} [${winnerTeam}] to ${nextSlot}`);
        }

        // 2. If Final match, set complete rankings
        if (match.round === 'Final' || nextSlot === 'winner_nama') {
            const loserName = winnerSide === 'aka' ? match.aoName : match.akaName;
            const loserTeam = winnerSide === 'aka' ? match.aoTeam : match.akaTeam;

            // Set winner_nama (Juara 1)
            updates['data.winner_nama'] = winnerName;
            updates['data.winner_kontingen'] = winnerTeam;

            // Set structured rankings
            updates['rankings.gold'] = {
                name: winnerName,
                team: winnerTeam,
                matchId: match.id,
                timestamp: new Date().toISOString()
            };

            updates['rankings.silver'] = {
                name: loserName,
                team: loserTeam,
                matchId: match.id,
                timestamp: new Date().toISOString()
            };

            // Find bronze medalists from Semi Final losers
            const semiFinals = allMatchesInClass.filter(m =>
                m.round === 'Semi-Final' && m.status === 'completed'
            );

            semiFinals.forEach((sf, idx) => {
                if (sf.winnerSide) {
                    const sfLoserName = sf.winnerSide === 'aka' ? sf.aoName : sf.akaName;
                    const sfLoserTeam = sf.winnerSide === 'aka' ? sf.aoTeam : sf.akaTeam;

                    const bronzeKey = idx === 0 ? 'bronzeA' : 'bronzeB';
                    updates[`rankings.${bronzeKey}`] = {
                        name: sfLoserName,
                        team: sfLoserTeam,
                        matchId: sf.id,
                        timestamp: new Date().toISOString()
                    };
                }
            });

            // Mark bracket as completed
            updates['isCompleted'] = true;
            updates['completedAt'] = new Date().toISOString();

            console.log('[Progression] 🏆 FINAL COMPLETE! Rankings set:', {
                gold: winnerName,
                silver: loserName,
                bronze: semiFinals.map(sf => sf.winnerSide === 'aka' ? sf.aoName : sf.akaName)
            });
        }

        // 3. Update Firestore
        if (Object.keys(updates).length > 0) {
            await updateDoc(bracketRef, updates);
            console.log('[Progression] ✅ Bracket updated successfully');
        }

    } catch (err) {
        console.error('[Progression] Error updating bracket:', err);
    }
}


window.manualDeclareWinner = async (side) => {
    if (!currentMatchId || !currentClassId) return;

    const match = allMatchesInClass.find(m => m.id === currentMatchId);
    if (!match) return;

    const ok = await customConfirm({
        title: "Konfirmasi Pemenang",
        message: `Yakin ingin menyatakan pemenang MANUAL untuk ${side.toUpperCase()}?`,
        confirmText: "Ya, Declare Menang",
        type: 'info'
    });
    if (!ok) return;

    try {
        const matchRef = doc(db, `events/${eventId}/brackets/${currentClassId}/matches`, currentMatchId);

        await updateDoc(matchRef, {
            status: 'completed',
            winnerSide: side,
            winnerName: side === 'aka' ? match.akaName : match.aoName,
            manualOverride: true,
            akaScore: side === 'aka' ? 1 : 0,
            aoScore: side === 'ao' ? 1 : 0,
            completedAt: serverTimestamp()
        });

        console.log(`[Admin Rekap] Manual winner declared: ${side}`);
        new Audio('assets/sounds/finish.mp3').play().catch(() => { });

        // 🆕 AUTO-PROGRESSION: Advance winner to next round and set rankings
        const winnerName = side === 'aka' ? match.akaName : match.aoName;
        const winnerTeam = side === 'aka' ? match.akaTeam : match.aoTeam;
        await advanceWinnerAndSetRankings(match, winnerName, winnerTeam, side);

        // 🆕 PROACTIVE LOCAL UPDATE: Mark as completed immediately for UI
        const localMatch = allMatchesInClass.find(m => m.id === currentMatchId);
        if (localMatch) {
            localMatch.status = 'completed';
            localMatch.winnerSide = side;
            localMatch.winnerName = side === 'aka' ? match.akaName : match.aoName;
            updateQueueDisplay();
        }

        // 🆕 ALWAYS auto-load next pending match (Final, Quarter, etc)
        // This prevents completed match from staying on screen
        setTimeout(() => {
            // Re-check matches state (should be updated by now from Firestore, but fallback to local)
            const nextMatch = allMatchesInClass.find(m => m.status === 'pending' || m.status === 'waiting' || (m.status === 'sent_to_scoring' && m.id !== currentMatchId));

            if (nextMatch) {
                console.log(`[Admin Rekap] 🔄 Auto-loading next match: ${nextMatch.round} - ${nextMatch.id}`);
                selectMatchFromQueue(nextMatch.id);
            } else {
                console.log('[Admin Rekap] ✅ All matches completed! No pending matches.');
                // Clear active match display
                document.getElementById('akaName').innerText = '-';
                document.getElementById('aoName').innerText = '-';
                document.getElementById('currentPartaiLabel').innerText = 'SELESAI';
                currentMatchId = null;
            }
        }, 1200); // 1.2 second delay
    } catch (err) {
        console.error("Manual override error:", err);
        await customAlert("Gagal declare pemenang: " + err.message, "Error", "danger");
    }
};

// --- LIVE MONITOR ---
function updateLiveMonitor(activeMatchId) {
    if (!activeMatchId) return;

    // 1. Listen to Firestore for Status & Progression
    onSnapshot(doc(db, `events/${eventId}/brackets/${currentClassId}/matches`, activeMatchId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();

            // Only use Firestore scores as fallback/final value
            if (data.status === 'completed') {
                document.getElementById('liveScoreAka').innerText = data.akaScore || 0;
                document.getElementById('liveScoreAo').innerText = data.aoScore || 0;

                document.getElementById('scoringStatusLabel').innerText = "🏁 PERTANDINGAN SELESAI";
                document.getElementById('scoringStatusLabel').classList.replace('text-yellow-400', 'text-cyan-400');
                document.getElementById('scoringStatusLabel').classList.remove('text-slate-500');

                // Sound Notification when finished
                new Audio('assets/sounds/finish.mp3').play().catch(() => { });

                // 🆕 AUTO-PROGRESSION from scoring panel
                if (data.winnerSide && !data.manualOverride) {
                    const match = allMatchesInClass.find(m => m.id === activeMatchId);
                    if (match) {
                        const winnerName = data.winnerSide === 'aka' ? match.akaName : match.aoName;
                        const winnerTeam = data.winnerSide === 'aka' ? match.akaTeam : match.aoTeam;
                        advanceWinnerAndSetRankings(match, winnerName, winnerTeam, data.winnerSide)
                            .catch(err => console.error('[Live Monitor] Progression error:', err));
                    }
                }

                // Auto-advance if enabled
                if (isAutoAdvance) {
                    setTimeout(() => {
                        loadNextPendingMatch();
                    }, 2000);
                }
            } else {
                document.getElementById('scoringStatusLabel').innerText = "⚡ PERTANDINGAN BERLANGSUNG";
                document.getElementById('scoringStatusLabel').classList.replace('text-slate-500', 'text-yellow-400');
                document.getElementById('scoringStatusLabel').classList.remove('text-cyan-500');
            }
        }
    });

    // 2. 🆕 Listen to RTDB for Real-time LIGHTNING Score Updates
    if (unsubLiveScore) unsubLiveScore();
    const liveRef = ref(rtdb, `livescoring/${tatamiId}`);

    unsubLiveScore = onValue(liveRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();

            // 🆕 MODE-AWARE SCORE DETECTION
            let displayAka = 0;
            let displayAo = 0;

            if (data.scoringMode === 'kata') {
                if (data.kataType === 'score') {
                    // Kata Point Mode
                    displayAka = data.kataScoreAka || 0;
                    displayAo = data.kataScoreAo || 0;
                } else {
                    // Kata Flag Mode (Bendera)
                    displayAka = data.akaFlags || 0;
                    displayAo = data.aoFlags || 0;
                }
            } else {
                // Kumite Mode
                displayAka = data.akaScore || 0;
                displayAo = data.aoScore || 0;
            }

            // Update Global State for re-rendering bracket cards
            liveAkaScore = displayAka;
            liveAoScore = displayAo;

            // Update Header Monitor
            const hakaEl = document.getElementById('liveScoreAka');
            const haoEl = document.getElementById('liveScoreAo');
            if (hakaEl) hakaEl.innerText = displayAka;
            if (haoEl) haoEl.innerText = displayAo;

            // 🆕 Trigger UI update for the sidebar cards
            renderBracketView();

            console.log(`[Live Monitor] RTDB Updated (${data.scoringMode || 'kumite'}): AKA ${displayAka} - AO ${displayAo}`);
        }
    });
}

// ============================================
// QUEUE SYNCHRONIZATION TO FIREBASE
// ============================================

// Sync queue to Firebase whenever matches change
function syncQueueToFirebase() {
    if (!currentClassId || !tatamiId) return;

    const pendingMatches = allMatchesInClass.filter(m =>
        m.status === 'pending' ||
        m.status === 'sent_to_scoring' ||
        m.status === 'waiting'
    );

    const queueArray = pendingMatches.map((m, idx) => ({
        partaiNum: m.matchNumber || (idx + 1),
        className: currentClassId,
        round: m.round || 'Penyisihan',
        aka: {
            name: m.akaName || '-',
            team: resolveTeamFromName(m.akaName, m.akaTeam || m.akaKontingen),
            slot: m.akaSlot || null
        },
        ao: {
            name: m.aoName || '-',
            team: resolveTeamFromName(m.aoName, m.aoTeam || m.aoKontingen),
            slot: m.aoSlot || null
        },
        matchId: m.id
    }));

    const queueRef = ref(rtdb, `tatami_queues/${tatamiId}/queue`);
    set(queueRef, queueArray).then(() => {
        console.log(`[Queue Sync] Pushed ${queueArray.length} matches to Firebase queue`);
    }).catch(err => {
        console.error('[Queue Sync] Error syncing queue:', err);
    });
}

// Call syncQueueToFirebase after matches update
const originalUpdateQueueDisplay = updateQueueDisplay;
updateQueueDisplay = function () {
    originalUpdateQueueDisplay();
    syncQueueToFirebase();
};

// ============================================
// FIREBASE LISTENER CLEANUP (Quota Optimization)
// ============================================

// Track all active listeners globally
const allUnsubscribers = [];

function registerUnsubscriber(unsubFunc) {
    if (unsubFunc && typeof unsubFunc === 'function') {
        allUnsubscribers.push(unsubFunc);
    }
}

// Register existing listeners
if (unsubMatches) registerUnsubscriber(unsubMatches);
if (unsubBracket) registerUnsubscriber(unsubBracket);
if (unsubAthletes) registerUnsubscriber(unsubAthletes);
if (unsubLiveScore) registerUnsubscriber(unsubLiveScore);

// Cleanup all listeners on page unload
window.addEventListener('beforeunload', () => {
    console.log(`[Cleanup] Unsubscribing ${allUnsubscribers.length} Firebase listeners`);
    allUnsubscribers.forEach(unsub => {
        try {
            unsub();
        } catch (e) {
            console.warn('[Cleanup] Error unsubscribing:', e);
        }
    });

    // Clear queue unsubscribe
    if (window.queueUnsubscribe) {
        window.queueUnsubscribe();
    }
});

console.log('[Admin Rekap] 🔥 Firebase quota optimization active');
