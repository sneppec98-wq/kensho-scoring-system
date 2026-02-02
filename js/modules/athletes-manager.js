// Athletes Data Manager
import { showProgress, updateProgress, hideProgress, toggleModal, customConfirm, customAlert } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

    // Filter by sub-tab
    const filtered = athletes.filter(a => {
        const classInfo = findClassInfo(a);
        if (!classInfo) return currentAthleteSubTab === 'OPEN';

        if (currentAthleteSubTab === 'BEREGU') {
            return classInfo.type === 'BEREGU';
        }

        const isFestival = (classInfo.code || classInfo.id || "").toString().toUpperCase().startsWith('F');

        if (currentAthleteSubTab === 'FESTIVAL') return isFestival;
        if (currentAthleteSubTab === 'OPEN') return !isFestival;

        return false;
    });

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

    tableBody.innerHTML = filtered.map(athlete => `
        <tr class="row-hover border-b border-white/5 group">
            <td class="p-4">
                <div class="font-bold text-white text-lg">${athlete.name}</div>
                ${athlete.name2 || athlete.name3 ?
            `<div class="text-[10px] opacity-40 font-bold mt-1 uppercase">👥 TIM: ${[athlete.name, athlete.name2, athlete.name3].filter(n => n).join(' & ')}</div>` :
            (athlete.members && athlete.members.length > 0 ?
                `<div class="text-[10px] opacity-40 font-bold mt-1 uppercase">👥 TIM: ${athlete.members.join(' & ')}</div>` : '')}
            </td>
            <td class="p-4 opacity-70 text-sm font-bold">${athlete.team || '-'}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded text-[9px] font-black ${athlete.gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
        }">
                    ${athlete.gender}
                </span>
            </td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-[9px] font-black text-blue-500 mb-1 tracking-widest">
                        ${athlete.classCode || findClassInfo(athlete)?.code || 'ERR'}
                    </span>
                    <span class="text-xs font-bold text-slate-200">${athlete.className || findClassInfo(athlete)?.name || '-'}</span>
                </div>
            </td>
            <td class="p-4 font-bold text-yellow-400">${athlete.weight || '-'} kg</td>
            <td class="p-4">
                <div class="flex items-center space-x-2">
                    <button onclick="editAthlete('${athlete.id}')" 
                        class="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onclick="deleteAthlete('${athlete.id}')" 
                        class="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
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
    let html = '';

    actualTeams.forEach((name, idx) => {
        const matchedAthletes = athletes.filter(a => (a.team || "").trim().toUpperCase() === name);
        submittedCount++;

        html += `
            <tr class="row-hover border-b border-white/5 bg-white/5">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-[8px] opacity-20 font-black">#${(idx + 1).toString().padStart(2, '0')}</span>
                    </div>
                </td>
                <td class="p-4 font-black italic text-slate-200 text-sm uppercase">${name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center">
                        <span class="px-4 py-1.5 rounded-full text-[10px] font-black bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]">AKTIF ✅</span>
                    </div>
                </td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center space-x-3">
                        <span class="text-blue-400 font-black text-2xl italic tracking-tighter">
                            ${matchedAthletes.length} <span class="text-[10px] uppercase not-italic opacity-40 ml-1">Atlet</span>
                        </span>
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
        html = `<tr><td colspan="4" class="p-20 text-center opacity-30 italic font-black uppercase tracking-widest text-xs">Belum ada data kontingen yang terdeteksi</td></tr>`;
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
        alert("Atlet tidak ditemukan.");
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
        alert("Kode Kelas wajib diisi!");
        return;
    }

    const targetClass = latestClasses.find(c => (c.code || "").toString().trim().toUpperCase() === classCode);
    if (!targetClass) {
        alert("Kode kelas tidak valid!");
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
        alert("Gagal menyimpan: " + err.message);
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
        alert("Kode kelas tidak valid! Data tidak disimpan.");
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
        alert("Gagal memperbarui data: " + err.message);
    }
};

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
            alert("❌ Gagal menghapus data: " + err.message);

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

        alert(`Berhasil membersihkan ${athleteSnap.size} data pendaftaran dan seluruh bagan!`);
    } catch (err) {
        console.error("Delete All Athletes/Brackets Error:", err);
        alert("Gagal membersihkan database: " + err.message);
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
            alert("Tidak ada data yang ditemukan untuk kontingen ini.");
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

        alert(`Berhasil menghapus ${toDelete.length} data atlet dari kontingen ${teamName}.`);
    } catch (err) {
        console.error("Delete Contingent Athletes Error:", err);
        alert("Gagal menghapus data: " + err.message);
    } finally {
        hideProgress();
    }
};

