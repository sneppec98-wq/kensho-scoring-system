import { db, auth } from './firebase-init.js';
import { handleLogout } from './auth-helpers.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, addDoc, onSnapshot, query, where, orderBy, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initVoiceLounge, joinVoice, leaveVoice, toggleMicMute } from './voice-chat.js';

window.handleLogout = handleLogout;

// Progress UI Helpers
const showProgress = (title, items) => {
    document.getElementById('loader-title').innerText = title;
    document.getElementById('loader-status').innerText = `MEMPROSES ${items} DATA...`;
    document.getElementById('loader-progress-bar').style.width = '0%';
    document.getElementById('loader-percent').innerText = '0%';
    document.getElementById('loading-overlay').style.display = 'flex';
};

const updateProgress = (current, total) => {
    const percent = Math.round((current / total) * 100);
    document.getElementById('loader-progress-bar').style.width = `${percent}%`;
    document.getElementById('loader-percent').innerText = `${percent}%`;
    document.getElementById('loader-status').innerText = `DATA KE-${current} DARI ${total} SELESAI`;
};

const hideProgress = () => {
    document.getElementById('loading-overlay').style.display = 'none';
};

// Utility to prevent "Page Unresponsive" / yield to UI thread
const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Sub-Tab Global State
let currentSubTab = 'OPEN';
let currentAthleteSubTab = 'OPEN';
let currentVerifikasiSubTab = 'PESERTA';
let latestClasses = [];
const EXPECTED_CONTINGENTS = [
    "INKAI DOJO AVATAR",
    "INKANAS DOJO DOMINORISE",
    "INKANAS KALISAT",
    "INKAI BRIGIF 9",
    "SHOTOKAI DOJO ARGAPURO",
    "SHOTOKAI DOJO DHARMA ALAM",
    "TAKO DOJO TKTDW",
    "INKAI DOJO RAMBIPUJI",
    "INKAI DOJO AMBULU",
    "INKAI DOJO KORAMIL WULUHAN",
    "INKANAS SUMBERSARI",
    "INKANAS DOJO LEDOKOMBO",
    "INKAI DOJO SKYAIR JEMBER",
    "INKAI GANESHA KARATE CLUB",
    "INKAI DOJO KODIM 0824",
    "INKAI SMK N 5",
    "INKAI GEMA 45",
    "INKAI DOJO CAHYA BANTALA",
    "LEMKARI JEMBER",
    "INKADO DOJO PENDOWO SEMBORO",
    "INKADO DOJO ONE KODIM JEMBER KARATE AKADEMI",
    "INKAI DOJO KTB",
    "INKAI YONIF 509",
    "INKANAS BHARADAKSA"
];
let pendingImportData = [];
let allEventResults = [];

window.setVerifikasiSubTab = (tab) => {
    currentVerifikasiSubTab = tab;
    document.querySelectorAll('.verifikasi-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });

    if (tab === 'PESERTA') {
        renderVerificationData(allAthletes);
    } else if (tab === 'JADWAL') {
        renderSchedule(latestClasses, allAthletes);
    } else if (tab === 'JUARA') {
        renderWinners(allEventResults);
    } else if (tab === 'MEDALI') {
        renderMedalTally(allEventResults);
    }
};

window.setSubTab = (tab) => {
    currentSubTab = tab;
    // Update UI Active State for both Classes and Brackets tabs
    document.querySelectorAll('.class-sub-tab, .bracket-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    // Re-render
    renderClassesData(latestClasses);
};

window.setAthleteSubTab = (tab) => {
    currentAthleteSubTab = tab;
    document.querySelectorAll('.athlete-sub-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === tab);
    });
    renderAthleteData(allAthletes);
};

window.toggleVoiceLounge = () => {
    const panel = document.getElementById('voice-lounge-panel');
    panel.classList.toggle('active');
    const btn = document.getElementById('btn-voice');
    btn.classList.toggle('active');
};

window.handleJoinVoice = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const btnJoin = document.getElementById('btn-join-voice');
    btnJoin.disabled = true;
    try {
        await joinVoice(user);
        btnJoin.classList.add('hidden');
        document.getElementById('btn-mute-voice').classList.remove('hidden');
        document.getElementById('btn-leave-voice').classList.remove('hidden');
    } catch (err) {
        alert("Gagal join Voice Lounge: " + err.message);
        btnJoin.disabled = false;
    }
};

window.handleLeaveVoice = async () => {
    await leaveVoice();
    document.getElementById('btn-join-voice').classList.remove('hidden');
    document.getElementById('btn-join-voice').disabled = false;
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

// Get Event ID from URL
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');

if (!eventId) {
    alert("ID Event tidak ditemukan!");
    window.location.href = 'data-pertandingan.html';
}

// Protect Route
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        if (document.getElementById('userNameDisplay')) {
            document.getElementById('userNameDisplay').innerText = user.displayName || user.email.split('@')[0];
        }
        const btnBagan = document.getElementById('btnBagan');
        if (btnBagan) btnBagan.href = `event-bracket.html?id=${eventId}`;

        const linkScoringHub = document.getElementById('linkScoringHub');
        if (linkScoringHub) linkScoringHub.href = `scoring-home.html?id=${eventId}`;
    }
});

// Load Event Basic Info
window.eventName = 'Event'; // Global variable for event name
window.eventLocation = '';  // Global variable for championship location
window.selectedDay = '1';   // Global variable for selected day
window.selectedTatami = '1'; // Global variable for selected Tatami
window.numDays = 1;         // Total days
window.totalTatami = 1;     // Total tatami
window.currentEventLogoBase64 = null; // Global variable for event logo

window.previewLogo = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentEventLogoBase64 = e.target.result;
            const previewImg = document.getElementById('logoPreviewImage');
            const placeholder = document.getElementById('logoPlaceholder');
            previewImg.src = currentEventLogoBase64;
            previewImg.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

async function loadEventInfo() {
    const docRef = doc(db, "events", eventId);
    onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            eventName = data.name; // Store event name globally
            document.getElementById('breadcrumbEventName').innerText = data.name;

            // Update logo preview if exists
            if (data.logo) {
                currentEventLogoBase64 = data.logo;
                const previewImg = document.getElementById('logoPreviewImage');
                const placeholder = document.getElementById('logoPlaceholder');
                previewImg.src = currentEventLogoBase64;
                previewImg.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }

            // Update modal fields if settings exist
            document.getElementById('settingEventName').value = data.name || '';
            if (data.settings) {
                document.getElementById('settingDeadline').value = data.settings.deadline || '';
                document.getElementById('feeOpenIndiv').value = data.settings.feeOpenIndiv || 0;
                document.getElementById('feeOpenTeam').value = data.settings.feeOpenTeam || 0;
                document.getElementById('feeFestIndiv').value = data.settings.feeFestIndiv || 0;
                document.getElementById('feeFestTeam').value = data.settings.feeFestTeam || 0;
                document.getElementById('feeContingent').value = data.settings.feeContingent || 0;
                document.getElementById('bankName').value = data.settings.bankName || '';
                document.getElementById('bankAccount').value = data.settings.bankAccount || '';
                document.getElementById('bankOwner').value = data.settings.bankOwner || '';
                document.getElementById('hostKontingen').value = data.settings.hostKontingen || '';

                document.getElementById('scheduleEventLocation').value = data.settings.eventLocation || '';
                document.getElementById('scheduleNumDays').value = data.settings.numDays || 1;
                document.getElementById('scheduleTotalTatami').value = data.settings.totalTatami || 1;

                eventLocation = data.settings.eventLocation || '';
                numDays = data.settings.numDays || 1;
                totalTatami = data.settings.totalTatami || 1;
            }

            // Trigger re-render of verification tab to include the logo
            if (typeof allAthletes !== 'undefined' && allAthletes.length > 0) {
                if (currentVerifikasiSubTab === 'PESERTA') {
                    renderVerificationData(allAthletes);
                } else if (currentVerifikasiSubTab === 'JADWAL') {
                    renderSchedule(latestClasses, allAthletes);
                }
            }
        }
    });
}
loadEventInfo();

// Save Event Settings
document.getElementById('formSettings').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "MENYIMPAN...";

    const newName = document.getElementById('settingEventName').value.toUpperCase();
    const settings = {
        deadline: document.getElementById('settingDeadline').value,
        feeOpenIndiv: parseInt(document.getElementById('feeOpenIndiv').value),
        feeOpenTeam: parseInt(document.getElementById('feeOpenTeam').value),
        feeFestIndiv: parseInt(document.getElementById('feeFestIndiv').value),
        feeFestTeam: parseInt(document.getElementById('feeFestTeam').value),
        feeContingent: parseInt(document.getElementById('feeContingent').value),
        bankName: document.getElementById('bankName').value.toUpperCase(),
        bankAccount: document.getElementById('bankAccount').value,
        bankOwner: document.getElementById('bankOwner').value.toUpperCase(),
        hostKontingen: document.getElementById('hostKontingen').value.toUpperCase(),
        eventLocation: eventLocation
    };

    try {
        await updateDoc(doc(db, "events", eventId), {
            name: newName,
            settings: settings,
            logo: currentEventLogoBase64,
            updatedAt: new Date().toISOString()
        });
        toggleModal('modal-settings', false);
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN PERUBAHAN";
    }
};

// Save Schedule Settings (Specific)
document.getElementById('formScheduleSettings').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "MENYIMPAN...";

    try {
        const eventRef = doc(db, "events", eventId);
        const snapshot = await getDoc(eventRef);
        if (snapshot.exists()) {
            const newLoc = document.getElementById('scheduleEventLocation').value.toUpperCase();
            const newDays = parseInt(document.getElementById('scheduleNumDays').value) || 1;
            const newTatami = parseInt(document.getElementById('scheduleTotalTatami').value) || 1;

            await updateDoc(eventRef, {
                'settings.eventLocation': newLoc,
                'settings.numDays': newDays,
                'settings.totalTatami': newTatami,
                updatedAt: new Date().toISOString()
            });

            toggleModal('modal-schedule-settings', false);
        }
    } catch (err) {
        alert("Gagal menyimpan jadwal: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "SIMPAN";
    }
};

