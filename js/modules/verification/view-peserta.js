/**
 * UI MODULE: PESERTA VIEW
 */
export const renderPesertaView = (athletes, classes, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const grouped = {};
    athletes.forEach(a => {
        const team = a.team || 'Lainnya';
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(a);
    });

    const teamKeys = Object.keys(grouped).sort();

    // IF SEARCH IS EMPTY: Show Contingent Directory (Resource Saver)
    if (!s) {
        let html = `
            <div class="bg-blue-500/5 border border-blue-500/10 rounded-[2rem] p-8 mb-8 text-center">
                <h3 class="text-xl font-black italic text-blue-400 uppercase tracking-tighter mb-2">Direktori Kontingen</h3>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pilih kontingen di bawah atau gunakan kolom pencarian untuk melihat detail peserta</p>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        `;

        teamKeys.forEach(team => {
            html += `
                <button onclick="window.setVerificationSearch('${team.replace(/'/g, "\\'")}')" 
                    class="group relative p-6 rounded-2xl bg-slate-900/40 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left overflow-hidden">
                    <div class="absolute -right-4 -bottom-4 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all"></div>
                    <div class="relative z-10">
                        <div class="text-[10px] font-black text-blue-500 opacity-40 uppercase tracking-widest mb-2">${grouped[team].length} ATLET</div>
                        <div class="text-sm font-black text-white italic uppercase tracking-tight group-hover:text-blue-400 transition-colors">${team}</div>
                    </div>
                </button>
            `;
        });

        if (teamKeys.length === 0) {
            html += '<div class="col-span-full py-20 text-center opacity-30 italic font-bold">BELUM ADA DATA PESERTA</div>';
        }

        return html + '</div>';
    }

    const filtered = athletes.filter(a => {
        return (a.name || "").toLowerCase().includes(s) ||
            (a.team || "").toLowerCase().includes(s) ||
            (a.className || "").toLowerCase().includes(s);
    });

    const filteredGrouped = {};
    filtered.forEach(a => {
        const team = a.team || 'Lainnya';
        if (!filteredGrouped[team]) filteredGrouped[team] = [];
        filteredGrouped[team].push(a);
    });

    const filteredTeamKeys = Object.keys(filteredGrouped).sort();
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filteredTeamKeys.length / PAGE_SIZE) || 1;
    window.verifikasiTotalPages = totalPages;

    const currentPage = window.verifikasiCurrentPage || 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredTeamKeys.length);
    const pagedTeams = filteredTeamKeys.slice(startIdx, endIdx);

    let html = '<div class="space-y-8">';
    if (pagedTeams.length === 0) {
        html += `
            <div class="py-20 text-center">
                <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-700">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Tidak ada hasil untuk "${searchTerm}"</p>
                <button onclick="window.setVerificationSearch('')" class="mt-4 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest">LIHAT SEMUA KONTINGEN</button>
            </div>
        `;
    }

    pagedTeams.forEach(team => {
        html += `
            <div>
                <h4 class="text-lg font-black uppercase bg-blue-500/10 px-6 py-3 rounded-xl mb-4 border border-blue-500/20 text-blue-400">${team}</h4>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="text-[9px] font-black opacity-50 uppercase tracking-widest text-slate-400">
                            <tr>
                                <th class="pb-2 pl-4">No</th>
                                <th class="pb-2">Nama Peserta</th>
                                <th class="pb-2 text-center">Gender</th>
                                <th class="pb-2">Kategori/Kelas</th>
                                <th class="pb-2 text-right pr-4">Lahir</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredGrouped[team].map((a, idx) => `
                                <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                                    <td class="py-4 pl-4 text-xs font-black opacity-30">#${idx + 1}</td>
                                    <td class="py-4 font-bold text-white uppercase">
                                        ${a.name}
                                        ${a.members?.length > 0 ? `<div class="text-[9pt] opacity-50 font-medium lowercase">👥 ${a.members.join(', ')}</div>` : ''}
                                    </td>
                                    <td class="py-4 text-center">
                                        <span class="px-2 py-0.5 rounded text-[9px] font-black ${a.gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}">${a.gender}</span>
                                    </td>
                                    <td class="py-4 text-blue-400 font-bold text-xs">
                                        <div class="flex flex-col">
                                            <span class="text-[8px] opacity-40 font-black">${classes.find(c => c.name === a.className)?.code || ''}</span>
                                            ${a.className}
                                        </div>
                                    </td>
                                    <td class="py-4 text-right pr-4 text-xs font-bold opacity-60">${a.birthDate || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    return html + '</div>';
};
