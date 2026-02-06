// ===================================
// Event Detail - Main Orchestrator
// ===================================
// This file coordinates all event detail functionalities
// by importing modular components

import { db, auth } from './firebase-init.js';
import { handleLogout } from './auth-helpers.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initVoiceLounge, joinVoice, leaveVoice, toggleMicMute } from './voice-chat.js';

// Import UI Helpers
import {
    showProgress,
    updateProgress,
    hideProgress,
    sleep,
    toggleModal,
    filterTable,
    switchTab,
    customConfirm,
    customAlert
} from './modules/ui-helpers.js';

// Import Excel Functions
import {
    downloadClassTemplate,
    importClassesFromExcel,
    importAthletesFromExcel,
    proceedWithConfirmedImport
} from './modules/excel-import-export.js';

// Import Athletes Manager
import {
    renderAthleteData,
    editAthlete,
    saveAthleteEdit,
    handleClassCodeInput,
    handleEmergencyClassCodeInput,
    saveEmergencyAthlete,
    deleteAthlete,
    deleteContingentAthletes,
    editContingentName,
    saveContingentNameEdit,
    deleteAllAthletes
} from './modules/athletes-manager.js';

// Import Classes Manager
import {
    renderClassesData,
    addNewClass,
    deleteClass,
    deleteAllClasses
} from './modules/classes-manager.js';

// Import Brackets Manager
import {
    renderBracketsConfig,
    openBracketConfig,
    saveBracketConfig,
    deleteBracketConfig,
    deleteAllBrackets
} from './modules/brackets-manager.js';

// Import Verification Display
import { renderVerificationData } from './modules/verification-display.js';

// Import Schedule Generator & Printing
import { renderSchedule } from './modules/schedule-generator.js';
import { prepareJadwalPrint } from './modules/print/print-jadwal.js';
import { prepareBracketPrint } from './modules/print/print-bracket.js';
import { renderWinnerStatusList, copyToClipboard, resetPrintingData } from './modules/print-manager.js';
import { initialiseWinnerEditor } from './modules/verification/winner-editor.js';
import { initialiseMedalTallyManager } from './modules/verification/medal-tally-manager.js';

// Import Firestore Cached Reads (OPTIMIZED!)
import {
    getClasses,
    getAthletes,
    getBrackets,
    getEventData,
    getRewards,
    fetchMedalsManual,
    invalidateEventCache,
    refreshAllData
} from './modules/firestore-listeners.js';

// Import Quota Monitor
import quotaMonitor from './modules/quota-monitor.js';

// ===================================
// Global State
// ===================================
window.handleLogout = handleLogout;
let eventId = null;
let eventName = "";
let eventLogo = null;
let latestAthletes = [];
let latestClasses = [];
let latestBrackets = [];
let latestRewards = {};
let latestMedalsManual = [];
let currentSubTab = 'OPEN'; // For Classes & Brackets
let currentAthleteSubTab = 'OPEN'; // For Athletes Table
let currentVerifikasiSubTab = 'PESERTA'; // For Verification Tab
let pendingLogoBase64 = null;

