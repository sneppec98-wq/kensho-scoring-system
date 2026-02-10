/**
 * UI MODULE: WINNERS VIEW
 */
export const renderWinnersView = (results, classes, athletes, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const openClasses = classes.filter(c =>
        !c.code?.toString().toUpperCase().startsWith('F') &&
        athletes.some(a => a.className === c.name) &&
        ((c.name || "").toLowerCase().includes(s) || (c.code || "").toString().toLowerCase().includes(s))
    ).sort((a, b) => (a.code || "").toString().localeCompare((b.code || "").toString(), undefined, { numeric: true }));

    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(openClasses.length / PAGE_SIZE) || 1;
    window.verifikasiTotalPages = totalPages;

    const currentPage = window.verifikasiCurrentPage || 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, openClasses.length);
    const pagedClasses = openClasses.slice(startIdx, endIdx);

    if (pagedClasses.length === 0) {
        return `
            <div class="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">Belum ada data pemenang untuk kelas Open.</p>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            ${pagedClasses.map(cls => {
        const res = results.find(r => r.id === cls.id || r.className === cls.name);
        const w = res?.winners || { gold: '-', silver: '-', bronze: ['-', '-'] };

        // Filter out "PESERTA KOSONG" for display
        const displayGold = w.gold === "PESERTA KOSONG" ? "-" : w.gold;
        const displaySilver = w.silver === "PESERTA KOSONG" ? "-" : w.silver;
        const displayBronze = (w.bronze || []).map(b => b === "PESERTA KOSONG" ? "-" : b);

        return `
                    <div class="bg-slate-900/40 border border-white/5 p-6 rounded-3xl relative group">
                        <!-- EDIT BUTTON (For Admin/Owner) -->
                        <button onclick="editJuaraManual('${cls.name.replace(/'/g, "\\'")}', '${cls.code}')" 
                            class="absolute top-6 right-6 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-500 hover:text-white">
                            📝 EDIT
                        </button>

                        <div class="flex items-center justify-between mb-6 pr-16 gap-4">
                            <span class="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-blue-500/20 shrink-0">${cls.code}</span>
                            <div class="flex items-center gap-2 overflow-hidden">
                                <h4 class="text-sm font-black text-white uppercase truncate">${cls.name}</h4>
                                <button onclick="window.editClassName('${cls.code}', '${cls.name.replace(/'/g, "\\'")}')" 
                                    class="w-6 h-6 rounded-lg bg-white/5 hover:bg-blue-500/20 text-white/20 hover:text-blue-400 flex items-center justify-center transition-all shrink-0">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                                <span class="text-[10px] font-black text-yellow-500 uppercase">GOLD</span>
                                <span class="text-xs font-black text-white uppercase">${displayGold}</span>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-slate-500/5 border border-slate-500/10 rounded-2xl">
                                <span class="text-[10px] font-black text-slate-400 uppercase">SILVER</span>
                                <span class="text-xs font-black text-white uppercase">${displaySilver}</span>
                            </div>
                            ${displayBronze.map(b => `
                                <div class="flex items-center justify-between p-3 bg-orange-700/5 border border-orange-700/10 rounded-2xl">
                                    <span class="text-[10px] font-black text-orange-700 uppercase">BRONZE</span>
                                    <span class="text-xs font-black text-white uppercase">${b}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
};
