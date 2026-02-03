// Classes Data Manager
import { showProgress, updateProgress, hideProgress, toggleModal, customConfirm } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        if (mappingContainer) {
            mappingContainer.classList.remove('hidden');
            renderMasterMappingTable(brackets, classes);
        }
        if (classCountLabel) classCountLabel.innerText = 'MODE MAPPING';
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
        if (currentSubTab === 'BEREGU') {
            return cls.type === 'BEREGU';
        }
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

    // Calculate Active Classes (Open + Festival with participants)
    const activeClassesCount = classes.filter(cls => {
        const isFestival = (cls.code || "").toString().toUpperCase().startsWith('F');
        const isPerorangan = cls.type === 'PERORANGAN' || !cls.type;
        const isOpen = !isFestival && isPerorangan;

        if (isFestival || isOpen) {
            return allAthletes.some(a => a.className === cls.name);
        }
        return false;
    }).length;

    if (classCountLabel) {
        classCountLabel.innerText = `${activeClassesCount} KELAS AKTIF`;
    }

    tableBody.innerHTML = filtered.map(cls => `
        <tr class="row-hover border-b border-white/5 group">
            <td class="p-4 font-black text-blue-400 text-sm">${cls.code}</td>
            <td class="p-4 text-white font-bold">${cls.name}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded text-[9px] font-black ${cls.type === 'BEREGU' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
        }">
                    ${cls.type || 'PERORANGAN'}
                </span>
            </td>
            <td class="p-4 opacity-70 text-xs">${cls.ageCategory || '-'}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded text-[9px] font-bold ${cls.gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
        }">
                    ${cls.gender}
                </span>
            </td>
            <td class="p-4 text-center opacity-70 text-xs">${cls.ageMin || 0} - ${cls.ageMax || 99} Thn</td>
            <td class="p-4 text-center opacity-70 text-xs">${cls.weightMin || 0} - ${cls.weightMax || 999} Kg</td>
            <td class="p-4">
                <button onclick="deleteClass('${cls.code}')" 
                    class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
            </td>
        </tr>
    `).join('');

    if (bracketListArea) {
        bracketListArea.innerHTML = '';
        if (filtered.length === 0) {
            bracketListArea.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">Belum ada data ${currentSubTab}</div>`;
        } else {
            // Load schedule data for Tatami info
            let scheduleData = [];
            try {
                const scheduleSnap = await getDoc(doc(db, `events/${eventId}/metadata`, 'schedule'));
                if (scheduleSnap.exists()) {
                    scheduleData = scheduleSnap.data().schedule || [];
                }
            } catch (err) {
                console.warn("Could not load schedule for tatami display:", err);
            }

            // Global Actions for Festival
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

            const renderPromises = filtered.map(async (data) => {
                const athleteCount = allAthletes.filter(a =>
                    (a.classCode === data.code) || (a.className.trim().toUpperCase() === data.name.trim().toUpperCase())
                ).length;

                if (athleteCount > 0) {
                    let statusBadge = '';
                    let statusReason = '';

                    // Find Tatami info from schedule using robust matching
                    const scheduleEntry = scheduleData.find(entry =>
                        entry.classes && entry.classes.some(cls => {
                            const cCode = (cls.code || "").toString().trim().toUpperCase();
                            const cName = (cls.name || "").toString().trim().toUpperCase();
                            const dCode = (data.code || "").toString().trim().toUpperCase();
                            const dName = (data.name || "").toString().trim().toUpperCase();

                            if (dCode && cCode && dCode === cCode) return true;
                            if (dName && cName && dName === cName) return true;

                            const fuzzyC = cName.replace(/[^A-Z0-9]/g, '');
                            const fuzzyD = dName.replace(/[^A-Z0-9]/g, '');
                            return fuzzyC && fuzzyD && fuzzyC === fuzzyD;
                        })
                    );
                    const tatamiLabel = scheduleEntry ? `<div class="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black tracking-widest uppercase w-fit">TATAMI ${scheduleEntry.arena}</div>` : '';

                    try {
                        const bracketDoc = await getDoc(doc(db, `events/${eventId}/brackets`, data.name));
                        if (bracketDoc.exists() && bracketDoc.data().status === 'complete') {
                            const savedCount = bracketDoc.data().athleteCount || 0;
                            const isRevised = athleteCount !== savedCount;

                            if (isRevised) {
                                const diff = athleteCount - savedCount;
                                const diffText = diff > 0 ? `+ ${diff} ATLET BARU` : `${diff} ATLET DIHAPUS`;
                                statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10">⚠️ REVISI</span>`;
                                statusReason = `<p class="text-[8px] text-red-400 mt-1 uppercase font-black">${diffText}</p>`;
                            } else {
                                statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">✅ OK</span>`;
                                statusReason = `<p class="text-[8px] text-emerald-400 mt-1 uppercase">BAGAN SELESAI</p>`;
                            }
                        } else {
                            statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10">⏳ PENDING</span>`;
                            statusReason = `<p class="text-[8px] text-orange-400/60 mt-1 italic">Bagan belum dibuat</p>`;
                        }
                    } catch (err) {
                        statusBadge = `<span class="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ ERR</span>`;
                    }

                    const card = `
                        <div class="bg-slate-800/40 p-10 rounded-[3rem] border border-white/5 group hover:border-blue-500/30 transition-all relative overflow-hidden flex flex-col h-full min-h-[420px] shadow-2xl">
                            <div class="absolute -right-8 -top-8 text-[160px] font-black italic opacity-[0.03] pointer-events-none select-none">${(athleteCount).toString().padStart(2, '0')}</div>
                            
                            <!-- Header Info -->
                            <div class="flex justify-between items-start mb-6 relative z-10 w-full">
                                <div class="flex flex-col gap-3">
                                    <div class="px-5 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 w-fit">
                                        <span class="text-[11px] font-black text-blue-400 tracking-wider">${athleteCount} ATLET</span>
                                    </div>
                                    ${tatamiLabel}
                                </div>
                                <div class="flex flex-col items-end gap-3 text-right">
                                    <span class="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">${data.gender}</span>
                                    <div>${statusBadge}</div>
                                </div>
                            </div>

                            <!-- Main Content (Centered) -->
                            <div class="flex-1 flex flex-col justify-center mb-8 relative z-10">
                                <span class="text-[11px] text-blue-500/60 font-black tracking-[0.3em] mb-3 uppercase">#${data.code || 'PENDING'}</span>
                                <h4 class="text-lg font-black italic uppercase text-white leading-[1.3] tracking-tight mb-4">
                                    ${data.name}
                                </h4>
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                    <p class="text-[10px] font-black opacity-30 uppercase tracking-widest text-slate-300">${data.ageCategory}</p>
                                </div>
                                ${statusReason}
                            </div>

                            <!-- Action Button -->
                            <div class="relative z-10 mt-auto">
                                <a href="event-bracket.html?id=${eventId}&classId=${data.code}&class=${encodeURIComponent(data.name)}" 
                                   class="w-full py-5 rounded-[1.5rem] bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-600 hover:border-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 group/btn">
                                    <span>BUAT / BUKA BAGAN</span>
                                    <svg class="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                    `;
                    return card;
                }
                return '';
            });

            const cards = await Promise.all(renderPromises);
            bracketListArea.innerHTML = globalActions + cards.join('');
        }
    }
};

