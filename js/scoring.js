import { rtdb, auth, db } from './firebase-init.js';
import { handleLogout } from './auth-helpers.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, getDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logActivity } from './activity-logger.js';
import { broadcastScoreData } from './scoring-firebase.js';
import { playBuzzer, playBeep, formatTime, resumeAudio } from './scoring-utils.js';
import { GOLDEN_PRESETS, getNextSlot, ROUND_MATCH_IDS } from './bracket-utils.js';
import { syncEngine } from './sync-engine.js';

window.handleLogout = handleLogout;
window.resumeAudio = resumeAudio;

// Expose Firestore functions for participant list
window.db = db;
window.query = query;
window.collection = collection;
window.where = where;
window.getDocs = getDocs;
window.orderBy = orderBy;
window.getDoc = getDoc;
window.doc = doc;

// 🆕 State for tracking auto-loaded matches
window.activeMatchId = null;
window.GOLDEN_PRESETS = GOLDEN_PRESETS;
window.getNextSlot = getNextSlot;
window.ROUND_MATCH_IDS = ROUND_MATCH_IDS;
window.syncAll = () => syncEngine.syncAll();

// Protect Route
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

// --- STATE MANAGEMENT ---
window.akaScore = 0;
window.aoScore = 0;
window.timeLeft = 60; // 1 menit (Default User)
window.timerId = null;
window.isTimerRunning = false;
window.isTimerEnabled = true;
window.penaltiesAka = { c1: false, c2: false, c3: false, hc: false, h: false };
window.penaltiesAo = { c1: false, c2: false, c3: false, hc: false, h: false };
window.currentTatami = 1;
window.monitorWindow = null;
window.nameAka = "";
window.nameAo = "";
window.teamAka = "";
window.teamAo = "";
window.slotAka = null;
window.slotAo = null;
window.matchCategory = "";
window.activeKataPerformer = null;
window.scoringMode = 'kumite'; // 'kumite' or 'kata'
window.kataType = 'score'; // 'score' or 'flag'
window.kataScoreAka = 0.0;
window.kataScoreAo = 0.0;
window.judgeScoresAka = [0.0, 0.0, 0.0, 0.0, 0.0];
window.judgeScoresAo = [0.0, 0.0, 0.0, 0.0, 0.0];
window.akaFlags = 0;
window.aoFlags = 0;
window.senshu = null; // 'aka', 'ao', or null
window.isWinnerDeclared = false;
window.winnerSide = null;
window.showWinnerBanner = false;
window.vrAka = false;
window.vrAo = false;
window.isHantei = false;
window.isQueueVisible = true;

// --- SOUND FUNCTIONS ---
window.playBuzzer = playBuzzer;
window.playBeep = playBeep;

// --- MODAL FUNCTIONS ---
window.closeJudgeKeypad = function () {
    const modal = document.getElementById('judgeKeypadModal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('opacity-0');
        }, 300);
    }
};

// --- CATEGORY DROPDOWN LOGIC ---
window.matchCategories = [];
window.eventId = new URLSearchParams(window.location.search).get('id');

window.loadMatchCategories = async function () {
    if (!window.eventId) {
        console.warn('[Scoring] No eventId found in URL. Autocomplete disabled.');
        return;
    }
    try {
        const q = query(collection(db, `events/${window.eventId}/classes`), orderBy("name", "asc"));
        const snap = await getDocs(q);
        window.matchCategories = snap.docs.map(doc => doc.data().name);
    } catch (err) {
        console.error('[Scoring] Error loading categories:', err);
    }
};

window.showCategoryDropdown = function () {
    const dropdown = document.getElementById('categoryDropdown');
    if (dropdown) dropdown.classList.add('active');
    window.filterCategories(document.getElementById('inputCategory').value);
};

window.filterCategories = function (queryText) {
    const dropdown = document.getElementById('categoryDropdown');
    if (!dropdown) return;

    const filtered = window.matchCategories.filter(cat =>
        cat.toLowerCase().includes(queryText.toLowerCase())
    );

    if (filtered.length === 0 && queryText === "") {
        dropdown.innerHTML = window.matchCategories.map(cat =>
            `<div class="dropdown-item" onclick="selectCategory('${cat.replace(/'/g, "\\\\'")}')">${cat}</div>`
        ).join('');
    } else {
        dropdown.innerHTML = filtered.map(cat =>
            `<div class="dropdown-item" onclick="selectCategory('${cat.replace(/'/g, "\\\\'")}')">${cat}</div>`
        ).join('');
    }

    dropdown.classList.toggle('active', filtered.length > 0 || (queryText === "" && window.matchCategories.length > 0));
};

window.selectCategory = function (name) {
    const input = document.getElementById('inputCategory');
    if (input) input.value = name;
    const dropdown = document.getElementById('categoryDropdown');
    if (dropdown) dropdown.classList.remove('active');
    window.loadAthletesForClass(name);
};

// --- CLASS SELECTOR LOGIC ---
window.eventClasses = [];
window.allEventClasses = [];
window.selectedClass = null;
window.classAthletes = [];

window.toggleClassSelector = function () {
    const sidebar = document.getElementById('classSelectorSidebar');
    if (!sidebar) return;
    const isOpen = !sidebar.classList.contains('translate-x-full');
    if (isOpen) {
        sidebar.classList.add('translate-x-full');
    } else {
        sidebar.classList.remove('translate-x-full');
        if (window.allEventClasses.length === 0) loadEventClasses();
    }
};

window.loadEventClasses = async function () {
    if (!window.eventId) return;
    const container = document.getElementById('classListContainer');
    if (!container) return;
    try {
        container.innerHTML = '<div class="py-20 text-center opacity-20 italic text-[10px] font-black uppercase tracking-widest">Memuat...</div>';
        const q = query(collection(db, `events/${window.eventId}/classes`), orderBy("name", "asc"));
        const snap = await getDocs(q);
        window.allEventClasses = snap.docs.map(doc => ({
            id: doc.id,
            code: doc.id,
            name: doc.data().name,
            category: doc.data().category || 'unknown',
            type: doc.data().type || 'PERORANGAN'
        }));
        window.eventClasses = [...window.allEventClasses];
        renderClassList();
    } catch (err) {
        console.error('[ClassSelector] Error loading classes:', err);
    }
};

window.renderClassList = function () {
    const container = document.getElementById('classListContainer');
    if (!container) return;
    const html = window.eventClasses.map(cls => {
        const isSelected = window.selectedClass && window.selectedClass.id === cls.id;
        return `
            <button onclick="selectClass('${cls.id}')" 
                class="w-full text-left px-4 py-3 rounded-xl transition-all ${isSelected ? 'bg-gradient-to-r from-purple-600/30 to-red-600/30 border border-purple-500/50' : 'bg-white/5 border border-white/5 hover:bg-white/10'}">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-bold text-white leading-tight flex-1">${cls.name}</p>
                </div>
            </button>
        `;
    }).join('');
    container.innerHTML = html;
};