// Real-time Counts & Lists
const athleteTableBody = document.querySelector('#tableAtlet tbody');
const classTableBody = document.querySelector('#tableKelas tbody');
const bracketListArea = document.querySelector('#tab-bracket .grid'); // Target for class cards
const countAtletLabel = document.querySelector('div[onclick*="tab-atlet"] span');
const countKelasLabel = document.getElementById('countKelas');
const athleteClassSelect = document.getElementById('athleteClass');

//## Verification Tab Improvements
-[x] Remove global print button from`event-detail.html`
    - [x] Refactor `js/modules/verification-display.js`:
-[x] Implement `renderVerificationData` with sub - tab support
    - [x] Restore "DAFTAR JUARA" logic(from backup)
        - [x] Restore "PEROLEHAN MEDALI" logic(from backup)
            - [x] Add sub - tab specific print buttons
                - [x] Implement`printVerificationSubTab(tab)`
                    - [x] Update `js/event-detail.js` orchestrator:
-[x] Pass `currentVerifikasiSubTab` to render function
    -[x] Ensure brackets listener triggers verification refresh

## Current Status
Successfully refactored the Verification tab with sub - tab specific printing and restored all missing results logic.

// Function to render verification data grouped by contingent
function renderVerificationData(athletes) {
    const verifikasiContent = document.getElementById('verifikasiContent');
    const printContent = document.getElementById('printContent');

    if (!athletes || athletes.length === 0) {
        verifikasiContent.innerHTML = '<p class="text-center opacity-40 py-20 italic">Belum ada data atlet.</p>';
        printContent.innerHTML = '';
        return;
    }

    // Group by contingent/team
    const grouped = {};
    athletes.forEach(athlete => {
        const team = athlete.team || 'Lainnya';
        if (!grouped[team]) {
            grouped[team] = [];
        }
        grouped[team].push(athlete);
    });

    // Sort each group by Class Code (Natural Sort)
    Object.keys(grouped).forEach(team => {
        grouped[team].sort((a, b) => {
            const classA = latestClasses.find(c => c.name === a.className);
            const classB = latestClasses.find(c => c.name === b.className);
            const codeA = (classA?.code || "").toString();
            const codeB = (classB?.code || "").toString();

            // Primary sort: Class Code
            const codeCmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            if (codeCmp !== 0) return codeCmp;

            // Secondary sort: Name
            return (a.name || "").localeCompare(b.name || "");
        });
    });

    // Render screen view
    let screenHTML = '<div class="space-y-8">';
    Object.keys(grouped).sort().forEach(team => {
        screenHTML += `
            <div>
                <h4 class="text-lg font-black uppercase bg-blue-500/20 px-6 py-3 rounded-xl mb-4">${team}</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="text-[9px] font-black opacity-50 uppercase tracking-wider">
                            <tr>
                                <th class="pb-2 pl-4">No</th>
                                <th class="pb-2">Nama Peserta</th>
                                <th class="pb-2">Gender</th>
                                <th class="pb-2">Kategori/Kelas</th>
                                <th class="pb-2">Tanggal Lahir</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        grouped[team].forEach((athlete, idx) => {
            const birthDate = athlete.birthDate ? new Date(athlete.birthDate) : null;
            const formattedDate = birthDate ? birthDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }) : '-';

            const gender = athlete.gender || (athlete.className?.includes('PUTRA') ? 'PUTRA' : 'PUTRI');

            // Handle Beregu display name
            let displayName = athlete.name;
            if (athlete.members && athlete.members.length > 0) {
                displayName += `<div class="text-[10px] opacity-60 font-medium normal-case mt-1">Anggota: ${athlete.members.join(', ')}</div>`;
            }

            screenHTML += `
                <tr class="border-t border-white/5">
                    <td class="py-3 pl-4">${idx + 1}</td>
                    <td class="py-3 font-bold">${displayName}</td>
                    <td class="py-3">${gender}</td>
                    <td class="py-3 text-blue-400">${athlete.className || '-'}</td>
                    <td class="py-3">${formattedDate}</td>
                </tr>
            `;
        });

        screenHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    screenHTML += '</div>';
    verifikasiContent.innerHTML = screenHTML;

    // Render print view: Logic for STRICT 30 rows per page
    const LIMIT = 30;
    const sortedTeams = Object.keys(grouped).sort();
    const flattened = [];
    sortedTeams.forEach(team => {
        grouped[team].forEach(a => flattened.push({ ...a, teamName: team }));
    });

    let printHTML = '';
    let athletesOnPage = 0;
    let currentTeam = null;
    let pageNum = 1;

    const renderHeader = () => `
        <div class="print-header" style="text-align: center; margin-bottom: 5px;">
            <div class="logo-banner-container" style="text-align: center; margin-bottom: 5px;">
                ${currentEventLogoBase64 ?
            `<img src="${currentEventLogoBase64}" style="height: 65px; object-fit: contain; margin: 0 auto; display: block;">` :
            `<div style="width: 100%; height: 35px; background: #f3f4f6; border: 1px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 7pt; color: #9ca3af; font-family: 'Montserrat', sans-serif; font-weight: 800; letter-spacing: 2px;">LOGO BANNER AREA</div>`
        }
            </div>
            <h2 style="font-family: 'Montserrat', sans-serif; font-size: 24pt; font-weight: 900; text-align: center; margin: 0; letter-spacing: 1px; text-transform: uppercase;">VERIFIKASI DATA PESERTA</h2>
            <p style="font-family: 'Montserrat', sans-serif; font-size: 10pt; text-align: center; color: #000; margin: 2px 0 10px 0; font-weight: 800; text-transform: uppercase;">${eventName || 'EVENT'}</p>
        </div>
    `;

    const renderFooter = (p) => `
        <div class="fixed-print-footer">
            <div class="brand-info">
                <img src="kensho-logo.png" class="brand-logo" alt="Kensho">
                <span class="brand-name">KENSHO - Digital Scoring System</span>
            </div>
            <div class="page-number">Halaman ${p}</div>
        </div>
    `;

    flattened.forEach((athlete, index) => {
        if (athletesOnPage === 0) {
            printHTML += `<div class="print-page">${renderHeader()}`;
        }

        // If contingent changes, or start of page, show contingent header
        if (athlete.teamName !== currentTeam || athletesOnPage === 0) {
            if (athletesOnPage > 0 && index > 0) {
                printHTML += `</tbody></table>`; // Close previous table on same page
            }
            printHTML += `
                <div style="background: #f3f4f6; border: 1.5px solid #374151; padding: 6px 10px; margin-bottom: 5px; border-radius: 4px; text-align: center;">
                    <h3 style="font-family: 'Montserrat', sans-serif; font-size: 11pt; font-weight: 800; margin: 0; color: #000; text-transform: uppercase;">${athlete.teamName}</h3>
                </div>
                <table style="font-family: 'Montserrat', sans-serif; width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 10px;">
                    <thead>
                        <tr style="background: #eee;">
                            <th style="width: 25px; text-align: center; border: 1px solid #e5e7eb; padding: 3px;">No</th>
                            <th style="text-align: left; border: 1px solid #e5e7eb; padding: 3px;">Nama Peserta</th>
                            <th style="width: 50px; text-align: center; border: 1px solid #e5e7eb; padding: 3px;">Gender</th>
                            <th style="border: 1px solid #e5e7eb; padding: 3px;">Kategori/Kelas</th>
                            <th style="width: 100px; text-align: center; border: 1px solid #e5e7eb; padding: 3px;">Lahir</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            currentTeam = athlete.teamName;
        }

        // Render Athlete Row
        const birthDate = athlete.birthDate ? new Date(athlete.birthDate) : null;
        const formattedDate = birthDate ? birthDate.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) : '-';
        const gender = athlete.gender || (athlete.className?.includes('PUTRA') ? 'Putra' : 'Putri');

        // Handle Beregu display name for print
        let displayName = athlete.name;
        if (athlete.members && athlete.members.length > 0) {
            displayName += `<br><span style="font-size: 7pt; font-weight: normal; text-transform: uppercase;">MEMBER: ${athlete.members.join(' / ')}</span>`;
        }

        printHTML += `
            <tr>
                <td style="text-align: center; border: 1px solid #e5e7eb; padding: 2px;">${index + 1}</td>
                <td style="font-weight: 700; border: 1px solid #e5e7eb; padding: 2px;">${displayName}</td>
                <td style="text-align: center; border: 1px solid #e5e7eb; padding: 2px;">${gender}</td>
                <td style="border: 1px solid #e5e7eb; padding: 2px;">${athlete.className || '-'}</td>
                <td style="text-align: center; border: 1px solid #e5e7eb; padding: 2px;">${formattedDate}</td>
            </tr>
        `;

        athletesOnPage++;

        // If hit limit or end of entire list
        if (athletesOnPage === LIMIT || index === flattened.length - 1) {
            printHTML += `</tbody></table>`;

            // If it's the absolute end, add summary
            if (index === flattened.length - 1) {
                printHTML += `
                    <div style="margin-top: 5px; font-family: 'Montserrat', sans-serif; font-size: 9pt; text-align: right; border-top: 1px solid #000; padding-top: 3px;">
                        <strong>TOTAL PENDAFTAR: ${athletes.length} ATLET</strong>
                    </div>
                `;
            }

            printHTML += `${renderFooter(pageNum)}</div>`;
            athletesOnPage = 0;
            pageNum++;
        }
    });

    if (currentVerifikasiSubTab === 'PESERTA') {
        printContent.innerHTML = printHTML;
    }
}

