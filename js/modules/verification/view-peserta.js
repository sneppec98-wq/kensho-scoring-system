/**
 * UI MODULE: PESERTA VIEW
 */
export const renderPesertaView = (athletes, classes, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const filtered = athletes.filter(a => {
        if (!s) return true;
        return (a.name || "").toLowerCase().includes(s) ||
            (a.team || "").toLowerCase().includes(s) ||
            (a.className || "").toLowerCase().includes(s);
    });

    const grouped = {};
    filtered.forEach(a => {
        const team = a.team || 'Lainnya';
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(a);
    });

    const teamKeys = Object.keys(grouped).sort();
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(teamKeys.length / PAGE_SIZE) || 1;
    window.verifikasiTotalPages = totalPages;

    const currentPage = window.verifikasiCurrentPage || 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, teamKeys.length);
    const pagedTeams = teamKeys.slice(startIdx, endIdx);

    let html = '<div class="space-y-8">';
    if (pagedTeams.length === 0) {
        html += '<p class="text-center py-10 opacity-40 italic">Tidak ada data ditemukan.</p>';
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
                            ${grouped[team].map((a, idx) => `
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