window.selectClass = async function (classId) {
    const classData = window.allEventClasses.find(c => c.id === classId);
    if (!classData) return;
    window.selectedClass = classData;
    window.currentClassCode = classData.id;
    const badge = document.getElementById('selectedClassInfo');
    const name = document.getElementById('selectedClassName');
    if (badge && name) {
        badge.classList.remove('hidden');
        name.textContent = classData.name;
    }
    const categoryDisplay = document.getElementById('categoryDisplay');
    if (categoryDisplay) categoryDisplay.textContent = classData.name;
    window.matchCategory = classData.name;
    renderClassList();
    await loadAthletesForClass(classData.name);
    window.broadcastData();
};

// --- ATHLETE AUTOCOMPLETE ---
window.loadAthletesForClass = async function (className) {
    if (!className) {
        window.classAthletes = [];
        return;
    }
    try {
        const q = query(collection(db, `events/${window.eventId}/athletes`), where('className', '==', className.trim()));
        const snapshot = await getDocs(q);
        window.classAthletes = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || doc.data().athleteName || 'Unknown',
            team: doc.data().team || doc.data().kontingen || ''
        }));
    } catch (err) {
        console.error('[Autocomplete] Error loading athletes:', err);
        window.classAthletes = [];
    }
};

window.showAthleteDropdown = function (side) {
    const dropdownId = side === 'aka' ? 'athleteDropdownAka' : 'athleteDropdownAo';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    if (window.classAthletes && window.classAthletes.length > 0) {
        window.filterAthletes(side);
    } else {
        dropdown.innerHTML = '<div class="px-4 py-3 text-xs text-slate-500 text-center">Pilih kelas terlebih dahulu</div>';
        dropdown.classList.remove('hidden');
    }
};

window.filterAthletes = function (side) {
    const inputId = side === 'aka' ? 'inputNameAka' : 'inputNameAo';
    const dropdownId = side === 'aka' ? 'athleteDropdownAka' : 'athleteDropdownAo';
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;
    const query = input.value.toLowerCase().trim();
    const filtered = window.classAthletes.filter(athlete => query === '' || athlete.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="px-4 py-3 text-xs text-slate-500 text-center">Tidak ada hasil</div>';
        dropdown.classList.remove('hidden');
        return;
    }
    dropdown.innerHTML = filtered.map(athlete => `
        <button type="button" onclick="selectAthlete('${side}', '${athlete.name.replace(/'/g, "\\\\'")}', '${(athlete.team || '').replace(/'/g, "\\\\'")}')"
            class="w-full text-left px-4 py-2.5 hover:bg-${side === 'aka' ? 'red' : 'blue'}-500/20 transition-colors border-b border-white/5 last:border-0">
            <p class="text-xs font-bold text-white">${athlete.name}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${athlete.team || '(No team)'}</p>
        </button>`).join('');
    dropdown.classList.remove('hidden');
};

window.selectAthlete = function (side, name, team) {
    const inputName = document.getElementById(side === 'aka' ? 'inputNameAka' : 'inputNameAo');
    const inputTeam = document.getElementById(side === 'aka' ? 'inputTeamAka' : 'inputTeamAo');
    const dropdown = document.getElementById(side === 'aka' ? 'athleteDropdownAka' : 'athleteDropdownAo');
    if (inputName) inputName.value = name;
    if (inputTeam) inputTeam.value = team;
    if (dropdown) dropdown.classList.add('hidden');
};

// --- BROADCAST LOGIC ---
window.broadcastData = function () {
    const scoreData = {
        akaScore: window.akaScore,
        aoScore: window.aoScore,
        timeLeft: window.timeLeft,
        timerText: document.getElementById('timerDisplay')?.value || '00:00',
        isTimerRunning: window.isTimerRunning,
        isTimerEnabled: window.isTimerEnabled,
        penaltiesAka: window.penaltiesAka,
        penaltiesAo: window.penaltiesAo,
        tatami: window.currentTatami,
        nameAka: window.nameAka,
        nameAo: window.nameAo,
        teamAka: window.teamAka,
        teamAo: window.teamAo,
        activeKataPerformer: window.activeKataPerformer,
        category: window.matchCategory,
        kataAka: document.getElementById('inputKataAka')?.value || '',
        kataAo: document.getElementById('inputKataAo')?.value || '',
        senshu: window.senshu,
        isAtoshiBaraku: window.timeLeft <= 15 && window.timeLeft > 0,
        isWinnerDeclared: window.isWinnerDeclared,
        winnerSide: window.winnerSide,
        vrAka: window.vrAka,
        vrAo: window.vrAo,
        isHantei: window.isHantei,
        scoringMode: window.scoringMode,
        kataType: window.kataType,
        classCode: window.currentClassCode || '',
        kataScoreAka: window.kataScoreAka,
        kataScoreAo: window.kataScoreAo,
        judgeScoresAka: window.judgeScoresAka,
        judgeScoresAo: window.judgeScoresAo,
        akaFlags: window.akaFlags,
        aoFlags: window.aoFlags,
        showWinnerBanner: window.showWinnerBanner
    };

    if (window.updateBroadcastUI) window.updateBroadcastUI();
    localStorage.setItem('karate_score_update', JSON.stringify(scoreData));

    clearTimeout(window._broadcastTimeout);
    window._broadcastTimeout = setTimeout(() => {
        broadcastScoreData(scoreData).catch(err => console.error('[Scoring] Broadcast failed:', err));
    }, 800);
};

window.updateBroadcastUI = function () {
    window.updateConsoleWinnerUI();
    const elements = {
        dAka: document.getElementById('nameAkaDisplay'),
        dAo: document.getElementById('nameAoDisplay'),
        tAka: document.getElementById('teamAkaDisplay'),
        tAo: document.getElementById('teamAoDisplay')
    };
    if (elements.dAka) elements.dAka.innerText = (window.nameAka || '---').toUpperCase();
    if (elements.dAo) elements.dAo.innerText = (window.nameAo || '---').toUpperCase();
    if (elements.tAka) elements.tAka.innerText = (!window.teamAka || window.teamAka === '-') ? '---' : window.teamAka.toUpperCase();
    if (elements.tAo) elements.tAo.innerText = (!window.teamAo || window.teamAo === '-') ? '---' : window.teamAo.toUpperCase();

    const btnHaka = document.getElementById('btnHanteiAka');
    const btnHao = document.getElementById('btnHanteiAo');
    if (btnHaka) btnHaka.classList.toggle('hidden', !window.isHantei);
    if (btnHao) btnHao.classList.toggle('hidden', !window.isHantei);

    const hanteiControls = document.getElementById('hanteiControls');
    if (hanteiControls) hanteiControls.classList.toggle('hidden', !window.isHantei);
};