async function fetchEventResults() {
    const verifikasiContent = document.getElementById('verifikasiContent');
    verifikasiContent.innerHTML = '<div class="flex flex-col items-center justify-center py-20 gap-4"><div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div><p class="text-[10px] font-black uppercase tracking-widest opacity-40">Menganalisis Hasil Pertandingan...</p></div>';

    try {
        const qBrackets = collection(db, `events/${eventId}/brackets`);
        const snap = await getDocs(qBrackets);
        const results = [];

        snap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.status === 'complete' && data.data) {
                const classResults = {
                    className: data.class,
                    winners: { gold: null, silver: null, bronze: [] },
                    goldTeam: null,
                    silverTeam: null,
                    bronzeTeams: []
                };

                const svgData = data.data;
                const gold = svgData.winner_nama || svgData.winner_name;
                if (gold && gold.trim() !== "-" && gold.trim() !== "") {
                    classResults.winners.gold = gold.trim();

                    // 1. Resolve Gold Team
                    if (data.participants) {
                        const pGold = data.participants.find(p => p.name === gold.trim());
                        if (pGold) classResults.goldTeam = pGold.team;
                    }

                    // 2. Silver Detection & Team Resolution
                    const finalist = svgData.fn1 || svgData.fn_1;
                    if (finalist && finalist.trim() !== "-" && finalist.trim() !== gold.trim()) {
                        classResults.winners.silver = finalist.trim();
                        if (data.participants) {
                            const pSilver = data.participants.find(p => p.name === finalist.trim());
                            if (pSilver) classResults.silverTeam = pSilver.team;
                        }
                    }

                    // 3. Bronze Detection & Team Resolution
                    const semi1 = svgData.sn1 || svgData.sn_1;
                    const semi2 = svgData.sn2 || svgData.sn_2;
                    [semi1, semi2].forEach(s => {
                        if (s && s.trim() !== "-" && s.trim() !== gold.trim() && s.trim() !== classResults.winners.silver) {
                            classResults.winners.bronze.push(s.trim());
                            if (data.participants) {
                                const pBronze = data.participants.find(p => p.name === s.trim());
                                if (pBronze) classResults.bronzeTeams.push(pBronze.team);
                            }
                        }
                    });
                }

                if (classResults.winners.gold) results.push(classResults);
            }
        });

        allEventResults = results;
        setVerifikasiSubTab(currentVerifikasiSubTab);
    } catch (err) {
        console.error("Fetch Results Error:", err);
        verifikasiContent.innerHTML = `<p class="text-red-400 text-center py-20 font-bold uppercase tracking-widest">Error: ${err.message}</p>`;
    }
}
function renderWinners(results) {
    const verifikasiContent = document.getElementById('verifikasiContent');
    if (!results || results.length === 0) {
        verifikasiContent.innerHTML = '<p class="text-center opacity-40 py-20 italic">Belum ada bagan yang selesai diisi pemenangnya.</p>';
        return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
    results.forEach(res => {
        html += `
            <div class="neu-inset p-6 rounded-2xl border border-white/5">
                <h4 class="text-xs font-black uppercase text-blue-400 mb-4 tracking-widest border-b border-white/5 pb-2">${res.className}</h4>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center text-yellow-500 font-bold text-[10px]">I</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">EMAS</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.gold}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-400/10 flex items-center justify-center text-slate-400 font-bold text-[10px]">II</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">PERAK</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.silver || '-'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center text-orange-400 font-bold text-[10px]">III</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">PERUNGGU</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.bronze.join(' / ') || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    verifikasiContent.innerHTML = html;
    renderWinnersPrint(results);
}

function renderWinnersPrint(results) {
    const printContent = document.getElementById('printContent');
    let html = '';
    const LIMIT = 10; // 10 classes per page for winners

    const renderHeader = () => `
        <div class="print-header" style="text-align: center; margin-bottom: 20px;">
            <h2 style="font-family: 'Montserrat', sans-serif; font-size: 20pt; font-weight: 900; margin: 0; text-transform: uppercase;">DAFTAR JUARA PERTANDINGAN</h2>
            <p style="font-family: 'Montserrat', sans-serif; font-size: 10pt; font-weight: 800; margin: 5px 0; text-transform: uppercase;">${eventName}</p>
        </div>
    `;

    for (let i = 0; i < results.length; i += LIMIT) {
        const chunk = results.slice(i, i + LIMIT);
        html += `<div class="print-page">${renderHeader()}`;
        html += `<table style="width: 100%; border-collapse: collapse; font-family: 'Montserrat', sans-serif; font-size: 9pt;">
            <thead>
                <tr style="background: #eee;">
                    <th style="border: 1px solid #000; padding: 8px;">KELAS PERTANDINGAN</th>
                    <th style="border: 1px solid #000; padding: 8px; color: #b8860b;">JUARA I</th>
                    <th style="border: 1px solid #000; padding: 8px; color: #708090;">JUARA II</th>
                    <th style="border: 1px solid #000; padding: 8px; color: #cd7f32;">JUARA III</th>
                </tr>
            </thead>
            <tbody>`;

        chunk.forEach(res => {
            html += `<tr>
                <td style="border: 1px solid #000; padding: 8px; font-weight: 800;">${res.className}</td>
                <td style="border: 1px solid #000; padding: 8px; font-weight: bold;">${res.winners.gold}</td>
                <td style="border: 1px solid #000; padding: 8px;">${res.winners.silver || '-'}</td>
                <td style="border: 1px solid #000; padding: 8px;">${res.winners.bronze.join(' / ') || '-'}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
    }
    printContent.innerHTML = html;
}

function renderMedalTally(results) {
    const verifikasiContent = document.getElementById('verifikasiContent');
    if (!results || results.length === 0) {
        verifikasiContent.innerHTML = '<p class="text-center opacity-40 py-20 italic">Belum ada data medali.</p>';
        return;
    }

    const tally = {};
    results.forEach(res => {
        if (res.goldTeam) {
            if (!tally[res.goldTeam]) tally[res.goldTeam] = { gold: 0, silver: 0, bronze: 0 };
            tally[res.goldTeam].gold++;
        }
        if (res.silverTeam) {
            if (!tally[res.silverTeam]) tally[res.silverTeam] = { gold: 0, silver: 0, bronze: 0 };
            tally[res.silverTeam].silver++;
        }
        if (res.bronzeTeams) {
            res.bronzeTeams.forEach(bt => {
                if (!tally[bt]) tally[bt] = { gold: 0, silver: 0, bronze: 0 };
                tally[bt].bronze++;
            });
        }
    });

    const sortedTally = Object.entries(tally).sort((a, b) => {
        if (b[1].gold !== a[1].gold) return b[1].gold - a[1].gold;
        if (b[1].silver !== a[1].silver) return b[1].silver - a[1].silver;
        return b[1].bronze - a[1].bronze;
    });

    let html = `
        <div class="neu-inset rounded-[2rem] overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-slate-900/50 text-[9px] font-black opacity-50 uppercase tracking-widest">
                    <tr>
                        <th class="p-6 text-center w-16">Rank</th>
                        <th class="p-6">Kontingen / Tim</th>
                        <th class="p-6 text-center text-yellow-500">Emas</th>
                        <th class="p-6 text-center text-slate-400">Perak</th>
                        <th class="p-6 text-center text-orange-400">Perunggu</th>
                        <th class="p-6 text-center font-bold">Total</th>
                    </tr>
                </thead>
                <tbody class="uppercase font-bold text-[10px]">
    `;

    sortedTally.forEach(([team, medals], idx) => {
        const total = medals.gold + medals.silver + medals.bronze;
        html += `
            <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-6 text-center font-black ${idx < 3 ? 'text-blue-500' : ''}">${idx + 1}</td>
                <td class="p-6 italic">${team}</td>
                <td class="p-6 text-center text-yellow-500 text-sm font-black">${medals.gold}</td>
                <td class="p-6 text-center text-slate-400 text-sm font-black">${medals.silver}</td>
                <td class="p-6 text-center text-orange-400 text-sm font-black">${medals.bronze}</td>
                <td class="p-6 text-center font-black text-sm">${total}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    verifikasiContent.innerHTML = html;
    renderMedalPrint(sortedTally);
}

function renderMedalPrint(sortedTally) {
    const printContent = document.getElementById('printContent');
    let html = `<div class="print-page">
        <div class="print-header" style="text-align: center; margin-bottom: 30px;">
            <h2 style="font-family: 'Montserrat', sans-serif; font-size: 22pt; font-weight: 900; margin: 0; text-transform: uppercase;">KLASEMEN PEROLEHAN MEDALI</h2>
            <p style="font-family: 'Montserrat', sans-serif; font-size: 11pt; font-weight: 800; margin: 5px 0; text-transform: uppercase;">${eventName}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-family: 'Montserrat', sans-serif; font-size: 10pt; text-align: center;">
            <thead>
                <tr style="background: #000; color: #fff;">
                    <th style="border: 1px solid #000; padding: 10px; width: 50px;">RANK</th>
                    <th style="border: 1px solid #000; padding: 10px; text-align: left;">KONTINGEN</th>
                    <th style="border: 1px solid #000; padding: 10px; width: 80px; background: #ffd700; color: #000;">EMAS</th>
                    <th style="border: 1px solid #000; padding: 10px; width: 80px; background: #c0c0c0; color: #000;">PERAK</th>
                    <th style="border: 1px solid #000; padding: 10px; width: 80px; background: #cd7f32; color: #000;">PRG</th>
                    <th style="border: 1px solid #000; padding: 10px; width: 80px; font-weight: 900;">TOTAL</th>
                </tr>
            </thead>
            <tbody>`;

    sortedTally.forEach(([team, medals], idx) => {
        const total = medals.gold + medals.silver + medals.bronze;
        html += `<tr>
            <td style="border: 1px solid #000; padding: 10px; font-weight: 900;">${idx + 1}</td>
            <td style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold;">${team}</td>
            <td style="border: 1px solid #000; padding: 10px; font-weight: 900; font-size: 12pt;">${medals.gold}</td>
            <td style="border: 1px solid #000; padding: 10px;">${medals.silver}</td>
            <td style="border: 1px solid #000; padding: 10px;">${medals.bronze}</td>
            <td style="border: 1px solid #000; padding: 10px; font-weight: 900; font-size: 12pt;">${total}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    printContent.innerHTML = html;
}

function renderSchedule(classes, athletes) {
    const verifikasiContent = document.getElementById('verifikasiContent');

    // Calculate statistics
    const classesWithAthletes = classes.filter(cls =>
        athletes.some(a => a.className === cls.name)
    );
    const classesWithoutAthletes = classes.filter(cls =>
        !athletes.some(a => a.className === cls.name)
    );

    const settingsComplete = eventLocation && numDays > 0 && totalTatami > 0;

    let html = `
        <!-- Configuration Panel -->
        <div class="neu-card p-8 mb-6 rounded-3xl border border-white/5">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-black uppercase tracking-widest">Pengaturan Jadwal Pertandingan</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div>
                    <label class="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">📍 Lokasi Kejuaraan</label>
                    <input 
                        id="inputEventLocation" 
                        type="text" 
                        value="${eventLocation || ''}"
                        placeholder="Contoh: GOR Bung Karno"
                        onchange="updateScheduleSettings('eventLocation', this.value)"
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none transition-all"
                    />
                </div>
                
                <div>
                    <label class="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">📅 Jumlah Hari</label>
                    <input 
                        id="inputNumDays" 
                        type="number" 
                        min="1" 
                        value="${numDays || 1}"
                        onchange="updateScheduleSettings('numDays', parseInt(this.value))"
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none transition-all"
                    />
                </div>
                
                <div>
                    <label class="block text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">🥋 Jumlah Tatami</label>
                    <input 
                        id="inputTotalTatami" 
                        type="number" 
                        min="1" 
                        value="${totalTatami || 1}"
                        onchange="updateScheduleSettings('totalTatami', parseInt(this.value))"
                        class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 focus:outline-none transition-all"
                    />
                </div>
            </div>
        </div>

        <!-- Summary Statistics -->
        <div class="neu-card p-8 mb-6 rounded-3xl border border-white/5">
            <div class="flex items-center gap-3 mb-6">
                <div class="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                </div>
                <h3 class="text-lg font-black uppercase tracking-widest">Ringkasan Data</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl">✅</span>
                        <span class="text-[10px] font-black uppercase tracking-widest opacity-50">Siap Bertanding</span>
                    </div>
                    <p class="text-3xl font-black italic text-green-400">${classesWithAthletes.length}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wider opacity-40 mt-1">Kelas memiliki peserta</p>
                </div>
                
                <div class="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl">⚠️</span>
                        <span class="text-[10px] font-black uppercase tracking-widest opacity-50">Belum Siap</span>
                    </div>
                    <p class="text-3xl font-black italic text-orange-400">${classesWithoutAthletes.length}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wider opacity-40 mt-1">Kelas belum ada peserta</p>
                </div>
                
                <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl">📋</span>
                        <span class="text-[10px] font-black uppercase tracking-widest opacity-50">Total Kelas</span>
                    </div>
                    <p class="text-3xl font-black italic text-blue-400">${classes.length}</p>
                    <p class="text-[9px] font-bold uppercase tracking-wider opacity-40 mt-1">Kelas terdaftar</p>
                </div>
            </div>
        </div>

        <!-- Generate Schedule Button -->
        <div class="mb-8 text-center flex gap-4 justify-center items-center">
            <button 
                onclick="generateSchedule()"
                ${!settingsComplete ? 'disabled' : ''}
                class="neu-button px-12 py-6 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 ${settingsComplete ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/50' : ''}"
            >
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <span>🎯 Buat Jadwal Pertandingan</span>
                </div>
            </button>
            
            <button 
                onclick="printSchedulePDF()"
                class="neu-button px-10 py-6 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-105 bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/50"
            >
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                    </svg>
                    <span>📄 Print PDF</span>
                </div>
            </button>
            
            ${!settingsComplete ? '<p class="text-[10px] text-orange-400 mt-3 font-bold uppercase tracking-wider w-full">⚠️ Lengkapi pengaturan terlebih dahulu</p>' : ''}
        </div>

        <!-- Tatami Grid Display -->
        <div id="tatamiGrid"></div>
    `;

    verifikasiContent.innerHTML = html;

    // Render schedule if exists
    renderTatamiGrid(classes, athletes);
}

window.updateScheduleSettings = async (field, value) => {
    const docRef = doc(db, 'events', eventId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        const settings = snapshot.data().settings || {};
        settings[field] = value;

        await updateDoc(docRef, { settings: settings });

        // Update local variables
        if (field === 'eventLocation') eventLocation = value;
        if (field === 'numDays') numDays = value;
        if (field === 'totalTatami') totalTatami = value;

        console.log(`[SETTINGS] Updated ${field} = ${value}`);
        renderSchedule(latestClasses, allAthletes);
    }
};

window.generateSchedule = async () => {
    try {
        console.log('[SCHEDULE] Generating schedule...');

        // Get classes with athletes
        const classesWithAthletes = latestClasses.filter(cls =>
            allAthletes.some(a => a.className === cls.name)
        );

        if (classesWithAthletes.length === 0) {
            alert('Tidak ada kelas dengan peserta untuk dijadwalkan!');
            return;
        }

        const getPriority = (cls) => {
            const code = (cls.code || '').toUpperCase();
            const name = cls.name.toUpperCase();

            const isFestival = code.startsWith('F');
            const isKata = name.includes("KATA");

            if (!isFestival && isKata) return 1;   // OPEN KATA
            if (!isFestival && !isKata) return 2;  // OPEN KUMITE
            if (isFestival && isKata) return 3;    // FESTIVAL KATA
            if (isFestival && !isKata) return 4;   // FESTIVAL KUMITE

            return 5;
        };

        const classesWithLoads = classesWithAthletes.map(cls => {
            const isBeregu = cls.type === 'BEREGU' || cls.name.toUpperCase().includes('BEREGU');
            const load = isBeregu ?
                new Set(allAthletes.filter(a => a.className === cls.name).map(a => a.team)).size :
                allAthletes.filter(a => a.className === cls.name).length;
            return { ...cls, priority: getPriority(cls), load };
        });

        classesWithLoads.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.load - a.load;
        });

        const distribution = {};
        const tatamiLoads = {};

        for (let t = 1; t <= totalTatami; t++) {
            distribution[t] = [];
            tatamiLoads[t] = 0;
        }

        classesWithLoads.forEach(cls => {
            let minT = 1;
            for (let t = 2; t <= totalTatami; t++) {
                if (tatamiLoads[t] < tatamiLoads[minT]) minT = t;
            }
            distribution[minT].push(cls);
            tatamiLoads[minT] += cls.load;
        });

        const batch = writeBatch(db);
        for (let t = 1; t <= totalTatami; t++) {
            distribution[t].forEach((cls, idx) => {
                const docRef = doc(db, `events/${eventId}/classes`, cls.id);
                batch.update(docRef, {
                    scheduledDay: "1",
                    scheduledTatami: t.toString(),
                    orderIndex: idx + 1
                });
            });
        }
        await batch.commit();

        console.log('[SCHEDULE] Schedule generated successfully!');
        alert('✅ Jadwal pertandingan berhasil dibuat!');
    } catch (error) {
        console.error('[SCHEDULE] Error generating schedule:', error);
        alert('❌ Gagal membuat jadwal: ' + error.message);
    }
};

function renderTatamiGrid(classes, athletes) {
    const tatamiGridEl = document.getElementById('tatamiGrid');
    if (!tatamiGridEl) return;

    const scheduledClasses = classes.filter(cls => cls.scheduledTatami);

    if (scheduledClasses.length === 0) {
        tatamiGridEl.innerHTML = '<p class="text-center opacity-30 py-16 text-sm font-black uppercase tracking-widest">Belum ada jadwal. Klik tombol "Buat Jadwal" untuk generate.</p>';
        return;
    }

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';

    for (let t = 1; t <= totalTatami; t++) {
        const tatamiClasses = scheduledClasses
            .filter(cls => cls.scheduledTatami === t.toString())
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        if (tatamiClasses.length === 0) continue;

        html += `
            <div class="neu-card rounded-3xl overflow-hidden border border-white/5">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                    <h4 class="text-2xl font-black italic text-white mb-1">TATAMI ${t}</h4>
                    <p class="text-[10px] uppercase tracking-widest opacity-80">${tatamiClasses.length} Kelas</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-900/50 text-[9px] font-black opacity-50 uppercase tracking-widest">
                            <tr>
                                <th class="p-4 text-center w-16">No</th>
                                <th class="p-4">Nama Kelas</th>
                                <th class="p-4 text-center w-20">Peserta</th>
                            </tr>
                        </thead>
                        <tbody class="text-[11px] font-bold">
        `;

        tatamiClasses.forEach((cls, idx) => {
            const athleteCount = athletes.filter(a => a.className === cls.name).length;
            html += `
                <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="p-4 text-center">
                        <div class="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] border border-white/5 text-blue-400 mx-auto font-black">
                            ${cls.orderIndex || idx + 1}
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="font-black italic uppercase text-[10px]">${cls.name}</div>
                        ${cls.code ? `<div class="text-[8px] text-blue-500/50 font-black mt-1">${cls.code}</div>` : ''}
                    </td>
                    <td class="p-4 text-center">
                        <span class="text-sm font-black text-blue-400">${athleteCount}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += '</div>';
    tatamiGridEl.innerHTML = html;
}

window.printSchedulePDF = () => {
    const scheduledClasses = latestClasses.filter(cls => cls.scheduledTatami);
    if (scheduledClasses.length === 0) {
        alert('Belum ada jadwal yang dibuat untuk diprint.');
        return;
    }

    const printWindow = window.open('', '_blank');
    const logoHtml = currentEventLogoBase64 ?
        `<img src="${currentEventLogoBase64}" style="height: 80px; margin-bottom: 20px;">` : '';

    let tablesHtml = '';
    for (let t = 1; t <= totalTatami; t++) {
        const tatamiClasses = scheduledClasses
            .filter(cls => cls.scheduledTatami === t.toString())
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        if (tatamiClasses.length === 0) continue;

        tablesHtml += `
            <div class="tatami-section">
                <div class="tatami-header">TATAMI ${t}</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">NO</th>
                            <th>NAMA KELAS TANDING</th>
                            <th style="width: 100px; text-align: center;">PESERTA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tatamiClasses.map((cls, idx) => {
            const athleteCount = allAthletes.filter(a => a.className === cls.name).length;
            return `
                                <tr>
                                    <td style="text-align: center;">${cls.orderIndex || idx + 1}</td>
                                    <td>
                                        <div style="font-weight: 800; font-size: 11pt;">${cls.name}</div>
                                        <div style="font-size: 8pt; opacity: 0.6; margin-top: 2px;">KODE: ${cls.code || '-'}</div>
                                    </td>
                                    <td style="text-align: center; font-weight: 800;">${athleteCount} ATLET</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Jadwal Pertandingan - ${eventName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
                body { 
                    font-family: 'Inter', sans-serif; 
                    padding: 40px; 
                    color: #1a1a1a;
                    background: white;
                }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                .header p { margin: 5px 0 0; font-size: 11pt; font-weight: 700; opacity: 0.7; text-transform: uppercase; }
                
                .tatami-section { margin-bottom: 40px; break-inside: avoid; }
                .tatami-header { 
                    background: #1a1a1a; 
                    color: white; 
                    padding: 10px 20px; 
                    font-weight: 800; 
                    font-size: 14pt; 
                    font-style: italic;
                    margin-bottom: 0;
                    display: inline-block;
                }
                
                table { width: 100%; border-collapse: collapse; margin-top: 0; }
                th { 
                    background: #f1f5f9; 
                    border: 2px solid #1a1a1a; 
                    padding: 12px; 
                    font-size: 9pt; 
                    font-weight: 800; 
                    text-transform: uppercase;
                }
                td { 
                    border: 1px solid #e2e8f0; 
                    padding: 12px; 
                    font-size: 10pt;
                    vertical-align: middle;
                }
                tr:nth-child(even) { background: #fafafa; }
                
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    @page { margin: 1cm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoHtml}
                <h1>JADWAL PERTANDINGAN</h1>
                <p>${eventName}</p>
                <p>${eventLocation || 'LOKASI BELUM DITENTUKAN'}</p>
            </div>
            ${tablesHtml}
            <div style="margin-top: 40px; text-align: right; font-size: 8pt; opacity: 0.5;">
                Generated by Kensho Scoring System • ${new Date().toLocaleString('id-ID')}
            </div>
            <script>
                window.onload = () => { setTimeout(() => { window.print(); }, 500); };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

window.downloadClassTemplate = () => {
    const headers = [["KODE", "NAMA KELAS", "KATEGORI UMUR", "JENIS KELAMIN", "MIN USIA", "MAX USIA", "MIN BERAT", "MAX BERAT"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Kelas");

    ws['!cols'] = [
        { wch: 10 }, { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, "Template_Kelas_Kensho.xlsx");
};

window.deleteAllClasses = async () => {
    if (!confirm("⚠️ PERINGATAN: Anda akan menghapus SELURUH KELAS TANDING dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.\n\nLanjutkan?")) return;

    const password = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan total:");
    if (password !== 'HAPUS') {
        alert("Konfirmasi gagal. Penghapusan dibatalkan.");
        return;
    }

    showProgress('MEMBERSIHKAN DATA KELAS', 0);
    try {
        const classSnap = await getDocs(collection(db, `events/${eventId}/ classes`));
        if (!classSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < classSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                classSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/ classes`, docSnap.id));
                });
                await batch.commit();
            }
        }

        const bracketSnap = await getDocs(collection(db, `events/${eventId}/ brackets`));
        if (!bracketSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < bracketSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                bracketSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/ brackets`, docSnap.id));
                });
                await batch.commit();
            }
        }

        alert(`Berhasil membersihkan ${classSnap.size} kelas dan seluruh bagan!`);
    } catch (err) {
        console.error("Delete All Classes/Brackets Error:", err);
        alert("Gagal membersihkan database: " + err.message);
    } finally {
        hideProgress();
    }
};

window.deleteAllAthletes = async () => {
    if (!confirm("⚠️ PERINGATAN: Anda akan menghapus SELURUH DATA ATLET dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.\n\nLanjutkan?")) return;

    const password = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan total:");
    if (password !== 'HAPUS') {
        alert("Konfirmasi gagal. Penghapusan dibatalkan.");
        return;
    }

    showProgress('MEMBERSIHKAN DATA ATLET', 0);
    try {
        const athleteSnap = await getDocs(collection(db, `events/${eventId}/ athletes`));
        if (!athleteSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < athleteSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                athleteSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/ athletes`, docSnap.id));
                });
                await batch.commit();
            }
        }

        const bracketSnap = await getDocs(collection(db, `events/${eventId}/ brackets`));
        if (!bracketSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < bracketSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                bracketSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/ brackets`, docSnap.id));
                });
                await batch.commit();
            }
        }

        alert(`Berhasil membersihkan ${athleteSnap.size} data pendaftaran dan seluruh bagan!`);
    } catch (err) {
        console.error("Delete All Athletes/Brackets Error:", err);
        alert("Gagal membersihkan database: " + err.message);
    } finally {
        hideProgress();
    }
};
window.importClassesFromExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                alert("File Excel kosong atau tidak valid.");
                return;
            }

            if (confirm(`Impor ${jsonData.length} kelas dari Excel ? (Data lama dengan kode yang sama akan diperbarui)`)) {
                showProgress('IMPORT KELAS', jsonData.length);
                try {
                    let successCount = 0;
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        let type = "PERORANGAN";
                        let genderRaw = "PUTRA";

                        for (const key of Object.keys(row)) {
                            const upperKey = key.toUpperCase().trim();
                            const val = (row[key] || "").toString().toUpperCase().trim();

                            if (upperKey.includes("TIPE") || upperKey.includes("TYPE") || upperKey.includes("JENIS")) {
                                if (val.includes("BEREGU") || val.includes("TEAM") || val.includes("GROUP")) type = "BEREGU";
                                else if (val.includes("INDIVIDU") || val.includes("PERORANGAN") || val.includes("SINGLE")) type = "PERORANGAN";
                            }
                            if (upperKey.includes("KELAMIN") || upperKey.includes("GENDER") || upperKey.includes("SEX")) {
                                if (val.includes("PEREMPUAN") || val.includes("PUTRI") || val === "P" || val === "PI") genderRaw = "PUTRI";
                                else if (val.includes("LAKI") || val.includes("PUTRA") || val === "L" || val === "PA") genderRaw = "PUTRA";
                            }
                        }

                        const classData = {
                            code: (row["KODE"] || "").toString().toUpperCase().trim(),
                            name: (row["NAMA KELAS"] || "").toString().toUpperCase().trim(),
                            ageCategory: row["KATEGORI UMUR"] || "",
                            gender: genderRaw,
                            ageMin: row["MIN USIA"] || 0,
                            ageMax: row["MAX USIA"] || 99,
                            weightMin: row["MIN BERAT"] || 0,
                            weightMax: row["MAX BERAT"] || 999,
                            type: type
                        };

                        if (classData.code && classData.name) {
                            await setDoc(doc(db, `events/${eventId}/classes`, classData.code), classData);
                            successCount++;
                        }
                        updateProgress(i + 1, jsonData.length);
                    }
                    alert(`Berhasil mengimpor ${successCount} kelas!`);
                    event.target.value = "";
                } catch (err) {
                    console.error("Excel Import Error (Internal):", err);
                    alert("Terjadi kesalahan saat menyimpan data: " + err.message);
                } finally {
                    hideProgress();
                }
            }
        } catch (err) {
            console.error("Excel Import Error (External):", err);
            alert("Gagal membaca file Excel. Pastikan formatnya benar.");
        }
    };
    reader.readAsArrayBuffer(file);
};

// Helper: Find value by flexible header aliases
const findVal = (row, aliases) => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
        const found = keys.find(k => {
            const uk = k.toUpperCase().trim();
            const ua = alias.toUpperCase().trim();
            return uk === ua || uk.includes(ua);
        });
        if (found) return row[found];
    }
    return null;
};

// Helper: Parse Indonesian Date (03 Juli 2016)
function parseIndoDate(dateVal) {
    if (!dateVal) return "";
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];

    const dateStr = dateVal.toString().toUpperCase().trim();

    if (/^\\d{4}-\\d{2}-\\d{2}\$/.test(dateStr)) return dateStr;

    const months = {
        'JANUARI': '01', 'FEBRUARI': '02', 'MARET': '03', 'APRIL': '04', 'MEI': '05', 'JUNI': '06',
        'JULI': '07', 'AGUSTUS': '08', 'SEPTEMBER': '09', 'OKTOBER': '10', 'NOVEMBER': '11', 'DESEMBER': '12',
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MEI': '05', 'JUN': '06',
        'JUL': '07', 'AGU': '08', 'SEP': '09', 'OKT': '10', 'NOV': '11', 'DES': '12'
    };

    const parts = dateStr.split(/[\\s/-]+/);
    if (parts.length === 3) {
        if (parts[0].length === 4 && parts[2].length === 4) {
            const yearCandidate = parseInt(parts[2]);
            if (yearCandidate > 2000) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].slice(-2)}`;
            }
        }

        let day = parts[0].padStart(2, '0');
        if (day.length > 2) day = day.slice(-2);

        let month = months[parts[1]] || parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = "20" + year;
        if (year.length === 4) return `${year}-${month}-${day}`;

        if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    return dateStr;
}

