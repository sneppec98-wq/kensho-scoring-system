/**
 * MEDAL PRINT MODULE
 */
import { executeIsolatedPrint } from './print-core.js';
import { extractResultsFromBrackets } from './print-juara.js';

const calculateMedalTally = (results, allContingents) => {
    const tally = {};
    const normalize = (name) => (name || "").toString().trim().toUpperCase();

    allContingents.forEach(team => {
        const normTeam = normalize(team);
        if (normTeam) {
            tally[normTeam] = tally[normTeam] || { gold: 0, silver: 0, bronze: 0 };
        }
    });

    results.forEach(res => {
        const gName = (res.winners?.gold || "").toString().toUpperCase();
        const sName = (res.winners?.silver || "").toString().toUpperCase();

        const gTeam = gName === "PESERTA KOSONG" ? null : normalize(res.goldTeam);
        const sTeam = sName === "PESERTA KOSONG" ? null : normalize(res.silverTeam);

        if (gTeam && tally[gTeam]) tally[gTeam].gold++;
        if (sTeam && tally[sTeam]) tally[sTeam].silver++;

        res.bronzeTeams.forEach((bt, bIdx) => {
            const bName = (res.winners?.bronze?.[bIdx] || "").toString().toUpperCase();
            const bTeam = bName === "PESERTA KOSONG" ? null : normalize(bt);
            if (bTeam && tally[bTeam]) tally[bTeam].bronze++;
        });
    });

    return Object.entries(tally).sort((a, b) => {
        if (b[1].gold !== a[1].gold) return b[1].gold - a[1].gold;
        if (b[1].silver !== a[1].silver) return b[1].silver - a[1].silver;
        if (b[1].bronze !== a[1].bronze) return b[1].bronze - a[1].bronze;
        return a[0].localeCompare(b[0]);
    });
};

export const prepareMedaliPrint = async (brackets, athletes, eventName, eventLogo) => {
    const results = extractResultsFromBrackets(brackets);
    const allContingents = [...new Set(athletes.map(a => a.team).filter(t => t))];
    const sortedTally = calculateMedalTally(results, allContingents);

    const hasData = sortedTally && sortedTally.length > 0;
    const placeholderRows = Array(15).fill(null);

    const rows = hasData ? sortedTally.map(([team, medals], idx) => {
        return `
            <tr>
                <td class="text-center text-bold" style="background: #f8fafc;">${idx + 1}</td>
                <td class="text-bold uppercase" style="font-size: 8.5pt; text-align: left; padding-left: 12px;">${team}</td>
                <td class="text-center text-bold" style="font-size: 9pt;">${medals.gold || 0}</td>
                <td class="text-center" style="font-size: 8.5pt;">${medals.silver || 0}</td>
                <td class="text-center" style="font-size: 8.5pt;">${medals.bronze || 0}</td>
            </tr>
        `;
    }).join('') : placeholderRows.map((_, idx) => `
        <tr>
            <td class="text-center" style="background: #f8fafc; color: #ccc;">${idx + 1}</td>
            <td class="line-placeholder">................................................</td>
            <td class="text-center line-placeholder">...</td>
            <td class="text-center line-placeholder">...</td>
            <td class="text-center line-placeholder">...</td>
        </tr>
    `).join('');

    const html = `
        <colgroup>
            <col style="width: 15mm;">
            <col style="width: auto;">
            <col style="width: 30mm;">
            <col style="width: 30mm;">
            <col style="width: 30mm;">
        </colgroup>
        <thead>
            <tr>
                <th>RANK</th>
                <th style="text-align: left; padding-left: 12px;">KONTINGEN / TIM</th>
                <th>GOLD</th>
                <th>SILVER</th>
                <th>BRONZE</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    `;

    await executeIsolatedPrint(html, 'PEROLEHAN MEDALI KONTINGEN', eventName, eventLogo, 6, true, true);
};
