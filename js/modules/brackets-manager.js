// Brackets Configuration & Management
import { showProgress, hideProgress, toggleModal } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        alert("Konfigurasi bagan berhasil disimpan!");
        toggleModal('modal-bracket-config', false);
    } catch (err) {
        console.error("Save Bracket Config Error:", err);
        alert("Gagal menyimpan konfigurasi: " + err.message);
    }
};

export const deleteBracketConfig = async (classCode, eventId) => {
    if (confirm(`Yakin ingin menghapus konfigurasi bagan untuk kelas "${classCode}"?`)) {
        try {
            await deleteDoc(doc(db, `events/${eventId}/brackets`, classCode));
            alert("Konfigurasi bagan berhasil dihapus!");
        } catch (err) {
            console.error("Delete Bracket Config Error:", err);
            alert("Gagal menghapus: " + err.message);
        }
    }
};
