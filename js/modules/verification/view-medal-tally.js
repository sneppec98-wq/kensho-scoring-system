/**
 * UI MODULE: MEDAL TALLY VIEW (Edisi Kensho)
 * Memisahkan logika penghitungan medali dari kode utama.
 * Versi ini berfokus pada rincian kebutuhan medali per kelas pertandingan.
 * Implementasi: Alternasi Medali Festival untuk jumlah peserta Ganjil.
 */

export const calculateMedalTallyNew = (athletes, classes) => {
    // 1. KELOMPOKKAN ATLET BERDASARKAN KELAS
    const athletesByClass = {};
    athletes.forEach(a => {
        const code = (a.classCode || "").toString().toUpperCase().trim();
        if (!athletesByClass[code]) athletesByClass[code] = [];
        athletesByClass[code].push(a);
    });

    // 2. SORTIR KELAS SECARA NATURAL UNTUK DETERMINISTIK ALTERNASI
    const sortedClasses = [...classes].sort((a, b) =>
        (a.code || "").toString().localeCompare((b.code || "").toString(), undefined, { numeric: true, sensitivity: 'base' })
    );

    const classResults = [];
    let festivalOddCounter = 0; // Penghitung untuk alternasi sisa festival

    // 3. PROSES TIAP KELAS
    sortedClasses.forEach(c => {
        const classCode = (c.code || "").toString().toUpperCase().trim();
        const classAthletes = athletesByClass[classCode] || [];
        const n = classAthletes.length;
        if (n === 0) return;

        const isFestival = classCode.startsWith('F');
        const multiplier = (c.type === 'BEREGU') ? 3 : 1;

        let gold = 0;
        let silver = 0;
        let bronze = 0;

        if (isFestival) {
            // LOGIKA FESTIVAL: Emas = floor(N/2), Perak = N - Emas
            // Kecuali jika N ganjil, sisa (+1) diberikan bergantian
            const base = Math.floor(n / 2);
            const hasRemainder = (n % 2 !== 0);

            if (hasRemainder) {
                festivalOddCounter++;
                // Jika ganjil ke-1, 3, 5... sisa masuk ke EMAS
                // Jika ganjil ke-2, 4, 6... sisa masuk ke PERAK
                if (festivalOddCounter % 2 !== 0) {
                    gold = base + 1;
                    silver = base;
                } else {
                    gold = base;
                    silver = base + 1;
                }
            } else {
                gold = base;
                silver = base;
            }
        } else {
            // LOGIKA OPEN / BEREGU (Prestasi)
            if (n >= 2) {
                gold = 1 * multiplier;
                silver = 1 * multiplier;
                if (n >= 4) {
                    bronze = 2 * multiplier;
                } else if (n === 3) {
                    bronze = 1 * multiplier;
                }
            }
        }

        classResults.push({
            code: classCode,
            name: (c.name || "KELAS TIDAK TERNAMA").toUpperCase(),
            n: n, // Team/Unit count for logic
            individualCount: n * multiplier, // Actual human count
            gold: gold,
            silver: silver,
            bronze: bronze,
            total: gold + silver + bronze
        });
    });

    return classResults;
};