window.updateConsoleWinnerUI = function () {
    const btnFinish = document.getElementById('btnFinishMatch');
    const iconFinish = document.getElementById('finishIcon');
    if (btnFinish && iconFinish) {
        if (window.isWinnerDeclared) {
            btnFinish.classList.replace('bg-emerald-600', 'bg-blue-600');
            iconFinish.className = "fa-solid fa-forward text-xl";
        } else {
            btnFinish.classList.replace('bg-blue-600', 'bg-emerald-600');
            iconFinish.className = "fa-solid fa-check text-xl";
        }
    }
};

// --- SCORING MODE ---
window.setScoringMode = function (mode) {
    const oldMode = window.scoringMode;
    window.scoringMode = mode;
    const isKata = mode === 'kata';

    if (oldMode && oldMode !== mode) window.resetMatch();

    const kumiteBtn = document.getElementById('modeKumiteBtn');
    const kataBtn = document.getElementById('modeKataBtn');
    if (kumiteBtn) kumiteBtn.className = !isKata ? "flex-1 py-2 rounded-lg mode-active" : "flex-1 py-2 rounded-lg text-slate-500";
    if (kataBtn) kataBtn.className = isKata ? "flex-1 py-2 rounded-lg mode-active" : "flex-1 py-2 rounded-lg text-slate-500";

    const catDisplay = document.getElementById('categoryDisplay');
    if (catDisplay) catDisplay.innerText = isKata ? 'KATA' : 'KUMITE';

    const consolidatedKataControls = document.getElementById('consolidatedKataControls');
    if (consolidatedKataControls) {
        consolidatedKataControls.classList.toggle('hidden', !isKata);
        consolidatedKataControls.classList.toggle('flex', isKata);
    }
    window.updateControlPanels();

    const timerToggle = document.getElementById('timerToggleContainer');
    if (timerToggle) {
        timerToggle.classList.toggle('hidden', !isKata);
        window.toggleTimerSetting(!isKata);
    }

    const sAka = document.getElementById('scoreAka');
    const sAo = document.getElementById('scoreAo');
    if (sAka && sAo) {
        if (isKata) {
            sAka.innerText = window.kataType === 'score' ? window.kataScoreAka.toFixed(1) : '--';
            sAo.innerText = window.kataType === 'score' ? window.kataScoreAo.toFixed(1) : '--';
        } else {
            sAka.innerText = window.akaScore.toString().padStart(2, '0');
            sAo.innerText = window.aoScore.toString().padStart(2, '0');
        }
    }
    window.broadcastData();
};

window.updateControlPanels = function () {
    const isKata = window.scoringMode === 'kata';
    const isFlag = window.kataType === 'flag';
    document.getElementById('kumiteControlsAka').classList.toggle('hidden', isKata);
    document.getElementById('kataControlsAka').classList.toggle('hidden', !isKata || isFlag);
    const flagControlsAka = document.getElementById('kataFlagControlsAka');
    if (flagControlsAka) flagControlsAka.classList.toggle('hidden', !isKata || !isFlag);
    document.getElementById('kumiteControlsAo').classList.toggle('hidden', isKata);
    document.getElementById('kataControlsAo').classList.toggle('hidden', !isKata || isFlag);
    const flagControlsAo = document.getElementById('kataFlagControlsAo');
    if (flagControlsAo) flagControlsAo.classList.toggle('hidden', !isKata || !isFlag);
};

const WKF_KATA_LIST = {
    "1": "ANAN", "2": "ANAN DAI", "3": "ANANKO", "4": "ANNUN", "5": "AOYAGI",
    "6": "BASSAI DAI", "7": "BASSAI SHO", "8": "CHATANYARA KUSHANKU", "9": "CHINTO", "10": "CHINTE",
    "11": "EMPI", "12": "GANKAKU", "13": "GARYU", "14": "GEKISAI DAI ICHI", "15": "GEKISAI DAI NI",
    "16": "GOJUSHIHO DAI", "17": "GOJUSHIHO SHO", "18": "HAFFA", "19": "HAKKAKU", "20": "HANGETSU",
    "21": "HEIAN SHODAN", "22": "HEIAN NIDAN", "23": "HEIAN SANDAN", "24": "HEIAN YONDAN", "25": "HEIAN GODAN",
    "26": "HEIKU", "27": "ISHINE", "28": "ITOSU ROHAI SHODAN", "29": "ITOSU ROHAI NIDAN", "30": "ITOSU ROHAI SANDAN",
    "31": "JIIN", "32": "JION", "33": "JITTE", "34": "JUROKU", "35": "KANKU DAI",
    "36": "KANKU SHO", "37": "KANSHU", "38": "KOPPO", "39": "KOSOKUN DAI", "40": "KOSOKUN SHO",
    "41": "KOSOKUN SHIHO", "42": "KURURUNFA", "43": "KUSHANKU", "44": "MATSUKAZE", "45": "MATSUMURA BASSAI",
    "46": "MATSUMURA ROHAI", "47": "MEIKYO", "48": "MYOJO", "49": "NAIHANCHI SHODAN", "50": "NAIHANCHI NIDAN",
    "51": "NAIHANCHI SANDAN", "52": "NIPAIPO", "53": "NISEISHI", "54": "NIJUSHIHO", "55": "PAIKU",
    "56": "PAPUREN", "57": "PASSAI", "58": "PINAN SHODAN", "59": "PINAN NIDAN", "60": "PINAN SANDAN",
    "61": "PINAN YONDAN", "62": "PINAN GODAN", "63": "ROHAI", "64": "SAIFA", "65": "SANCHIN",
    "66": "SANSEIRU", "67": "SEICHIN", "68": "SEIENCHIN", "69": "SEIPAI", "70": "SEISAN",
    "71": "SEISHAN", "72": "SEIYUNCHIN", "73": "SHIHO KOSOKUN", "74": "SHISOCHIN", "75": "SOCHIN",
    "76": "SUPARINPEI", "77": "TENSHO", "78": "TOMARI BASSAI", "79": "UNSU", "80": "UNSHU",
    "81": "WANKAN", "82": "WANSHU"
};

window.checkKataShortcut = function (input) {
    const val = input.value.trim();
    if (WKF_KATA_LIST[val]) {
        input.value = WKF_KATA_LIST[val];
        if (input.id === 'inputKataAka') window.kataAka = input.value;
        if (input.id === 'inputKataAo') window.kataAo = input.value;
        window.broadcastData();
    }
};