window.importAthletesFromExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    showProgress('MEMBACA FILE', 1);
    document.getElementById('loader-status').innerText = 'DIPROSES... MOHON TUNGGU SEBENTAR';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            await sleep(100);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            let targetSheet = null;
            let jsonData = [];

            document.getElementById('loader-title').innerText = 'MENCARI DATA';

            for (let i = 0; i < workbook.SheetNames.length; i++) {
                const sheetName = workbook.SheetNames[i];
                updateProgress(i + 1, workbook.SheetNames.length);
                document.getElementById('loader-status').innerText = `MEMERIKSA SHEET: ${sheetName}`;
                await sleep(10);
                const isHidden = workbook.Workbook && workbook.Workbook.Sheets && workbook.Workbook.Sheets[i] && workbook.Workbook.Sheets[i].Hidden !== 0;
                if (isHidden) continue;

                const sheet = workbook.Sheets[sheetName];
                const tempJson = XLSX.utils.sheet_to_json(sheet);
                if (tempJson.length > 0) {
                    const firstRow = tempJson[0];
                    const hasName = findVal(firstRow, ["NAMA ATLET", "NAME"]);
                    const hasCode = findVal(firstRow, ["KODE", "CODE"]);
                    if (hasName || hasCode) {
                        targetSheet = sheet;
                        jsonData = tempJson;
                        break;
                    }
                }
            }

            if (!targetSheet) {
                targetSheet = workbook.Sheets[workbook.SheetNames[0]];
                jsonData = XLSX.utils.sheet_to_json(targetSheet);
            }

            const validData = jsonData.filter(row => {
                const name = (findVal(row, ["NAMA ATLET", "NAME"]) || "").toString().trim();
                const code = (findVal(row, ["KODE", "CODE", "ID"]) || "").toString().trim();
                return name.length > 0 && code.length > 0;
            });

            if (validData.length === 0) {
                alert("Tidak ditemukan data atlet valid di file Excel ini.\\nPastikan kolom 'NAMA ATLET' dan 'KODE' sudah terisi.");
                hideProgress();
                return;
            }

            const classSnap = await getDocs(collection(db, `events/${eventId}/classes`));
            const classMap = {};
            classSnap.forEach(doc => {
                const d = doc.data();
                if (d.code) classMap[d.code.toString().toUpperCase().trim()] = {
                    name: d.name, type: d.type || 'PERORANGAN'
                };
            });

            pendingImportData = [];
            let readyCount = 0;
            let errorCount = 0;
            const previewBody = document.getElementById('import-preview-body');
            previewBody.innerHTML = '';

            validData.forEach(row => {
                const name = (findVal(row, ["NAMA ATLET", "NAME"]) || "").toString().toUpperCase().trim();
                const code = (findVal(row, ["KODE", "CODE", "ID"]) || "").toString().toUpperCase().trim();
                const team = (findVal(row, ["KONTINGEN", "TEAM", "REGU"]) || "INDEPENDEN").toString().toUpperCase().trim();
                const genderRaw = (findVal(row, ["JENIS", "SEX", "KELAMIN", "GENDER"]) || "L").toString().toUpperCase().trim();
                const weight = findVal(row, ["BERAT", "WEIGHT"]) || 0;
                const birthRaw = findVal(row, ["LAHIR", "BIRTH", "DATE"]);

                const classConfig = classMap[code];
                const isOk = !!classConfig;
                if (isOk) readyCount++; else errorCount++;

                const gender = (genderRaw.includes("P") || genderRaw.includes("PI")) ? "PUTRI" : "PUTRA";
                const birth = parseIndoDate(birthRaw);

                const members = [];
                if (classConfig && classConfig.type === 'BEREGU') {
                    const m2 = findVal(row, ["ANGGOTA 2", "MEMBER 2"]);
                    const m3 = findVal(row, ["ANGGOTA 3", "MEMBER 3"]);
                    if (m2) members.push(m2);
                    if (m3) members.push(m3);
                }

                const athlete = {
                    name: name,
                    team: team,
                    code: code,
                    className: classConfig ? classConfig.name : `KELAS TIDAK DITEMUKAN (${code})`,
                    isOk: isOk,
                    gender: gender,
                    birthDate: birth,
                    weight: weight,
                    members: members
                };

                pendingImportData.push(athlete);

                previewBody.innerHTML += `
                    <tr class="border-b border-white/5 ${!isOk ? 'bg-red-500/5' : ''}">
                        <td class="p-4 text-white">${athlete.name}</td>
                        <td class="p-4 opacity-60">${athlete.team}</td>
                        <td class="p-4 ${!isOk ? 'text-red-500' : 'text-blue-400'} font-black italic">
                            ${athlete.code}</td>
                        <td class="p-4">
                            <span class="${isOk ? 'text-green-400' : 'text-red-500'}">
                                ${isOk ? '✅ ' + athlete.className : '❌ ' + athlete.className}
                            </span>
                        </td>
                    </tr>
                `;
            });

            document.getElementById('preview-total-count').innerText = validData.length;
            document.getElementById('preview-ready-count').innerText = readyCount;
            document.getElementById('preview-error-count').innerText = errorCount;

            hideProgress();
            toggleModal('modal-import-athlete-preview', true);
            event.target.value = "";
        } catch (err) {
            console.error(err);
            alert("Error reading Excel: " + err.message);
            hideProgress();
        }
    };
    reader.readAsArrayBuffer(file);
};

