/**
 * UI MODULE: MEDAL VIEW
 */

export const calculateMedalTally = (results, allContingents) => {
    const tally = {};
    allContingents.forEach(team => tally[team] = { gold: 0, silver: 0, bronze: 0 });

    results.forEach(res => {
        if (res.goldTeam && tally[res.goldTeam]) tally[res.goldTeam].gold++;
        if (res.silverTeam && tally[res.silverTeam]) tally[res.silverTeam].silver++;
        res.bronzeTeams.forEach(bt => {
            if (bt && tally[bt]) tally[bt].bronze++;
        });
    });

    return Object.entries(tally).sort((a, b) =>
        b[1].gold - a[1].gold ||
        b[1].silver - a[1].silver ||
        b[1].bronze - a[1].bronze
    );
};

export const renderMedalView = (sortedTally) => {
    if (sortedTally.length === 0) {
        return `
            <div class="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">Belum ada data perolehan medali.</p>
            </div>
        `;
    }

    return `
        <div class="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-white/5 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                        <th class="p-6">RANK</th>
                        <th>KONTINGEN</th>
                        <th class="text-center text-yellow-500">GOLD</th>
                        <th class="text-center text-slate-400">SILVER</th>
                        <th class="text-center text-orange-700">BRONZE</th>
                        <th class="text-center pr-6">TOTAL</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    ${sortedTally.map(([team, m], idx) => `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-6 text-xs font-black opacity-30">${idx + 1}</td>
                            <td class="font-bold text-white uppercase text-xs">${team}</td>
                            <td class="text-center font-black text-white text-sm">${m.gold}</td>
                            <td class="text-center font-bold text-slate-400 text-sm">${m.silver}</td>
                            <td class="text-center font-bold text-orange-700 text-sm">${m.bronze}</td>
                            <td class="text-center pr-6 font-black text-blue-400 text-sm">${m.gold + m.silver + m.bronze}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};