window.setKataType = function (type) {
    window.kataType = type;
    const isFlag = type === 'flag';
    const scoreBtn = document.getElementById('kataTypeScoreBtn');
    const flagBtn = document.getElementById('kataTypeFlagBtn');
    if (scoreBtn) scoreBtn.className = !isFlag ? "flex-1 py-1.5 rounded-lg mode-active italic" : "flex-1 py-1.5 rounded-lg text-slate-500 italic";
    if (flagBtn) flagBtn.className = isFlag ? "flex-1 py-1.5 rounded-lg mode-active italic" : "flex-1 py-1.5 rounded-lg text-slate-500 italic";
    window.updateControlPanels();
    if (window.scoringMode === 'kata') {
        const sAka = document.getElementById('scoreAka');
        const sAo = document.getElementById('scoreAo');
        if (isFlag) {
            sAka.innerText = window.isWinnerDeclared ? window.akaFlags : '--';
            sAo.innerText = window.isWinnerDeclared ? window.aoFlags : '--';
        } else {
            sAka.innerText = window.kataScoreAka.toFixed(1);
            sAo.innerText = window.kataScoreAo.toFixed(1);
        }
    }
    window.broadcastData();
};

window.setKataFlagsAka = function (count) {
    window.akaFlags = count;
    window.aoFlags = 5 - count;
    document.querySelectorAll('.flag-btn-aka').forEach(btn => {
        const val = parseInt(btn.dataset.val);
        btn.classList.toggle('bg-red-500', val === count);
        btn.classList.toggle('text-white', val === count);
        btn.classList.toggle('bg-white/5', val !== count);
        btn.classList.toggle('text-red-500', val !== count);
    });
    document.querySelectorAll('.flag-btn-ao').forEach(btn => {
        const val = parseInt(btn.dataset.val);
        const aoVal = 5 - count;
        btn.classList.toggle('bg-blue-500', val === aoVal);
        btn.classList.toggle('text-white', val === aoVal);
        btn.classList.toggle('bg-white/5', val !== aoVal);
        btn.classList.toggle('text-blue-500', val !== aoVal);
    });
    window.isWinnerDeclared = true;
    window.showWinnerBanner = true;
    window.winnerSide = count > 2.5 ? 'aka' : (count < 2.5 ? 'ao' : 'draw');
    document.getElementById('scoreAka').innerText = count;
    document.getElementById('scoreAo').innerText = 5 - count;
    window.broadcastData();
};

window.setKataFlagsAo = function (count) {
    window.aoFlags = count;
    window.akaFlags = 5 - count;
    document.querySelectorAll('.flag-btn-ao').forEach(btn => {
        const val = parseInt(btn.dataset.val);
        btn.classList.toggle('bg-blue-500', val === count);
        btn.classList.toggle('text-white', val === count);
        btn.classList.toggle('bg-white/5', val !== count);
        btn.classList.toggle('text-blue-500', val !== count);
    });
    document.querySelectorAll('.flag-btn-aka').forEach(btn => {
        const val = parseInt(btn.dataset.val);
        const akaVal = 5 - count;
        btn.classList.toggle('bg-red-500', val === akaVal);
        btn.classList.toggle('text-white', val === akaVal);
        btn.classList.toggle('bg-white/5', val !== akaVal);
        btn.classList.toggle('text-red-500', val !== akaVal);
    });
    window.isWinnerDeclared = true;
    window.showWinnerBanner = true;
    window.winnerSide = count > 2.5 ? 'ao' : (count < 2.5 ? 'aka' : 'draw');
    document.getElementById('scoreAka').innerText = 5 - count;
    document.getElementById('scoreAo').innerText = count;
    window.broadcastData();
};

window.updateKataJudgeScoreManual = function (inputEl, side, index) {
    let valStr = inputEl.value.replace(/[^0-9.]/g, '');
    inputEl.value = valStr;
    const val = parseFloat(valStr) || 0.0;
    if (side === 'aka') {
        window.judgeScoresAka[index] = val;
        window.kataScoreAka = window.calculateKataTotal('aka', window.judgeScoresAka);
        document.getElementById('kataTotalAka').innerText = window.kataScoreAka.toFixed(1);
        document.getElementById('scoreAka').innerText = window.kataScoreAka.toFixed(1);
    } else {
        window.judgeScoresAo[index] = val;
        window.kataScoreAo = window.calculateKataTotal('ao', window.judgeScoresAo);
        document.getElementById('kataTotalAo').innerText = window.kataScoreAo.toFixed(1);
        document.getElementById('scoreAo').innerText = window.kataScoreAo.toFixed(1);
    }
    window.checkKataAutoWinner();
    window.broadcastData();
};

window.updateKataJudgeScore = function (side, index, value) {
    const val = parseFloat(value) || 0.0;
    const inputId = `judgeBtn${side.charAt(0).toUpperCase() + side.slice(1)}${index}`;
    const inputEl = document.getElementById(inputId);
    if (side === 'aka') {
        window.judgeScoresAka[index] = val;
        window.kataScoreAka = window.calculateKataTotal('aka', window.judgeScoresAka);
        if (inputEl) inputEl.innerText = val.toFixed(1);
        document.getElementById('kataTotalAka').innerText = window.kataScoreAka.toFixed(1);
        document.getElementById('scoreAka').innerText = window.kataScoreAka.toFixed(1);
    } else {
        window.judgeScoresAo[index] = val;
        window.kataScoreAo = window.calculateKataTotal('ao', window.judgeScoresAo);
        if (inputEl) inputEl.innerText = val.toFixed(1);
        document.getElementById('kataTotalAo').innerText = window.kataScoreAo.toFixed(1);
        document.getElementById('scoreAo').innerText = window.kataScoreAo.toFixed(1);
    }
    window.checkKataAutoWinner();
    window.broadcastData();
};

window.checkKataAutoWinner = function () {
    if (window.scoringMode !== 'kata') return;
    const allAkaFilled = window.judgeScoresAka.every(s => s > 0);
    const allAoFilled = window.judgeScoresAo.every(s => s > 0);
    if (allAkaFilled && allAoFilled) {
        window.isWinnerDeclared = true;
        window.showWinnerBanner = true;
        if (window.kataScoreAka > window.kataScoreAo) window.winnerSide = 'aka';
        else if (window.kataScoreAo > window.kataScoreAka) window.winnerSide = 'ao';
        else window.winnerSide = 'draw';
        window.updateConsoleWinnerUI();
        window.broadcastData();
    }
};