window.proceedWithConfirmedImport = async () => {
    if (pendingImportData.length === 0) return;

    const errors = pendingImportData.filter(a => !a.isOk).length;
    if (errors > 0) {
        if (!confirm(`Ada ${errors} data dengan kode kelas yang TIDAK DITEMUKAN. Atlet tersebut akan tetap diimpor tapi kemungkinan tidak masuk ke daftar bagan.\\n\\nLanjutkan?`)) return;
    }

    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true;
    btn.innerText = "MENYIMPAN KE CLOUD...";

    showProgress('IMPORT DATABASE', pendingImportData.length);
    try {
        for (let i = 0; i < pendingImportData.length; i++) {
            const a = pendingImportData[i];
            const data = {
                name: a.name,
                team: a.team,
                gender: a.gender,
                birthDate: a.birthDate,
                weight: a.weight,
                className: a.className,
                members: a.members,
                createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, `events/${eventId}/athletes`), data);
            updateProgress(i + 1, pendingImportData.length);
            if (i % 10 === 0) await sleep(5);
        }
        alert(`Berhasil mengimpor ${pendingImportData.length} pendaftaran!`);
        toggleModal('modal-import-athlete-preview', false);
    } catch (err) {
        alert("Gagal impor: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Impor Sekarang";
        hideProgress();
    }
};

