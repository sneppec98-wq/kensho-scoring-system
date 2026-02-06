import { db } from '../../firebase-init.js';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { customAlert, toggleModal, customConfirm } from '../ui-helpers.js';
import { renderVerificationData } from '../verification-display.js';
import { fetchMedalsManual } from '../firestore-listeners.js';

let eventId = null;

export const initialiseMedalTallyManager = (id) => {
    eventId = id;
};

// Local state for system counts
let systemCounts = { gold: 0, silver: 0, bronze: 0 };

/**
 * OPEN MODAL FOR ADD/EDIT
 */
export const openMedalManualModal = (data = null) => {
    const title = document.getElementById('medal-manual-title');
    const inputId = document.getElementById('medal-manual-id');
    const inputTeam = document.getElementById('medal-manual-team');
    const inputGold = document.getElementById('medal-manual-gold');
    const inputSilver = document.getElementById('medal-manual-silver');
    const inputBronze = document.getElementById('medal-manual-bronze');

    const sysGold = document.getElementById('system-gold-display');
    const sysSilver = document.getElementById('system-silver-display');
    const sysBronze = document.getElementById('system-bronze-display');

    // Reset/Store system counts for delta calculation
    systemCounts = {
        gold: data?.autoGold || 0,
        silver: data?.autoSilver || 0,
        bronze: data?.autoBronze || 0
    };

    // Update system display UI
    if (sysGold) sysGold.innerText = `Sistem: ${systemCounts.gold}`;
    if (sysSilver) sysSilver.innerText = `Sistem: ${systemCounts.silver}`;
    if (sysBronze) sysBronze.innerText = `Sistem: ${systemCounts.bronze}`;

    if (data) {
        title.innerText = "Edit Medali (Target Total)";
        inputId.value = data.id || "";
        inputTeam.value = data.team;
        inputTeam.readOnly = true;

        // Input values shown are the TARGET TOTALS (Current Gold/Silver/Bronze)
        inputGold.value = data.gold || 0;
        inputSilver.value = data.silver || 0;
        inputBronze.value = data.bronze || 0;
    } else {
        title.innerText = "Input Medali Manual";
        inputId.value = "";
        inputTeam.value = "";
        inputTeam.readOnly = false;
        inputGold.value = 0;
        inputSilver.value = 0;
        inputBronze.value = 0;
    }

    toggleModal('modal-medal-manual-edit', true);
};

/**
 * SAVE MANUAL MEDAL (Delta Calculation)
 */
export const saveMedalManual = async () => {
    const id = document.getElementById('medal-manual-id').value;
    const team = document.getElementById('medal-manual-team').value.trim().toUpperCase();

    // These values from the UI represent the TARGET TOTAL desired by the user
    const targetGold = parseInt(document.getElementById('medal-manual-gold').value) || 0;
    const targetSilver = parseInt(document.getElementById('medal-manual-silver').value) || 0;
    const targetBronze = parseInt(document.getElementById('medal-manual-bronze').value) || 0;

    if (!team) {
        customAlert("Nama kontingen wajib diisi!", "Validasi Gagal", "danger");
        return;
    }

    if (!eventId) return;

    // CALCULATE ADJUSTMENT (DELTA)
    // Adjustment = Target - Automated
    const adjGold = targetGold - systemCounts.gold;
    const adjSilver = targetSilver - systemCounts.silver;
    const adjBronze = targetBronze - systemCounts.bronze;

    const btn = document.getElementById('save-medal-manual-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "MENYIMPAN...";

    try {
        const docId = id || team.replace(/[^A-Z0-9]/g, '_');
        const ref = doc(db, `events/${eventId}/medals_manual`, docId);

        // We store the ADJUSTMENT (delta), not the total
        await setDoc(ref, {
            team: team,
            gold: adjGold,
            silver: adjSilver,
            bronze: adjBronze,
            updatedAt: serverTimestamp()
        }, { merge: true });

        customAlert("Data penyesuaian medali berhasil disimpan!", "Sukses", "info");
        toggleModal('modal-medal-manual-edit', false);

        await refreshMedalView();
    } catch (err) {
        console.error("Error saving manual medal adjustment:", err);
        customAlert("Gagal menyimpan: " + err.message, "Error", "danger");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

/**
 * DELETE MANUAL MEDAL
 */
export const deleteManualMedal = async (team) => {
    if (!eventId) return;

    const confirmed = await customConfirm(
        `Apakah Anda yakin ingin menghapus manual override untuk kontingen ${team}?`,
        "Konfirmasi Hapus"
    );

    if (!confirmed) return;

    try {
        const docId = team.replace(/[^A-Z0-9]/g, '_');
        await deleteDoc(doc(db, `events/${eventId}/medals_manual`, docId));

        customAlert("Data manual berhasil dihapus", "Sukses", "info");
        await refreshMedalView();
    } catch (err) {
        console.error("Error deleting manual medal:", err);
        customAlert("Gagal menghapus: " + err.message, "Error", "danger");
    }
};

const refreshMedalView = async () => {
    // Force refresh cache for medals_manual
    const medalsManual = await fetchMedalsManual(db, eventId, true);
    window.latestMedalsManual = medalsManual;

    if (typeof renderVerificationData === 'function') {
        renderVerificationData(
            window.latestAthletes,
            window.latestClasses,
            window.latestBrackets,
            'MEDALI',
            window.currentEventData?.name,
            window.currentEventData?.logo
        );
    }
};

window.saveMedalManual = saveMedalManual;
window.openMedalManualModal = openMedalManualModal;
window.deleteManualMedal = deleteManualMedal;