window.calculateKataTotal = function (side, scores) {
    const sorted = scores.map((s, i) => ({ val: s, idx: i })).sort((a, b) => a.val - b.val);
    const discardedIndices = [];
    if (sorted.length >= 3) {
        discardedIndices.push(sorted[0].idx);
        discardedIndices.push(sorted[sorted.length - 1].idx);
    }
    let total = sorted.filter(item => !discardedIndices.includes(item.idx)).reduce((sum, item) => sum + item.val, 0);
    for (let i = 0; i < scores.length; i++) {
        const btn = document.getElementById(`judgeBtn${side.charAt(0).toUpperCase() + side.slice(1)}${i}`);
        if (btn) btn.classList.toggle('kata-discarded', discardedIndices.includes(i) && scores[i] > 0);
    }
    return parseFloat(total.toFixed(1));
};

window.toggleQueueVisibility = function () {
    window.isQueueVisible = !window.isQueueVisible;
    const mainArea = document.getElementById('scoringMainArea');
    const sidebar = document.getElementById('queueSidebarArea');
    if (window.isQueueVisible) {
        if (mainArea.classList.contains('col-span-12')) mainArea.classList.replace('col-span-12', 'col-span-9');
        if (sidebar) sidebar.classList.remove('hidden');
    } else {
        if (mainArea.classList.contains('col-span-9')) mainArea.classList.replace('col-span-9', 'col-span-12');
        if (sidebar) sidebar.classList.add('hidden');
    }
};

window.toggleSettingsModal = function () {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    modal.classList.toggle('hidden', !isHidden);
    modal.classList.toggle('flex', isHidden);
    if (isHidden) {
        document.getElementById('inputCategory').value = window.matchCategory || '';
        document.getElementById('inputNameAka').value = window.nameAka || '';
        document.getElementById('inputTeamAka').value = window.teamAka || '';
        document.getElementById('inputNameAo').value = window.nameAo || '';
        document.getElementById('inputTeamAo').value = window.teamAo || '';
    }
};

window.saveMatchSettings = function () {
    try {
        const category = document.getElementById('inputCategory')?.value || '';
        const nameAka = document.getElementById('inputNameAka')?.value || '';
        const teamAka = document.getElementById('inputTeamAka')?.value || '';
        const nameAo = document.getElementById('inputNameAo')?.value || '';
        const teamAo = document.getElementById('inputTeamAo')?.value || '';

        window.matchCategory = category;
        window.nameAka = nameAka;
        window.teamAka = teamAka;
        window.nameAo = nameAo;
        window.teamAo = teamAo;

        const el = {
            cat: document.getElementById('categoryDisplay'),
            nAka: document.getElementById('nameAkaDisplay'),
            tAka: document.getElementById('teamAkaDisplay'),
            nAo: document.getElementById('nameAoDisplay'),
            tAo: document.getElementById('teamAoDisplay')
        };
        if (el.cat) el.cat.textContent = category || '---';
        if (el.nAka) el.nAka.textContent = nameAka || '---';
        if (el.tAka) el.tAka.textContent = teamAka || '---';
        if (el.nAo) el.nAo.textContent = nameAo || '---';
        if (el.tAo) el.tAo.textContent = teamAo || '---';

        window.broadcastData();
        window.toggleSettingsModal();
        if (window.updateKataListLink) window.updateKataListLink();
    } catch (err) {
        console.error('[Settings] Error saving settings:', err);
    }
};

window.addScore = function (side, amount) {
    if (window.scoringMode === 'kata') return;
    if (side === 'aka') {
        window.akaScore = Math.max(0, window.akaScore + amount);
        document.getElementById('scoreAka').innerText = window.akaScore.toString().padStart(2, '0');
        window.animateScore(document.getElementById('scoreAka'));
        logActivity("Update Skor", amount > 0 ? `AKA +${amount}` : `AKA -${Math.abs(amount)}`, window.currentTatami);
    } else {
        window.aoScore = Math.max(0, window.aoScore + amount);
        document.getElementById('scoreAo').innerText = window.aoScore.toString().padStart(2, '0');
        window.animateScore(document.getElementById('scoreAo'));
        logActivity("Update Skor", amount > 0 ? `AO +${amount}` : `AO -${Math.abs(amount)}`, window.currentTatami);
    }

    if (Math.abs(window.akaScore - window.aoScore) >= 8) {
        window.isWinnerDeclared = true;
        window.showWinnerBanner = true;
        window.winnerSide = window.akaScore > window.aoScore ? 'aka' : 'ao';
        logActivity("Pemenang Dinyatakan", `${window.winnerSide.toUpperCase()} (${window.winnerSide === 'aka' ? window.nameAka : window.nameAo}) menang selisih poin.`, window.currentTatami);
        window.isTimerRunning = false;
        if (window.timerId) clearInterval(window.timerId);
        window.playBuzzer();
    }
    window.broadcastData();
};

window.toggleVR = function (side) {
    if (side === 'aka') window.vrAka = !window.vrAka;
    else window.vrAo = !window.vrAo;
    const btn = document.getElementById(`vr${side.charAt(0).toUpperCase() + side.slice(1)}`);
    const isActive = side === 'aka' ? window.vrAka : window.vrAo;
    if (btn) btn.className = isActive ? "py-3 rounded-lg neu-button text-[10px] font-black text-yellow-400 bg-yellow-400/20 border-yellow-400/50" : "py-3 rounded-lg neu-button text-[10px] font-black opacity-50 text-yellow-500 transition-all hover:opacity-100";
    window.broadcastData();
};

window.animateScore = function (el) {
    el.classList.add('scale-125', 'brightness-150');
    setTimeout(() => el.classList.remove('scale-125', 'brightness-150'), 200);
};

window.setSenshu = function (side) {
    window.senshu = window.senshu === side ? null : side;
    const btnAka = document.getElementById('senshuAka');
    const btnAo = document.getElementById('senshuAo');
    if (btnAka) btnAka.className = window.senshu === 'aka' ? "py-3 rounded-lg bg-red-600 text-white text-[10px] font-black shadow-[0_0_20px_rgba(220,38,38,0.5)] border-white/20" : "py-3 rounded-lg neu-button text-[10px] font-black opacity-70 hover:opacity-100 transition-opacity";
    if (btnAo) btnAo.className = window.senshu === 'ao' ? "py-3 rounded-lg bg-blue-600 text-white text-[10px] font-black shadow-[0_0_20px_rgba(37,99,235,0.5)] border-white/20" : "py-3 rounded-lg neu-button text-[10px] font-black opacity-70 hover:opacity-100 transition-opacity";
    window.broadcastData();
};