window.allAthletes = [];
const qAthletes = query(collection(db, `events/${eventId}/athletes`), orderBy("createdAt", "desc"));
onSnapshot(qAthletes, (snapshot) => {
    window.allAthletes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[DATA SYNC] Athletes loaded: ${window.allAthletes.length} atlet`);
    renderAthleteData(window.allAthletes);
    renderVerificationData(window.allAthletes);
    if (currentVerifikasiSubTab === 'JADWAL' && latestClasses.length > 0) {
        renderSchedule(latestClasses, window.allAthletes);
    }
});

window.allBrackets = [];
onSnapshot(collection(db, `events/${eventId}/brackets`), (snapshot) => {
    window.allBrackets = snapshot.docs.map(doc => ({ className: doc.id, ...doc.data() }));
    allEventResults = window.allBrackets.filter(b => b.status === 'complete');
    if (currentVerifikasiSubTab === 'JADWAL') renderSchedule(latestClasses, window.allAthletes);
});

function renderAthleteData(athletes) {
    const count = athletes.length;
    countAtletLabel.innerText = `${count} Atlet`;
    const summaryAtletCount = document.querySelector('div[onclick*="tab-atlet"] span');
    if (summaryAtletCount) summaryAtletCount.innerText = `${count} Atlet`;

    const filtered = athletes.filter(a => {
        const classInfo = latestClasses.find(c => c.name === a.className);
        if (!classInfo) return currentAthleteSubTab === 'OPEN';

        if (currentAthleteSubTab === 'BEREGU') {
            return classInfo.type === 'BEREGU';
        }

        const isFestival = (classInfo.code || "").toString().toUpperCase().startsWith('F');
        const isPerorangan = classInfo.type === 'PERORANGAN' || !classInfo.type;

        if (currentAthleteSubTab === 'FESTIVAL') return isFestival && isPerorangan;
        if (currentAthleteSubTab === 'OPEN') return !isFestival && isPerorangan;
        return false;
    });

    renderContingentTracking(athletes);

    if (filtered.length === 0) {
        athleteTableBody.innerHTML = `<tr>
            <td colspan="4" class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">
                Belum ada data atlet (${currentAthleteSubTab}).</td>
        </tr>`;
        return;
    }

    filtered.sort((a, b) => {
        const classA = latestClasses.find(c => c.name === a.className);
        const classB = latestClasses.find(c => c.name === b.className);
        const codeA = (classA?.code || "").toString();
        const codeB = (classB?.code || "").toString();

        const codeCmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        if (codeCmp !== 0) return codeCmp;
        return (a.name || "").localeCompare(b.name || "");
    });

    athleteTableBody.innerHTML = '';
    filtered.forEach(data => {
        let memberInfo = "";
        if (data.members && data.members.length > 0) {
            memberInfo = `<div class="text-[8px] opacity-40 font-bold mt-1 uppercase">TIM: ${data.members.join(' & ')}</div>`;
        }

        athleteTableBody.innerHTML += `
            <tr class="row-hover group transition-all duration-300">
                <td class="py-6 pl-6">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500/30">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <div class="text-xl font-black italic shimmer-text">${data.name}</div>
                            ${memberInfo}
                        </div>
                    </div>
                </td>
                <td class="py-6">
                    <div class="text-sm font-bold text-slate-300">${data.team}</div>
                </td>
                <td class="py-6">
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-blue-500 mb-1 tracking-widest leading-none">${latestClasses.find(c => c.name === data.className)?.code || 'ERR'}</span>
                        <span class="text-xs font-bold text-slate-200">${data.className || '-'}</span>
                    </div>
                </td>
                <td class="py-6 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="editAthlete('${data.id}')" class="w-8 h-8 rounded-lg neu-button text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="deleteData('athlete', '${data.id}')" class="w-8 h-8 rounded-lg neu-button text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function renderContingentTracking(athletes) {
    const tbody = document.getElementById('contingentTableBody');
    const summaryArea = document.getElementById('contingentSummary');
    if (!tbody) return;

    const actualTeams = [...new Set(athletes.map(a => (a.team || "").trim().toUpperCase()))].filter(t => t !== "");

    const discoveredTeams = actualTeams.filter(teamName => {
        return !EXPECTED_CONTINGENTS.some(expected =>
            teamName.includes(expected.toUpperCase()) || expected.toUpperCase().includes(teamName)
        );
    });

    const fullTargetList = [
        ...EXPECTED_CONTINGENTS.map(name => ({ name, type: 'EXPECTED' })),
        ...discoveredTeams.map(name => ({ name, type: 'DISCOVERED' }))
    ];

    let submittedCount = 0;
    let totalAthletesFound = 0;
    let html = '';

    fullTargetList.forEach((item, idx) => {
        const name = item.name;
        const isDiscovered = item.type === 'DISCOVERED';

        const matchedAthletes = athletes.filter(a =>
            a.team && (
                a.team.toUpperCase().includes(name.toUpperCase()) ||
                name.toUpperCase().includes(a.team.toUpperCase())
            )
        );

        const isSubmitted = matchedAthletes.length > 0;
        if (isSubmitted) {
            submittedCount++;
            totalAthletesFound += matchedAthletes.length;
        }

        html += `
            <tr class="row-hover group transition-all duration-300 border-b border-white/5 ${isDiscovered ? 'bg-indigo-500/5' : ''}">
                <td class="py-6 pl-6">
                    <div class="flex flex-col">
                        <span class="text-[8px] opacity-20 font-black">#${(idx + 1).toString().padStart(2, '0')}</span>
                        ${isDiscovered ? '<span class="text-[7px] text-indigo-400 font-black tracking-tighter uppercase leading-none mt-1">NEW DISCOVERY</span>' : ''}
                    </div>
                </td>
                <td class="py-6">
                    <div class="text-sm font-black italic text-slate-200">${name}</div>
                </td>
                <td class="py-6 text-center">
                    ${isSubmitted ?
                `<span class="px-3 py-1 rounded-full text-[8px] font-black bg-green-500/20 text-green-400 border border-green-500/30">SUDAH MASUK ✅</span>` :
                `<span class="px-3 py-1 rounded-full text-[8px] font-black bg-slate-800 text-slate-500 border border-white/5 opacity-40">BELUM ADA DATA ⏳</span>`
            }
                </td>
                <td class="py-6 text-center">
                    <span class="${isSubmitted ? 'text-blue-400 font-black' : 'opacity-20'} text-lg italic">
                        ${matchedAthletes.length} <span class="text-[8px] uppercase not-italic">Atlet</span>
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    if (summaryArea) {
        summaryArea.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="neu-inset p-6 rounded-2xl border border-white/5">
                    <p class="text-[8px] font-black opacity-30 uppercase tracking-[.2em] mb-1">Total Target</p>
                    <p class="text-2xl font-black italic text-slate-200">${fullTargetList.length} <span class="text-[10px] uppercase not-italic opacity-40">Kontingen</span></p>
                </div>
                <div class="neu-inset p-6 rounded-2xl border border-white/5">
                    <p class="text-[8px] font-black opacity-30 uppercase tracking-[.2em] mb-1">Sudah Setor</p>
                    <p class="text-2xl font-black italic text-green-400">${submittedCount} <span class="text-[10px] uppercase not-italic opacity-40">Kontingen</span></p>
                </div>
                <div class="neu-inset p-6 rounded-2xl border border-white/5">
                    <p class="text-[8px] font-black opacity-30 uppercase tracking-[.2em] mb-1">Total Pendaftar</p>
                    <p class="text-2xl font-black italic text-blue-400">${totalAthletesFound} <span class="text-[10px] uppercase not-italic opacity-40">Atlet Unik</span></p>
                </div>
            </div>
        `;
    }
}
const qClasses = query(collection(db, `events/${eventId}/classes`), orderBy("name", "asc"));

onSnapshot(qClasses, async (snapshot) => {
    latestClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[DATA SYNC] Classes loaded: ${latestClasses.length} kelas`);
    countKelasLabel.innerText = `${latestClasses.length} Kelas`;

    renderClassesData(latestClasses);
    if (window.allAthletes && window.allAthletes.length > 0) renderAthleteData(window.allAthletes);

    if (currentVerifikasiSubTab === 'JADWAL') {
        renderSchedule(latestClasses, window.allAthletes);
    }
});

async function renderClassesData(classes) {
    if (!athleteClassSelect) return;
    athleteClassSelect.innerHTML = '<option value="">Pilih Kelas...</option>';

    classes.forEach(c => {
        athleteClassSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });

    let filteredClasses = classes.filter(cls => {
        if (currentSubTab === 'BEREGU') {
            return cls.type === 'BEREGU';
        }
        const isFestival = (cls.code || "").toString().toUpperCase().startsWith('F');
        const isPerorangan = cls.type === 'PERORANGAN' || !cls.type;

        if (currentSubTab === 'FESTIVAL') return isFestival && isPerorangan;
        if (currentSubTab === 'OPEN') return !isFestival && isPerorangan;
        return false;
    });

    filteredClasses.sort((a, b) => {
        const codeA = (a.code || "").toString().toUpperCase();
        const codeB = (b.code || "").toString().toUpperCase();

        if (codeA.startsWith('F') && codeB.startsWith('F')) {
            const numA = parseInt(codeA.substring(1)) || 0;
            const numB = parseInt(codeB.substring(1)) || 0;
            return numA - numB;
        }

        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    countKelasLabel.innerText = `${filteredClasses.length} KELAS (${currentSubTab})`;

    if (filteredClasses.length === 0) {
        classTableBody.innerHTML = `<tr>
                    <td colspan="5"
                        class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">
                        Belum ada data (${currentSubTab}).</td>
                </tr>`;
        bracketListArea.innerHTML = `
                <div
                    class="col-span-2 neu-inset p-8 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p class="text-xs font-black uppercase tracking-widest">Belum ada bagan ${currentSubTab}
                    </p>
                </div>`;
        return;
    }

    classTableBody.innerHTML = '';
    bracketListArea.innerHTML = '';

    const renderPromises = filteredClasses.map(async (data) => {
        const athleteCount = window.allAthletes.filter(a => a.className === data.name).length;

        classTableBody.innerHTML += `
                <tr class="row-hover group transition-all duration-300">
                    <td class="py-6 pl-6">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-blue-500 mb-1 tracking-widest">${data.code || 'NO-CODE'}</span>
                            <div class="text-xl font-black italic text-slate-200">${data.name}</div>
                        </div>
                    </td>
                    <td class="py-6 opacity-60">${data.ageCategory}</td>
                    <td class="py-6"><span class="text-blue-500 font-bold">${data.gender}</span></td>
                    <td class="py-6"><span
                            class="px-3 py-1 rounded-full text-[8px] font-black ${data.type === 'BEREGU' ? 'bg-orange-500/20 text-orange-500' : 'bg-blue-500/20 text-blue-500'} border border-current">${data.type || 'PERORANGAN'}</span></td>
                    <td class="py-6 text-center">
                        <button onclick="deleteData('class', '${data.id}')"
                            class="w-8 h-8 rounded-lg neu-button text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
                            <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                </tr>
                `;

        if (athleteCount > 0) {
            let statusBadge = '';
            let statusReason = '';
            try {
                const bracketDoc = await getDoc(doc(db, `events/${eventId}/brackets`, data.name));
                if (bracketDoc.exists() && bracketDoc.data().status === 'complete') {
                    const lastModified = bracketDoc.data().lastModified;
                    const dateStr = lastModified ? new Date(lastModified).toLocaleString('id-ID', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) + ' WIB' : 'N/A';
                    statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30">✅ OK</span>`;
                    statusReason = `<p class="text-[8px] text-green-400/60 mt-1">Tersimpan: ${dateStr}</p>`;
                } else {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ PENDING</span>`;
                    statusReason = `<p class="text-[8px] text-orange-400/60 mt-1 italic">Bagan belum dibuat</p>`;
                }
            } catch (err) {
                statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ PENDING</span>`;
                statusReason = `<p class="text-[8px] text-orange-400/60 mt-1 italic">Error status</p>`;
            }

            bracketListArea.innerHTML += `
                <div class="neu-inset p-8 rounded-[2rem] border border-white/5 group hover:border-blue-500/30 transition-all relative overflow-hidden">
                    <div class="absolute -right-4 -top-4 text-[120px] font-black italic opacity-[0.03] pointer-events-none select-none">${(athleteCount).toString().padStart(2, '0')}</div>
                    <div class="flex justify-between items-start mb-6">
                        <div class="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-blue-500">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span class="text-[10px] font-black">${athleteCount} ATLET</span>
                        </div>
                        <span class="text-[9px] font-black uppercase text-blue-500/40 tracking-[0.2em]">${data.gender}</span>
                    </div>
                    <div class="flex items-start justify-between mb-2">
                        <h4 class="text-lg font-black italic uppercase text-slate-100 leading-tight flex-1">
                            <span class="block text-[10px] text-blue-400 not-italic tracking-[0.2em] mb-1">${data.code || 'CODE-PENDING'}</span>
                            ${data.name}
                        </h4>
                        <div class="text-right">${statusBadge}${statusReason}</div>
                    </div>
                    <p class="text-[9px] font-bold opacity-30 uppercase tracking-widest mb-6">${data.ageCategory}</p>
                    <div class="flex gap-2">
                        <a href="event-bracket.html?id=${eventId}&classId=${data.id}&class=${encodeURIComponent(data.name)}" class="flex-1 py-4 rounded-xl bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                            BUAT / BUKA BAGAN
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>
            `;
        }
    });

    await Promise.all(renderPromises);
}

