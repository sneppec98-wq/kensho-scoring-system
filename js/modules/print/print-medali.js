/**
 * MEDAL PRINT MODULE
 */
import { executeIsolatedPrint } from './print-core.js';
import { extractResultsFromBrackets } from './print-juara.js';

const calculateMedalTally = (results, allContingents) => {
    const tally = {};
    allContingents.forEach(team => {
        tally[team] = { gold: 0, silver: 0, bronze: 0 };
    });

    results.forEach(res => {
        if (res.goldTeam && tally[res.goldTeam]) tally[res.goldTeam].gold++;
        if (res.silverTeam && tally[res.silverTeam]) tally[res.silverTeam].silver++;
        res.bronzeTeams.forEach(bt => {
            if (bt && tally[bt]) tally[bt].bronze++;
        });
    });

    return Object.entries(tally).sort((a, b) => {
        if (b[1].gold !== a[1].gold) return b[1].gold - a[1].gold;
        if (b[1].silver !== a[1].silver) return b[1].silver - a[1].silver;
        return b[1].bronze - a[1].bronze;
    });
};

export const prepareMedaliPrint = (brackets, athletes, eventName, eventLogo) => {
    const results = extractResultsFromBrackets(brackets);
    const allContingents = [...new Set(athletes.map(a => a.team).filter(t => t))];
    const sortedTally = calculateMedalTally(results, allContingents);

    const hasData = sortedTally && sortedTally.length > 0;
    const placeholderRows = Array(15).fill(null);

    let html = `
        <style>
            .medal-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
            .medal-table th { background: #f3f4f6!important; border: 1.5px solid #000; padding: 4px; font-size: 8pt; text-align: center; font-weight: 900; }
            .medal-table td { border: 1.2px solid #000; padding: 3px 8px; font-size: 8.5pt; height: 22px; vertical-align: middle; }
            .line-placeholder { color: #ccc; letter-spacing: 2px; }
            .text-center { text-align: center; }
            .text-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
        </style>
        <div class="medal-body-flow">
            <table class="medal-table">
                <colgroup>
                    <col style="width: 40px;">
                    <col style="width: auto;">
                    <col style="width: 60px;">
                    <col style="width: 60px;">
                    <col style="width: 60px;">
                    <col style="width: 60px;">
                </colgroup>
                <thead>
                    <tr>
                        <th>RANK</th>
                        <th style="text-align: left; padding-left: 12px;">KONTINGEN / TIM</th>
                        <th>GOLD</th>
                        <th>SILVER</th>
                        <th>BRONZE</th>
                        <th>TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${hasData ? sortedTally.map(([team, medals], idx) => {
        const total = medals.gold + medals.silver + medals.bronze;
        return `
                            <tr>
                                <td class="text-center text-bold" style="background: #f8fafc;">${idx + 1}</td>
                                <td class="text-bold uppercase" style="font-size: 8.5pt; text-align: left; padding-left: 12px;">${team}</td>
                                <td class="text-center text-bold" style="font-size: 9pt;">${medals.gold || 0}</td>
                                <td class="text-center" style="font-size: 8.5pt;">${medals.silver || 0}</td>
                                <td class="text-center" style="font-size: 8.5pt;">${medals.bronze || 0}</td>
                                <td class="text-center text-bold" style="font-size: 9pt; background: #f8fafc;">${total}</td>
                            </tr>
                        `;
    }).join('') : placeholderRows.map((_, idx) => `
                        <tr>
                            <td class="text-center" style="background: #f8fafc; color: #ccc;">${idx + 1}</td>
                            <td class="line-placeholder">................................................</td>
                            <td class="text-center line-placeholder">...</td>
                            <td class="text-center line-placeholder">...</td>
                            <td class="text-center line-placeholder">...</td>
                            <td class="text-center line-placeholder" style="background: #f8fafc;">...</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    executeIsolatedPrint(html, 'PEROLEHAN MEDALI KONTINGEN', eventName, eventLogo, 6, true);
};
