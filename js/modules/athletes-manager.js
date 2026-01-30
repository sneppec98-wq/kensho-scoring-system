// Athletes Data Manager
import { showProgress, updateProgress, hideProgress, toggleModal, EXPECTED_CONTINGENTS } from './ui-helpers.js';
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

    // Filter by sub-tab
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

    // Natural Sorting by Class Code
    filtered.sort((a, b) => {
        const classA = latestClasses.find(c => c.name === a.className);
        const classB = latestClasses.find(c => c.name === b.className);
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
                ${athlete.members && athlete.members.length > 0 ?
            `<div class="text-[10px] opacity-40 font-bold mt-1 uppercase">👥 TIM: ${athlete.members.join(' & ')}</div>` : ''}
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
                    <span class="text-[9px] font-black text-blue-500 mb-1 tracking-widest">${latestClasses.find(c => c.name === athlete.className)?.code || 'ERR'}</span>
                    <span class="text-xs font-bold text-slate-200">${athlete.className || '-'}</span>
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

    renderContingentTracking(athletes);
};

export const renderContingentTracking = (athletes) => {
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
            <tr class="row-hover border-b border-white/5 ${isDiscovered ? 'bg-indigo-500/5' : ''}">
                <td class="p-4">
                    <div class="flex flex-col">
                        <span class="text-[8px] opacity-20 font-black">#${(idx + 1).toString().padStart(2, '0')}</span>
                        ${isDiscovered ? '<span class="text-[7px] text-indigo-400 font-black tracking-tighter uppercase leading-none mt-1">NEW</span>' : ''}
                    </div>
                </td>
                <td class="p-4 font-black italic text-slate-200 text-sm">${name}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center">
                        ${isSubmitted ?
                `<span class="px-4 py-1.5 rounded-full text-[10px] font-black bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]">OK ✅</span>` :
                `<span class="px-4 py-1.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-500 border border-white/5 opacity-40">WAIT ⏳</span>`
            }
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="${isSubmitted ? 'text-blue-400 font-black' : 'opacity-20'} text-2xl italic tracking-tighter">
                        ${matchedAthletes.length} <span class="text-[10px] uppercase not-italic opacity-40 ml-1">Atlet</span>
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    const labelDataMasuk = document.getElementById('labelDataMasuk');
    if (labelDataMasuk) {
        labelDataMasuk.innerText = `${submittedCount} Masuk`;
    }

    if (summaryArea) {
        summaryArea.innerHTML = `
            <div class="neu-flat p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-slate-500/5 rounded-full blur-3xl group-hover:bg-slate-500/10 transition-all"></div>
                <div class="relative z-10 flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center text-slate-400 mb-6 group-hover:bg-slate-500/20 transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <p class="text-[10px] font-black opacity-30 uppercase tracking-[0.5em] mb-2">KUOTA TARGET</p>
                    <h4 class="text-5xl font-black italic text-slate-200">${fullTargetList.length}<span class="text-xs not-italic opacity-40 ml-3 uppercase tracking-tighter">Kontingen</span></h4>
                </div>
            </div>

            <div class="neu-flat p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all"></div>
                <div class="relative z-10 flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-400 mb-6 group-hover:bg-green-500/20 transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p class="text-[10px] font-black opacity-30 uppercase tracking-[0.5em] mb-2">SUDAH SETOR</p>
                    <h4 class="text-5xl font-black italic text-green-400">${submittedCount}<span class="text-xs not-italic opacity-40 ml-3 uppercase tracking-tighter">Kontingen</span></h4>
                </div>
            </div>

            <div class="neu-flat p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:scale-[1.01] transition-all duration-500">
                <div class="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                <div class="relative z-10 flex flex-col items-center text-center">
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6 group-hover:bg-blue-500/20 transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <p class="text-[10px] font-black opacity-30 uppercase tracking-[0.5em] mb-2">TOTAL TERDAFTAR</p>
                    <h4 class="text-5xl font-black italic text-blue-400">${totalAthletesFound}<span class="text-xs not-italic opacity-40 ml-3 uppercase tracking-tighter">Atlet</span></h4>
                </div>
            </div>
        `;
    }
};

export const editAthlete = async (athleteId, eventId) => {
    const athleteDoc = await getDoc(doc(db, `events/${eventId}/athletes`, athleteId));
    if (!athleteDoc.exists()) {
        alert("Atlet tidak ditemukan.");
        return;
    }

    const data = athleteDoc.data();
    document.getElementById('edit-athlete-id').value = athleteId;
    document.getElementById('edit-athlete-name').value = data.name || '';
    document.getElementById('edit-athlete-team').value = data.team || '';
    document.getElementById('edit-athlete-gender').value = data.gender || '';
    document.getElementById('edit-athlete-birthDate').value = data.birthDate || '';
    document.getElementById('edit-athlete-weight').value = data.weight || '';
    document.getElementById('edit-athlete-className').value = data.className || '';

    toggleModal('modal-edit-athlete', true);
};

export const saveAthleteEdit = async (eventId) => {
    const athleteId = document.getElementById('edit-athlete-id').value;
    const updatedData = {
        name: document.getElementById('edit-athlete-name').value.toUpperCase(),
        team: document.getElementById('edit-athlete-team').value.toUpperCase(),
        gender: document.getElementById('edit-athlete-gender').value,
        birthDate: document.getElementById('edit-athlete-birthDate').value,
        weight: document.getElementById('edit-athlete-weight').value,
        className: document.getElementById('edit-athlete-className').value.toUpperCase()
    };

    try {
        await updateDoc(doc(db, `events/${eventId}/athletes`, athleteId), updatedData);
        alert("Data atlet berhasil diperbarui!");
        toggleModal('modal-edit-athlete', false);
    } catch (err) {
        console.error("Update Athlete Error:", err);
        alert("Gagal memperbarui data: " + err.message);
    }
};

export const deleteAthlete = async (athleteId, eventId) => {
    if (confirm("Yakin ingin menghapus data pendaftaran ini?")) {
        try {
            await deleteDoc(doc(db, `events/${eventId}/athletes`, athleteId));
            alert("Data berhasil dihapus!");
        } catch (err) {
            console.error("Delete Athlete Error:", err);
            alert("Gagal menghapus: " + err.message);
        }
    }
};

export const deleteAllAthletes = async (eventId) => {
    if (!confirm("⚠️ PERINGATAN: Anda akan menghapus SELURUH DATA ATLET dan SEMUA BAGAN (BRACKET) di event ini. Tindakan ini tidak dapat dibatalkan.\\n\\nLanjutkan?")) return;

    const password = prompt("Ketik 'HAPUS' untuk konfirmasi penghapusan total:");
    if (password !== 'HAPUS') {
        alert("Konfirmasi gagal. Penghapusan dibatalkan.");
        return;
    }

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

