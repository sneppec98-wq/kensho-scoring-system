import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-init.js";

const PAGE_SIZE = 10;
window.athleteCurrentPage = 1;
window.contingentCurrentPage = 1;

let lastAthletesRef = [];
let lastClassesRef = [];
let lastFilteredAthletes = [];
let lastFilteredTeams = [];

window.changeAthletePage = (delta) => {
    window.athleteCurrentPage += delta;
    renderAthleteData(lastAthletesRef, lastClassesRef, window.currentAthleteSubTab || 'OPEN');
};

window.changeContingentPage = (delta) => {
    window.contingentCurrentPage += delta;
    renderContingentTracking(lastAthletesRef, lastClassesRef);
};

export const renderAthleteData = (athletes, latestClasses, currentAthleteSubTab = 'OPEN') => {
    const tableBody = document.getElementById('athlete-table-body');
    const athleteCountBadge = document.getElementById('athlete-count-badge');
    if (!tableBody) return;

    if (!athletes || athletes.length === 0) {
        tableBody.innerHTML = `
            <tr><td colspan="7" class="text-center p-12 opacity-40 italic">
                BELUM ADA DATA ATLET
            </td></tr>
        `;
        if (athleteCountBadge) athleteCountBadge.innerText = '0';
        return;
    }

    if (athleteCountBadge) athleteCountBadge.innerText = athletes.length;

    // Helper to find class info robustly
    const findClassInfo = (a) => {
        return latestClasses.find(c =>
            (c.id && a.classCode && c.id.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
            (c.code && a.classCode && c.code.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
            (c.name && a.className && c.name.toString().trim().toUpperCase() === a.className.toString().trim().toUpperCase())
        );
    };

    // Dashboard Breakdown Update
    const dashOpen = document.getElementById('dash-open-count');
    const dashFest = document.getElementById('dash-fest-count');
    const dashTeam = document.getElementById('dash-team-count');
    if (dashOpen && dashFest) {
        let openTotal = 0;
        let festTotal = 0;
        let teamTotal = 0;
        athletes.forEach(a => {
            const classInfo = findClassInfo(a);
            if (!classInfo) return;

            if (classInfo.type === 'BEREGU') {
                teamTotal++;
            } else {
                const isF = (classInfo.code || "").toString().toUpperCase().startsWith('F');
                if (isF) festTotal++; else openTotal++;
            }
        });
        dashOpen.innerText = openTotal;
        dashFest.innerText = festTotal;
        if (dashTeam) dashTeam.innerText = teamTotal;
    }

    // Unified list (No filtering by sub-tab)
    const filtered = athletes;

    // Natural Sorting by Class Code
    filtered.sort((a, b) => {
        const classA = findClassInfo(a);
        const classB = findClassInfo(b);
        const codeA = (classA?.code || "").toString();
        const codeB = (classB?.code || "").toString();

        const codeCmp = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        if (codeCmp !== 0) return codeCmp;
        return (a.name || "").localeCompare(b.name || "");
    });

    lastAthletesRef = athletes;
    lastClassesRef = latestClasses;
    window.currentAthleteSubTab = currentAthleteSubTab;
    lastFilteredAthletes = filtered;

    // Pagination Logic
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

    if (window.athleteCurrentPage > totalPages) window.athleteCurrentPage = totalPages;
    if (window.athleteCurrentPage < 1) window.athleteCurrentPage = 1;

    const startIdx = (window.athleteCurrentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
    const pagedData = filtered.slice(startIdx, endIdx);

    // Update Pagination UI
    const pageInfo = document.getElementById('athletePageInfo');
    const currentLbl = document.getElementById('athleteCurrentPage');
    const totalLbl = document.getElementById('athleteTotalPages');
    const prevBtn = document.getElementById('athletePrevBtn');
    const nextBtn = document.getElementById('athleteNextBtn');

    if (pageInfo) pageInfo.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${endIdx} dari ${totalItems} data`;
    if (currentLbl) currentLbl.innerText = window.athleteCurrentPage;
    if (totalLbl) totalLbl.innerText = totalPages;
    if (prevBtn) prevBtn.disabled = window.athleteCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = window.athleteCurrentPage >= totalPages;

    tableBody.innerHTML = pagedData.map(athlete => `
        <tr class="row-hover border-b border-white/5 group ${athlete.verified === false ? 'bg-orange-500/5' : ''}">
            <td class="p-4">
                <div class="font-bold text-white text-lg">${athlete.name}</div>
                ${athlete.name2 || athlete.name3 ?
            `<div class="text-[10px] opacity-40 font-bold mt-1 uppercase">👥 TIM: ${[athlete.name, athlete.name2, athlete.name3].filter(n => n).join(' & ')}</div>` :
            (athlete.members && athlete.members.length > 0 ?
                `<div class="text-[10px] opacity-40 font-bold mt-1 uppercase">👥 TIM: ${athlete.members.join(' & ')}</div>` : '')}
                ${athlete.whatsapp ? `<div class="text-[9px] text-slate-500 font-bold mt-1">📱 ${athlete.whatsapp}</div>` : ''}
                ${athlete.registeredVia === 'public_portal' ? '<span class="inline-block px-2 py-0.5 rounded text-[8px] font-black bg-purple-500/20 text-purple-400 mt-1">VIA PORTAL</span>' : ''}
            </td>
            <td class="p-4 opacity-70 text-sm font-bold">${athlete.team || '-'}</td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black text-blue-500 mb-1 tracking-widest">
                        ${athlete.classCode || findClassInfo(athlete)?.code || 'ERR'}
                    </span>
                    <span class="text-xs font-bold text-slate-200">${athlete.className || findClassInfo(athlete)?.name || '-'}</span>
                    <span class="px-2 py-1 rounded text-[9px] font-black mt-2 ${athlete.gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}">
                        ${athlete.gender}
                    </span>
                </div>
            </td>
            <td class="p-4 text-center">
                ${athlete.verified === false ?
            `<span class="inline-block px-3 py-1.5 rounded-full text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-wider">⏳ Pending</span>` :
            `<span class="inline-block px-3 py-1.5 rounded-full text-[9px] font-black bg-green-500/20 text-green-400 border border-green-500/30 uppercase tracking-wider">✓ Verified</span>`
        }
            </td>
            <td class="p-4 font-bold text-yellow-400">${athlete.weight || '-'} kg</td>
            <td class="p-4">
                <div class="flex items-center justify-center space-x-2">
                    ${athlete.verified === false ? `
                        <button onclick="verifyAthlete('${athlete.id}')" 
                            class="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-green-500/20"
                            title="Verifikasi Atlet">
                            ✓ VERIFIKASI
                        </button>
                        <button onclick="rejectAthlete('${athlete.id}', '${(athlete.name || '').replace(/'/g, "\\'")}') "
                            class="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 hover:text-white text-red-400 text-[10px] font-black uppercase tracking-wider transition-all border border-red-500/30"
                           title="Tolak Pendaftaran">
                            ✕ TOLAK
                        </button>
                    ` : `
                        <button onclick="editAthlete('${athlete.id}')" 
                            class="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onclick="deleteAthlete('${athlete.id}')" 
                            class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `).join('');

    renderContingentTracking(athletes, latestClasses);
};

export const renderContingentTracking = (athletes, latestClasses = []) => {
    const tbody = document.getElementById('contingentTableBody');
    const summaryArea = document.getElementById('contingentSummary');
    if (!tbody) return;

    // Detect unique contingents from athletes data
    const actualTeams = [...new Set(athletes.map(a => (a.team || "").trim().toUpperCase()))]
        .filter(t => t !== "")
        .sort((a, b) => a.localeCompare(b));

    // Calculate Category Breakdown
    let openCount = 0;
    let festivalCount = 0;
    let bereguCount = 0;

    athletes.forEach(a => {
        const classInfo = latestClasses.find(c =>
            (c.code && a.classCode && c.code.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
            (c.name && a.className && c.name.toString().trim().toUpperCase() === a.className.toString().trim().toUpperCase())
        );
        if (!classInfo) {
            openCount++; // Fallback
            return;
        }

        if (classInfo.type === 'BEREGU') {
            bereguCount++;
        } else {
            const isFestival = (classInfo.code || "").toString().toUpperCase().startsWith('F');
            if (isFestival) festivalCount++;
            else openCount++;
        }
    });

    let submittedCount = 0;
    let totalAthletesFound = athletes.length;

    lastFilteredTeams = actualTeams;
    const totalItems = actualTeams.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

    if (window.contingentCurrentPage > totalPages) window.contingentCurrentPage = totalPages;
    if (window.contingentCurrentPage < 1) window.contingentCurrentPage = 1;

    const startIdx = (window.contingentCurrentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
    const pagedTeams = actualTeams.slice(startIdx, endIdx);

    // Update Pagination UI
    const pageInfo = document.getElementById('contingentPageInfo');
    const currentLbl = document.getElementById('contingentCurrentPage');
    const totalLbl = document.getElementById('contingentTotalPages');
    const prevBtn = document.getElementById('contingentPrevBtn');
    const nextBtn = document.getElementById('contingentNextBtn');

    if (pageInfo) pageInfo.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${endIdx} dari ${totalItems} kontingen`;
    if (currentLbl) currentLbl.innerText = window.contingentCurrentPage;
    if (totalLbl) totalLbl.innerText = totalPages;
    if (prevBtn) prevBtn.disabled = window.contingentCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = window.contingentCurrentPage >= totalPages;

    let html = '';

    pagedTeams.forEach((name, idxIdx) => {
        const actualIdx = startIdx + idxIdx;
        const matchedAthletes = athletes.filter(a => (a.team || "").trim().toUpperCase() === name);

        // Per-contingent breakdown
        let teamOpen = 0;
        let teamFest = 0;
        let teamTeam = 0;

        matchedAthletes.forEach(a => {
            const classInfo = latestClasses.find(c =>
                (c.code && a.classCode && c.code.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
                (c.name && a.className && c.name.toString().trim().toUpperCase() === a.className.toString().trim().toUpperCase())
            );
            if (!classInfo) {
                teamOpen++;
                return;
            }
            if (classInfo.type === 'BEREGU') {
                teamTeam++;
            } else {
                const isF = (classInfo.code || "").toString().toUpperCase().startsWith('F');
                if (isF) teamFest++; else teamOpen++;
            }
        });

        submittedCount++;

        html += `
            <tr class="row-hover border-b border-white/5 bg-white/5">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-[8px] opacity-20 font-black">#${(actualIdx + 1).toString().padStart(2, '0')}</span>
                    </div>
                </td>
                <td class="p-4 font-black italic text-slate-200 text-sm uppercase">${name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center">
                        <span class="px-4 py-1.5 rounded-full text-[10px] font-black bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]">AKTIF ✅</span>
                    </div>
                </td>
                <td class="p-4 text-center font-bold text-blue-400">${teamOpen}</td>
                <td class="p-4 text-center font-bold text-purple-400">${teamFest}</td>
                <td class="p-4 text-center font-bold text-orange-400">${teamTeam}</td>
                <td class="p-4 text-center">
                    <span class="text-blue-400 font-black text-2xl italic tracking-tighter">
                        ${matchedAthletes.length} <span class="text-[10px] uppercase not-italic opacity-40 ml-1">Atlet</span>
                    </span>
                </td>
                <td class="p-4">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="window.editContingentName('${name.replace(/'/g, "\\'")}')" 
                            class="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all"
                            title="Edit Nama Kontingen">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onclick="window.deleteContingentAthletes('${name.replace(/'/g, "\\'")}')" 
                            class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-all group/del"
                            title="Hapus Data Kontingen Ini">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (actualTeams.length === 0) {
        html = `<tr><td colspan="7" class="p-20 text-center opacity-30 italic font-black uppercase tracking-widest text-xs">Belum ada data kontingen yang terdeteksi</td></tr>`;
    }

    tbody.innerHTML = html;

    const labelDataMasuk = document.getElementById('labelDataMasuk');
    if (labelDataMasuk) {
        labelDataMasuk.innerText = `${actualTeams.length} Kontingen`;
    }

    if (summaryArea) {
        summaryArea.innerHTML = `
            <div class="neu-flat p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500 bg-slate-800/20">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                <div class="relative z-10 flex flex-col items-center text-center">
                    <div class="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 mb-4 group-hover:bg-green-500/20 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <p class="text-[9px] font-black opacity-30 uppercase tracking-[0.4em] mb-1">KONTINGEN</p>
                    <h4 class="text-4xl font-black italic text-green-400">${actualTeams.length}</h4>
                </div>
            </div>

            <div class="neu-flat p-8 rounded-[2.5rem] border border-white/5 col-span-2 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500 bg-slate-800/40">
                <div class="absolute -right-10 -top-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row items-center justify-between h-full space-y-6 md:space-y-0 md:space-x-8 px-4">
                    <div class="flex flex-col items-center md:items-start text-center md:text-left">
                        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 group-hover:bg-blue-500/20 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <p class="text-[9px] font-black opacity-30 uppercase tracking-[0.4em] mb-1">TOTAL ATLET</p>
                        <h4 class="text-5xl font-black italic text-blue-400">${totalAthletesFound}</h4>
                    </div>

                    <div class="flex flex-wrap justify-center md:justify-end gap-3 max-w-[400px]">
                        <div class="bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-2xl flex flex-col items-center min-w-[100px]">
                            <span class="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">OPEN</span>
                            <span class="text-xl font-black text-white italic">${openCount}</span>
                        </div>
                        <div class="bg-purple-500/10 border border-purple-500/20 px-4 py-3 rounded-2xl flex flex-col items-center min-w-[100px]">
                            <span class="text-[8px] font-black text-purple-400 uppercase tracking-widest mb-1">FESTIVAL</span>
                            <span class="text-xl font-black text-white italic">${festivalCount}</span>
                        </div>
                        <div class="bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-2xl flex flex-col items-center min-w-[100px]">
                            <span class="text-[8px] font-black text-orange-400 uppercase tracking-widest mb-1">BEREGU</span>
                            <span class="text-xl font-black text-white italic">${bereguCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Auto-update Contingent Datalist
    updateContingentDatalist(athletes);
    // Auto-update Payment Tracking (Need payments map from state)
    if (window.latestPaymentsMap) {
        renderPaymentTracking(athletes, latestClasses, window.latestPaymentsMap);
    }
};

export const renderPaymentTracking = (athletes, latestClasses = [], paymentsMap = {}) => {
    const tbody = document.getElementById('paymentTableBody');
    if (!tbody) return;

    const actualTeams = [...new Set(athletes.map(a => (a.team || "").trim().toUpperCase()))]
        .filter(t => t !== "")
        .sort((a, b) => a.localeCompare(b));

    const prices = { fest: 250000, open: 250000, beregu: 300000, kontingen: 100000, cashback: 25000 };
    let globalTotal = 0;
    let globalPaid = 0;
    let html = '';

    actualTeams.forEach((name, idx) => {
        const teamAthletes = athletes.filter(a => (a.team || "").trim().toUpperCase() === name);

        let fest = 0, open = 0, beregu = 0;
        teamAthletes.forEach(a => {
            const clsCode = (a.classCode || "").toString().toUpperCase();
            const classInfo = latestClasses.find(c =>
                (c.code && c.code.toString().toUpperCase() === clsCode) ||
                (c.id && c.id.toUpperCase() === clsCode)
            );

            if (classInfo) {
                if (classInfo.type === 'BEREGU') beregu++;
                else if (clsCode.startsWith('F')) fest++;
                else open++;
            } else {
                // Fallback string matching
                const clsName = (a.className || "").toUpperCase();
                if (clsName.includes("BEREGU")) beregu++;
                else if (clsCode.startsWith("F") || clsName.includes("FESTIVAL")) fest++;
                else open++;
            }
        });

        const totalEntries = fest + open + beregu;
        const subTotal = (fest * prices.fest) + (open * prices.open) + (beregu * prices.beregu) + prices.kontingen;
        const cashback = totalEntries * prices.cashback;
        const finalAmount = subTotal - cashback;
        globalTotal += finalAmount;

        const isPaid = paymentsMap[name.toUpperCase()]?.paid || false;
        if (isPaid) globalPaid += finalAmount;

        html += `
            <tr class="row-hover border-b border-white/5 ${isPaid ? 'bg-green-500/5' : 'bg-white/5'}">
                <td class="p-4 font-black italic text-slate-200 uppercase">${name}</td>
                <td class="p-4 text-center text-blue-400 font-bold">${open}</td>
                <td class="p-4 text-center text-purple-400 font-bold">${fest}</td>
                <td class="p-4 text-center text-orange-400 font-bold">${beregu}</td>
                <td class="p-4 text-right font-black text-slate-100">
                    <div class="flex flex-col items-end">
                        <span>Rp ${finalAmount.toLocaleString('id-ID')}</span>
                        ${isPaid ? '<span class="text-[8px] text-green-500 font-black tracking-widest uppercase mt-0.5">TERBAYAR</span>' : ''}
                    </div>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <a href="https://kensho-invoice.web.app?team=${encodeURIComponent(name)}" target="_blank"
                            class="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all text-[10px] font-black uppercase">
                            INVOICE
                        </a>
                        ${isPaid ?
                `<span class="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-black uppercase">LUNAS ✅</span>` :
                `<button onclick="window.applyPayment('${name.replace(/'/g, "\\'")}', ${finalAmount})"
                                class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all text-[10px] font-black uppercase">
                                APPLY
                            </button>`
            }
                    </div>
                </td>
            </tr>
        `;
    });

    if (actualTeams.length === 0) {
        html = `<tr><td colspan="6" class="p-20 text-center opacity-30 italic font-black uppercase tracking-widest text-xs">Belum ada data pendaftaran</td></tr>`;
    }

    tbody.innerHTML = html;
    const labelTotal = document.getElementById('labelTotalBiaya');
    if (labelTotal) {
        labelTotal.innerHTML = `
            <div class="flex flex-col items-end">
                <div class="text-[10px] opacity-40 mb-1">TOTAL TAGIHAN</div>
                <div class="text-2xl font-black text-blue-400">Rp ${globalTotal.toLocaleString('id-ID')}</div>
                <div class="flex gap-4 mt-2">
                    <div class="text-right">
                        <div class="text-[8px] opacity-40">MASUK</div>
                        <div class="text-sm font-black text-green-400">Rp ${globalPaid.toLocaleString('id-ID')}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[8px] opacity-40">SISA</div>
                        <div class="text-sm font-black text-red-500">Rp ${(globalTotal - globalPaid).toLocaleString('id-ID')}</div>
                    </div>
                </div>
            </div>
        `;
    }
};

export const applyPayment = async (contingentName, amount, eventId) => {
    const ok = await customConfirm({
        title: "Konfirmasi Pembayaran",
        message: `Tandai kontingen "${contingentName}" sebagai LUNAS sebesar Rp ${amount.toLocaleString('id-ID')}?`,
        confirmText: "Ya, Apply Pembayaran",
        type: "info"
    });

    if (!ok) return;

    try {
        const paymentRef = doc(db, `events/${eventId}/payments`, contingentName.toUpperCase());
        await setDoc(paymentRef, {
            paid: true,
            amount: amount,
            updatedAt: new Date().getTime(),
            timestamp: new Date()
        });

        await customAlert(`Pembayaran ${contingentName} berhasil di-apply!`, "Berhasil", "info");
        // We will need orchestrator to trigger refresh
    } catch (err) {
        console.error("Apply Payment Error:", err);
        await customAlert("Gagal apply pembayaran: " + err.message, "Gagal", "danger");
    }
};

const updateContingentDatalist = (athletes) => {
    const datalist = document.getElementById('contingent-list');
    if (!datalist) return;

    const uniqueTeams = [...new Set(athletes.map(a => a.team).filter(t => t))].sort();
    datalist.innerHTML = uniqueTeams.map(t => `<option value="${t}">`).join('');
};

export const editAthlete = async (athleteId, eventId, latestClasses = []) => {
    const athleteDoc = await getDoc(doc(db, `events/${eventId}/athletes`, athleteId));
    if (!athleteDoc.exists()) {
        await customAlert("Atlet tidak ditemukan.", "Peringatan", "danger");
        return;
    }

    const data = athleteDoc.data();
    const elements = {
        'edit-athlete-id': athleteId,
        'edit-athlete-name': data.name || '',
        'edit-athlete-team': data.team || '',
        'edit-athlete-gender': data.gender || '',
        'edit-athlete-birthDate': data.birthDate || '',
        'edit-athlete-weight': data.weight || '',
        'edit-athlete-classCode': data.classCode || '',
        'edit-athlete-name2': data.name2 || '',
        'edit-athlete-name3': data.name3 || ''
    };

    // Fill elements with safety check
    Object.entries(elements).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    // Set initial class preview and toggle members
    updateClassPreview(data.classCode || '', latestClasses, 'edit-athlete-class-preview', 'edit-teamMembersContainer');

    toggleModal('modal-edit-athlete', true);
};

export const handleClassCodeInput = (code, latestClasses = []) => {
    updateClassPreview(code, latestClasses, 'edit-athlete-class-preview', 'edit-teamMembersContainer');
};

export const handleEmergencyClassCodeInput = (code, latestClasses = []) => {
    updateClassPreview(code, latestClasses, 'athlete-class-preview', 'teamMembersContainer');
};

const updateClassPreview = (code, latestClasses, previewElId, teamContainerId = null) => {
    const previewEl = document.getElementById(previewElId);
    if (!previewEl) return;

    if (!code || code.trim() === "") {
        previewEl.textContent = "";
        return;
    }

    const targetClass = latestClasses.find(c => (c.code || "").toString().trim().toUpperCase() === code.toUpperCase().trim());
    if (targetClass) {
        previewEl.textContent = targetClass.name || "NAMA KELAS TIDAK TERDEFINISI";
        previewEl.classList.remove('text-red-400');
        previewEl.classList.add('text-blue-400');
    } else {
        previewEl.textContent = "KODE KELAS TIDAK DITEMUKAN";
        previewEl.classList.remove('text-blue-400');
        previewEl.classList.add('text-red-400');
    }

    // Toggle Team Members visibility if container ID is provided
    if (teamContainerId) {
        const teamContainer = document.getElementById(teamContainerId);
        if (teamContainer) {
            if (targetClass?.type === 'BEREGU') {
                teamContainer.classList.remove('hidden');
            } else {
                teamContainer.classList.add('hidden');
            }
        }
    }
};

export const saveEmergencyAthlete = async (eventId, latestClasses = []) => {
    const nameEl = document.getElementById('athleteName');
    const teamEl = document.getElementById('athleteTeam');
    const genderEl = document.getElementById('athleteGender');
    const birthEl = document.getElementById('athleteBirth');
    const weightEl = document.getElementById('athleteWeight');
    const codeEl = document.getElementById('athlete-classCode');

    if (!nameEl || !teamEl || !codeEl) return;

    const classCode = codeEl.value.toUpperCase().trim();
    if (!classCode) {
        await customAlert("Kode Kelas wajib diisi!", "Validasi", "danger");
        return;
    }

    const targetClass = latestClasses.find(c => (c.code || "").toString().trim().toUpperCase() === classCode);
    if (!targetClass) {
        await customAlert("Kode kelas tidak valid!", "Validasi", "danger");
        return;
    }

    showProgress('MENYIMPAN ATLET', 0);

    try {
        const athleteData = {
            name: nameEl.value.toUpperCase().trim(),
            team: teamEl.value.toUpperCase().trim(),
            gender: genderEl?.value || 'PUTRA',
            birthDate: birthEl?.value || '',
            weight: parseFloat(weightEl?.value) || 0,
            classCode: classCode,
            className: targetClass.name || '',
            timestamp: new Date().getTime()
        };

        // Handle Team Members if BEREGU
        if (targetClass.type === 'BEREGU') {
            athleteData.name2 = document.getElementById('athleteName2')?.value.toUpperCase().trim() || '';
            athleteData.name3 = document.getElementById('athleteName3')?.value.toUpperCase().trim() || '';
        }

        const newAthleteRef = doc(collection(db, `events/${eventId}/athletes`));
        await setDoc(newAthleteRef, athleteData);

        customAlert(`Atlet "${athleteData.name}" berhasil ditambahkan!`, "Pendaftaran Berhasil", "info");
        toggleModal('modal-atlet', false);

        // Reset Form
        document.getElementById('formAthlete').reset();
        document.getElementById('athlete-class-preview').textContent = '';
        document.getElementById('teamMembersContainer')?.classList.add('hidden');

    } catch (err) {
        console.error("Save Emergency Athlete Error:", err);
        await customAlert("Gagal menyimpan: " + err.message, "Gagal", "danger");
    } finally {
        hideProgress();
    }
};

export const saveAthleteEdit = async (eventId, latestClasses = []) => {
    const idEl = document.getElementById('edit-athlete-id');
    const codeEl = document.getElementById('edit-athlete-classCode');
    if (!idEl || !codeEl) return;

    const athleteId = idEl.value;
    const classCode = codeEl.value.toUpperCase().trim();

    // Find the class name for the entered code
    const targetClass = latestClasses.find(c => (c.code || "").toString().trim().toUpperCase() === classCode);
    if (!targetClass) {
        await customAlert("Kode kelas tidak valid! Data tidak disimpan.", "Gagal Validasi", "danger");
        return;
    }
    const className = targetClass?.name || '';

    const updatedData = {
        name: document.getElementById('edit-athlete-name')?.value.toUpperCase() || '',
        team: document.getElementById('edit-athlete-team')?.value.toUpperCase() || '',
        gender: document.getElementById('edit-athlete-gender')?.value || '',
        birthDate: document.getElementById('edit-athlete-birthDate')?.value || '',
        weight: document.getElementById('edit-athlete-weight')?.value || '',
        className: className,
        classCode: classCode
    };

    // Include members if BEREGU
    if (targetClass.type === 'BEREGU') {
        updatedData.name2 = document.getElementById('edit-athlete-name2')?.value.toUpperCase().trim() || '';
        updatedData.name3 = document.getElementById('edit-athlete-name3')?.value.toUpperCase().trim() || '';
    }

    try {
        await updateDoc(doc(db, `events/${eventId}/athletes`, athleteId), updatedData);
        customAlert("Data atlet berhasil diperbarui!", "Update Berhasil", "info");
        toggleModal('modal-edit-athlete', false);
    } catch (err) {
        console.error("Update Athlete Error:", err);
        await customAlert("Gagal memperbarui data: " + err.message, "Gagal", "danger");
    }
}

export const deleteAthlete = async (athleteId, eventId) => {
    const ok = await customConfirm({
        title: "Hapus Pendaftaran",
        message: "Yakin ingin menghapus data pendaftaran ini? Data yang dihapus TIDAK DAPAT dikembalikan.",
        confirmText: "Hapus Selamanya"
    });

    if (ok) {
        try {
            // Show loading state
            const deleteButtons = document.querySelectorAll(`button[onclick="deleteAthlete('${athleteId}')"]`);
            deleteButtons.forEach(btn => {
                btn.disabled = true;
                btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>';
            });

            // Delete from Firestore
            await deleteDoc(doc(db, `events/${eventId}/athletes`, athleteId));

            // Success feedback
            customAlert("Data atlet berhasil dihapus dari database!", "Terhapus", "info");
        } catch (err) {
            console.error("Delete Athlete Error:", err);
            await customAlert("❌ Gagal menghapus data: " + err.message, "Gagal", "danger");

            // Restore button state on error
            const deleteButtons = document.querySelectorAll(`button[onclick="deleteAthlete('${athleteId}')"]`);
            deleteButtons.forEach(btn => {
                btn.disabled = false;
                btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
            });
        }
    }
};

export const deleteAllAthletes = async (eventId) => {
    const ok = await customConfirm({
        title: "Hapus Seluruh Data",
        message: "⚠️ PERINGATAN: Anda akan menghapus SELURUH DATA ATLET dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.",
        confirmText: "Hapus Total",
        promptWord: "HAPUS"
    });

    if (!ok) return;

    showProgress('MEMBERSIHKAN DATA ATLET', 0);
    try {
        const athleteSnap = await getDocs(collection(db, `events/${eventId}/athletes`));
        if (!athleteSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < athleteSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                athleteSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/athletes`, docSnap.id));
                });
                await batch.commit();
            }
        }

        const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        if (!bracketSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < bracketSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                bracketSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/brackets`, docSnap.id));
                });
                await batch.commit();
            }
        }

        const total = athleteSnap.size;
        await customAlert(`Berhasil membersihkan ${total} data pendaftaran dan seluruh bagan!`, "Pembersihan Selesai", "info");
    } catch (err) {
        console.error("Delete All Athletes/Brackets Error:", err);
        await customAlert("Gagal membersihkan database: " + err.message, "Kesalahan", "danger");
    } finally {
        hideProgress();
    }
};

export const deleteContingentAthletes = async (teamName, eventId) => {
    const ok = await customConfirm({
        title: `Hapus Kontingen`,
        message: `Konfirmasi: Anda akan menghapus SELURUH pendaftaran dari kontingen "${teamName}". Lanjutkan?`,
        confirmText: "Hapus Kontingen"
    });

    if (!ok) return;

    showProgress(`MENGHAPUS DATA ${teamName}`, 0);
    try {
        const athletesRef = collection(db, `events/${eventId}/athletes`);
        // We match exactly like in tracking
        const athleteSnap = await getDocs(athletesRef);
        const toDelete = athleteSnap.docs.filter(docSnap => {
            const a = docSnap.data();
            return a.team && (
                a.team.toUpperCase().includes(teamName.toUpperCase()) ||
                teamName.toUpperCase().includes(a.team.toUpperCase())
            );
        });

        if (toDelete.length === 0) {
            await customAlert("Tidak ada data yang ditemukan untuk kontingen ini.", "Data Kosong", "info");
            return;
        }

        const batchSize = 500;
        for (let i = 0; i < toDelete.length; i += batchSize) {
            const batch = writeBatch(db);
            toDelete.slice(i, i + batchSize).forEach(docSnap => {
                batch.delete(doc(db, `events/${eventId}/athletes`, docSnap.id));
            });
            await batch.commit();
            updateProgress(Math.round(((i + batchSize) / toDelete.length) * 100));
        }

        await customAlert(`Berhasil menghapus ${toDelete.length} data atlet dari kontingen ${teamName}.`, "Data Terhapus", "info");
    } catch (err) {
        console.error("Delete Contingent Athletes Error:", err);
        await customAlert("Gagal menghapus data: " + err.message, "Gagal", "danger");
    } finally {
        hideProgress();
    }
};


export const editContingentName = (oldName) => {
    const oldValueEl = document.getElementById('edit-contingent-old-value');
    const oldNameLabel = document.getElementById('edit-contingent-old-name-label');
    const newNameInput = document.getElementById('edit-contingent-new-name');

    if (oldValueEl) oldValueEl.value = oldName;
    if (oldNameLabel) oldNameLabel.innerText = `MENGUBAH: ${oldName.toUpperCase()}`;
    if (newNameInput) {
        newNameInput.value = oldName;
        setTimeout(() => newNameInput.focus(), 300);
    }

    toggleModal('modal-edit-contingent', true);
};

export const saveContingentNameEdit = async (eventId) => {
    const oldName = document.getElementById('edit-contingent-old-value')?.value || '';
    const newName = document.getElementById('edit-contingent-new-name')?.value.trim().toUpperCase() || '';

    if (!newName || newName === oldName.toUpperCase()) {
        toggleModal('modal-edit-contingent', false);
        return;
    }

    const confirmed = await customConfirm({
        title: "Ubah Nama Kontingen",
        message: `Ubah "${oldName}" menjadi "${newName}" untuk SEMUA atlet terkait? Tindakan ini akan mengupdate database secara massal.`,
        confirmText: "Ya, Update Semua",
        type: 'info'
    });

    if (!confirmed) return;

    toggleModal('modal-edit-contingent', false);
    showProgress(`MENGUPDATE KONTINGEN`, 0);

    try {
        const athletesRef = collection(db, `events/${eventId}/athletes`);
        // Use query with where to be more efficient if possible, but matching might be case sensitive in Firestore
        // For safety with how tracking was done (toUpperCase), we might need to get all or be precise
        const athleteSnap = await getDocs(query(athletesRef, where("team", "==", oldName.toUpperCase())));

        if (athleteSnap.empty) {
            // Fallback: check if it's case insensitive or mixed
            const allSnap = await getDocs(athletesRef);
            const matches = allSnap.docs.filter(d => (d.data().team || "").toUpperCase() === oldName.toUpperCase());

            if (matches.length === 0) {
                await customAlert("Tidak ada atlet yang ditemukan untuk kontingen ini.", "Data Tidak Ditemukan", "info");
                return;
            }

            await processUpdates(matches, newName, eventId);
        } else {
            await processUpdates(athleteSnap.docs, newName, eventId);
        }

        customAlert(`Berhasil memperbarui data atlet!`, "Berhasil", "info");
    } catch (err) {
        console.error("Edit Contingent Name Error:", err);
        await customAlert("Gagal mengubah nama kontingen: " + err.message, "Gagal Update", "danger");
    } finally {
        hideProgress();
    }
};

const processUpdates = async (docs, newName, eventId) => {
    const total = docs.length;
    const batchSize = 500;
    for (let i = 0; i < total; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach(docSnap => {
            batch.update(doc(db, `events/${eventId}/athletes`, docSnap.id), {
                team: newName
            });
        });
        await batch.commit();
        updateProgress(Math.min(i + batchSize, total), total);
    }
};
