// Verification & Results Display
import { renderSchedule } from './schedule-generator.js';

export const renderVerificationData = (athletes, classes, brackets = [], tab = 'PESERTA', eventName = '', eventLogo = null) => {
    const verifikasiContent = document.getElementById('verifikasiContent');
    if (!verifikasiContent) return;

    if (!athletes || athletes.length === 0) {
        verifikasiContent.innerHTML = '<p class="text-center opacity-40 py-20 italic">Belum ada data atlet.</p>';
        return;
    }

    // Add print button container at the top
    let html = `
        <div class="mb-8 flex justify-end no-print">
            <button onclick="printVerificationSubTab('${tab}')" 
                class="neu-button px-8 py-4 rounded-2xl flex items-center space-x-3 group transition-all text-green-500 hover:text-white hover:bg-green-500">
                <div class="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:bg-green-500 group-hover:text-white transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                </div>
                <span class="text-[10px] font-black uppercase tracking-[0.2em]">CETAK ${tab.replace('_', ' ')} (F4)</span>
            </button>
        </div>
    `;

    // Extract Result Data from Brackets
    const results = [];
    brackets.forEach(bracket => {
        if (bracket.status === 'complete' && bracket.data) {
            const data = bracket.data;
            const gold = (data.winner_name || data.winner_nama || "").trim();
            if (gold && gold !== "-") {
                const res = {
                    className: bracket.name,
                    winners: { gold: gold, silver: null, bronze: [] },
                    goldTeam: null,
                    silverTeam: null,
                    bronzeTeams: []
                };

                const participants = bracket.participants || [];
                const pGold = participants.find(p => p.name === gold);
                if (pGold) res.goldTeam = pGold.team;

                const finalist = data.fn1 || data.fn2 || data.fn_1 || data.fn_2;
                if (finalist && finalist.trim() !== "-" && finalist.trim() !== gold) {
                    res.winners.silver = finalist.trim();
                    const pSilver = participants.find(p => p.name === finalist.trim());
                    if (pSilver) res.silverTeam = pSilver.team;
                }

                [data.sn1, data.sn2, data.sn3, data.sn4, data.sn_1, data.sn_2].forEach(s => {
                    if (s && s.trim() !== "-" && s.trim() !== gold && s.trim() !== res.winners.silver) {
                        res.winners.bronze.push(s.trim());
                        const pBronze = participants.find(p => p.name === s.trim());
                        if (res.winners.bronze.length <= 2 && pBronze) res.bronzeTeams.push(pBronze.team);
                    }
                });
                results.push(res);
            }
        }
    });

    if (tab === 'PESERTA') {
        html += renderPesertaView(athletes, classes);
        currentPrintHtml = preparePesertaPrint(athletes, classes, eventName, eventLogo);
    } else if (tab === 'JADWAL') {
        verifikasiContent.innerHTML = html + `<div id="scheduleContent"></div>`;
        renderSchedule(classes, athletes, 'scheduleContent');
        return;
    } else if (tab === 'JUARA') {
        html += renderWinnersView(results);
        currentPrintHtml = prepareWinnersPrint(results, eventName, eventLogo);
    } else if (tab === 'MEDALI') {
        const sortedTally = calculateMedalTally(results);
        html += renderMedalView(sortedTally);
        currentPrintHtml = prepareMedalPrint(sortedTally, eventName, eventLogo);
    }

    verifikasiContent.innerHTML = html;
};

let currentPrintHtml = '';