document.getElementById('formAthlete').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('athleteId').value;
    const name2 = document.getElementById('athleteName2').value.toUpperCase().trim();
    const name3 = document.getElementById('athleteName3').value.toUpperCase().trim();

    const members = [];
    if (name2) members.push(name2);
    if (name3) members.push(name3);

    const data = {
        name: document.getElementById('athleteName').value.toUpperCase(),
        team: document.getElementById('athleteTeam').value.toUpperCase(),
        gender: document.getElementById('athleteGender').value,
        birthDate: document.getElementById('athleteBirth').value,
        weight: document.getElementById('athleteWeight').value,
        className: document.getElementById('athleteClass').value,
        members: members,
        updatedAt: new Date().toISOString()
    };

    if (!id) data.createdAt = new Date().toISOString();

    try {
        if (id) {
            await updateDoc(doc(db, `events/${eventId}/athletes`, id), data);
        } else {
            await addDoc(collection(db, `events/${eventId}/athletes`), data);
        }
        toggleModal('modal-atlet', false);
        e.target.reset();
        document.getElementById('athleteId').value = '';
    } catch (err) { alert(err.message); }
};

window.editAthlete = (id) => {
    const athlete = window.allAthletes.find(a => a.id === id);
    if (!athlete) return;

    document.getElementById('athleteId').value = athlete.id;
    document.getElementById('athleteName').value = athlete.name;
    document.getElementById('athleteTeam').value = athlete.team;
    document.getElementById('athleteGender').value = athlete.gender || 'PUTRA';
    document.getElementById('athleteBirth').value = athlete.birthDate || '';
    document.getElementById('athleteWeight').value = athlete.weight || 0;
    document.getElementById('athleteClass').value = athlete.className || '';

    window.checkClassType(athlete.className || '');

    document.getElementById('athleteName2').value = (athlete.members && athlete.members[0]) ? athlete.members[0] : '';
    document.getElementById('athleteName3').value = (athlete.members && athlete.members[1]) ? athlete.members[1] : '';

    toggleModal('modal-atlet', true);
};

