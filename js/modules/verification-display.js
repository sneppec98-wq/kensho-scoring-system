import { renderSchedule } from './schedule-generator.js';
import { preparePesertaPrint } from './print/print-peserta.js';
import { prepareJuaraPrint, extractResultsFromBrackets } from './print/print-juara.js';
import { prepareMedaliPrint } from './print/print-medali.js';
import { prepareMedalTallyPrint } from './print/print-medal-tally.js';
import { prepareBracketPrint } from './print/print-bracket.js';
import { prepareJadwalPrint } from './print/print-jadwal.js';
import { prepareOfficialReport } from './print/print-official-report.js';


// UI View Imports
import { renderPesertaView } from './verification/view-peserta.js';
import { renderWinnersView } from './verification/view-juara.js';
import { renderMedalView, calculateMedalTally } from './verification/view-medali.js';
import { renderMedalTallyView, calculateMedalTallyNew } from './verification/view-medal-tally.js';
import { customAlert } from './ui-helpers.js';

// Global State
window.verifikasiSearchTerm = '';
window.verifikasiCurrentPage = 1;
window.verifikasiCurrentTab = '';

window.changeVerifikasiPage = (delta, athletes, classes, brackets, tab, eventName, eventLogo) => {
    window.verifikasiCurrentPage += delta;
    renderVerificationData(athletes, classes, brackets, tab, eventName, eventLogo);
};

window.handleVerifikasiSearch = (value, tab, athletes, classes, brackets, eventName, eventLogo) => {
    window.verifikasiSearchTerm = value.toLowerCase();
    window.verifikasiCurrentPage = 1; // Reset page on search
    renderVerificationData(athletes, classes, brackets, tab, eventName, eventLogo);
};

window.switchVerificationTab = (tab) => {
    if (typeof window.setVerifikasiSubTab === 'function') {
        window.setVerifikasiSubTab(tab);
    } else {
        window.verifikasiCurrentTab = tab;
        window.verifikasiCurrentPage = 1;
        renderVerificationData(window.latestAthletes, window.latestClasses, window.latestBrackets, tab);
    }
};

window.setVerificationSearch = (val) => {
    const input = document.getElementById('verifikasiSearchInput');
    if (input) {
        input.value = val;
        window.handleVerifikasiSearch(val, window.verifikasiCurrentTab, window.latestAthletes, window.latestClasses, window.latestBrackets, window.currentEventName || '', window.currentEventLogo || '');
    } else {
        // If searching but input not visible, just update term and re-render
        window.verifikasiSearchTerm = val.toLowerCase();
        window.verifikasiCurrentPage = 1;
        renderVerificationData(window.latestAthletes, window.latestClasses, window.latestBrackets, window.verifikasiCurrentTab, window.currentEventName || '', window.currentEventLogo || '');
    }
};

window.editJuaraManual = (className, classCode = null) => {
    if (typeof window.openWinnerEditModal === 'function') {
        window.openWinnerEditModal(className, classCode);
    } else {
        customAlert("Membuka tab manajemen Juara...", "Info", "info");

        if (typeof window.switchTab === 'function') {
            window.switchTab('verification');
        }

        window.switchVerificationTab('JUARA');
    }
};