export const renderMedalTallyView = (sortedClassResults, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const filteredResults = sortedClassResults.filter(c =>
        (c.name || "").toLowerCase().includes(s) ||
        (c.code || "").toString().toLowerCase().includes(s)
    );

    if (filteredResults.length === 0) {
        return `
            <div class="text-center py-20 bg-slate-900/40 border border-white/5 rounded-3xl">
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">Tidak ada data hasil perhitungan yang sesuai pencarian.</p>
            </div>
        `;
    }

    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE) || 1;
    window.verifikasiTotalPages = totalPages;

    const currentPage = window.verifikasiCurrentPage || 1;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredResults.length);
    const pagedResults = filteredResults.map((c, i) => ({ ...c, originalIdx: i }))
        .slice(startIdx, endIdx);

    const openResults = pagedResults.filter(c => !c.code.startsWith('F'));
    const festivalResults = pagedResults.filter(c => c.code.startsWith('F'));

    const renderTable = (results, title, colorClass) => {
        if (results.length === 0) return '';

        const total = results.reduce((acc, curr) => {
            acc.gold += curr.gold;
            acc.silver += curr.silver;
            acc.bronze += curr.bronze;
            acc.total += curr.total;
            return acc;
        }, { gold: 0, silver: 0, bronze: 0, total: 0 });

        return `
            <div class="mb-12 bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div class="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <div class="flex flex-col">
                        <h4 class="text-xs font-black uppercase tracking-[0.2em] ${colorClass}">RINCIAN KEBUTUHAN MEDALI: ${title}</h4>
                        <p class="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-tight">Perhitungan Otomatis Sistem Kensho</p>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-900/60 text-[10px] font-black uppercase text-slate-500 border-b border-white/5">
                            <tr>
                                <th class="p-6 w-20">NO</th>
                                <th>KELAS PERTANDINGAN</th>
                                <th class="text-center w-20">ATLET</th>
                                <th class="text-center text-yellow-500 w-20">GOLD</th>
                                <th class="text-center text-slate-300 w-20">SILVER</th>
                                <th class="text-center text-orange-600 w-20">BRONZE</th>
                                <th class="text-center pr-6 text-blue-400 w-20">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            ${results.map((c, idx) => `
                                <tr class="hover:bg-blue-500/5 transition-all group">
                                    <td class="p-6">
                                        <div class="w-8 h-8 rounded-lg bg-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-black">
                                            ${c.originalIdx + 1}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="font-black text-white uppercase text-xs tracking-wider">${c.name}</div>
                                    </td>
                                    <td class="text-center">
                                        <span class="px-2 py-1 rounded bg-blue-500/10 text-white font-black text-[10px]">
                                            ${c.individualCount}
                                        </span>
                                    </td>
                                    <td class="text-center font-black text-white text-lg">${c.gold}</td>
                                    <td class="text-center font-bold text-slate-400 text-lg">${c.silver}</td>
                                    <td class="text-center font-bold text-orange-700 text-lg">${c.bronze}</td>
                                    <td class="text-center pr-6">
                                        <span class="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 font-black text-sm border border-blue-500/20">
                                            ${c.total}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="bg-blue-500/5 border-t border-blue-500/20">
                            <tr class="font-black text-white">
                                <td colspan="3" class="p-6 text-right uppercase tracking-[0.2em] text-[10px] text-blue-400">Total Stok Medali ${title}</td>
                                <td class="text-center text-2xl py-6">${total.gold}</td>
                                <td class="text-center text-2xl py-6 opacity-60">${total.silver}</td>
                                <td class="text-center text-2xl py-6 text-orange-700">${total.bronze}</td>
                                <td class="text-center pr-6">
                                    <span class="px-5 py-2 rounded-xl bg-blue-500 text-white font-black text-xl shadow-lg shadow-blue-500/20">
                                        ${total.total}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    };

    return `
        ${renderTable(openResults, 'PRESTASI / OPEN', 'text-blue-400')}
        ${renderTable(festivalResults, 'FESTIVAL', 'text-emerald-400')}
        
        <div class="mt-6 p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl no-print">
            <h5 class="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Ketentuan Perhitungan Stok:</h5>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="space-y-1">
                    <p class="text-[9px] font-black text-slate-400 uppercase">KELAS PRESTASI (OPEN)</p>
                    <p class="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">N=2: 1G, 1S | N=3: 1G, 1S, 1B | N>=4: 1G, 1S, 2B</p>
                </div>
                <div class="space-y-1">
                    <p class="text-[9px] font-black text-slate-400 uppercase">KELAS BEREGU</p>
                    <p class="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">Logika Stok sama dengan Prestasi x 3 (per personil dalam tim)</p>
                </div>
                <div class="space-y-1">
                    <p class="text-[9px] font-black text-slate-400 uppercase">KELAS FESTIVAL (ROTASI GANJIL)</p>
                    <p class="text-[8px] font-bold text-slate-500 leading-relaxed uppercase">Jika N=Ganjil, sisa (+1) diberikan bergantian antara Emas dan Perak di seluruh kelas festival.</p>
                </div>
            </div>
        </div>
    `;
};
