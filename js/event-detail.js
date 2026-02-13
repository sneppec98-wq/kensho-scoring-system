// ===================================
// Event Detail - Main Orchestrator
// ===================================
// This file coordinates all event detail functionalities
// by importing modular components

import { db, auth } from './firebase-init.js';
import { handleLogout } from './auth-helpers.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
    renderPaymentTracking,
    editAthlete,
    saveAthleteEdit,
    handleClassCodeInput,
    handleEmergencyClassCodeInput,
    saveEmergencyAthlete,
    deleteAthlete,
    deleteContingentAthletes,
    editContingentName,
    saveContingentNameEdit,
    deleteAllAthletes,
    applyPayment
} from './modules/athletes-manager.js';

// Import Classes Manager
import {
    renderClassesData,
    addNewClass,
    deleteClass,
    deleteAllClasses,
    editClassName,
    saveClassNameEdit
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
    getPayments,
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
let latestPaymentsMap = {};
let currentSubTab = 'OPEN'; // For Classes & Brackets
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
window.toggleModal = toggleModal;

// ===================================
// GRAND ACCESS CONTROL
// ===================================
window.openAccessModal = async function () {
    // 1. Show Modal
    toggleModal('modal-access', true);

    // 2. Fetch Latest Data
    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();

        // 3. Set Toggles
        document.getElementById('access-registration').checked = !!data.isRegistrationPublic;
        document.getElementById('access-roster').checked = !!data.isRosterPublic;
        document.getElementById('access-bracket').checked = !!data.isBracketPublic;
        document.getElementById('access-schedule').checked = !!data.isSchedulePublic;
        // Combine winners & medals for simplicity in UI, but separate in DB if needed (or just sync them)
        const isWinners = !!data.isWinnersPublic;
        const isMedals = !!data.isMedalsPublic;
        document.getElementById('access-results').checked = (isWinners && isMedals);
    }
}

