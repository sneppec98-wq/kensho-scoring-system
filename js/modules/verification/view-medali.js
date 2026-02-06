export const calculateMedalTally = (results, allContingents, manualMedals = []) => {
    const tally = {};

    // Normalize contingent names for consistent mapping
    const normalize = (name) => (name || "").toString().trim().toUpperCase();

    // Initialize tally with normalized team names
    allContingents.forEach(team => {
        const normTeam = normalize(team);
        if (normTeam) {
            tally[normTeam] = tally[normTeam] || { gold: 0, silver: 0, bronze: 0, isManual: false };
        }
    });

    // 1. PROCESS AUTOMATED RESULTS (FROM BRACKETS)
    results.forEach(res => {
        const gName = (res.winners?.gold || "").toString().toUpperCase();
        const sName = (res.winners?.silver || "").toString().toUpperCase();

        const gTeam = gName === "PESERTA KOSONG" ? null : normalize(res.goldTeam);
        const sTeam = sName === "PESERTA KOSONG" ? null : normalize(res.silverTeam);

        if (gTeam && tally[gTeam]) {
            tally[gTeam].gold++;
            tally[gTeam].autoGold = (tally[gTeam].autoGold || 0) + 1;
        }
        if (sTeam && tally[sTeam]) {
            tally[sTeam].silver++;
            tally[sTeam].autoSilver = (tally[sTeam].autoSilver || 0) + 1;
        }

        res.bronzeTeams.forEach((bt, bIdx) => {
            const bName = (res.winners?.bronze?.[bIdx] || "").toString().toUpperCase();
            const bTeam = bName === "PESERTA KOSONG" ? null : normalize(bt);
            if (bTeam && tally[bTeam]) {
                tally[bTeam].bronze++;
                tally[bTeam].autoBronze = (tally[bTeam].autoBronze || 0) + 1;
            }
        });
    });

    // 2. MERGE MANUAL OVERRIDES (CRUD)
    manualMedals.forEach(m => {
        const team = normalize(m.team);
        if (team) {
            if (!tally[team]) {
                tally[team] = {
                    gold: m.gold, silver: m.silver, bronze: m.bronze,
                    isManual: true, docId: m.id,
                    autoGold: 0, autoSilver: 0, autoBronze: 0,
                    adjGold: m.gold, adjSilver: m.silver, adjBronze: m.bronze
                };
            } else {
                tally[team].gold += m.gold;
                tally[team].silver += m.silver;
                tally[team].bronze += m.bronze;
                tally[team].isManual = true;
                tally[team].docId = m.id;
                tally[team].adjGold = m.gold;
                tally[team].adjSilver = m.silver;
                tally[team].adjBronze = m.bronze;
            }
        }
    });

    return Object.entries(tally).sort((a, b) => {
        // 1. Gold (Emas)
        if (b[1].gold !== a[1].gold) return b[1].gold - a[1].gold;
        // 2. Silver (Perak)
        if (b[1].silver !== a[1].silver) return b[1].silver - a[1].silver;
        // 3. Bronze (Perunggu)
        if (b[1].bronze !== a[1].bronze) return b[1].bronze - a[1].bronze;
        // 4. Alphabetical tie-breaker
        return a[0].localeCompare(b[0]);
    });
};