window.setKataPerformer = function (side) {
    window.activeKataPerformer = window.activeKataPerformer === side ? null : side;
    const akaBtn = document.getElementById('performerAkaBtn');
    const aoBtn = document.getElementById('performerAoBtn');
    if (!akaBtn || !aoBtn) return;
    if (window.activeKataPerformer === 'aka') {
        akaBtn.className = "w-16 h-10 rounded-lg bg-red-600 text-white flex items-center justify-center transition-all border border-red-500/30 shadow-md shadow-red-500/20";
        aoBtn.className = "w-16 h-10 rounded-lg bg-white/5 text-blue-500 flex items-center justify-center hover:text-white transition-all border border-white/5 shadow-md";
    } else if (window.activeKataPerformer === 'ao') {
        aoBtn.className = "w-16 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center transition-all border border-blue-500/30 shadow-md shadow-blue-500/20";
        akaBtn.className = "w-16 h-10 rounded-lg bg-white/5 text-red-500 flex items-center justify-center hover:text-white transition-all border border-white/5 shadow-md";
    } else {
        akaBtn.className = "w-16 h-10 rounded-lg bg-white/5 text-red-500 flex items-center justify-center hover:text-white transition-all border border-white/5 shadow-md";
        aoBtn.className = "w-16 h-10 rounded-lg bg-white/5 text-blue-500 flex items-center justify-center hover:text-white transition-all border border-white/5 shadow-md";
    }
    window.broadcastData();
};

window.declareKataWinner = async function (side) {
    window.isWinnerDeclared = true;
    window.winnerSide = side;
    window.showWinnerBanner = true;
    window.broadcastData();
    window.updateConsoleWinnerUI();

    const winnerData = {
        name: side === 'aka' ? window.nameAka : window.nameAo,
        team: side === 'aka' ? window.teamAka : window.teamAo,
        slot: side === 'aka' ? window.slotAka : window.slotAo,
        score: side === 'aka' ? window.kataScoreAka : window.kataScoreAo
    };
    const nextSlot = typeof getNextSlot === 'function' ? getNextSlot(winnerData.slot) : null;

    const matchData = {
        eventId: window.eventId,
        category: window.matchCategory,
        classCode: window.currentClassCode || '',
        tatami: window.currentTatami,
        winner: winnerData.name,
        winnerTeam: winnerData.team,
        nextSlot: nextSlot,
        aka: { name: window.nameAka, team: window.teamAka, score: window.kataScoreAka, slotId: window.slotAka },
        ao: { name: window.nameAo, team: window.teamAo, score: window.kataScoreAo, slotId: window.slotAo },
        timestamp: Date.now()
    };
    if (syncEngine) await syncEngine.save(matchData);
};

window.flipPanels = function () {
    const panelAka = document.getElementById('panelContainerAka');
    const panelAo = document.getElementById('panelContainerAo');
    if (!panelAka || !panelAo) return;
    const currentAkaOrder = parseInt(getComputedStyle(panelAka).order) || 3;
    const currentAoOrder = parseInt(getComputedStyle(panelAo).order) || 1;
    panelAka.style.order = currentAoOrder;
    panelAo.style.order = currentAkaOrder;
    localStorage.setItem('panelLayout', currentAkaOrder === 3 ? 'flipped' : 'default');
};

window.toggleTimerSetting = function (enabled) {
    window.isTimerEnabled = enabled;
    const indicator = document.getElementById('timerEnabledIndicator');
    if (indicator) {
        if (enabled) {
            indicator.className = "flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold";
            indicator.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>AKTIF';
        } else {
            indicator.className = "flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-500 text-[10px] font-bold";
            indicator.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>OFF';
        }
    }
    window.broadcastData();
};

window.toggleTimer = function () {
    if (!window.isTimerEnabled) return;
    if (window.isWinnerDeclared) return;
    if (window.isTimerRunning) {
        window.isTimerRunning = false;
        clearInterval(window.timerId);
    } else {
        if (window.timeLeft <= 0) return;
        window.isTimerRunning = true;
        resumeAudio();
        window.timerId = setInterval(window.updateTimer, 1000);
    }
    window.broadcastData();
};

window.updateTimer = function () {
    if (window.timeLeft > 0) {
        window.timeLeft--;
        const display = document.getElementById('timerDisplay');
        if (display) display.value = formatTime(window.timeLeft);
        if (window.timeLeft === 15) {
            playBeep();
            logActivity("Atoshi Baraku", "Waktu tersisa 15 detik.", window.currentTatami);
        }
        if (window.timeLeft === 0) {
            window.isTimerRunning = false;
            clearInterval(window.timerId);
            playBuzzer();
            logActivity("Waktu Habis", "Pertandingan berakhir.", window.currentTatami);
            window.finishMatch();
        }
        window.broadcastData();
    }
};

window.adjustTimer = function (seconds) {
    if (window.isWinnerDeclared) return;
    window.timeLeft = Math.max(0, window.timeLeft + seconds);
    const display = document.getElementById('timerDisplay');
    if (display) display.value = formatTime(window.timeLeft);
    window.broadcastData();
};

window.showCustomConfirm = function (message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customConfirmModal');
        const msgEl = document.getElementById('customConfirmMessage');
        const confirmBtn = document.getElementById('confirmYes');
        const cancelBtn = document.getElementById('confirmNo');
        if (!modal || !msgEl || !confirmBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }
        msgEl.textContent = message;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const cleanup = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };
        confirmBtn.onclick = () => { cleanup(); resolve(true); };
        cancelBtn.onclick = () => { cleanup(); resolve(false); };
    });
};

window.loadMatch = async function (match) {
    const confirmResult = await window.showCustomConfirm("Load match ini? Data saat ini akan direset.");
    if (!confirmResult) return;
    window.resetMatch();
    window.activeMatchId = match.id;
    window.nameAka = match.aka.name;
    window.teamAka = match.aka.team;
    window.slotAka = match.aka.order;
    window.nameAo = match.ao.name;
    window.teamAo = match.ao.team;
    window.slotAo = match.ao.order;
    window.matchCategory = match.category;
    document.getElementById('nameAkaDisplay').textContent = window.nameAka;
    document.getElementById('teamAkaDisplay').textContent = window.teamAka;
    document.getElementById('nameAoDisplay').textContent = window.nameAo;
    document.getElementById('teamAoDisplay').textContent = window.teamAo;
    document.getElementById('categoryDisplay').textContent = window.matchCategory;
    window.broadcastData();
    logActivity("Load Match", `${window.nameAka} vs ${window.nameAo}`, window.currentTatami);
};

window.checkHanteiResult = function () {
    if (window.scoringMode === 'kata') return;
    if (window.akaScore === window.aoScore) {
        if (window.senshu) {
            window.announceWinner(window.senshu);
            logActivity("Pemenang Dinyatakan", `${window.senshu.toUpperCase()} menang via SENSHU.`, window.currentTatami);
        } else {
            window.confirmHantei();
        }
    } else {
        window.announceWinner(window.akaScore > window.aoScore ? 'aka' : 'ao');
    }
};

window.confirmHantei = function () {
    window.isHantei = true;
    window.broadcastData();
};