window.updateAccessSetting = async function (field, value) {
    try {
        const updateData = {};
        updateData[field] = value;

        // Special case for "Results" toggle affecting two fields
        if (field === 'isWinnersPublic') {
            updateData['isMedalsPublic'] = value;
        }

        const docRef = doc(db, "events", eventId);
        await updateDoc(docRef, updateData);

        console.log(`✅ Access Updated: ${field} = ${value}`);

        // Optional: Show small success toast inside modal? 
        // For now, simpler is better as requested.
    } catch (error) {
        console.error("Error updating access:", error);
        alert("Gagal menyimpan perubahan: " + error.message);
        // Revert toggle if failed
        // (Implementation skipped for simplicity, user can just retry)
    }
}

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
            const newName = document.getElementById('settingsEventName').value.trim();
            const newDate = document.getElementById('settingsEventDate').value;
            const newLocation = document.getElementById('settingsEventLocation').value.trim();

            // Biaya
            const feeOpenIndiv = document.getElementById('feeOpenIndiv').value;
            const feeOpenTeam = document.getElementById('feeOpenTeam').value;
            const feeFestIndiv = document.getElementById('feeFestIndiv').value;
            const feeFestTeam = document.getElementById('feeFestTeam').value;
            const feeContingent = document.getElementById('feeContingent').value;

            // Bank
            const bankName = document.getElementById('bankName').value.trim();
            const bankAccount = document.getElementById('bankAccount').value.trim();
            const bankOwner = document.getElementById('bankOwner').value.trim();

            // Teknis
            const hostKontingen = document.getElementById('hostKontingen').value.trim();
            const registrationDeadline = document.getElementById('settingsRegistrationDeadline').value;

            if (!newName) {
                await customAlert("Nama event wajib diisi!", "Validasi Gagal", "danger");
                return;
            }

            const eventDataToValidate = {
                name: newName,
                date: newDate,
                location: newLocation,
                registrationDeadline: registrationDeadline,
                fees: {
                    openIndiv: Number(feeOpenIndiv) || 0,
                    openTeam: Number(feeOpenTeam) || 0,
                    festIndiv: Number(feeFestIndiv) || 0,
                    festTeam: Number(feeFestTeam) || 0,
                    contingent: Number(feeContingent) || 0
                },
                bank: {
                    name: bankName,
                    account: bankAccount,
                    owner: bankOwner
                },
                hostKontingen: hostKontingen
            };

            const isComplete = validateSetup(eventDataToValidate);

            try {
                const updateData = {
                    ...eventDataToValidate,
                    setupComplete: isComplete,
                    setupCompletedAt: isComplete ? new Date().toISOString() : null
                };

                if (pendingLogoBase64) {
                    updateData.logo = pendingLogoBase64;
                }

                await updateDoc(doc(db, 'events', eventId), updateData);

                if (isComplete) {
                    enableAllTabs();
                    await customAlert("Setup lengkap! Event siap dikelola.", "Berhasil", "info");
                } else {
                    disableAllTabs();
                    await customAlert("Data berhasil disimpan, namun belum lengkap. Mohon lengkapi semua field (termasuk biaya > 0) untuk membuka akses event.", "Setup Belum Lengkap", "warning");
                }

                toggleModal('modal-settings', false);

                // Refresh cache/state after update
                await refreshEventData();
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
        const [eventData, athletes, classes, brackets, rewards, medalsManual, payments] = await Promise.all([
            getEventData(db, eventId),
            getAthletes(db, eventId),
            getClasses(db, eventId),
            getBrackets(db, eventId),
            getRewards(db, eventId),
            fetchMedalsManual(db, eventId),
            getPayments(db, eventId)
        ]);

        // Map payments for O(1) lookup
        latestPaymentsMap = {};
        if (payments) {
            payments.forEach(p => {
                latestPaymentsMap[p.id.toUpperCase()] = p;
            });
        }
        window.latestPaymentsMap = latestPaymentsMap;

        // Update event info
        if (eventData) {
            eventName = eventData.name || 'Event Tidak Dikenal';
            eventLogo = eventData.logo || null;
            window.currentEventData = eventData;

            const nameDisplay = document.getElementById('event-name-display');
            if (nameDisplay) nameDisplay.innerText = eventName;

            const breadcrumbName = document.getElementById('breadcrumbEventName');
            if (breadcrumbName) breadcrumbName.innerText = eventName;

            const nameInput = document.getElementById('settingsEventName');
            if (nameInput) nameInput.value = eventName;

            const deadlineInput = document.getElementById('settingsEventDate');
            if (deadlineInput) deadlineInput.value = eventData.date || "";

            const regDeadlineInput = document.getElementById('settingsRegistrationDeadline');
            if (regDeadlineInput) regDeadlineInput.value = eventData.registrationDeadline || "";

            const locationInput = document.getElementById('settingsEventLocation');
            if (locationInput) locationInput.value = eventData.location || "";

            // Populate Fees
            if (eventData.fees) {
                if (document.getElementById('feeOpenIndiv')) document.getElementById('feeOpenIndiv').value = eventData.fees.openIndiv || 0;
                if (document.getElementById('feeOpenTeam')) document.getElementById('feeOpenTeam').value = eventData.fees.openTeam || 0;
                if (document.getElementById('feeFestIndiv')) document.getElementById('feeFestIndiv').value = eventData.fees.festIndiv || 0;
                if (document.getElementById('feeFestTeam')) document.getElementById('feeFestTeam').value = eventData.fees.festTeam || 0;
                if (document.getElementById('feeContingent')) document.getElementById('feeContingent').value = eventData.fees.contingent || 0;
            }

            // Populate Bank
            if (eventData.bank) {
                if (document.getElementById('bankName')) document.getElementById('bankName').value = eventData.bank.name || "";
                if (document.getElementById('bankAccount')) document.getElementById('bankAccount').value = eventData.bank.account || "";
                if (document.getElementById('bankOwner')) document.getElementById('bankOwner').value = eventData.bank.owner || "";
            }

            // Populate Host
            if (document.getElementById('hostKontingen')) document.getElementById('hostKontingen').value = eventData.hostKontingen || "";

            if (eventLogo) {
                updateLogoPreview(eventLogo);
            }

            // SETUP LOCK CHECK
            if (!eventData.setupComplete) {
                console.warn('⚠️ Event setup incomplete. Locking UI.');
                disableAllTabs();
                toggleModal('modal-settings', true);
            } else {
                enableAllTabs();
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
        renderAthleteData(athletes, classes);
        renderClassesData(classes, athletes, brackets, currentSubTab, eventId);
        renderBracketsConfig(classes, brackets);
        renderVerificationData(athletes, classes, brackets, currentVerifikasiSubTab, eventName, eventLogo, medalsManual);
        renderPaymentTracking(athletes, classes, latestPaymentsMap);
        renderWinnerStatusList(classes, brackets, rewards);

        console.log('✅ All data loaded and rendered from cache');
    } catch (err) {
        console.error('❌ Error loading data:', err);
        await customAlert('Gagal memuat data event: ' + err.message, 'Error', 'danger');
    }


    console.log('✅ Event Detail Modules Loaded Successfully');

    // ===================================
    // Auto Tab Selection (Deep Linking)
    // ===================================
    const urlParams = new URLSearchParams(window.location.search);
    const targetTab = urlParams.get('tab');
    if (targetTab === 'bracket') {
        window.switchTab('bracket');
    } else if (targetTab === 'kontingen') {
        window.switchTab('kontingen');
    } else if (targetTab === 'atlet') {
        window.switchTab('atlet');
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
    console.warn("setAthleteSubTab is deprecated. All athletes are now shown in a unified list.");
};

window.setVerifikasiSubTab = (tab) => {
    currentVerifikasiSubTab = tab;
    document.querySelectorAll('.verifikasi-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    renderVerificationData(latestAthletes, latestClasses, latestBrackets, currentVerifikasiSubTab, eventName, eventLogo, latestMedalsManual);
};


// ===================================
// Global Exports (for HTML onclick)
// ===================================
// NOTE: window.switchTab is defined at the bottom of event-detail.html for custom UI handling
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

window.applyPayment = async (name, amount) => {
    await applyPayment(name, amount, eventId);
    await window.refreshEventData(); // UI Refresh
};

window.addNewClass = () => addNewClass(eventId);
window.deleteClass = (code) => deleteClass(code, eventId);
window.deleteAllClasses = () => deleteAllClasses(eventId);
window.openBracketConfig = (code) => openBracketConfig(code, eventId, latestClasses);
window.saveBracketConfig = () => saveBracketConfig(eventId);
window.deleteBracketConfig = (code) => deleteBracketConfig(code, eventId);
window.deleteAllBrackets = () => deleteAllBrackets(eventId);
window.editClassName = (code, oldName) => editClassName(code, oldName);
window.saveClassNameEdit = () => saveClassNameEdit(eventId);

window.copyOfficialLink = async () => {
    if (!eventId) return;
    const url = `https://kensho-peserta.web.app/${eventId}`;

    try {
        await navigator.clipboard.writeText(url);
        await customAlert("Link Official Peserta berhasil disalin ke clipboard!", "Link Tersalin", "info");
    } catch (err) {
        console.error("Gagal menyalin link:", err);
        // Fallback jika navigator.clipboard tidak didukung (jarang terjadi di browser modern)
        const textArea = document.createElement("textarea");
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        await customAlert("Link Official Peserta berhasil disalin ke clipboard!", "Link Tersalin", "info");
    }
};
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
        const { classes, athletes, brackets, eventData, rewards, medalsManual, payments } = await refreshAllData(db, eventId);

        // Update global state
        latestPaymentsMap = {};
        if (payments) {
            payments.forEach(p => {
                latestPaymentsMap[p.id.toUpperCase()] = p;
            });
        }
        window.latestPaymentsMap = latestPaymentsMap;
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
        renderAthleteData(athletes, classes);
        renderClassesData(classes, athletes, brackets, currentSubTab, eventId);
        renderBracketsConfig(classes, brackets);
        renderVerificationData(athletes, classes, brackets, currentVerifikasiSubTab, eventName, eventLogo, medalsManual);
        renderPaymentTracking(athletes, classes, latestPaymentsMap);
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
// ===================================
// Setup Lock & Validation System
// ===================================
function validateSetup(data) {
    if (!data) return false;

    // Optional: Log detailed validation status for debugging
    const checks = {
        name: !!data.name?.trim(),
        date: !!data.date?.trim(),
        location: !!data.location?.trim(),
        registrationDeadline: !!data.registrationDeadline?.trim(),
        // Fees can be 0 (e.g. free event), just check if they exist as numbers
        feesOpenIndiv: data.fees?.openIndiv !== undefined && data.fees?.openIndiv !== null,
        feesOpenTeam: data.fees?.openTeam !== undefined && data.fees?.openTeam !== null,
        feesFestIndiv: data.fees?.festIndiv !== undefined && data.fees?.festIndiv !== null,
        feesFestTeam: data.fees?.festTeam !== undefined && data.fees?.festTeam !== null,
        feesContingent: data.fees?.contingent !== undefined && data.fees?.contingent !== null,
        // Bank info is optional if payment not required, but let's check basic structure if provided
        // For now, let's make bank info OPTIONAL to prevent blocking if not needed
        // bankName: !!data.bank?.name?.trim(),
        // bankAccount: !!data.bank?.account?.trim(),
        // bankOwner: !!data.bank?.owner?.trim(),
        hostKontingen: !!data.hostKontingen?.trim()
    };



    const isValid = (
        checks.name &&
        checks.date &&
        checks.location &&
        checks.registrationDeadline &&
        checks.feesOpenIndiv &&
        checks.feesOpenTeam &&
        checks.feesFestIndiv &&
        checks.feesFestTeam &&
        checks.feesContingent &&
        checks.hostKontingen
    );

    return isValid;
}

function disableAllTabs() {
    // Disable all management tabs
    const tabIds = ['btn-atlet', 'btn-kontingen', 'btn-kelas', 'btn-bagan', 'btn-pembayaran', 'btn-hasil'];
    tabIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        }
    });

    // Show banner
    document.getElementById('setupBanner')?.classList.remove('hidden');

    // Also disable sub-tab navigation
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    });

    // HIDE ALL DATA CONTENT
    const wrapper = document.getElementById('tab-content-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
}

function enableAllTabs() {
    // Enable all management tabs
    const tabIds = ['btn-atlet', 'btn-kontingen', 'btn-kelas', 'btn-bagan', 'btn-pembayaran', 'btn-hasil'];
    tabIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        }
    });

    // Hide banner
    document.getElementById('setupBanner')?.classList.add('hidden');

    // Enable sub-tab navigation
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });

    // SHOW DATA CONTENT
    const wrapper = document.getElementById('tab-content-wrapper');
    if (wrapper) wrapper.classList.remove('hidden');

    // RESTORE ACTIVE TAB
    // Find which button has 'active' class
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) {
        const tabId = activeBtn.id.replace('btn-', '');
        switchTab(tabId, activeBtn);
    } else {
        switchTab('atlet', document.getElementById('btn-atlet'));
    }
}