const executeIsolatedPrint = (htmlContent, title) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up terblokir! Silakan izinkan pop-up untuk mencetak.");
        return;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap');
                
                * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                
                /* THE ULTIMATE RESET - ZERO ARTIFACTS */
                *::before, *::after, *::marker { display: none !important; content: none !important; }
                
                body { 
                    margin: 0; 
                    padding: 0; 
                    background: white; 
                    font-family: 'Montserrat', sans-serif;
                }

                @page { 
                    size: 215mm 330mm !important; 
                    margin: 5mm !important; 
                }

                .print-page {
                    width: 205mm;
                    height: 320mm;
                    padding: 0;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    page-break-after: always;
                    position: relative;
                    overflow: hidden;
                    background: white;
                }

                .print-header {
                    text-align: center;
                    margin-bottom: 12px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 8px;
                }

                .header-logo {
                    height: 80px;
                    max-width: 80%;
                    object-fit: contain;
                    margin: 0 auto 5px auto;
                    display: block;
                }

                .logo-placeholder {
                    width: 120px;
                    height: 120px;
                    border: 5px solid #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px auto;
                    font-weight: 900;
                    font-size: 22pt;
                    letter-spacing: 2px;
                }

                .header-title {
                    font-size: 18pt;
                    font-weight: 900;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #000;
                    line-height: 1.0;
                }

                .header-event {
                    font-size: 10pt;
                    font-weight: 800;
                    margin: 4px 0 0 0;
                    text-transform: uppercase;
                    color: #333;
                    letter-spacing: 1px;
                }

                .kontingen-badge {
                    margin-bottom: 15px;
                    padding: 6px 15px;
                    background: #000;
                    color: #fff;
                    display: inline-block;
                    border-radius: 4px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    font-size: 11pt;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9pt;
                }

                th {
                    background: #f3f4f6 !important;
                    border: 2px solid #000;
                    padding: 6px 10px;
                    text-align: left;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    vertical-align: middle;
                }

                .footer {
                    margin-top: auto;
                    padding: 20px 0;
                    border-top: 2px solid #000;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .brand-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .brand-logo {
                    height: 30px;
                    width: 30px;
                }

                .brand-name {
                    font-weight: 800;
                    font-size: 9pt;
                    color: #000;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .page-number {
                    font-weight: 900;
                    font-size: 10pt;
                }

                /* TABLE MODIFIERS */
                .text-center { text-align: center !important; }
                .text-bold { font-weight: 800 !important; }
                .uppercase { text-transform: uppercase !important; }
                .text-sm { font-size: 8.5pt !important; }
                .medal-gold { font-weight: 900; color: #000; }
            </style>
        </head>
        <body>
            ${htmlContent}
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const renderPesertaView = (athletes, classes) => {
    const grouped = {};
    athletes.forEach(athlete => {
        const team = athlete.team || 'Lainnya';
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(athlete);
    });

    Object.keys(grouped).forEach(team => {
        grouped[team].sort((a, b) => {
            const classA = classes.find(c => c.name === a.className);
            const classB = classes.find(c => c.name === b.className);
            const codeA = (classA?.code || "").toString();
            const codeB = (classB?.code || "").toString();
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' }) || (a.name || "").localeCompare(b.name || "");
        });
    });

    let html = '<div class="space-y-8">';
    Object.keys(grouped).sort().forEach(team => {
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
        `;
        grouped[team].forEach((athlete, idx) => {
            const gender = athlete.gender || '-';
            let displayName = athlete.name;
            if (athlete.members && athlete.members.length > 0) {
                displayName += `<div class="text-[10px] opacity-60 font-medium normal-case mt-1 uppercase">👥 ANGGOTA: ${athlete.members.join(', ')}</div>`;
            }
            html += `
                <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td class="py-4 pl-4 text-xs font-black opacity-30">#${idx + 1}</td>
                    <td class="py-4 font-bold text-white">${displayName}</td>
                    <td class="py-4 text-center">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black ${gender === 'PUTRA' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}">
                            ${gender}
                        </span>
                    </td>
                    <td class="py-4 text-blue-400 font-bold text-xs">
                        <div class="flex flex-col">
                            <span class="text-[8px] opacity-40 font-black">${classes.find(c => c.name === athlete.className)?.code || ''}</span>
                            ${athlete.className || '-'}
                        </div>
                    </td>
                    <td class="py-4 text-right pr-4 text-xs font-bold opacity-60">${athlete.birthDate || '-'}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div></div>';
    });
    return html + '</div>';
};

const renderWinnersView = (results) => {
    if (!results || results.length === 0) return '<p class="text-center opacity-40 py-20 italic">Belum ada bagan yang selesai diisi pemenangnya.</p>';
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">';
    results.forEach(res => {
        html += `
            <div class="neu-card p-6 rounded-2xl border border-white/5 bg-slate-800/20">
                <h4 class="text-xs font-black uppercase text-blue-400 mb-4 tracking-widest border-b border-white/5 pb-2">${res.className}</h4>
                <div class="space-y-3">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-yellow-400/10 flex items-center justify-center text-yellow-500 font-bold text-[10px]">I</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">EMAS</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.gold}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-slate-400/10 flex items-center justify-center text-slate-400 font-bold text-[10px]">II</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">PERAK</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.silver || '-'}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center text-orange-400 font-bold text-[10px]">III</div>
                        <div class="flex-1">
                            <p class="text-[8px] font-black opacity-30 uppercase">PERUNGGU</p>
                            <p class="text-[11px] font-black uppercase">${res.winners.bronze.join(' / ') || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    return html + '</div>';
};

const calculateMedalTally = (results) => {
    const tally = {};
    results.forEach(res => {
        if (res.goldTeam) {
            if (!tally[res.goldTeam]) tally[res.goldTeam] = { gold: 0, silver: 0, bronze: 0 };
            tally[res.goldTeam].gold++;
        }
        if (res.silverTeam) {
            if (!tally[res.silverTeam]) tally[res.silverTeam] = { gold: 0, silver: 0, bronze: 0 };
            tally[res.silverTeam].silver++;
        }
        if (res.bronzeTeams) {
            res.bronzeTeams.forEach(bt => {
                if (!tally[bt]) tally[bt] = { gold: 0, silver: 0, bronze: 0 };
                tally[bt].bronze++;
            });
        }
    });
    return Object.entries(tally).sort((a, b) => {
        if (b[1].gold !== a[1].gold) return b[1].gold - a[1].gold;
        if (b[1].silver !== a[1].silver) return b[1].silver - a[1].silver;
        return b[1].bronze - a[1].bronze;
    });
};

const renderMedalView = (sortedTally) => {
    if (!sortedTally || sortedTally.length === 0) return '<p class="text-center opacity-40 py-20 italic">Belum ada data medali.</p>';
    let html = `
        <div class="neu-inset rounded-[2rem] overflow-hidden border border-white/5">
            <table class="w-full text-left">
                <thead class="bg-slate-900/50 text-[9px] font-black opacity-50 uppercase tracking-widest">
                    <tr>
                        <th class="p-6 text-center w-16">Rank</th>
                        <th class="p-6">Kontingen / Tim</th>
                        <th class="p-6 text-center text-yellow-500">Emas</th>
                        <th class="p-6 text-center text-slate-400">Perak</th>
                        <th class="p-6 text-center text-orange-400">Perunggu</th>
                        <th class="p-6 text-center font-bold">Total</th>
                    </tr>
                </thead>
                <tbody class="uppercase font-bold text-[10px]">
    `;
    sortedTally.forEach(([team, medals], idx) => {
        const total = medals.gold + medals.silver + medals.bronze;
        html += `
            <tr class="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-6 text-center font-black ${idx < 3 ? 'text-blue-500' : ''}">${idx + 1}</td>
                <td class="p-6 italic">${team}</td>
                <td class="p-6 text-center text-yellow-500 text-sm font-black">${medals.gold}</td>
                <td class="p-6 text-center text-slate-400 text-sm font-black">${medals.silver}</td>
                <td class="p-6 text-center text-orange-400 text-sm font-black">${medals.bronze}</td>
                <td class="p-6 text-center font-black text-sm">${total}</td>
            </tr>
        `;
    });
    return html + '</tbody></table></div>';
};

const generatePrintHeaderHTML = (eventName, eventLogo, title) => {
    const logoHtml = (eventLogo && eventLogo.length > 10)
        ? `<img src="${eventLogo}" class="header-logo">`
        : `<div class="logo-placeholder">LOGO</div>`;

    return `
        <div class="print-header">
            ${logoHtml}
            <h2 class="header-title">${title}</h2>
            <p class="header-event">${eventName}</p>
        </div>
    `;
};

// Printing Helpers
const preparePesertaPrint = (athletes, classes, eventName, eventLogo) => {
    const grouped = {};
    athletes.forEach(a => {
        const t = a.team || 'Lainnya';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(a);
    });

    let html = '';
    let globalPage = 1;
    const sortedTeams = Object.keys(grouped).sort();

    sortedTeams.forEach(team => {
        const teamAthletes = grouped[team];
        teamAthletes.sort((a, b) => {
            const classA = classes.find(c => c.name === a.className);
            const classB = classes.find(c => c.name === b.className);
            const codeA = (classA?.code || "").toString();
            const codeB = (classB?.code || "").toString();
            return codeA.localeCompare(codeB, undefined, { numeric: true }) || (a.name || "").localeCompare(b.name || "");
        });

        const LIMIT = 30; // High density for F4
        for (let i = 0; i < teamAthletes.length; i += LIMIT) {
            const chunk = teamAthletes.slice(i, i + LIMIT);
            html += `
                <div class="print-page">
                    ${generatePrintHeaderHTML(eventName, eventLogo, 'VERIFIKASI DATA PESERTA')}

                    <div class="kontingen-badge">KONTINGEN: ${team}</div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th class="text-center" style="width: 50px;">NO</th>
                                <th>NAMA LENGKAP PESERTA</th>
                                <th class="text-center" style="width: 80px;">GENDER</th>
                                <th class="text-center" style="width: 120px;">TANGGAL LAHIR</th>
                                <th>KELAS PERTANDINGAN</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            chunk.forEach((a, idx) => {
                html += `
                    <tr>
                        <td class="text-center">${i + idx + 1}</td>
                        <td class="text-bold uppercase">${a.name}</td>
                        <td class="text-center">${a.gender || '-'}</td>
                        <td class="text-center">${a.birthDate || '-'}</td>
                        <td class="text-sm border-l-2">${a.className}</td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>

                    <div class="footer">
                        <div class="brand-info">
                            <img src="kensho-logo.png" class="brand-logo">
                            <span class="brand-name">KENSHO - Digital Scoring System</span>
                        </div>
                        <div class="page-number">Halaman ${globalPage}</div>
                    </div>
                </div>
            `;
            globalPage++;
        }
    });

    return html;
};

const prepareWinnersPrint = (results, eventName, eventLogo) => {
    let html = '';
    const LIMIT = 8; // Ultra-safe for Winners
    let globalPage = 1;
    for (let i = 0; i < results.length; i += LIMIT) {
        const chunk = results.slice(i, i + LIMIT);
        html += `
            <div class="print-page">
                ${generatePrintHeaderHTML(eventName, eventLogo, 'DAFTAR JUARA PERTANDINGAN')}
                <table>
                    <thead>
                        <tr>
                            <th>KELAS PERTANDINGAN</th>
                            <th class="text-center" style="color: #854d0e;">JUARA I (GOLD)</th>
                            <th class="text-center" style="color: #475569;">JUARA II (SILVER)</th>
                            <th class="text-center" style="color: #9a3412;">JUARA III (BRONZE)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        chunk.forEach(res => {
            html += `
                <tr>
                    <td class="text-bold" style="background: #f9fafb;">${res.className}</td>
                    <td class="text-center medal-gold uppercase">${res.winners.gold}</td>
                    <td class="text-center uppercase">${res.winners.silver || '-'}</td>
                    <td class="text-center text-sm uppercase">${res.winners.bronze.join(' / ') || '-'}</td>
                </tr>
            `;
        });
        html += `
                    </tbody>
                </table>
                <div class="footer">
                    <div class="brand-info">
                        <img src="kensho-logo.png" class="brand-logo">
                        <span class="brand-name">KENSHO - Digital Scoring System</span>
                    </div>
                    <div class="page-number">Halaman ${globalPage}</div>
                </div>
            </div>
        `;
        globalPage++;
    }
    return html;
};

const prepareMedalPrint = (sortedTally, eventName, eventLogo) => {
    let html = `
        <div class="print-page">
            ${generatePrintHeaderHTML(eventName, eventLogo, 'KLASEMEN PEROLEHAN MEDALI')}
            <table>
                <thead>
                    <tr>
                        <th class="text-center" style="width: 80px;">RANK</th>
                        <th>KONTINGEN / TIM</th>
                        <th class="text-center" style="width: 100px; background: #ffd700 !important; color: #000;">EMAS</th>
                        <th class="text-center" style="width: 100px; background: #c0c0c0 !important; color: #000;">PERAK</th>
                        <th class="text-center" style="width: 100px; background: #cd7f32 !important; color: #000;">PRG</th>
                        <th class="text-center" style="width: 100px;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
    `;
    sortedTally.forEach(([team, medals], idx) => {
        const total = medals.gold + medals.silver + medals.bronze;
        html += `
            <tr>
                <td class="text-center text-bold" style="background: #f3f4f6;">${idx + 1}</td>
                <td class="text-bold uppercase">${team}</td>
                <td class="text-center text-bold" style="font-size: 14pt;">${medals.gold}</td>
                <td class="text-center" style="font-size: 12pt;">${medals.silver}</td>
                <td class="text-center" style="font-size: 12pt;">${medals.bronze}</td>
                <td class="text-center text-bold" style="font-size: 14pt;">${total}</td>
            </tr>
        `;
    });
    html += `
                </tbody>
            </table>
            <div class="footer">
                <div class="brand-info">
                    <img src="kensho-logo.png" class="brand-logo">
                    <span class="brand-name">KENSHO - Digital Scoring System</span>
                </div>
                <div class="page-number">Halaman 1</div>
            </div>
        </div>
    `;
    return html;
};

window.printVerificationSubTab = (tab) => {
    if (tab === 'JADWAL') {
        if (typeof window.printSchedule === 'function') {
            window.printSchedule('F4');
        } else {
            console.error('printSchedule function not found on window object');
        }
        return;
    }

    if (currentPrintHtml) {
        executeIsolatedPrint(currentPrintHtml, `Cetak ${tab}`);
    } else {
        alert("Gagal menyiapkan data cetak. Silakan coba lagi.");
    }
};
