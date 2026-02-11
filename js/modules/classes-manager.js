import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "../firebase-init.js";

const PAGE_SIZE = 10;
window.bracketCurrentPage = 1;

let lastClassesRef = [];
let lastAthletesRef = [];
let lastBracketsRef = [];
let lastSubTabRef = 'OPEN';
let lastEventIdRef = '';

window.changeBracketPage = (delta) => {
    window.bracketCurrentPage += delta;
    renderClassesData(lastClassesRef, lastAthletesRef, lastBracketsRef, lastSubTabRef, lastEventIdRef);
};

export const renderClassesData = async (classes, allAthletes, brackets, currentSubTab = 'OPEN', eventId) => {
    const tableBody = document.getElementById('classes-table-body');
    const classCountLabel = document.getElementById('countKelas');
    const bracketListArea = document.getElementById('bracket-cards-container');

    if (!tableBody) return;

    // Handle MAPPING Sub-tab Visibility Early
    const cardsContainer = document.getElementById('bracket-cards-container');
    const mappingContainer = document.getElementById('bracket-mapping-container');
    const publicAccessContainer = document.getElementById('bracket-public-access-container');

    if (currentSubTab === 'MAPPING') {
        if (cardsContainer) cardsContainer.classList.add('hidden');
        if (publicAccessContainer) publicAccessContainer.classList.add('hidden');
        if (mappingContainer) mappingContainer.classList.remove('hidden');
        if (classCountLabel) classCountLabel.innerText = 'MODE MAPPING';
        renderMasterMappingTable(brackets, classes);
        return;
    } else {
        if (cardsContainer) cardsContainer.classList.remove('hidden');
        if (publicAccessContainer) publicAccessContainer.classList.remove('hidden');
        if (mappingContainer) mappingContainer.classList.add('hidden');
    }

    if (!classes || classes.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-12 opacity-40">BELUM ADA KELAS</td></tr>`;
        if (classCountLabel) classCountLabel.innerText = '0 Kelas';
        return;
    }

    // Filter by sub-tab
    let filtered = classes.filter(cls => {
        if (currentSubTab === 'BEREGU') return cls.type === 'BEREGU';
        const isFestival = (cls.code || "").toString().toUpperCase().startsWith('F');
        const isPerorangan = cls.type === 'PERORANGAN' || !cls.type;
        if (currentSubTab === 'FESTIVAL') return isFestival && isPerorangan;
        if (currentSubTab === 'OPEN') return !isFestival && isPerorangan;
        return false;
    });

    // Sorting
    filtered.sort((a, b) => {
        const codeA = (a.code || "").toString().toUpperCase();
        const codeB = (b.code || "").toString().toUpperCase();
        if (codeA.startsWith('F') && codeB.startsWith('F')) {
            const numA = parseInt(codeA.substring(1)) || 0;
            const numB = parseInt(codeB.substring(1)) || 0;
            return numA - numB;
        }
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Calculate active classes for the label
    const activeClassesCount = classes.filter(cls => {
        const isFestival = (cls.code || "").toString().toUpperCase().startsWith('F');
        const isPerorangan = cls.type === 'PERORANGAN' || !cls.type;
        const isOpen = !isFestival && isPerorangan;
        return (isFestival || isOpen) && allAthletes.some(a => a.className === cls.name);
    }).length;

    if (classCountLabel) classCountLabel.innerText = `${activeClassesCount} KELAS AKTIF`;

    // Render Classes Table
    tableBody.innerHTML = filtered.map(cls => `
        <tr class="row-hover border-b border-white/5 group">
            <td class="p-4 font-black text-blue-400 text-sm">${cls.code}</td>
            <td class="p-4 text-white font-bold">${cls.name}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded text-[9px] font-black ${cls.type === 'BEREGU' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}">
                    ${cls.type || 'PERORANGAN'}
                </span>
            </td>
            <td class="p-4 opacity-70 text-xs">${cls.ageCategory || '-'}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded text-[9px] font-bold ${cls.gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}">
                    ${cls.gender}
                </span>
            </td>
            <td class="p-4 text-center opacity-70 text-xs">${cls.ageMin || 0} - ${cls.ageMax || 99} Thn</td>
            <td class="p-4 text-center opacity-70 text-xs">${cls.weightMin || 0} - ${cls.weightMax || 999} Kg</td>
            <td class="p-4">
                <button onclick="deleteClass('${cls.code}')" class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
    `).join('');

    if (bracketListArea) {
        lastClassesRef = classes;
        lastAthletesRef = allAthletes;
        lastBracketsRef = brackets;
        lastSubTabRef = currentSubTab;
        lastEventIdRef = eventId;

        if (filtered.length === 0) {
            bracketListArea.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">Belum ada data ${currentSubTab}</div>`;
        } else {
            // Batch load all brackets and schedule
            let scheduleData = [];
            let allBracketsMap = {};
            try {
                const scheduleSnap = await getDoc(doc(db, `events/${eventId}/metadata`, 'schedule'));
                if (scheduleSnap.exists()) scheduleData = scheduleSnap.data().schedule || [];

                const { getBrackets } = await import('./firestore-listeners.js');
                const allBrackets = await getBrackets(db, eventId);
                allBrackets.forEach(b => allBracketsMap[b.class || b.id] = b);
            } catch (err) { console.warn("Bracket init error:", err); }

            // Festival Global Action
            let globalActions = "";
            if (currentSubTab === 'FESTIVAL') {
                globalActions = `
                    <div class="col-span-full mb-8 flex justify-between items-center no-print bg-slate-800/20 p-6 rounded-[2rem] border border-white/5">
                        <div>
                            <h3 class="text-xl font-black italic uppercase text-slate-200">Bagan Head-to-Head Festival</h3>
                            <p class="text-[9px] font-black uppercase tracking-widest text-blue-500 opacity-40 mt-1">Cetak seluruh kelas festival yang sudah disimpan</p>
                        </div>
                        <button onclick="window.handlePrintFestivalBracket()" class="neu-button px-8 py-4 rounded-2xl flex items-center space-x-4 text-blue-400 font-black text-[10px] tracking-widest uppercase hover:bg-blue-600 hover:text-white transition-all shadow-xl">
                             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                             <span>CETAK SEMUA BAGAN FESTIVAL</span>
                        </button>
                    </div>
                `;
            }

            // Prepare card data
            const cardsData = filtered.map(data => {
                const bracketData = allBracketsMap[data.name];
                const athleteCount = allAthletes.filter(a =>
                    (a.classCode === data.code) || (a.className.trim().toUpperCase() === data.name.trim().toUpperCase())
                ).length;

                return {
                    data, athleteCount,
                    hasParticipants: athleteCount > 0,
                    isComplete: bracketData && bracketData.status === 'complete' && bracketData.athleteCount === athleteCount,
                    bracketData
                };
            }).filter(c => c.hasParticipants); // Filter early to simplify sorting

            // Smart Sorting: Pending/Revisi (isComplete: false) FIRST
            cardsData.sort((a, b) => {
                if (a.isComplete !== b.isComplete) {
                    return a.isComplete ? 1 : -1; // false comes before true
                }
                // Secondary sort by code/name
                return (a.data.code || "").localeCompare(b.data.code || "", undefined, { numeric: true });
            });

            // Calculate Global Status Indicator
            const totalBracketsCount = cardsData.length;
            const completedBracketsCount = cardsData.filter(c => c.isComplete).length;
            const needsEditCount = totalBracketsCount - completedBracketsCount;

            const statusLabel = document.getElementById('bracketStatusLabel');
            if (statusLabel) {
                statusLabel.innerText = `BAGAN PERLU DIEDIT / TOTAL: (${needsEditCount.toString().padStart(2, '0')}/${totalBracketsCount.toString().padStart(2, '0')})`;
                statusLabel.className = `text-[10px] font-black uppercase tracking-widest mr-4 ${needsEditCount > 0 ? 'text-orange-500' : 'text-emerald-500'}`;
            }

            // Generate Cards HTML
            const cardsHtml = cardsData.map(({ data, athleteCount, isComplete, bracketData, hasParticipants }) => {
                if (!hasParticipants) return '';

                let statusBadge = '';
                let statusReason = '';

                const scheduleEntry = scheduleData.find(e => e.classes && e.classes.some(cls => (cls.code === data.code || cls.name === data.name)));
                const tatamiLabel = scheduleEntry ? `<div class="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black tracking-widest uppercase w-fit">TATAMI ${scheduleEntry.arena}</div>` : '';

                if (isComplete) {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✅ OK</span>`;
                    statusReason = `<p class="text-[8px] text-emerald-400 mt-1 uppercase font-black">BAGAN SELESAI</p>`;
                } else if (bracketData && bracketData.status === 'complete') {
                    const diff = athleteCount - (bracketData.athleteCount || 0);
                    const diffText = diff > 0 ? `+ ${diff} ATLET BARU` : `${diff} ATLET DIHAPUS`;
                    statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30">⚠️ REVISI</span>`;
                    statusReason = `<p class="text-[8px] text-red-400 mt-1 uppercase font-black">${diffText}</p>`;
                } else {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ PENDING</span>`;
                    statusReason = `<p class="text-[8px] text-orange-400/60 mt-1 italic font-bold">BELUM DIBUAT</p>`;
                }

                return `
                    <div class="bg-slate-900/50 rounded-[2rem] border border-white/5 p-6 group hover:border-blue-500/30 transition-all flex flex-col h-full shadow-lg">
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${tatamiLabel}
                            <div class="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg">${athleteCount} ATLET</div>
                            <div class="ml-auto">${statusBadge}</div>
                        </div>
                        <div class="flex-1 mb-6">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">#${data.code || 'PENDING'}</span>
                                <span class="text-[9px] font-black text-slate-600 uppercase tracking-widest">&bull;</span>
                                <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${data.gender}</span>
                            </div>
                            <h4 class="text-base font-black uppercase text-white leading-tight tracking-tight group-hover:text-blue-400 transition-colors">${data.name}</h4>
                            <div class="flex items-center gap-2 mt-2 opacity-40">
                                <svg class="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
                                <p class="text-[9px] font-black uppercase tracking-widest text-slate-300 line-clamp-1">${data.ageCategory}</p>
                            </div>
                            ${statusReason}
                        </div>
                        <a href="event-bracket.html?id=${eventId}&classId=${data.code}&class=${encodeURIComponent(data.name)}" 
                           class="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:border-blue-500 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                            <span>BUAT / BUKA BAGAN</span>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        </a>
                    </div>
                `;
            }).filter(h => h !== '');

            // Pagination UI Refresh
            const totalItems = cardsHtml.length;
            const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
            if (window.bracketCurrentPage > totalPages) window.bracketCurrentPage = totalPages;
            if (window.bracketCurrentPage < 1) window.bracketCurrentPage = 1;

            const startIdx = (window.bracketCurrentPage - 1) * PAGE_SIZE;
            const endIdx = Math.min(startIdx + PAGE_SIZE, totalItems);
            const pagedHtml = cardsHtml.slice(startIdx, endIdx);

            const paginationContainer = document.getElementById('bracketPaginationControls');
            const pageInfoLabel = document.getElementById('bracketPageInfo');
            const currentPageSpan = document.getElementById('bracketCurrentPage');
            const totalPagesSpan = document.getElementById('bracketTotalPages');
            const prevButton = document.getElementById('bracketPrevBtn');
            const nextButton = document.getElementById('bracketNextBtn');

            if (paginationContainer) paginationContainer.classList.toggle('hidden', totalItems <= PAGE_SIZE);
            if (pageInfoLabel) pageInfoLabel.innerText = `Menampilkan ${totalItems === 0 ? 0 : startIdx + 1} - ${endIdx} dari ${totalItems} kelas`;
            if (currentPageSpan) currentPageSpan.innerText = window.bracketCurrentPage;
            if (totalPagesSpan) totalPagesSpan.innerText = totalPages;
            if (prevButton) prevButton.disabled = window.bracketCurrentPage <= 1;
            if (nextButton) nextButton.disabled = window.bracketCurrentPage >= totalPages;

            bracketListArea.innerHTML = globalActions + pagedHtml.join('');
        }
    }
};

async function renderMasterMappingTable(brackets, classes = []) {
    const tbody = document.getElementById('masterMappingTableBody');
    if (!tbody) return;

    if (!brackets || brackets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-20 text-center opacity-30 italic">Belum ada data bagan yang disimpan.</td></tr>';
        hideMappingPagination();
        return;
    }

    let html = '';
    const allBracketsData = [];

    try {
        brackets.forEach(bracket => {
            const data = bracket.data || {};
            const className = bracket.class || bracket.classCode || 'Unknown';
            const classCode = bracket.classCode;

            const classInfo = classes.find(c => c.name === className || c.code === classCode);
            const bracketData = data;

            // DEBUG: Log all slot IDs to see what's actually in the data
            console.log(`[MAPPING DEBUG] Class: ${className}, Slot IDs:`, Object.keys(bracketData).filter(k => k.includes('_n_')));

            // Extract only athlete names from all slot formats (s_n_, q_n_, f_n_, p_n_)
            Object.keys(bracketData).forEach(slotId => {
                // Match current format with underscores: s_n_1, q_n_1, f_n_1, p_n_1
                if (slotId.match(/^(s_n_|q_n_|f_n_|p_n_)\d+$/)) {
                    const name = bracketData[slotId];
                    // Look for corresponding team slot (replace _n_ with _k_)
                    const teamSlotId = slotId.replace('_n_', '_k_');
                    const team = bracketData[teamSlotId] || '-';

                    // Use class code as prefix (e.g. 001_sn1)
                    const uniqueId = classInfo ? `${classInfo.code}_${slotId}` : slotId;

                    allBracketsData.push({
                        classCode: classInfo ? classInfo.code : 'ZZZ',
                        className,
                        slotId: uniqueId,
                        name,
                        team
                    });
                }
            });
        });

        if (allBracketsData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-20 text-center opacity-30 italic">Bagan ditemukan tapi tidak berisi data atlet.</td></tr>';
            hideMappingPagination();
            return;
        }

        // Sort by Class Code then Slot ID (Correctly handles 001 -> ... -> F40)
        allBracketsData.sort((a, b) => {
            const codeA = (a.classCode || "").toString();
            const codeB = (b.classCode || "").toString();

            // Numeric comparison for codes like 001, 002
            const codeSort = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            if (codeSort !== 0) return codeSort;

            return a.slotId.localeCompare(b.slotId, undefined, { numeric: true });
        });

        // Store for export and pagination
        window.latestMasterMappingData = allBracketsData;

        // Pagination logic
        const itemsPerPage = 10;
        const totalPages = Math.ceil(allBracketsData.length / itemsPerPage);

        // Initialize or maintain current page - prevent NaN
        if (typeof window.mappingCurrentPage !== 'number' || isNaN(window.mappingCurrentPage) || window.mappingCurrentPage < 1 || window.mappingCurrentPage > totalPages) {
            window.mappingCurrentPage = 1;
        }

        const startIndex = (window.mappingCurrentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, allBracketsData.length);
        const pageData = allBracketsData.slice(startIndex, endIndex);

        pageData.forEach(row => {
            html += `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="px-6 py-4 text-blue-400 font-black text-[10px]">${row.className}</td>
                    <td class="px-6 py-4 font-mono text-indigo-400">${row.slotId}</td>
                    <td class="px-6 py-4">${row.name}</td>
                    <td class="px-6 py-4 text-slate-500">${row.team}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        // Update pagination UI
        updateMappingPaginationUI(window.mappingCurrentPage, totalPages, startIndex + 1, endIndex, allBracketsData.length);
    } catch (err) {
        console.error("Render Master Mapping Error:", err);
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-20 text-center text-red-400 italic">Gagal memproses data: ' + err.message + '</td></tr>';
        hideMappingPagination();
    }
}

function updateMappingPaginationUI(currentPage, totalPages, startItem, endItem, totalItems) {
    const paginationContainer = document.getElementById('mappingPaginationControls');
    const pageInfo = document.getElementById('mappingPageInfo');
    const currentPageSpan = document.getElementById('mappingCurrentPage');
    const totalPagesSpan = document.getElementById('mappingTotalPages');
    const prevBtn = document.getElementById('mappingPrevBtn');
    const nextBtn = document.getElementById('mappingNextBtn');

    if (paginationContainer) paginationContainer.classList.remove('hidden');
    if (pageInfo) pageInfo.textContent = `Menampilkan ${startItem} - ${endItem} dari ${totalItems} data`;
    if (currentPageSpan) currentPageSpan.textContent = currentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function hideMappingPagination() {
    const paginationContainer = document.getElementById('mappingPaginationControls');
    if (paginationContainer) paginationContainer.classList.add('hidden');
}

window.changeMappingPage = (direction) => {
    if (!window.latestMasterMappingData) return;

    const itemsPerPage = 10;
    const totalPages = Math.ceil(window.latestMasterMappingData.length / itemsPerPage);

    window.mappingCurrentPage = Math.max(1, Math.min(window.mappingCurrentPage + direction, totalPages));

    // Re-render with new page
    const tbody = document.getElementById('masterMappingTableBody');
    if (!tbody) return;

    const startIndex = (window.mappingCurrentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, window.latestMasterMappingData.length);
    const pageData = window.latestMasterMappingData.slice(startIndex, endIndex);

    let html = '';
    pageData.forEach(row => {
        html += `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 text-blue-400 font-black text-[10px]">${row.className}</td>
                <td class="px-6 py-4 font-mono text-indigo-400">${row.slotId}</td>
                <td class="px-6 py-4">${row.name}</td>
                <td class="px-6 py-4 text-slate-500">${row.team}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    updateMappingPaginationUI(window.mappingCurrentPage, totalPages, startIndex + 1, endIndex, window.latestMasterMappingData.length);
};


window.exportAllMappingToExcel = async () => {
    if (!window.latestMasterMappingData || window.latestMasterMappingData.length === 0) {
        await customAlert("Data mapping tidak tersedia atau masih kosong.", "Data Kosong", "info");
        return;
    }

    const data = window.latestMasterMappingData.map(row => ({
        "Kategori / Kelas": row.className,
        "ID Sel Excel": row.slotId,
        "Nama Peserta": row.name,
        "Kontingen": row.team
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Mapping");

    const fileName = `Master_Mapping_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

export const addNewClass = async (eventId) => {
    const code = document.getElementById('new-class-code').value.toUpperCase().trim();
    const name = document.getElementById('new-class-name').value.toUpperCase().trim();
    const type = document.getElementById('new-class-type').value;
    const ageCategory = document.getElementById('new-class-ageCategory').value.trim();
    const gender = document.getElementById('new-class-gender').value;
    const ageMin = document.getElementById('new-class-ageMin').value || 0;
    const ageMax = document.getElementById('new-class-ageMax').value || 99;
    const weightMin = document.getElementById('new-class-weightMin').value || 0;
    const weightMax = document.getElementById('new-class-weightMax').value || 999;

    if (!code || !name) {
        await customAlert("Kode dan Nama Kelas wajib diisi!", "Validasi Gagal", "danger");
        return;
    }

    const classData = {
        code, name, type, ageCategory, gender,
        ageMin: parseInt(ageMin),
        ageMax: parseInt(ageMax),
        weightMin: parseFloat(weightMin),
        weightMax: parseFloat(weightMax)
    };

    try {
        await setDoc(doc(db, `events/${eventId}/classes`, code), classData);
        await customAlert(`Kelas "${name}" berhasil ditambahkan!`, "Berhasil", "info");
        toggleModal('modal-add-class', false);

        // Reset form
        document.getElementById('new-class-code').value = '';
        document.getElementById('new-class-name').value = '';
        document.getElementById('new-class-ageCategory').value = '';
        document.getElementById('new-class-ageMin').value = '';
        document.getElementById('new-class-ageMax').value = '';
        document.getElementById('new-class-weightMin').value = '';
        document.getElementById('new-class-weightMax').value = '';
    } catch (err) {
        console.error("Add Class Error:", err);
        await customAlert("Gagal menambahkan kelas: " + err.message, "Gagal", "danger");
    }
};

export const deleteClass = async (classCode, eventId) => {
    const ok = await customConfirm({
        title: "Hapus Kelas",
        message: `Yakin ingin menghapus kelas "${classCode}"? Semua bagan terkait juga akan dihapus.`,
        confirmText: "Hapus Kelas"
    });

    if (ok) {
        try {
            // 1. Get class name first (brackets are keyed by name)
            const classRef = doc(db, `events/${eventId}/classes`, classCode);
            const classSnap = await getDoc(classRef);

            if (classSnap.exists()) {
                const className = classSnap.data().name;
                // 2. Delete Bracket if exists (using both classCode and legacy className)
                await deleteDoc(doc(db, `events/${eventId}/brackets`, classCode));
                await deleteDoc(doc(db, `events/${eventId}/brackets`, className));
            }

            // 3. Delete Class
            await deleteDoc(classRef);
            await customAlert("Kelas dan bagan terkait berhasil dihapus!", "Terhapus", "info");
        } catch (err) {
            console.error("Delete Class Error:", err);
            await customAlert("Gagal menghapus kelas: " + err.message, "Hapus Gagal", "danger");
        }
    }
};

export const deleteAllClasses = async (eventId) => {
    const ok = await customConfirm({
        title: "Hapus Seluruh Kelas",
        message: "⚠️ PERINGATAN: Anda akan menghapus SELURUH KELAS TANDING dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.",
        confirmText: "Hapus Semua Kelas",
        promptWord: "HAPUS"
    });

    if (!ok) return;

    showProgress('MEMBERSIHKAN DATA KELAS', 0);
    try {
        const classSnap = await getDocs(collection(db, `events/${eventId}/classes`));
        if (!classSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < classSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                classSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/classes`, docSnap.id));
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

        await customAlert(`Berhasil membersihkan ${classSnap.size} kelas dan seluruh bagan!`, "Pembersihan Selesai", "info");
    } catch (err) {
        console.error("Delete All Classes/Brackets Error:", err);
        await customAlert("Gagal membersihkan database: " + err.message, "Gagal", "danger");
    } finally {
        hideProgress();
    }
};

export const editClassName = (code, oldName) => {
    const codeEl = document.getElementById('edit-class-code');
    const labelEl = document.getElementById('edit-class-old-name-label');
    const nameInput = document.getElementById('edit-class-new-name');

    if (codeEl) codeEl.value = code;
    if (labelEl) labelEl.innerText = `MENGUBAH: ${oldName.toUpperCase()}`;
    if (nameInput) {
        nameInput.value = oldName;
        setTimeout(() => nameInput.focus(), 300);
    }

    import('./ui-helpers.js').then(m => m.toggleModal('modal-edit-class-name', true));
};

export const saveClassNameEdit = async (eventId) => {
    const classCode = document.getElementById('edit-class-code')?.value || '';
    const newName = document.getElementById('edit-class-new-name')?.value.trim().toUpperCase() || '';

    if (!newName) return;

    const { customConfirm, customAlert, toggleModal, showProgress, hideProgress, updateProgress } = await import('./ui-helpers.js');

    const confirmed = await customConfirm({
        title: "Ubah Nama Kelas",
        message: `Ubah nama kelas menjadi "${newName}"? Sistem akan mengupdate nama kelas pada seluruh database atlet dan bagan terkait secara otomatis.`,
        confirmText: "Ya, Update Nama",
        type: 'info'
    });

    if (!confirmed) return;

    toggleModal('modal-edit-class-name', false);
    showProgress(`MENGUPDATE NAMA KELAS`, 0);

    try {
        // 1. Get current class data to get the old name
        const classRef = doc(db, `events/${eventId}/classes`, classCode);
        const classSnap = await getDoc(classRef);
        if (!classSnap.exists()) throw new Error("Kelas tidak ditemukan.");

        const oldName = classSnap.data().name;

        // 2. Update Class Document
        await updateDoc(classRef, { name: newName });

        // 3. Update Athletes (Mass Update)
        const athletesRef = collection(db, `events/${eventId}/athletes`);
        const athleteSnap = await getDocs(query(athletesRef, where("classCode", "==", classCode)));

        if (!athleteSnap.empty) {
            const batchSize = 500;
            const docs = athleteSnap.docs;
            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(db);
                docs.slice(i, i + batchSize).forEach(d => {
                    batch.update(d.ref, { className: newName });
                });
                await batch.commit();
                updateProgress(Math.round(((i + batchSize) / docs.length) * 50)); // Progress up to 50%
            }
        }

        // 4. Update Brackets (Handle logic migration)
        updateProgress(60);
        const bracketRef = doc(db, `events/${eventId}/brackets`, classCode);
        const bracketSnap = await getDoc(bracketRef);

        if (bracketSnap.exists()) {
            await updateDoc(bracketRef, { class: newName });
        } else {
            // Check legacy bracket keyed by NAME
            const legacyRef = doc(db, `events/${eventId}/brackets`, oldName);
            const legacySnap = await getDoc(legacyRef);
            if (legacySnap.exists()) {
                const legacyData = legacySnap.data();
                await setDoc(bracketRef, { ...legacyData, class: newName, classCode: classCode });
                await deleteDoc(legacyRef);
            }
        }
        updateProgress(90);

        await customAlert("Nama kelas dan data terkait berhasil diperbarui!", "Update Berhasil", "info");

        // Refresh UI if possible
        if (typeof window.refreshEventData === 'function') {
            await window.refreshEventData();
        }

    } catch (err) {
        console.error("Save Class Name Edit Error:", err);
        await customAlert("Gagal mengupdate nama kelas: " + err.message, "Gagal", "danger");
    } finally {
        hideProgress();
    }
};