document.getElementById('formClass').onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        code: document.getElementById('classCode').value.toUpperCase(),
        name: document.getElementById('className').value.toUpperCase(),
        ageCategory: document.getElementById('classAgeCategory').value,
        gender: document.getElementById('classGender').value,
        ageMin: document.getElementById('classAgeMin').value,
        ageMax: document.getElementById('classAgeMax').value,
        weightMin: document.getElementById('classWeightMin').value,
        weightMax: document.getElementById('classWeightMax').value,
        type: document.getElementById('classType').value
    };
    try {
        await addDoc(collection(db, `events/${eventId}/classes`), data);
        toggleModal('modal-kelas', false);
        e.target.reset();
    } catch (err) { alert(err.message); }
};

window.deleteData = async (type, id) => {
    if (confirm(`Hapus ${type} ini?`)) {
        const path = type === 'athlete' ? `events/${eventId}/athletes` : `events/${eventId}/classes`;
        await deleteDoc(doc(db, path, id));
    }
};

window.switchTab = (tabId, element) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.card-menu').forEach(card => card.classList.remove('card-active'));
    element.classList.add('card-active');

    if (tabId === 'tab-verifikasi') {
        fetchEventResults();
    }
};

window.toggleModal = (modalId, show) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('flex', show);
    document.body.classList.toggle('overflow-hidden', show);
};

window.filterTable = (input, tableId) => {
    let filter = input.value.toUpperCase();
    let tr = document.getElementById(tableId).getElementsByTagName("tr");
    for (let i = 1; i < tr.length; i++) {
        let text = tr[i].textContent || tr[i].innerText;
        tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
};

const ALL_SLOTS = [
    ...Array.from({ length: 16 }, (_, i) => ({ id: `p_n_${i + 1}`, label: `P${i + 1} (Penyisihan)` })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: `qn${i + 1}`, label: `Q${i + 1} (Kualifikasi)` })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `sn${i + 1}`, label: `S${i + 1} (Semi Final)` })),
    { id: 'fn1', label: 'F1 (Final - Kiri)' },
    { id: 'fn2', label: 'F2 (Final - Kanan)' }
];

window.openBracketConfig = async () => {
    document.getElementById('configModalTitle').innerText = `Pemetaan Slot Peserta`;
    document.getElementById('configModalSubtitle').innerText = "Atur titik mulai setiap peserta pada bagan";

    const paxTabs = document.getElementById('layout-pax-tabs');
    const mappingContainer = document.getElementById('mapping-container');

    paxTabs.innerHTML = '';
    mappingContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-20"><div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div><div class="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Cloud...</div></div>`;

    try {
        paxTabs.innerHTML = '';
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].forEach(i => {
            const btn = document.createElement('button');
            btn.className = "pax-preset-btn px-3 py-2 bg-slate-800 hover:bg-blue-500/20 text-slate-400 text-[9px] font-black rounded-xl transition-all border border-white/5";
            btn.innerText = `${i} PAX`;
            btn.onclick = () => { if (confirm(`Reset pemetaan ke default untuk ${i} peserta?`)) window.autoConfigBracketLayout(i); };
            paxTabs.appendChild(btn);
        });

        const eventRef = doc(db, "events", eventId);
        const snap = await getDoc(eventRef);
        const data = snap.data() || {};
        const mapping = data.globalBracketMapping || {};
        const savedPax = data.globalPax || 0;

        if (savedPax > 0) {
            renderMappingUI(savedPax, mapping);
            updatePaxActiveState(savedPax);
        } else {
            mappingContainer.innerHTML = `<div class="text-center py-10 opacity-30 text-[10px] uppercase font-bold tracking-widest">Belum ada pemetaan. Silakan pilih PAX di atas.</div>`;
        }
    } catch (err) { alert("Gagal memuat konfigurasi: " + err.message); }

    toggleModal('modal-bracket-config', true);
};

window.autoConfigBracketLayout = (count) => {
    const defaultMapping = {};
    let prefix = 'p_n_';
    if (count <= 2) prefix = 'fn';
    else if (count <= 4) prefix = 'sn';
    else if (count <= 8) prefix = 'qn';

    for (let i = 1; i <= count; i++) {
        defaultMapping[i] = (prefix === 'fn') ? `fn${i}` : `${prefix}${i}`;
    }
    renderMappingUI(count, defaultMapping);
    updatePaxActiveState(count);
};

function updatePaxActiveState(activeCount) {
    document.querySelectorAll('.pax-preset-btn').forEach(btn => {
        const count = btn.innerText.split(' ')[0];
        if (count == activeCount) {
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-400/50', 'shadow-[0_0_15px_rgba(37,99,235,0.3)]');
            btn.classList.remove('bg-slate-800', 'text-slate-400');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-400/50', 'shadow-[0_0_15px_rgba(37,99,235,0.3)]');
            btn.classList.add('bg-slate-800', 'text-slate-400');
        }
    });
}

function renderMappingUI(count, mapping) {
    const container = document.getElementById('mapping-container');
    container.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const row = document.createElement('div');
        row.className = "flex items-center gap-4 p-4 bg-slate-800/30 rounded-2xl border border-white/5 group hover:border-blue-500/50 transition-all";
        const selectedId = mapping[i] || mapping[i.toString()] || '';
        row.innerHTML = `<div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-[10px] font-black">${i}</div><div class="flex-1"><label class="text-[8px] font-black uppercase opacity-30 block mb-1">Titik Mulai Peserta #${i}</label><select class="participant-slot-select w-full bg-slate-900/50 border-none text-[11px] font-bold text-slate-200 focus:ring-1 focus:ring-blue-500 rounded-lg py-1 px-2" data-index="${i}"><option value="">-- Pilih Slot SVG --</option>${ALL_SLOTS.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>`;
        container.appendChild(row);
    }
}

window.saveGlobalLayout = async () => {
    const btn = document.getElementById('btnSaveGlobalLayout');
    const originalText = btn.innerText;
    const mapping = {};
    const selects = document.querySelectorAll('.participant-slot-select');
    const paxCount = selects.length;

    if (paxCount === 0) { alert("Silakan pilih jumlah PAX terlebih dahulu."); return; }
    btn.disabled = true;
    btn.innerText = "MENYIMPAN KE CLOUD...";

    selects.forEach(sel => { if (sel.value) mapping[sel.dataset.index] = sel.value; });

    try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, { globalBracketMapping: mapping, globalPax: paxCount, updatedAt: new Date().toISOString() });
        btn.innerText = "TERSIMPAN DI CLOUD! ✅";
        setTimeout(() => { toggleModal('modal-bracket-config', false); btn.disabled = false; btn.innerText = originalText; }, 1000);
    } catch (err) { alert("Gagal menyimpan: " + err.message); btn.disabled = false; btn.innerText = originalText; }
};

window.checkClassType = async (className) => {
    const container = document.getElementById('teamMembersContainer');
    if (!className) { if (container) container.classList.add('hidden'); return; }
    try {
        const q = query(collection(db, `events/${eventId}/classes`), where("name", "==", className));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const classData = snap.docs[0].data();
            if (classData.type === 'BEREGU') { if (container) container.classList.remove('hidden'); }
            else { if (container) container.classList.add('hidden'); }
        } else { if (container) container.classList.add('hidden'); }
    } catch (err) { console.error("Check Class Type Error:", err); }
};

