// Brackets Configuration & Management
import { showProgress, hideProgress, toggleModal, updateProgress, customConfirm, customAlert } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const renderBracketsConfig = (classes, brackets) => {
    const container = document.getElementById('bracket-config-list');
    if (!container) return;

    if (classes.length === 0) {
        container.innerHTML = `
            <div class="text-center p-12 opacity-40">
                <div class="text-6xl mb-4">📋</div>
                <p class="text-sm font-bold">BELUM ADA KELAS TANDING</p>
            </div>
        `;
        return;
    }

    const bracketMap = {};
    brackets.forEach(b => {
        bracketMap[b.classCode] = b;
    });

    container.innerHTML = classes.map(cls => {
        const bracketData = bracketMap[cls.code];
        const hasBracket = !!bracketData;

        return `
            <div class="bg-slate-800/30 rounded-2xl p-6 border border-white/10">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-black text-white">${cls.name}</h3>
                        <p class="text-xs text-blue-400 font-bold">${cls.code}</p>
                    </div>
                    ${hasBracket ?
                `<span class="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold">✅ AKTIF</span>` :
                `<span class="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-bold">BELUM DIKONFIGURASI</span>`
            }
                </div>
                <button onclick="openBracketConfig('${cls.code}')" 
                    class="w-full px-4 py-3 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-xl text-sm font-bold transition-all">
                    ${hasBracket ? 'UBAH KONFIGURASI' : 'BUAT BAGAN BARU'}
                </button>
            </div>
        `;
    }).join('');
};

export const openBracketConfig = async (classCode, eventId, classes) => {
    const classInfo = classes.find(c => c.code === classCode);
    if (!classInfo) return;

    document.getElementById('bracket-config-classCode').value = classCode;
    document.getElementById('bracket-config-className').innerText = classInfo.name;

    // Check if bracket exists
    const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
    const existingBracket = bracketSnap.docs.find(doc => doc.data().classCode === classCode);

    if (existingBracket) {
        const data = existingBracket.data();
        document.getElementById('bracket-config-type').value = data.type || 'single-elimination';
        document.getElementById('bracket-config-poolCount').value = data.poolCount || 1;
    } else {
        document.getElementById('bracket-config-type').value = 'single-elimination';
        document.getElementById('bracket-config-poolCount').value = 1;
    }

    toggleModal('modal-bracket-config', true);
};

export const saveBracketConfig = async (eventId) => {
    const classCode = document.getElementById('bracket-config-classCode').value;
    const type = document.getElementById('bracket-config-type').value;
    const poolCount = parseInt(document.getElementById('bracket-config-poolCount').value) || 1;

    const bracketData = {
        classCode,
        type,
        poolCount,
        participants: [],
        matches: [],
        createdAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, `events/${eventId}/brackets`, classCode), bracketData);
        await customAlert("Konfigurasi bagan berhasil disimpan!", "Simpan Berhasil", "info");
        toggleModal('modal-bracket-config', false);
    } catch (err) {
        console.error("Save Bracket Config Error:", err);
        await customAlert("Gagal menyimpan konfigurasi: " + err.message, "Gagal", "danger");
    }
};

export const deleteBracketConfig = async (classCode, eventId) => {
    const okDelete = await customConfirm({
        title: "Hapus Konfigurasi",
        message: `Yakin ingin menghapus konfigurasi bagan untuk kelas "${classCode}"?`,
        confirmText: "Hapus Konfigurasi"
    });

    if (okDelete) {
        try {
            await deleteDoc(doc(db, `events/${eventId}/brackets`, classCode));
            await customAlert("Konfigurasi bagan berhasil dihapus!", "Terhapus", "info");
        } catch (err) {
            console.error("Delete Bracket Config Error:", err);
            await customAlert("Gagal menghapus: " + err.message, "Gagal", "danger");
        }
    }
};

export const deleteAllBrackets = async (eventId) => {
    const ok = await customConfirm({
        title: "Hapus Seluruh Bagan",
        message: "⚠️ PERINGATAN: Anda akan menghapus SELURUH bagan pertandingan yang sudah digenerate di event ini. Data atlet TIDAK akan terhapus. Lanjutkan?",
        confirmText: "Hapus Semua Bagan",
        promptWord: "HAPUS"
    });

    if (!ok) return;

    showProgress('MEMBERSIHKAN DATA BAGAN', 0);
    try {
        const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        if (!bracketSnap.empty) {
            const batchSize = 500;
            for (let i = 0; i < bracketSnap.docs.length; i += batchSize) {
                const batch = writeBatch(db);
                bracketSnap.docs.slice(i, i + batchSize).forEach(docSnap => {
                    batch.delete(doc(db, `events/${eventId}/brackets`, docSnap.id));
                });
                await batch.commit();
                updateProgress(Math.round(((i + batchSize) / bracketSnap.size) * 100));
            }
            await customAlert(`Berhasil menghapus ${bracketSnap.size} bagan pertandingan!`, "Selesai", "info");
        } else {
            await customAlert("Tidak ada bagan yang ditemukan untuk dihapus.", "Informasi", "info");
        }
    } catch (err) {
        console.error("Delete All Brackets Error:", err);
        await customAlert("Gagal membersihkan bagan: " + err.message, "Gagal", "danger");
    } finally {
        hideProgress();
    }
};
