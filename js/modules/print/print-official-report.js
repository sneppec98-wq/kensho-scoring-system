/**
 * OFFICIAL TOURNAMENT REPORT MODULE
 * Consolidated summary of all match results for archival purposes.
 */
import { executeIsolatedPrint } from './print-core.js';

export const prepareOfficialReport = async (brackets, classes, athletes, eventName, eventLogo) => {
    // 1. EXTRACT DATA ROBUSTLY
    const results = [];

    brackets.forEach(bracket => {
        if (bracket.status !== 'complete' || !bracket.data) return;

        const d = bracket.data;
        const participants = bracket.participants || [];
        const className = bracket.class || bracket.id || bracket.name;
        const classInfo = classes.find(c => c.name === className || c.code === bracket.id);
        const isFestival = (classInfo?.code || "").toString().toUpperCase().startsWith('F');

        const findTeam = (name) => {
            if (!name || name === "-" || name === "PESERTA KOSONG") return null;
            const p = participants.find(part => part.name === name);
            return p ? p.team : null;
        };

        if (isFestival) {
            // Festival: Multiple matches, each has a winner/loser
            const festRes = bracket.festivalResults || {};
            const matches = [];
            for (let i = 0; i < participants.length; i += 2) {
                const p1 = participants[i];
                const p2 = participants[i + 1] || { name: 'BYE', team: '-' };
                const winnerSide = festRes[i / 2];

                if (winnerSide === 'aka') {
                    matches.push({ rank: 1, name: p1.name, team: p1.team });
                    if (p2.name !== 'BYE') matches.push({ rank: 2, name: p2.name, team: p2.team });
                } else if (winnerSide === 'ao') {
                    matches.push({ rank: 1, name: p2.name, team: p2.team });
                    matches.push({ rank: 2, name: p1.name, team: p1.team });
                }
            }
            if (matches.length > 0) {
                results.push({
                    className: className,
                    classCode: classInfo?.code || "-",
                    isFestival: true,
                    winners: matches
                });
            }
        } else {
            // Open: Standard Gold, Silver, Bronze
            const gName = d['winner_nama'] || d['nama_juara_1'] || d['winner_1_name'] || d['Winner_1'] || d['text5989'] || d['fn1'];
            const sName = d['nama_juara_2'] || d['winner_2_name'] || d['Winner_2'] || d['fn2'];
            const b1Name = d['nama_juara_3_a'] || d['winner_3_name'] || d['Winner_3'] || d['sn1'];
            const b2Name = d['nama_juara_3_b'] || d['winner_4_name'] || d['Winner_4'] || d['sn3'];

            const winners = [];
            if (gName && gName !== "-" && gName !== "PESERTA KOSONG") {
                winners.push({ rank: 1, name: gName, team: d['winner_kontingen'] || d['kontingen_juara_1'] || findTeam(gName) || "-" });
            }
            if (sName && sName !== "-" && sName !== "PESERTA KOSONG") {
                winners.push({ rank: 2, name: sName, team: d['kontingen_juara_2'] || findTeam(sName) || "-" });
            }
            if (b1Name && b1Name !== "-" && b1Name !== "PESERTA KOSONG") {
                winners.push({ rank: 3, name: b1Name, team: d['kontingen_juara_3_a'] || findTeam(b1Name) || "-" });
            }
            if (b2Name && b2Name !== "-" && b2Name !== "PESERTA KOSONG") {
                winners.push({ rank: 3, name: b2Name, team: d['kontingen_juara_3_b'] || findTeam(b2Name) || "-" });
            }

            if (winners.length > 0) {
                results.push({
                    className: className,
                    classCode: classInfo?.code || "-",
                    isFestival: false,
                    winners: winners
                });
            }
        }
    });

    results.sort((a, b) => a.classCode.localeCompare(b.classCode, undefined, { numeric: true }));

    // 2. GENERATE HTML
    const openResults = results.filter(r => !r.isFestival);
    const festivalResults = results.filter(r => r.isFestival);

    const renderRows = (resList) => {
        return resList.map(r => {
            const gold = r.winners.find(w => w.rank === 1) || { name: '-', team: '-' };
            const silver = r.winners.find(w => w.rank === 2) || { name: '-', team: '-' };
            const bronzes = r.winners.filter(w => w.rank === 3);
            const b1 = bronzes[0] || { name: '-', team: '-' };
            const b2 = bronzes[1] || { name: '-', team: '-' };

            return `
                <tr>
                    <td class="text-center font-black" style="font-size: 7pt; width: 40px;">${r.classCode}</td>
                    <td style="text-align: left; font-size: 7pt; font-weight: 900; background: #fafafa;">${r.className}</td>
                    <td class="winner-cell">
                        <div class="name">${gold.name}</div>
                        <div class="team">${gold.team}</div>
                    </td>
                    <td class="winner-cell">
                        <div class="name">${silver.name}</div>
                        <div class="team">${silver.team}</div>
                    </td>
                    <td class="winner-cell">
                        <div class="name">${b1.name}</div>
                        <div class="team">${b1.team}</div>
                    </td>
                    <td class="winner-cell">
                        <div class="name">${b2.name}</div>
                        <div class="team">${b2.team}</div>
                    </td>
                </tr>
            `;
        }).join('');
    };

    const renderFestivalRows = (resList) => {
        return resList.map(r => {
            const winners = r.winners;
            let rows = '';
            for (let i = 0; i < winners.length; i += 2) {
                const w1 = winners[i];
                const w2 = winners[i + 1] || { name: '-', team: '-' };
                rows += `
                    <tr>
                        ${i === 0 ? `<td rowspan="${Math.ceil(winners.length / 2)}" class="text-center font-black" style="font-size: 7pt; width: 40px;">${r.classCode}</td>` : ''}
                        ${i === 0 ? `<td rowspan="${Math.ceil(winners.length / 2)}" style="text-align: left; font-size: 7pt; font-weight: 900; background: #fafafa;">${r.className}</td>` : ''}
                        <td colspan="2" class="winner-cell">
                            <div class="name">${w1.name}</div>
                            <div class="team">${w1.team}</div>
                        </td>
                        <td colspan="2" class="winner-cell" style="background: #f8fafc;">
                            <div class="name" style="opacity: 0.6;">${w2.name}</div>
                            <div class="team" style="opacity: 0.6;">${w2.team}</div>
                        </td>
                    </tr>
                `;
            }
            return rows;
        }).join('');
    };

    const html = `
        <style>
            .report-table { width: 100%; border-collapse: collapse; border: 2px solid #000; table-layout: fixed; }
            .report-table th { background: #f3f4f6 !important; border: 1.5px solid #000; padding: 4px; font-size: 7pt; font-weight: 900; text-transform: uppercase; }
            .report-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: middle; }
            .winner-cell { text-align: left; line-height: 1.1; }
            .winner-cell .name { font-size: 7.5pt; font-weight: 900; text-transform: uppercase; }
            .winner-cell .team { font-size: 6pt; opacity: 0.8; text-transform: uppercase; }
            .section-header { background: #000 !important; color: #fff !important; font-weight: 900; font-size: 8pt; padding: 6px; text-transform: uppercase; border: 2px solid #000; }
            .sign-container { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .sign-box { text-align: center; width: 220px; }
            .sign-space { height: 70px; }
            .sign-name { font-weight: 900; text-decoration: underline; text-transform: uppercase; font-size: 9pt; }
            .sign-title { font-size: 8pt; margin-top: 2px; }
        </style>

        <div style="margin-bottom: 10px; font-size: 8pt; font-weight: bold; opacity: 0.7; text-align: right;">
            REKAPITULASI HASIL RESMI - ${new Date().toLocaleDateString('id-ID')}
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 40px;">KODE</th>
                    <th style="width: 150px;">KELAS PERTANDINGAN</th>
                    <th>JUARA 1 (EMAS)</th>
                    <th>JUARA 2 (PERAK)</th>
                    <th>JUARA 3 (PERUNGGU)</th>
                    <th>JUARA 3 (PERUNGGU)</th>
                </tr>
            </thead>
            <tbody>
                ${openResults.length > 0 ? `<tr><td colspan="6" class="section-header">A. KATEGORI PRESTASI (OPEN)</td></tr>` : ''}
                ${renderRows(openResults)}
                
                ${festivalResults.length > 0 ? `<tr><td colspan="6" class="section-header">B. KATEGORI FESTIVAL</td></tr>` : ''}
                ${renderFestivalRows(festivalResults)}
            </tbody>
        </table>

        <div class="sign-container">
            <div class="sign-box">
                <p style="font-size: 8.5pt;">Mengetahui,</p>
                <p class="sign-title" style="margin-bottom: 5px;">Ketua Pertandingan</p>
                <div class="sign-space"></div>
                <p class="sign-name">( ............................... )</p>
            </div>
            <div class="sign-box">
                <p style="font-size: 8.5pt;">Hormat Kami,</p>
                <p class="sign-title" style="margin-bottom: 5px;">Sekretaris Pertandingan</p>
                <div class="sign-space"></div>
                <p class="sign-name">( ............................... )</p>
            </div>
        </div>
    `;

    await executeIsolatedPrint(html, 'LAPORAN REKAPITULASI HASIL PERTANDINGAN', eventName, eventLogo, 6, true, true);
};
