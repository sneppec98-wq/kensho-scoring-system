import { renderSchedule } from './schedule-generator.js';
import { preparePesertaPrint } from './print/print-peserta.js';
import { prepareJuaraPrint, extractResultsFromBrackets } from './print/print-juara.js';
import { prepareMedaliPrint } from './print/print-medali.js';
import { prepareMedalTallyPrint } from './print/print-medal-tally.js';
import { prepareBracketPrint } from './print/print-bracket.js';
import { prepareJadwalPrint } from './print/print-jadwal.js';

// UI View Imports
import { renderPesertaView } from './verification/view-peserta.js';
import { renderWinnersView } from './verification/view-juara.js';
import { renderMedalView, calculateMedalTally } from './verification/view-medali.js';
import { renderMedalTallyView, calculateMedalTallyNew } from './verification/view-medal-tally.js';

// Global State for Search
window.verifikasiSearchTerm = '';
window.handleVerifikasiSearch = (value, tab, athletes, classes, brackets, eventName, eventLogo) => {
    window.verifikasiSearchTerm = value.toLowerCase();
    renderVerificationData(athletes, classes, brackets, tab, eventName, eventLogo);
};

export const renderVerificationData = (athletes, classes, brackets = [], tab = 'PESERTA', eventName = '', eventLogo = null) => {
    const verifikasiContent = document.getElementById('verifikasiContent');
    if (!verifikasiContent) return;

    // Save latest data for global access
    window.latestAthletes = athletes;
    window.latestClasses = classes;
    window.latestBrackets = brackets;

    // Add search bar and print button container
    let html = `
        <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <!-- Search Bar -->
            <div class="relative flex-1 max-w-md group">
                <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg class="w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input type="text" 
                    id="verifikasiSearchInput"
                    placeholder="Cari Nama / Kontingen / Kelas..." 
                    value="${window.verifikasiSearchTerm}"
                    oninput="window.handleVerifikasiSearch(this.value, '${tab}', latestAthletes, latestClasses, latestBrackets, '${eventName}', '${eventLogo || ''}')"
                    class="w-full bg-slate-900/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all">
            </div>

            <!-- Public Publication Toggle -->
            ${(tab === 'JUARA' || tab === 'MEDALI' || tab === 'JADWAL') ? `
            <div class="flex items-center gap-3 bg-slate-900/40 px-6 py-4 rounded-2xl border border-white/5 no-print">
                <div class="text-right">
                    <p class="text-[8px] font-black uppercase opacity-40 tracking-widest text-slate-200">PUBLIKASIKAN HASIL</p>
                    <p class="text-[7px] font-bold opacity-30 uppercase mt-0.5">TERLIHAT DI PORTAL PESERTA</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" onchange="window.updatePublicAccess('${tab === 'JUARA' ? 'isWinnersPublic' : (tab === 'MEDALI' ? 'isMedalsPublic' : 'isSchedulePublic')}', this.checked)" 
                        ${(window.currentEventData && (tab === 'JUARA' ? window.currentEventData.isWinnersPublic : (tab === 'MEDALI' ? window.currentEventData.isMedalsPublic : window.currentEventData.isSchedulePublic))) ? 'checked' : ''}
                        class="sr-only peer">
                    <div class="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                </label>
            </div>
            ` : ''}

            <!-- Print Button (Custom Styled for Kensho) -->
            <div class="flex gap-2">
                <button onclick="window.copyOfficialLink()" 
                    class="neu-button px-6 py-4 rounded-2xl flex items-center space-x-3 group transition-all text-blue-500 hover:text-white hover:bg-blue-500">
                    <div class="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-[0.1em]">BAGIKAN LINK</span>
                </button>
                <button onclick="printVerificationSubTab('${tab}', '${eventName}', '${eventLogo || ''}')" 
                    class="neu-button px-8 py-4 rounded-2xl flex items-center space-x-3 group transition-all text-green-500 hover:text-white hover:bg-green-500">
                    <div class="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-[0.2em]">CETAK ${tab.replace('_', ' ')} (F4)</span>
                </button>
            </div>
        </div>
    `;

    const results = extractResultsFromBrackets(brackets);

    if (tab === 'PESERTA') {
        html += renderPesertaView(athletes, classes, window.verifikasiSearchTerm);
    } else if (tab === 'JADWAL') {
        verifikasiContent.innerHTML = html + `<div id="scheduleContent"></div>`;
        renderSchedule(classes, athletes, 'scheduleContent');
        return;
    } else if (tab === 'JUARA') {
        html += renderWinnersView(results, classes, athletes);
    } else if (tab === 'MEDALI') {
        const allContingents = [...new Set(athletes.map(a => a.team).filter(t => t))];
        const sortedTally = calculateMedalTally(results, allContingents);
        html += renderMedalView(sortedTally);
    } else if (tab === 'MEDALI_TALLY') {
        const sortedTally = calculateMedalTallyNew(athletes, classes, brackets);
        html += renderMedalTallyView(sortedTally);
    }

    verifikasiContent.innerHTML = html;

    // Restore focus if searching
    const searchInput = document.getElementById('verifikasiSearchInput');
    if (searchInput && window.verifikasiSearchTerm) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    }
};

/**
 * GLOBAL DISPATCHER FOR PRINTING
 */
window.printVerificationSubTab = (tab, eventName, eventLogo) => {
    const athletes = window.latestAthletes || [];
    const classes = window.latestClasses || [];
    const brackets = window.latestBrackets || [];

    if (tab === 'PESERTA') {
        preparePesertaPrint(athletes, classes, eventName, eventLogo, window.verifikasiSearchTerm);
    } else if (tab === 'JUARA') {
        prepareJuaraPrint(brackets, classes, athletes, eventName, eventLogo);
    } else if (tab === 'MEDALI') {
        prepareMedaliPrint(brackets, athletes, eventName, eventLogo);
    } else if (tab === 'MEDALI_TALLY') {
        prepareMedalTallyPrint(athletes, classes, eventName, eventLogo);
    } else if (tab === 'JADWAL_FESTIVAL') {
        prepareBracketPrint(athletes, classes, eventName, eventLogo);
    } else if (tab === 'JADWAL') {
        prepareJadwalPrint(eventName, eventLogo);
    }
};

/**
 * COPY OFFICIAL LINK
 */
window.copyOfficialLink = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) return alert("Event ID tidak ditemukan.");

    const fullUrl = `https://kensho-peserta.web.app/?id=${eventId}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
        alert("✅ Link Daftar Peserta berasil disalin ke clipboard!\n\nLink ini dapat dibagikan kepada Official.");
    }).catch(err => {
        console.error("Copy Error:", err);
        alert("Gagal menyalin link.");
    });
};