window.setHanteiWinner = function (side) {
    logActivity("Pemenang Dinyatakan", `${side.toUpperCase()} menang via HANTEI.`, window.currentTatami);
    window.announceWinner(side);
};

window.togglePenalty = function (side, penalty) {
    const penalties = side === 'aka' ? window.penaltiesAka : window.penaltiesAo;
    const btnId = `${penalty}${side.charAt(0).toUpperCase() + side.slice(1)}`;
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (penalty === 'h') {
        const isCurrentlyH = penalties.h;
        penalties.c1 = !isCurrentlyH;
        penalties.c2 = !isCurrentlyH;
        penalties.c3 = !isCurrentlyH;
        penalties.hc = !isCurrentlyH;
        penalties.h = !isCurrentlyH;
    } else {
        penalties[penalty] = !penalties[penalty];
        if (penalties.h && !penalties[penalty]) penalties.h = false;
        if (penalty === 'hc' && penalties.hc) {
            penalties.c1 = true; penalties.c2 = true; penalties.c3 = true;
        }
        if (penalty === 'c3' && penalties.c3) {
            penalties.c1 = true; penalties.c2 = true;
        }
        if (penalty === 'c2' && penalties.c2) {
            penalties.c1 = true;
        }
    }

    const pTypes = ['c1', 'c2', 'c3', 'hc', 'h'];
    pTypes.forEach(p => {
        const b = document.getElementById(`${p}${side.charAt(0).toUpperCase() + side.slice(1)}`);
        if (b) {
            if (penalties[p]) {
                b.classList.add('bg-red-500', 'text-white', 'border-red-400');
                b.classList.remove('opacity-40');
            } else {
                b.classList.remove('bg-red-500', 'text-white', 'border-red-400');
                b.classList.add('opacity-40');
            }
        }
    });

    if (penalties.h) {
        window.isWinnerDeclared = true;
        window.showWinnerBanner = true;
        window.winnerSide = side === 'aka' ? 'ao' : 'aka';
        window.isTimerRunning = false;
        if (window.timerId) clearInterval(window.timerId);
    }
    window.broadcastData();
};

window.resetTimer = function () {
    window.isTimerRunning = false;
    if (window.timerId) clearInterval(window.timerId);
    window.timeLeft = 60; // Default
    const display = document.getElementById('timerDisplay');
    if (display) display.value = formatTime(window.timeLeft);
    window.broadcastData();
};

window.resetMatch = function () {
    window.akaScore = 0;
    window.aoScore = 0;
    window.timeLeft = 60;
    window.isTimerRunning = false;
    if (window.timerId) clearInterval(window.timerId);
    window.penaltiesAka = { c1: false, c2: false, c3: false, hc: false, h: false };
    window.penaltiesAo = { c1: false, c2: false, c3: false, hc: false, h: false };
    window.senshu = null;
    window.isWinnerDeclared = false;
    window.winnerSide = null;
    window.showWinnerBanner = false;
    window.vrAka = false;
    window.vrAo = false;
    window.isHantei = false;
    window.kataScoreAka = 0.0;
    window.kataScoreAo = 0.0;
    window.judgeScoresAka = [0.0, 0.0, 0.0, 0.0, 0.0];
    window.judgeScoresAo = [0.0, 0.0, 0.0, 0.0, 0.0];
    window.akaFlags = 0;
    window.aoFlags = 0;

    const sAka = document.getElementById('scoreAka');
    const sAo = document.getElementById('scoreAo');
    if (sAka) sAka.innerText = '00';
    if (sAo) sAo.innerText = '00';
    const tDisp = document.getElementById('timerDisplay');
    if (tDisp) tDisp.value = '01:00';

    const pTypes = ['c1', 'c2', 'c3', 'hc', 'h'];
    pTypes.forEach(p => {
        ['Aka', 'Ao'].forEach(side => {
            const b = document.getElementById(`${p}${side}`);
            if (b) {
                b.classList.remove('bg-red-500', 'text-white', 'border-red-400');
                b.classList.add('opacity-40');
            }
        });
    });

    ['Aka', 'Ao'].forEach(side => {
        const vrBtn = document.getElementById(`vr${side}`);
        if (vrBtn) vrBtn.className = "py-3 rounded-lg neu-button text-[10px] font-black opacity-50 text-yellow-500 transition-all hover:opacity-100";
        const senshuBtn = document.getElementById(`senshu${side}`);
        if (senshuBtn) senshuBtn.className = "py-3 rounded-lg neu-button text-[10px] font-black opacity-70 hover:opacity-100 transition-opacity";
    });

    const hControls = document.getElementById('hanteiControls');
    if (hControls) hControls.classList.add('hidden');

    document.getElementById('performerAkaBtn')?.classList.replace('bg-red-600', 'bg-white/5');
    document.getElementById('performerAoBtn')?.classList.replace('bg-blue-600', 'bg-white/5');

    for (let i = 0; i < 5; i++) {
        document.getElementById(`judgeBtnAka${i}`)?.classList.remove('kata-discarded');
        document.getElementById(`judgeBtnAo${i}`)?.classList.remove('kata-discarded');
        const bAka = document.getElementById(`judgeBtnAka${i}`); if (bAka) bAka.innerText = '0.0';
        const bAo = document.getElementById(`judgeBtnAo${i}`); if (bAo) bAo.innerText = '0.0';
    }
    document.getElementById('kataTotalAka') && (document.getElementById('kataTotalAka').innerText = '0.0');
    document.getElementById('kataTotalAo') && (document.getElementById('kataTotalAo').innerText = '0.0');

    document.querySelectorAll('.flag-btn-aka, .flag-btn-ao').forEach(btn => {
        btn.classList.remove('bg-red-500', 'bg-blue-500', 'text-white');
        btn.classList.add('bg-white/5');
    });

    window.updateConsoleWinnerUI();
    window.broadcastData();
    logActivity("Reset Match", "Semua data pertandingan direset.", window.currentTatami);
};

window.announceWinner = function (side) {
    window.isWinnerDeclared = true;
    window.showWinnerBanner = true;
    window.winnerSide = side;
    window.isTimerRunning = false;
    if (window.timerId) clearInterval(window.timerId);
    window.playBuzzer();
    window.broadcastData();
    window.updateConsoleWinnerUI();
};

window.handleMonitor = function () {
    if (window.monitorWindow && !window.monitorWindow.closed) {
        window.monitorWindow.focus();
    } else {
        const features = 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no';
        window.monitorWindow = window.open('monitor.html', 'KarateMonitor', features);
    }
};

window.updateMonitorUI = function () {
    if (window.monitorWindow && !window.monitorWindow.closed) {
        window.broadcastData();
    }
};

