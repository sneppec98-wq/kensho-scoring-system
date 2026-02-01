// Classes Data Manager
import { showProgress, updateProgress, hideProgress, toggleModal } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const renderClassesData = async (classes, allAthletes, currentSubTab = 'OPEN', eventId) => {
    const tableBody = document.getElementById('classes-table-body');
    const classCountLabel = document.getElementById('countKelas');
    const athleteClassSelect = document.getElementById('athleteClass');
    const bracketListArea = document.querySelector('#tab-bracket .grid');

    if (!tableBody) return;

    // Update Dropdown
    if (athleteClassSelect) {
        const currentVal = athleteClassSelect.value;
        athleteClassSelect.innerHTML = '<option value="">Pilih Kelas...</option>';
        classes.forEach(c => {
            athleteClassSelect.innerHTML += `<option value="${c.name}" ${c.name === currentVal ? 'selected' : ''}>${c.name}</option>`;
        });
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
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Render Brackets Cards or Festival Table
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
                    const tatamiLabel = scheduleEntry ? `<div class="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black tracking-widest uppercase mb-4 w-fit">TATAMI ${scheduleEntry.arena}</div>` : '';

                    try {
                        const bracketDoc = await getDoc(doc(db, `events/${eventId}/brackets`, data.name));
                        if (bracketDoc.exists() && bracketDoc.data().status === 'complete') {
                            const savedCount = bracketDoc.data().athleteCount || 0;
                            const isRevised = athleteCount !== savedCount;

                            if (isRevised) {
                                const diff = athleteCount - savedCount;
                                const diffText = diff > 0 ? `+ ${diff} ATLET BARU` : `${diff} ATLET DIHAPUS`;
                                statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30">⚠️ REVISI</span>`;
                                statusReason = `<p class="text-[8px] text-red-400/60 mt-1 uppercase font-black">${diffText}</p>`;
                            } else {
                                statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 border border-green-500/30">✅ OK</span>`;
                                statusReason = `<p class="text-[8px] text-green-400/60 mt-1 uppercase">BAGAN SELESAI</p>`;
                            }
                        } else {
                            statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ PENDING</span>`;
                            statusReason = `<p class="text-[8px] text-orange-400/60 mt-1 italic">Bagan belum dibuat</p>`;
                        }
                    } catch (err) {
                        statusBadge = `<span class="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">⏳ ERR</span>`;
                    }

                    const card = `
                        <div class="bg-slate-800/20 p-8 rounded-[2rem] border border-white/5 group hover:border-blue-500/30 transition-all relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 text-[120px] font-black italic opacity-[0.03] pointer-events-none select-none">${(athleteCount).toString().padStart(2, '0')}</div>
                            <div class="flex justify-between items-start mb-6">
                                <div class="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-blue-500">
                                    <span class="text-[10px] font-black">${athleteCount} ATLET</span>
                                </div>
                                <span class="text-[9px] font-black uppercase text-blue-500/40 tracking-[0.2em]">${data.gender}</span>
                            </div>
                            ${tatamiLabel}
                            <div class="flex items-start justify-between mb-2">
                                <h4 class="text-lg font-black italic uppercase text-slate-100 leading-tight flex-1">
                                    <span class="block text-[10px] text-blue-400 not-italic tracking-[0.2em] mb-1">${data.code || 'CODE-PENDING'}</span>
                                    ${data.name}
                                </h4>
                                <div class="text-right">${statusBadge}${statusReason}</div>
                            </div>
                            <p class="text-[9px] font-bold opacity-30 uppercase tracking-widest mb-6">${data.ageCategory}</p>
                            <div class="flex gap-2">
                                <a href="event-bracket.html?id=${eventId}&classId=${data.code}&class=${encodeURIComponent(data.name)}" class="flex-1 py-4 rounded-xl bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-3">
                                    BUAT / BUKA BAGAN
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
    if (confirm(`Yakin ingin menghapus kelas "${classCode}"?`)) {
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
    if (!confirm("⚠️ PERINGATAN: Anda akan menghapus SELURUH KELAS TANDING dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.\\n\\nLanjutkan?")) return;

    const password = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan total:");
    if (password !== 'HAPUS') {
        alert("Konfirmasi gagal. Penghapusan dibatalkan.");
        return;
    }

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

