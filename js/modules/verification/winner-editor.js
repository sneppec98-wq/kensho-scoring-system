import { db } from '../../firebase-init.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { customAlert, toggleModal } from '../ui-helpers.js';
import { renderVerificationData } from '../verification-display.js';

let currentClassCode = null;
let currentClassName = null;
let eventId = null;

/**
 * INITIALISE WINNER EDITOR
 */
export const initialiseWinnerEditor = (id) => {
    eventId = id;
    setupAutocomplete('edit-win1');
    setupAutocomplete('edit-win2');
    setupAutocomplete('edit-win3a');
    setupAutocomplete('edit-win3b');
};

const setupAutocomplete = (inputId) => {
    const input = document.getElementById(inputId);
    const container = document.getElementById('winner-edit-autocomplete');
    if (!input || !container) return;

    input.addEventListener('input', () => {
        const value = input.value.trim().toLowerCase();
        if (value.length < 2) {
            container.classList.add('hidden');
            return;
        }

        const athletes = window.latestAthletes || [];
        const matches = athletes.filter(a => a.name.toLowerCase().includes(value)).slice(0, 5);

        if (matches.length > 0) {
            const rect = input.getBoundingClientRect();
            // Container follows input position
            // We use absolute mapping because the container is inside the modal
            container.style.top = `${input.offsetTop + input.offsetHeight + 5}px`;
            container.style.left = `${input.offsetLeft}px`;
            container.style.width = `${input.offsetWidth}px`;

            container.innerHTML = matches.map(a => `
                <div class="px-6 py-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" 
                     onclick="window.selectWinnerAutocomplete('${inputId}', '${a.name.replace(/'/g, "\\'")}')">
                    <p class="text-xs font-black text-white uppercase">${a.name}</p>
                    <p class="text-[8px] font-bold text-slate-500 uppercase">${a.team}</p>
                </div>
            `).join('');
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });
};

/**
 * GLOBAL SCOPE FOR ONCLICK
 */
window.selectWinnerAutocomplete = (inputId, name) => {
    document.getElementById(inputId).value = name;
    document.getElementById('winner-edit-autocomplete').classList.add('hidden');
};

/**
 * OPEN WINNER EDIT MODAL
 */
export const openWinnerEditModal = async (className, classCode = null) => {
    currentClassName = className;
    currentClassCode = classCode;

    const subtitle = document.getElementById('winner-edit-subtitle');
    if (subtitle) subtitle.innerText = `KELAS: ${className.toUpperCase()} (${classCode})`;

    toggleModal('modal-winner-edit', true);

    // Initial state
    ['edit-win1', 'edit-win2', 'edit-win3a', 'edit-win3b'].forEach(id => {
        document.getElementById(id).value = 'Memuat...';
        document.getElementById(id).disabled = true;
    });

    try {
        const docId = classCode || className;
        const bracketDoc = await getDoc(doc(db, "events", eventId, "brackets", docId));

        ['edit-win1', 'edit-win2', 'edit-win3a', 'edit-win3b'].forEach(id => {
            document.getElementById(id).value = '';
            document.getElementById(id).disabled = false;
        });

        if (bracketDoc.exists()) {
            const data = bracketDoc.data().data || {};
            if (bracketDoc.data().status === 'complete') {
                document.getElementById('edit-win1').value = data.winner_name || data.winner_nama || '';
                document.getElementById('edit-win2').value = data.fn1 || data.fn2 || data.fn_1 || data.fn_2 || '';
                document.getElementById('edit-win3a').value = data.sn1 || data.sn_1 || '';
                document.getElementById('edit-win3b').value = data.sn2 || data.sn_2 || '';
            }
        }
    } catch (err) {
        console.error("Error loading winner data:", err);
        ['edit-win1', 'edit-win2', 'edit-win3a', 'edit-win3b'].forEach(id => {
            document.getElementById(id).value = '';
            document.getElementById(id).disabled = false;
        });
    }
};

/**
 * SAVE WINNER EDIT
 */
export const saveWinnerEdit = async () => {
    const w1 = document.getElementById('edit-win1').value.trim();
    const w2 = document.getElementById('edit-win2').value.trim();
    const w3a = document.getElementById('edit-win3a').value.trim();
    const w3b = document.getElementById('edit-win3b').value.trim();

    if (!eventId || !currentClassName) return;

    const btn = document.getElementById('save-winner-edit-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "MENYIMPAN...";

    try {
        const docId = currentClassCode || currentClassName;

        // Helper to find team
        const athletes = window.latestAthletes || [];
        const findAthlete = (name) => athletes.find(a => a.name.toUpperCase() === name.toUpperCase());

        const getTeam = (name) => {
            if (!name) return "";
            return findAthlete(name)?.team || "MANDIRI";
        };

        const resultsData = {
            winner_name: w1,
            winner_nama: w1,
            fn1: w2,
            sn1: w3a,
            sn2: w3b,
            manual_entry: true,
            updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, "events", eventId, "brackets", docId), {
            class: currentClassName,
            classCode: currentClassCode,
            status: 'complete',
            data: resultsData,
            goldTeam: getTeam(w1),
            silverTeam: getTeam(w2),
            bronzeTeams: [getTeam(w3a), getTeam(w3b)]
        }, { merge: true });

        customAlert("Hasil berhasil disimpan!", "Sukses", "info");
        toggleModal('modal-winner-edit', false);

        // Reload global verifikasi data to calculate medal tally
        if (typeof renderVerificationData === 'function') {
            renderVerificationData(
                window.latestAthletes,
                window.latestClasses,
                window.latestBrackets,
                window.verifikasiCurrentTab,
                window.currentEventData?.name,
                window.currentEventData?.logo
            );
        }
    } catch (err) {
        console.error("Error saving winner edit:", err);
        customAlert("Gagal menyimpan data: " + err.message, "Error", "danger");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

window.openWinnerEditModal = openWinnerEditModal;
window.saveWinnerEdit = saveWinnerEdit;