// ===================================
// Sub-Tab Management
// ===================================
function switchSubTab(tab) {
    currentSubTab = tab;
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sub-tab-btn[onclick="switchSubTab('${tab}')"]`)?.classList.add('active');

    const containers = {
        'OPEN': document.getElementById('bracket-open-container'),
        'CLOSED': document.getElementById('bracket-closed-container'),
        'THIRD': document.getElementById('bracket-third-container')
    };

    Object.keys(containers).forEach(key => {
        if (containers[key]) {
            containers[key].style.display = (key === tab) ? 'block' : 'none';
        }
    });
}
window.switchSubTab = switchSubTab;
window.resetPrintingData = () => resetPrintingData(eventId);

// ===================================
// Event ID & Route Protection
// ===================================
function getEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// ===================================
// Initialize on DOM Ready
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM Content Loaded - Starting initialization...');

    onAuthStateChanged(auth, async user => {
        if (!user) {
            console.log('❌ Tidak ada user terautentikasi, mengalihkan ke login...');
            window.location.href = 'login.html';
            return;
        }

        // Security Check: Hanya OWNER atau ADMIN dengan KODE 2026 yang boleh akses Event Detail
        try {
            const q = query(collection(db, "admins"), where("email", "==", user.email.toLowerCase()));
            const snap = await getDocs(q);

            if (snap.empty) {
                console.warn('🚫 Akses Ditolak: Bukan Admin/Owner');
                await customAlert("Akses Terbatas!", "Akses Ditolak", "danger");
                window.location.href = 'dashboard.html';
                return;
            }

            const adminData = snap.docs[0].data();
            if (adminData.role !== 'owner') {
                const accessCode = prompt("🔐 HALAMAN KHUSUS OWNER\n\nMasukkan Kode Akses untuk Admin:");
                if (accessCode !== '2026') {
                    await customAlert("Kode Akses Salah!", "Akses Ditolak", "danger");
                    window.location.href = 'dashboard.html';
                    return;
                }
            }

            console.log('✅ Akses Terverifikasi:', user.email);
            const userDisplay = document.getElementById('userNameDisplay');
            if (userDisplay) userDisplay.innerText = user.displayName || user.email.split('@')[0];
        } catch (err) {
            console.error("Gagal memeriksa otoritas:", err);
        }
    });

    eventId = getEventId();
    console.log('📋 Event ID:', eventId);

    if (!eventId) {
        await customAlert("Event ID tidak ditemukan!", "Sistem Error", "danger");
        window.location.href = 'dashboard.html';
        return;
    }

    // Initialize Winner Editor
    initialiseWinnerEditor(eventId);
    initialiseMedalTallyManager(eventId);

    // ===================================
    // Settings Save
    // ===================================
    const formSettings = document.getElementById('formSettings');
    if (formSettings) {
        formSettings.onsubmit = async (e) => {
            e.preventDefault();
            const newName = document.getElementById('settingEventName').value.trim();
            const newDate = document.getElementById('settingDeadline').value;
            const newLocation = document.getElementById('settingLocation').value.trim();

            if (!newName) {
                await customAlert("Nama event wajib diisi!", "Validasi Gagal", "danger");
                return;
            }

            try {
                const updateData = {
                    name: newName,
                    date: newDate,
                    location: newLocation
                };

                if (pendingLogoBase64) {
                    updateData.logo = pendingLogoBase64;
                }

                await updateDoc(doc(db, 'events', eventId), updateData);
                await customAlert("Pengaturan event berhasil disimpan!", "Simpan Berhasil", "info");

                // Real-time listener will handle global variable and UI updates
                pendingLogoBase64 = null;
            } catch (err) {
                console.error("Update Event Error:", err);
                await customAlert("Gagal menyimpan: " + err.message, "Gagal", "danger");
            }
        };
    }

    // ===================================================
    // OPTIMIZED: Load Data with Caching (Instead of Realtime Listeners)
    // ===================================================
    console.log('🔥 Loading initial data from cache/Firestore...');

    try {
        // Load all data in parallel
        const [eventData, athletes, classes, brackets, rewards, medalsManual] = await Promise.all([
            getEventData(db, eventId),
            getAthletes(db, eventId),
            getClasses(db, eventId),
            getBrackets(db, eventId),
            getRewards(db, eventId),
            fetchMedalsManual(db, eventId)
        ]);

        // Update event info
        if (eventData) {
            eventName = eventData.name || 'Event Tidak Dikenal';
            eventLogo = eventData.logo || null;
            window.currentEventData = eventData;

            const nameDisplay = document.getElementById('event-name-display');
            if (nameDisplay) nameDisplay.innerText = eventName;

            const breadcrumbName = document.getElementById('breadcrumbEventName');
            if (breadcrumbName) breadcrumbName.innerText = eventName;

            const nameInput = document.getElementById('settingEventName');
            if (nameInput) nameInput.value = eventName;

            const deadlineInput = document.getElementById('settingDeadline');
            if (deadlineInput) deadlineInput.value = eventData.date || "";

            const locationInput = document.getElementById('settingLocation');
            if (locationInput) locationInput.value = eventData.location || "";

            if (eventLogo) {
                updateLogoPreview(eventLogo);
            }

            // Sync Public Access Toggles
            const chkBracket = document.getElementById('check-public-bracket');
            const chkSchedule = document.getElementById('check-public-schedule');
            const chkWinners = document.getElementById('check-public-winners');
            const chkMedals = document.getElementById('check-public-medals');

            if (chkBracket) chkBracket.checked = eventData.isBracketPublic || false;
            if (chkSchedule) chkSchedule.checked = eventData.isSchedulePublic || false;
            if (chkWinners) chkWinners.checked = eventData.isWinnersPublic || false;
            if (chkMedals) chkMedals.checked = eventData.isMedalsPublic || false;
        }

        // Update global state
        latestAthletes = athletes;
        latestClasses = classes;
        latestBrackets = brackets;
        latestRewards = rewards;
        latestMedalsManual = medalsManual;

        window.latestAthletes = athletes;
        window.latestClasses = classes;
        window.latestBrackets = brackets;
        window.latestRewards = rewards;
        window.latestMedalsManual = medalsManual;

        // Render all views
        renderAthleteData(athletes, classes, currentAthleteSubTab);
        renderClassesData(classes, athletes, brackets, currentSubTab, eventId);
        renderBracketsConfig(classes, brackets);
        renderVerificationData(athletes, classes, brackets, currentVerifikasiSubTab, eventName, eventLogo, medalsManual);
        renderWinnerStatusList(classes, brackets, rewards);

        console.log('✅ All data loaded and rendered from cache');
    } catch (err) {
        console.error('❌ Error loading data:', err);
        await customAlert('Gagal memuat data event: ' + err.message, 'Error', 'danger');
    }

    // ===================================
    // Initialize Voice Lounge
    // ===================================
    try {
        initVoiceLounge();
        console.log('🎤 Voice Lounge initialized');
    } catch (err) {
        console.error('Voice Lounge initialization error:', err);
    }

    console.log('✅ Event Detail Modules Loaded Successfully');

    // ===================================
    // Auto Tab Selection (Deep Linking)
    // ===================================
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab === 'bracket') {
        const cardBracket = document.querySelector('[onclick*="tab-bracket"]');
        if (cardBracket) {
            switchTab('tab-bracket', cardBracket);
        }
    } else if (targetTab === 'kontingen') {
        const cardKontingen = document.querySelector('[onclick*="tab-kontingen"]');
        if (cardKontingen) switchTab('tab-kontingen', cardKontingen);
    } else if (targetTab === 'atlet') {
        const cardAtlet = document.querySelector('[onclick*="tab-atlet"]');
        if (cardAtlet) switchTab('tab-atlet', cardAtlet);
    }
});


// ===================================
// UI Methods
// ===================================
function updateLogoPreview(url) {
    const preview = document.getElementById('logoPreviewImage');
    const placeholder = document.getElementById('logoPlaceholder');
    if (preview && placeholder) {
        if (url && url.length > 5) {
            preview.src = url;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            preview.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }
}
window.updateLogoPreview = updateLogoPreview;

async function previewLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Final check size - keep it under 1MB for Firestore safety
        if (file.size > 1024 * 1024) {
            await customAlert("Ukuran logo terlalu besar! Maksimal 1MB.", "Ukuran File", "danger");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            pendingLogoBase64 = base64;
            updateLogoPreview(base64);
        };
        reader.readAsDataURL(file);
    }
}
window.previewLogo = previewLogo;

window.setSubTab = (tab) => {
    currentSubTab = tab;
    document.querySelectorAll('.class-sub-tab, .bracket-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    renderClassesData(latestClasses, latestAthletes, latestBrackets, currentSubTab, eventId);
};

window.setAthleteSubTab = (tab) => {
    currentAthleteSubTab = tab;
    document.querySelectorAll('.athlete-sub-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    renderAthleteData(latestAthletes, latestClasses, currentAthleteSubTab);
};

window.setVerifikasiSubTab = (tab) => {
    currentVerifikasiSubTab = tab;
    document.querySelectorAll('.verifikasi-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    renderVerificationData(latestAthletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo, latestMedalsManual);
};

function toggleVoiceLounge() {
    const panel = document.getElementById('voice-lounge-panel');
    if (panel) {
        panel.classList.toggle('active');
    }
}
window.toggleVoiceLounge = toggleVoiceLounge;

// ===================================
// Global Exports (for HTML onclick)
// ===================================
window.switchTab = switchTab;
window.toggleModal = toggleModal;
window.filterTable = filterTable;
window.customConfirm = customConfirm;
window.customAlert = customAlert;
window.showProgress = showProgress;
window.updateProgress = updateProgress;
window.hideProgress = hideProgress;
window.downloadClassTemplate = downloadClassTemplate;
window.importClassesFromExcel = (e) => importClassesFromExcel(e, eventId);
window.importAthletesFromExcel = (e) => importAthletesFromExcel(e, eventId, latestClasses);
window.proceedWithConfirmedImport = () => proceedWithConfirmedImport(eventId);
window.editAthlete = (id) => editAthlete(id, eventId, latestClasses);
window.saveAthleteEdit = () => saveAthleteEdit(eventId, latestClasses);
window.handleClassCodeInput = (code) => handleClassCodeInput(code, latestClasses);
window.handleEmergencyClassCodeInput = (code) => handleEmergencyClassCodeInput(code, latestClasses);
window.saveEmergencyAthlete = () => saveEmergencyAthlete(eventId, latestClasses);
window.deleteAthlete = (id) => deleteAthlete(id, eventId);
window.editContingentName = (teamName) => editContingentName(teamName);
window.saveContingentNameEdit = () => saveContingentNameEdit(eventId);
window.deleteContingentAthletes = (teamName) => deleteContingentAthletes(teamName, eventId);
window.deleteAllAthletes = () => deleteAllAthletes(eventId);
window.addNewClass = () => addNewClass(eventId);
window.deleteClass = (code) => deleteClass(code, eventId);
window.deleteAllClasses = () => deleteAllClasses(eventId);
window.openBracketConfig = (code) => openBracketConfig(code, eventId, latestClasses);
window.saveBracketConfig = () => saveBracketConfig(eventId);
window.deleteBracketConfig = (code) => deleteBracketConfig(code, eventId);
window.deleteAllBrackets = () => deleteAllBrackets(eventId);
window.handleJoinVoice = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const btnJoin = document.getElementById('btn-join-voice');
    btnJoin.innerHTML = '<span class="skeleton w-20 h-3"></span>';
    btnJoin.disabled = true;
    try {
        await joinVoice(user);
        btnJoin.classList.add('hidden');
        document.getElementById('btn-mute-voice').classList.remove('hidden');
        document.getElementById('btn-leave-voice').classList.remove('hidden');
    } catch (err) {
        alert("Gagal join Voice Lounge: " + err.message);
        btnJoin.innerHTML = 'Join Lounge';
        btnJoin.disabled = false;
    }
};

window.handleLeaveVoice = async () => {
    await leaveVoice();
    document.getElementById('btn-join-voice').classList.remove('hidden');
    document.getElementById('btn-join-voice').disabled = false;
    document.getElementById('btn-join-voice').innerHTML = 'Join Lounge';
    document.getElementById('btn-mute-voice').classList.add('hidden');
    document.getElementById('btn-leave-voice').classList.add('hidden');
};

window.toggleMute = () => {
    const isMuted = toggleMicMute();
    const icon = document.getElementById('mute-icon');
    const btn = document.getElementById('btn-mute-voice');
    if (isMuted) {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-3.674m0 0L3 21m0-18l18 18" />';
        btn.classList.add('text-red-400');
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />';
        btn.classList.remove('text-red-400');
    }
};
window.toggleMicMute = toggleMicMute;
window.printSchedule = async (name, logo) => await prepareJadwalPrint(name || eventName, logo || eventLogo);
window.handlePrintFestivalBracket = async () => {
    const bracketsMap = {};
    if (latestBrackets && latestBrackets.length > 0) {
        latestBrackets.forEach(b => {
            bracketsMap[b.class] = b;
        });
    }
    await prepareBracketPrint(latestAthletes, latestClasses, eventName, eventLogo, bracketsMap);
};

window.renderWinnerStatusList = (searchTerm) => renderWinnerStatusList(latestClasses, latestBrackets, latestRewards, searchTerm);
window.copyToClipboard = copyToClipboard;
window.filterWinnerStatus = (term) => {
    renderWinnerStatusList(latestClasses, latestBrackets, latestRewards, term);
};

// ===================================
// Manual Data Refresh (QUOTA SAVER!)
// ===================================
window.refreshEventData = async () => {
    if (!eventId) return;

    const btn = document.getElementById('btn-refresh-data');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refreshing...</span>
            </div>
        `;
    }

    try {
        console.log('🔄 Manual refresh triggered...');

        // Force refresh all data
        const { classes, athletes, brackets, eventData, rewards, medalsManual } = await refreshAllData(db, eventId);

        // Update global state
        if (eventData) {
            eventName = eventData.name || eventName;
            eventLogo = eventData.logo || eventLogo;
            window.currentEventData = eventData;
        }

        latestAthletes = athletes;
        latestClasses = classes;
        latestBrackets = brackets;
        latestRewards = rewards;

        // Re-render all views
        renderAthleteData(athletes, classes, currentAthleteSubTab);
        renderClassesData(classes, athletes, brackets, currentSubTab, eventId);
        renderBracketsConfig(classes, brackets);
        renderVerificationData(athletes, classes, brackets, currentVerifikasiSubTab, eventName, eventLogo, medalsManual);
        renderWinnerStatusList(classes, brackets, rewards);

        console.log('✅ Manual refresh complete!');

        // Show success notification
        const tempMsg = document.createElement('div');
        tempMsg.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 font-black text-xs uppercase tracking-widest';
        tempMsg.textContent = '✅ Data Berhasil di-Refresh!';
        document.body.appendChild(tempMsg);

        setTimeout(() => tempMsg.remove(), 2000);
    } catch (err) {
        console.error('❌ Refresh error:', err);
        await customAlert('Gagal refresh data: ' + err.message, 'Error', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh Data</span>
                </div>
            `;
        }
    }
};

// ===================================
// Public Access (Locking) System
// ===================================
window.updatePublicAccess = async (field, value) => {
    if (!eventId) return;
    try {
        await updateDoc(doc(db, 'events', eventId), {
            [field]: value
        });
        console.log(`✅ ${field} updated to ${value}`);
    } catch (err) {
        console.error(`❌ Error updating ${field}:`, err);
        await customAlert("Gagal merubah status publikasi: " + err.message, "Gagal", "danger");
    }
};