async function renderMasterMappingTable(brackets, classes = []) {
    const tbody = document.getElementById('masterMappingTableBody');
    if (!tbody) return;

    if (!brackets || brackets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-20 text-center opacity-30 italic">Belum ada data bagan yang disimpan.</td></tr>';
        return;
    }

    let html = '';
    const allBracketsData = [];

    try {
        brackets.forEach(bracket => {
            const data = bracket.data || {};
            const className = bracket.class || bracket.classCode || 'Unknown';
            const classCode = bracket.classCode;

            // EXCLUDE BEREGU (Team) from Mapping Master
            const classInfo = classes.find(c => c.name === className || c.code === classCode);
            if (classInfo && classInfo.type === 'BEREGU') {
                console.log(`Skipping BEREGU class in mapping: ${className}`);
                return;
            }

            const bracketData = data;

            // Extract only athlete names (sn, qn, pn, fn slots)
            Object.keys(bracketData).forEach(slotId => {
                if (slotId.match(/^(sn|qn|fn|p_n_)\d+$/)) {
                    const name = bracketData[slotId];
                    // Look for corresponding team slot
                    const teamSlotId = slotId.replace('n', 'k').replace('p_n_', 'p_k_');
                    const team = bracketData[teamSlotId] || '-';

                    // Use class code as prefix (e.g. 001_sn1)
                    const uniqueId = classInfo ? `${classInfo.code}_${slotId}` : slotId;

                    allBracketsData.push({
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
            return;
        }

        // Sort by Class Name then Slot ID
        allBracketsData.sort((a, b) => a.className.localeCompare(b.className) || a.slotId.localeCompare(b.slotId, undefined, { numeric: true }));

        allBracketsData.forEach(row => {
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
        window.latestMasterMappingData = allBracketsData; // Store for export
    } catch (err) {
        console.error("Render Master Mapping Error:", err);
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-20 text-center text-red-400 italic">Gagal memproses data: ' + err.message + '</td></tr>';
    }
}

window.exportAllMappingToExcel = () => {
    if (!window.latestMasterMappingData || window.latestMasterMappingData.length === 0) {
        alert("Data mapping tidak tersedia atau masih kosong.");
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
        alert("Kode dan Nama Kelas wajib diisi!");
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
        alert(`Kelas "${name}" berhasil ditambahkan!`);
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
        alert("Gagal menambahkan kelas: " + err.message);
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
                // 2. Delete Bracket if exists
                await deleteDoc(doc(db, `events/${eventId}/brackets`, className));
            }

            // 3. Delete Class
            await deleteDoc(classRef);
            alert("Kelas dan bagan terkait berhasil dihapus!");
        } catch (err) {
            console.error("Delete Class Error:", err);
            alert("Gagal menghapus kelas: " + err.message);
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

        alert(`Berhasil membersihkan ${classSnap.size} kelas dan seluruh bagan!`);
    } catch (err) {
        console.error("Delete All Classes/Brackets Error:", err);
        alert("Gagal membersihkan database: " + err.message);
    } finally {
        hideProgress();
    }
};

