import { customAlert, customConfirm, showProgress, hideProgress, updateProgress } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { collection, getDocs, deleteDoc, doc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const renderWinnerStatusList = (classes, brackets, rewardStatus, searchTerm = "") => {
    const container = document.getElementById('printing-athlete-list');
    const statClaimedEl = document.getElementById('stat-rewards-claimed');
    const statPendingEl = document.getElementById('stat-rewards-pending');
    if (!container) return;

    const s = searchTerm.toLowerCase();

    // 1. Compile Winners from Brackets
    let allWinners = [];
    brackets.forEach(b => {
        const className = b.id;
        const classInfo = classes.find(c => c.name === className || c.code === b.classCode);
        if (!classInfo) return;

        const isFestival = (classInfo.code || "").toString().toUpperCase().startsWith('F');

        if (isFestival) {
            const participants = b.participants || [];
            const res = b.festivalResults || {};
            for (let i = 0; i < participants.length; i += 2) {
                const matchIdx = i / 2;
                const aka = participants[i];
                const ao = participants[i + 1];
                const winnerSide = res[matchIdx];

                if (winnerSide === 'aka') {
                    allWinners.push(createWinnerObj(aka, 1, classInfo));
                    if (ao && ao.name !== "BYE") allWinners.push(createWinnerObj(ao, 2, classInfo));
                } else if (winnerSide === 'ao') {
                    allWinners.push(createWinnerObj(ao, 1, classInfo));
                    allWinners.push(createWinnerObj(aka, 2, classInfo));
                }
            }
        } else {
            const d = b.data || {};
            const goldName = d['winner_nama'] || d['nama_juara_1'] || d['text5989'] || d['fn1'];
            if (goldName && goldName !== "-" && goldName !== "NAMA PESERTA") {
                const goldTeam = d['winner_kontingen'] || d['kontingen_juara_1'] || d['text5993'] || d['fk1'] || "-";
                allWinners.push(createWinnerObj({ name: goldName, team: goldTeam }, 1, classInfo));
            }
            const silverName = d['nama_juara_2'] || d['fn2'];
            if (silverName && silverName !== "-" && silverName !== "NAMA PESERTA") {
                const silverTeam = d['kontingen_juara_2'] || d['fk2'] || "-";
                allWinners.push(createWinnerObj({ name: silverName, team: silverTeam }, 2, classInfo));
            }
            const bronzeAName = d['nama_juara_3_a'] || d['sn1'];
            if (bronzeAName && bronzeAName !== "-" && bronzeAName !== "NAMA PESERTA") {
                const bronzeATeam = d['kontingen_juara_3_a'] || d['sk1'] || "-";
                allWinners.push(createWinnerObj({ name: bronzeAName, team: bronzeATeam }, 3, classInfo));
            }
            const bronzeBName = d['nama_juara_3_b'] || d['sn3'];
            if (bronzeBName && bronzeBName !== "-" && bronzeBName !== "NAMA PESERTA") {
                const bronzeBTeam = d['kontingen_juara_3_b'] || d['sk3'] || "-";
                allWinners.push(createWinnerObj({ name: bronzeBName, team: bronzeBTeam }, 3, classInfo));
            }
        }
    });

    function createWinnerObj(athlete, rank, classInfo) {
        return {
            name: athlete.name,
            team: athlete.team,
            rank: rank,
            className: classInfo.name,
            classCode: classInfo.code,
            rewardId: `${athlete.name.trim()}_${classInfo.name.trim()}`.replace(/\//g, '_')
        };
    }

    const filtered = allWinners.filter(w =>
        w.name.toLowerCase().includes(s) ||
        w.className.toLowerCase().includes(s) ||
        w.team.toLowerCase().includes(s)
    );

    // Calculate stats
    let totalClaimed = 0;
    let totalPending = 0;

    allWinners.forEach(w => {
        const status = rewardStatus[w.rewardId] || { medal: false, certificate: false };
        if (status.medal) totalClaimed++; else totalPending++;
        if (status.certificate) totalClaimed++; else totalPending++;
    });

    if (statClaimedEl) statClaimedEl.textContent = totalClaimed;
    if (statPendingEl) statPendingEl.textContent = totalPending;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">
                Tidak ada data pemenang yang sesuai pencarian.
            </div>
        `;
        return;
    }

    // Sort by class then rank
    filtered.sort((a, b) => a.classCode.localeCompare(b.classCode) || a.rank - b.rank);

    container.innerHTML = filtered.map(w => {
        const status = rewardStatus[w.rewardId] || { medal: false, certificate: false, receiver: "" };
        const isFullyClaimed = status.medal && status.certificate;

        return `
        <div class="neu-flat p-6 rounded-3xl border border-white/5 group transition-all hover:border-blue-500/30">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-black italic ${w.rank === 1 ? 'text-yellow-500' : (w.rank === 2 ? 'text-slate-400' : 'text-orange-500')}">
                        ${w.rank === 1 ? '🥇' : (w.rank === 2 ? '🥈' : '🥉')}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-[11px] font-black uppercase text-slate-100 truncate max-w-[150px]">${w.name}</h4>
                            <button onclick="copyToClipboard('${w.name.replace(/'/g, "\\'")}', this)" class="p-1 rounded-md hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 transition-all">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                            </button>
                        </div>
                        <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">${w.team}</p>
                    </div>
                </div>
                <div class="text-[9px] font-black text-blue-500 italic bg-blue-500/10 px-2 py-1 rounded-lg uppercase whitespace-nowrap">${w.classCode}</div>
            </div>

            <div class="space-y-3 mt-4">
                <div class="flex items-center justify-between text-[10px] uppercase font-black tracking-widest">
                    <span class="text-slate-400">Kelas</span>
                    <span class="text-slate-200 text-right truncate ml-4">${w.className}</span>
                </div>
                
                <div class="flex items-center gap-2 mt-4">
                    <div class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border ${status.medal ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-slate-800 bg-slate-800/50 text-slate-500'}">
                        <span class="text-[8px] font-black uppercase">Medali</span>
                        <svg class="w-3 h-3" fill="${status.medal ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border ${status.certificate ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-slate-800 bg-slate-800/50 text-slate-500'}">
                        <span class="text-[8px] font-black uppercase">Piagam</span>
                        <svg class="w-3 h-3" fill="${status.certificate ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>

                ${status.receiver ? `
                    <div class="mt-3 py-2 px-4 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-between">
                        <span class="text-[8px] font-black text-slate-500 uppercase">Pengambil:</span>
                        <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">${status.receiver}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
};

export const copyToClipboard = (text, element) => {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        if (element) {
            const originalHTML = element.innerHTML;
            element.innerHTML = `
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
            `;
            element.classList.add('bg-emerald-500/20');

            setTimeout(() => {
                element.innerHTML = originalHTML;
                element.classList.remove('bg-emerald-500/20');
            }, 2000);
        }
    }).catch(err => {
        console.error('Gagal menyalin:', err);
        customAlert("Gagal menyalin teks ke clipboard.", "Error", "danger");
    });
};

export const resetPrintingData = async (eventId) => {
    const isConfirmed = await customConfirm(
        "Hapus Seluruh Data Hasil?",
        "Tindakan ini akan menghapus semua log pengambilan medali/piagam DAN hasil juara di bagan. Data atlet dan kelas tetap aman.",
        "danger",
        "HAPUS"
    );

    if (!isConfirmed) return;

    showProgress("MEMBERSIHKAN DATA", "MENGHAPUS LOG REWARDS...", 0);

    try {
        // 1. Reset Rewards (Log Penyerahan)
        const rewardsSnap = await getDocs(collection(db, `events/${eventId}/rewards`));
        const totalRewards = rewardsSnap.size;

        if (totalRewards > 0) {
            let count = 0;
            const batch = writeBatch(db);
            rewardsSnap.docs.forEach(d => {
                batch.delete(d.ref);
                count++;
                updateProgress(Math.round((count / totalRewards) * 50), `MENGHAPUS REWARDS: ${count}/${totalRewards}`);
            });
            await batch.commit();
        }

        updateProgress(50, "MEMBERSIHKAN HASIL BAGAN...");

        // 2. Reset Brackets (Hasil Juara)
        const bracketsSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        const totalBrackets = bracketsSnap.size;

        if (totalBrackets > 0) {
            let count = 0;
            const batch = writeBatch(db);
            bracketsSnap.docs.forEach(d => {
                // Remove results fields but keep the bracket structure/participants
                batch.update(d.ref, {
                    data: {},
                    festivalResults: {},
                    updatedAt: new Date().toISOString()
                });
                count++;
                updateProgress(50 + Math.round((count / totalBrackets) * 50), `RESET BAGAN: ${count}/${totalBrackets}`);
            });
            await batch.commit();
        }

        hideProgress();
        customAlert("Seluruh data hasil pertandingan dan log pencetakan telah dibersihkan!", "Reset Berhasil", "success");
    } catch (err) {
        console.error("Reset Printing Data Error:", err);
        hideProgress();
        customAlert("Gagal mereset data: " + err.message, "Error", "danger");
    }
};