export const renderMedalView = (results, sortedTally, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const filteredTally = sortedTally.filter(([team]) => team.toLowerCase().includes(s));

    if (filteredTally.length === 0 && !s) {
        return `
            <div class="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs mb-6">Belum ada data perolehan medali.</p>
                <button onclick="window.openMedalManualModal()" 
                    class="px-6 py-3 rounded-2xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
                    ➕ TAMBAH DATA MANUAL
                </button>
            </div>
        `;
    }

    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filteredTally.length / PAGE_SIZE) || 1;
    window.verifikasiTotalPages = totalPages;

    const currentPage = window.verifikasiCurrentPage || 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredTally.length);
    const pagedTally = filteredTally.slice(startIdx, endIdx);

    // Global toggle for drill-down
    window.toggleTeamMedals = (team) => {
        window.expandedMedalTeam = (window.expandedMedalTeam === team) ? null : team;
        if (typeof window.renderVerificationData === 'function') {
            window.renderVerificationData(
                window.latestAthletes,
                window.latestClasses,
                window.latestBrackets,
                'MEDALI',
                window.currentEventData?.name,
                window.currentEventData?.logo,
                window.latestMedalsManual
            );
        }
    };

    return `
        <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden">
            <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div class="flex flex-col">
                    <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400">Klasemen Perolehan Medali</h4>
                    <p class="text-[7px] font-bold text-slate-500 uppercase mt-1 italic">Klik baris kontingen untuk detail / Gunakan tombol orange untuk input manual</p>
                </div>
                <button onclick="window.openMedalManualModal()" 
                    class="px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">
                    ➕ TAMBAH MANUAL
                </button>
            </div>
            <table class="w-full text-left">
                <thead class="bg-white/[0.02] text-[10px] font-black uppercase text-slate-400 border-b border-white/5">
                    <tr>
                        <th class="p-6 w-20">RANK</th>
                        <th>KONTINGEN</th>
                        <th class="text-center text-yellow-500 w-24">GOLD</th>
                        <th class="text-center text-slate-400 w-24">SILVER</th>
                        <th class="text-center text-orange-700 w-24">BRONZE</th>
                        <th class="w-16"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    ${pagedTally.map(([team, m], idx) => {
        const isExpanded = window.expandedMedalTeam === team;
        const teamResults = isExpanded ? results.filter(res =>
            (res.goldTeam === team) || (res.silverTeam === team) || (res.bronzeTeams.includes(team))
        ) : [];

        return `
                        <tr onclick="window.toggleTeamMedals('${team}')" 
                            class="hover:bg-white/5 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-500/5' : ''}">
                            <td class="p-6 text-xs font-black opacity-30">${startIdx + idx + 1}</td>
                            <td class="font-bold text-white uppercase text-xs">
                                <div class="flex items-center gap-3">
                                    ${team}
                                    ${m.isManual ? '<span class="px-2 py-0.5 rounded text-[6px] bg-orange-500/20 text-orange-400 border border-orange-500/20">MANUAL</span>' : ''}
                                    ${isExpanded ? `
                                        <svg class="w-3 h-3 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    ` : `
                                        <svg class="w-3 h-3 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    `}
                                </div>
                            </td>
                            <td class="text-center font-black text-white text-sm">${m.gold || 0}</td>
                            <td class="text-center font-bold text-slate-400 text-sm">${m.silver || 0}</td>
                            <td class="text-center font-bold text-orange-700 text-sm">${m.bronze || 0}</td>
                            <td class="p-4 text-right pr-6">
                                <div class="flex gap-2 justify-end opacity-20 group-hover:opacity-100 transition-opacity">
                                    <button onclick="event.stopPropagation(); window.openMedalManualModal({
                                        id: '${m.docId || ''}', 
                                        team: '${team}', 
                                        gold: ${m.gold || 0}, 
                                        silver: ${m.silver || 0}, 
                                        bronze: ${m.bronze || 0},
                                        autoGold: ${m.autoGold || 0},
                                        autoSilver: ${m.autoSilver || 0},
                                        autoBronze: ${m.autoBronze || 0}
                                    })" class="text-blue-400 hover:text-white p-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </button>
                                    ${m.isManual ? `
                                        <button onclick="event.stopPropagation(); window.deleteManualMedal('${team}')" class="text-red-400 hover:text-white p-1">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                        ${isExpanded ? `
                        <tr>
                            <td colspan="6" class="bg-black/20 p-6">
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    ${teamResults.length > 0 ? teamResults.map(res => {
            let medalType = "";
            let medalColor = "";
            if (res.goldTeam === team) { medalType = "GOLD"; medalColor = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20"; }
            else if (res.silverTeam === team) { medalType = "SILVER"; medalColor = "text-slate-400 bg-slate-400/10 border-slate-400/20"; }
            else { medalType = "BRONZE"; medalColor = "text-orange-700 bg-orange-700/10 border-orange-700/20"; }

            return `
                                            <div onclick="event.stopPropagation(); window.editJuaraManual('${(res.className || '').replace(/'/g, "\\'")}', '${res.id}')"
                                                class="flex flex-col gap-2 p-4 rounded-2xl border border-white/5 bg-slate-900/60 hover:border-blue-500/50 transition-all cursor-pointer group">
                                                <div class="flex justify-between items-start">
                                                    <span class="px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border ${medalColor}">${medalType}</span>
                                                    <span class="text-[8px] font-black text-slate-600 uppercase tracking-tighter">${res.id}</span>
                                                </div>
                                                <p class="text-[10px] font-black text-white uppercase leading-tight">${res.className}</p>
                                            </div>
                                        `;
        }).join('') : `
                                        <div class="col-span-full py-6 text-center opacity-30 italic text-[10px] uppercase font-bold">Tidak ada data medali detail (Mungkin hasil input manual).</div>
                                    `}
                                </div>
                            </td>
                        </tr>
                        ` : ''}
                    `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
};