window.finishMatch = async function () {
    if (!window.isWinnerDeclared) {
        if (window.scoringMode === 'kumite') {
            window.checkHanteiResult();
        } else {
            const confirmResult = await window.showCustomConfirm("Belum ada pemenang. Selesaikan match?");
            if (confirmResult) {
                window.isWinnerDeclared = true;
                window.broadcastData();
            }
        }
        return;
    }

    const winnerData = {
        name: window.winnerSide === 'aka' ? window.nameAka : window.nameAo,
        team: window.winnerSide === 'aka' ? window.teamAka : window.teamAo,
        slot: window.winnerSide === 'aka' ? window.slotAka : window.slotAo,
        score: window.winnerSide === 'aka' ? window.akaScore : window.aoScore
    };
    const nextSlot = typeof getNextSlot === 'function' ? getNextSlot(winnerData.slot) : null;

    const matchData = {
        eventId: window.eventId,
        category: window.matchCategory,
        classCode: window.currentClassCode || '',
        tatami: window.currentTatami,
        winner: winnerData.name,
        winnerTeam: winnerData.team,
        nextSlot: nextSlot,
        aka: { name: window.nameAka, team: window.teamAka, score: window.akaScore, slotId: window.slotAka },
        ao: { name: window.nameAo, team: window.teamAo, score: window.aoScore, slotId: window.slotAo },
        timestamp: Date.now()
    };

    if (syncEngine) await syncEngine.save(matchData);
    logActivity("Match Selesai", `${window.winnerSide.toUpperCase()} Menang. Data disimpan.`, window.currentTatami);
    const confirmReset = await window.showCustomConfirm("Match Selesai. Reset untuk match berikutnya?");
    if (confirmReset) window.resetMatch();
};

window.handleTimerBlur = function (input) {
    const val = input.value.trim();
    if (!val.includes(':') && val.length > 0) {
        const seconds = parseInt(val);
        if (!isNaN(seconds)) {
            window.timeLeft = seconds;
            input.value = formatTime(seconds);
        }
    } else {
        const parts = val.split(':');
        if (parts.length === 2) {
            const m = parseInt(parts[0]) || 0;
            const s = parseInt(parts[1]) || 0;
            window.timeLeft = (m * 60) + s;
        }
    }
    window.broadcastData();
};

window.handleTimerKey = function (event) {
    if (event.key === 'Enter') {
        event.target.blur();
    }
};

window.initDashboard = async function () {
    const tatamiId = new URLSearchParams(window.location.search).get('tatami') || '1';
    window.currentTatami = parseInt(tatamiId);
    const tatamiLabel = document.getElementById('tatamiLabel');
    if (tatamiLabel) tatamiLabel.textContent = window.currentTatami;

    logActivity("Dashboard Dimuat", `Tatami ${window.currentTatami} Aktif.`, window.currentTatami);
    await window.loadMatchCategories();

    // Check local storage for flipped layout
    if (localStorage.getItem('panelLayout') === 'flipped') {
        window.flipPanels();
    }

    // Set initial mode
    window.setScoringMode('kumite');
};

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    window.initDashboard();
});

// --- PARTICIPANT MODAL LOGIC (formerly line 3342-3891) ---
window.participantModal = {
    isOpen: false,
    type: 'aka', // aka or ao
    classes: [],
    selectedClass: null,
    athletes: []
};

window.openParticipantModal = function (type) {
    window.participantModal.type = type;
    const modal = document.getElementById('participantModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.participantModal.isOpen = true;

    const title = document.getElementById('participantModalTitle');
    if (title) title.innerText = `PILIH ATLET ${type.toUpperCase()}`;

    if (window.participantModal.classes.length === 0) {
        window.loadParticipantClasses();
    }
};

window.closeParticipantModal = function () {
    const modal = document.getElementById('participantModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    window.participantModal.isOpen = false;
};

window.loadParticipantClasses = async function () {
    if (!window.eventId) return;
    const container = document.getElementById('participantClassList');
    if (!container) return;

    try {
        container.innerHTML = '<div class="col-span-full py-10 text-center opacity-20 italic text-xs">Memuat Kelas...</div>';
        const q = query(collection(db, `events/${window.eventId}/classes`), orderBy("name", "asc"));
        const snap = await getDocs(q);
        window.participantModal.classes = snap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        container.innerHTML = window.participantModal.classes.map(cls => `
            <button onclick="selectParticipantClass('${cls.id}', '${cls.name.replace(/'/g, "\\\\'")}')"
                class="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <p class="text-[10px] font-bold text-white uppercase tracking-wider">${cls.name}</p>
            </button>
        `).join('');
    } catch (err) {
        console.error('[ParticipantModal] Error loading classes:', err);
    }
};

window.selectParticipantClass = async function (id, name) {
    window.participantModal.selectedClass = { id, name };
    const container = document.getElementById('participantAthleteList');
    if (!container) return;

    try {
        container.innerHTML = '<div class="col-span-full py-10 text-center opacity-20 italic text-xs">Memuat Atlet...</div>';
        const q = query(collection(db, `events/${window.eventId}/athletes`), where('className', '==', name.trim()));
        const snapshot = await getDocs(q);
        window.participantModal.athletes = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || doc.data().athleteName || 'Unknown',
            team: doc.data().team || doc.data().kontingen || ''
        }));

        if (window.participantModal.athletes.length === 0) {
            container.innerHTML = '<div class="col-span-full py-10 text-center opacity-20 italic text-xs">Tidak ada atlet di kelas ini</div>';
            return;
        }

        container.innerHTML = window.participantModal.athletes.map(ath => `
            <button onclick="selectParticipantAthlete('${ath.name.replace(/'/g, "\\\\'")}', '${ath.team.replace(/'/g, "\\\\'")}')"
                class="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                <p class="text-[11px] font-bold text-white">${ath.name}</p>
                <p class="text-[9px] text-slate-400 mt-0.5">${ath.team}</p>
            </button>
        `).join('');
    } catch (err) {
        console.error('[ParticipantModal] Error loading athletes:', err);
    }
};

window.selectParticipantAthlete = function (name, team) {
    const side = window.participantModal.type;
    if (side === 'aka') {
        window.nameAka = name;
        window.teamAka = team;
        document.getElementById('nameAkaDisplay').innerText = name;
        document.getElementById('teamAkaDisplay').innerText = team;
    } else {
        window.nameAo = name;
        window.teamAo = team;
        document.getElementById('nameAoDisplay').innerText = name;
        document.getElementById('teamAoDisplay').innerText = team;
    }
    window.broadcastData();
    window.closeParticipantModal();
};

// --- KEYPAD / NUMPAD ATTACHMENTS ---
window.appendDigit = function (digit) {
    // This will be used by the judge keypad modal if implemented
    console.log('Digit appended:', digit);
};

window.clearDigits = function () {
    console.log('Digits cleared');
};