export const renderVerificationData = (athletes, classes, brackets = [], tab = 'PESERTA', eventName = '', eventLogo = null, manualMedals = []) => {
    if (window.verifikasiCurrentTab !== tab) {
        window.verifikasiCurrentTab = tab;
        window.verifikasiCurrentPage = 1;
        window.verifikasiSearchTerm = '';
    }

    // Cache event metadata for search handlers
    window.currentEventName = eventName;
    window.currentEventLogo = eventLogo;

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
                ${tab === 'JUARA' ? `
                <button onclick="window.printOfficialTournamentReport('${eventName}', '${eventLogo || ''}')" 
                    class="neu-button px-8 py-4 rounded-2xl flex items-center space-x-3 group transition-all text-blue-400 hover:text-white hover:bg-blue-500 shadow-xl shadow-blue-500/10">
                    <div class="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-[0.2em]">LAPORAN RESMI (A4)</span>
                </button>
                ` : ''}
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
        html += renderWinnersView(results, classes, athletes, window.verifikasiSearchTerm);
    } else if (tab === 'MEDALI') {
        const allContingents = [...new Set(athletes.map(a => a.team).filter(t => t))];
        const sortedTally = calculateMedalTally(results, allContingents, manualMedals);
        html += renderMedalView(results, sortedTally, window.verifikasiSearchTerm);
    } else if (tab === 'MEDALI_TALLY') {
        const sortedTally = calculateMedalTallyNew(athletes, classes, brackets);
        html += renderMedalTallyView(sortedTally, window.verifikasiSearchTerm);
    }

    // Standard Pagination for Verification (All Sub-tabs)
    const paginatedTabs = ['PESERTA', 'JADWAL', 'JUARA', 'MEDALI', 'MEDALI_TALLY'];
    if (paginatedTabs.includes(tab)) {
        // We'll need a way for the view modules to communicate total pages
        // For now, let's assume they set window.verifikasiTotalPages
        const totalPages = window.verifikasiTotalPages || 1;
        if (window.verifikasiCurrentPage > totalPages) window.verifikasiCurrentPage = totalPages;
        if (window.verifikasiCurrentPage < 1) window.verifikasiCurrentPage = 1;

        const paginationHtml = `
            <div id="verifikasiPaginationControls" class="flex justify-between items-center mt-12 mb-8 px-2 no-print">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Halaman ${window.verifikasiCurrentPage} dari ${totalPages}
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.changeVerifikasiPage(-1, latestAthletes, latestClasses, latestBrackets, '${tab}', '${eventName}', '${eventLogo || ''}')"
                        class="px-4 py-2 rounded-lg bg-slate-900/50 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30"
                        ${window.verifikasiCurrentPage <= 1 ? 'disabled' : ''}>
                        ← Sebelum
                    </button>
                    <div class="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <span class="text-[10px] font-black text-blue-400">${window.verifikasiCurrentPage}</span>
                    </div>
                    <button onclick="window.changeVerifikasiPage(1, latestAthletes, latestClasses, latestBrackets, '${tab}', '${eventName}', '${eventLogo || ''}')"
                        class="px-4 py-2 rounded-lg bg-slate-900/50 text-slate-400 text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 hover:text-white transition-all disabled:opacity-30"
                        ${window.verifikasiCurrentPage >= totalPages ? 'disabled' : ''}>
                        Lanjut →
                    </button>
                </div>
            </div>
        `;
        html += paginationHtml;
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
window.printVerificationSubTab = async (tab, eventName, eventLogo) => {
    const athletes = window.latestAthletes || [];
    const classes = window.latestClasses || [];
    const brackets = window.latestBrackets || [];

    if (tab === 'PESERTA') {
        await preparePesertaPrint(athletes, classes, eventName, eventLogo, window.verifikasiSearchTerm);
    } else if (tab === 'JUARA') {
        await prepareJuaraPrint(brackets, classes, athletes, eventName, eventLogo);
    } else if (tab === 'MEDALI') {
        await prepareMedaliPrint(brackets, athletes, eventName, eventLogo);
    } else if (tab === 'MEDALI_TALLY') {
        await prepareMedalTallyPrint(athletes, classes, eventName, eventLogo);
    } else if (tab === 'JADWAL_FESTIVAL') {
        await prepareBracketPrint(athletes, classes, eventName, eventLogo);
    } else if (tab === 'JADWAL') {
        await prepareJadwalPrint(eventName, eventLogo);
    }
};

/**
 * PRINT OFFICIAL TOURNAMENT REPORT
 */
window.printOfficialTournamentReport = async (eventName, eventLogo) => {
    const brackets = window.latestBrackets || [];
    const classes = window.latestClasses || [];
    const athletes = window.latestAthletes || [];
    await prepareOfficialReport(brackets, classes, athletes, eventName, eventLogo);
};

/**
 * COPY OFFICIAL LINK
 */
window.copyOfficialLink = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) {
        customAlert("Event ID tidak ditemukan.", "Error", "danger");
        return;
    }

    const fullUrl = `https://kensho-peserta.web.app/?id=${eventId}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
        customAlert("✅ Link Daftar Peserta berasil disalin ke clipboard!\n\nLink ini dapat dibagikan kepada Official.", "Link Disalin", "info");
    }).catch(err => {
        console.error("Copy Error:", err);
        customAlert("Gagal menyalin link.", "Gagal", "danger");
    });
};
