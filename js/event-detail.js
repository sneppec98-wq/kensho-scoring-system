// ===================================
// Event Detail - Main Orchestrator
// ===================================
// This file coordinates all event detail functionalities
// by importing modular components

import { db, auth } from './firebase-init.js';
import { handleLogout } from './auth-helpers.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initVoiceLounge, joinVoice, leaveVoice, toggleMicMute } from './voice-chat.js';

// Import UI Helpers
import {
    showProgress,
    updateProgress,
    hideProgress,
    sleep,
    toggleModal,
    filterTable,
    switchTab
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
    deleteAthlete,
    deleteContingentAthletes,
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
    deleteBracketConfig
} from './modules/brackets-manager.js';

// Import Verification Display
import { renderVerificationData } from './modules/verification-display.js';

// Import Schedule Generator & Printing
import { renderSchedule } from './modules/schedule-generator.js';
import { prepareJadwalPrint } from './modules/print/print-jadwal.js';
import { prepareBracketPrint } from './modules/print/print-bracket.js';

// Import Firestore Listeners
import {
    setupAthletesListener,
    setupClassesListener,
    setupBracketsListener,
    setupEventListener
} from './modules/firestore-listeners.js';

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
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Starting initialization...');

    onAuthStateChanged(auth, user => {
        if (!user) {
            console.log('❌ No user authenticated, redirecting to login...');
            window.location.href = 'login.html';
            return;
        }
        console.log('✅ User authenticated:', user.email);
        const userDisplay = document.getElementById('userNameDisplay');
        if (userDisplay) userDisplay.innerText = user.displayName || user.email.split('@')[0];
    });

    eventId = getEventId();
    console.log('📋 Event ID:', eventId);

    if (!eventId) {
        alert("Event ID tidak ditemukan!");
        window.location.href = 'dashboard.html';
        return;
    }

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
                alert("Nama event wajib diisi!");
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
                alert("Pengaturan event berhasil disimpan!");

                // Real-time listener will handle global variable and UI updates
                pendingLogoBase64 = null;
            } catch (err) {
                console.error("Update Event Error:", err);
                alert("Gagal menyimpan: " + err.message);
            }
        };
    }

    // ===================================
    // Setup Firestore Listeners
    // ===================================
    console.log('🔥 Setting up Firestore listeners...');

    try {
        setupEventListener(eventId, (data) => {
            console.log('📅 Event Info updated:', data);
            eventName = data.name || 'Event Tidak Dikenal';
            eventLogo = data.logo || null;

            // Update UI Labels
            const nameDisplay = document.getElementById('event-name-display');
            if (nameDisplay) nameDisplay.innerText = eventName;

            const breadcrumbName = document.getElementById('breadcrumbEventName');
            if (breadcrumbName) breadcrumbName.innerText = eventName;

            // Update Settings Modal
            const nameInput = document.getElementById('settingEventName');
            if (nameInput) nameInput.value = eventName;

            const deadlineInput = document.getElementById('settingDeadline');
            if (deadlineInput) deadlineInput.value = data.date || "";

            const locationInput = document.getElementById('settingLocation');
            if (locationInput) locationInput.value = data.location || "";

            if (eventLogo) {
                updateLogoPreview(eventLogo);
            }

            // Trigger Re-render of Verification/Print to catch logo changes
            renderVerificationData(latestAthletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo);
        });

        setupAthletesListener(eventId, (athletes) => {
            console.log('👥 Athletes updated:', athletes.length);
            latestAthletes = athletes;
            renderAthleteData(athletes, latestClasses, currentAthleteSubTab);
            renderVerificationData(athletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo);
        });

        setupClassesListener(eventId, (classes) => {
            console.log('🏅 Classes updated:', classes.length);
            latestClasses = classes;
            renderAthleteData(latestAthletes, classes, currentAthleteSubTab);
            renderClassesData(classes, latestAthletes, currentSubTab, eventId);
            renderBracketsConfig(classes, latestBrackets);
            renderVerificationData(latestAthletes, classes, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo);
        });

        setupBracketsListener(eventId, (brackets) => {
            console.log('📊 Brackets updated:', brackets.length);
            latestBrackets = brackets;
            renderClassesData(latestClasses, latestAthletes, currentSubTab, eventId);
            renderVerificationData(latestAthletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo);
        });

        console.log('✅ All Firestore listeners setup complete');
    } catch (err) {
        console.error('❌ Error setting up listeners:', err);
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

function previewLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Final check size - keep it under 1MB for Firestore safety
        if (file.size > 1024 * 1024) {
            alert("Ukuran logo terlalu besar! Maksimal 1MB.");
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
    renderClassesData(latestClasses, latestAthletes, currentSubTab, eventId);
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
    renderVerificationData(latestAthletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo);
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
window.deleteAthlete = (id) => deleteAthlete(id, eventId);
window.deleteContingentAthletes = (teamName) => deleteContingentAthletes(teamName, eventId);
window.deleteAllAthletes = () => deleteAllAthletes(eventId);
window.addNewClass = () => addNewClass(eventId);
window.deleteClass = (code) => deleteClass(code, eventId);
window.deleteAllClasses = () => deleteAllClasses(eventId);
window.openBracketConfig = (code) => openBracketConfig(code, eventId, latestClasses);
window.saveBracketConfig = () => saveBracketConfig(eventId);
window.deleteBracketConfig = (code) => deleteBracketConfig(code, eventId);
window.joinVoice = joinVoice;
window.leaveVoice = leaveVoice;
window.toggleMicMute = toggleMicMute;
window.setSubTab = setSubTab;
window.setAthleteSubTab = setAthleteSubTab;
window.setVerifikasiSubTab = setVerifikasiSubTab;
window.printSchedule = (name, logo) => prepareJadwalPrint(name || eventName, logo || eventLogo);
window.handlePrintFestivalBracket = () => {
    const bracketsMap = {};
    if (latestBrackets && latestBrackets.length > 0) {
        latestBrackets.forEach(b => {
            bracketsMap[b.class] = b;
        });
    }
    prepareBracketPrint(latestAthletes, latestClasses, eventName, eventLogo, bracketsMap);
};
