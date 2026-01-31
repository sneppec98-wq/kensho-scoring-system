/**
 * UI MODULE: WINNERS VIEW
 */
export const renderWinnersView = (results, classes, athletes) => {
    const openClasses = classes.filter(c =>
        !c.code?.toString().toUpperCase().startsWith('F') &&
        athletes.some(a => a.className === c.name)
    ).sort((a, b) => (a.code || "").toString().localeCompare((b.code || "").toString(), undefined, { numeric: true }));

    if (openClasses.length === 0) {
        return `
            <div class="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">Belum ada data pemenang untuk kelas Open.</p>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            ${openClasses.map(cls => {
        const res = results.find(r => r.className === cls.name);
        const w = res?.winners || { gold: '-', silver: '-', bronze: ['-', '-'] };
        return `
                    <div class="bg-slate-900/40 border border-white/5 p-6 rounded-3xl">
                        <div class="flex items-center justify-between mb-6">
                            <span class="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-blue-500/20">${cls.code}</span>
                            <h4 class="text-sm font-black text-white uppercase">${cls.name}</h4>
                        </div>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                                <span class="text-[10px] font-black text-yellow-500 uppercase">GOLD</span>
                                <span class="text-xs font-black text-white uppercase">${w.gold}</span>
                            </div>
                            <div class="flex items-center justify-between p-3 bg-slate-500/5 border border-slate-500/10 rounded-2xl">
                                <span class="text-[10px] font-black text-slate-400 uppercase">SILVER</span>
                                <span class="text-xs font-black text-white uppercase">${w.silver}</span>
                            </div>
                            ${(w.bronze || []).map(b => `
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
