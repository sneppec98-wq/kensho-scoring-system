/**
 * WINNERS PRINT MODULE
 */
import { executeIsolatedPrint } from './print-core.js';

export const extractResultsFromBrackets = (brackets) => {
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
    return results;
};

export const prepareJuaraPrint = (brackets, classes, athletes, eventName, eventLogo) => {
    const results = extractResultsFromBrackets(brackets);
    const openClasses = classes.filter(c => {
        const code = (c.code || "").toString().toUpperCase();
        return !code.startsWith('F') && athletes.some(a => {
            const n1 = (c.name || "").replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const n2 = (a.className || "").replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return n1 === n2;
        });
    }).sort((a, b) => (a.code || "").toString().localeCompare((b.code || "").toString(), undefined, { numeric: true }));

    if (openClasses.length === 0) {
        alert("Belum ada daftar kelas Open yang memiliki pemenang untuk dicetak.");
        return;
    }

    let html = '';

    openClasses.forEach((cls, index) => {
        const res = results.find(r => r.className === cls.name);
        const w = res?.winners || { gold: '', silver: '', bronze: ['', ''] };
        const t = { gold: res?.goldTeam || '', silver: res?.silverTeam || '', bronze: res?.bronzeTeams || ['', ''] };
        const dot = ' . . . . . . . . . . .';

        // Add page break after every 5 classes
        const needsPageBreak = (index > 0 && index % 5 === 0);
        if (needsPageBreak) {
            html += '<div style="page-break-after: always; height: 1px; visibility: hidden;"></div>';
        }

        html += `
            <div style="break-inside: avoid; border-bottom: 1px dashed #ccc; padding-bottom: 3px; margin-bottom: 6px;">
                <div style="background: #000; color: #fff; padding: 1px 6px; display: inline-block; font-weight: 900; font-size: 7pt; text-transform: uppercase; margin-bottom: 2px; border-radius: 1px;">
                    KELAS: ${cls.code} - ${cls.name}
                </div>
                <table style="border: 1px solid #000; width: 100%; border-collapse: collapse; table-layout: fixed;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #000; background: #f0f0f0; width: 30px; font-size: 5.5pt; padding: 1px;">JUARA</th>
                            <th style="border: 1px solid #000; background: #f0f0f0; text-align: left; padding-left: 4px; font-size: 5.5pt;">NAMA PESERTA</th>
                            <th style="border: 1px solid #000; background: #f0f0f0; text-align: left; padding-left: 4px; font-size: 5.5pt; width: 35%;">KONTINGEN / TIM</th>
                            <th style="border: 1px solid #000; background: #f0f0f0; width: 50px; font-size: 5.5pt;">MEDALI</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 5.5pt; height: 16px;">1</td>
                            <td style="border: 1px solid #000; padding-left: 4px; font-weight: 900; text-transform: uppercase; font-size: 6pt; line-height: 1; text-align: left;">${w.gold || dot}</td>
                            <td style="border: 1px solid #000; padding-left: 4px; text-transform: uppercase; font-size: 5.5pt; text-align: left;">${t.gold || dot}</td>
                            <td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 5.5pt; color: #a16207;">GOLD</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 5.5pt; height: 16px;">2</td>
                            <td style="border: 1px solid #000; padding-left: 4px; font-weight: 900; text-transform: uppercase; font-size: 6pt; line-height: 1; text-align: left;">${w.silver || dot}</td>
                            <td style="border: 1px solid #000; padding-left: 4px; text-transform: uppercase; font-size: 5.5pt; text-align: left;">${t.silver || dot}</td>
                            <td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 5.5pt; color: #475569;">SILVER</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 5.5pt; height: 16px;">3</td>
                            <td style="border: 1px solid #000; padding-left: 4px; font-weight: 900; text-transform: uppercase; font-size: 6pt; line-height: 1; text-align: left;">${w.bronze[0] || dot}</td>
                            <td style="border: 1px solid #000; padding-left: 4px; text-transform: uppercase; font-size: 5.5pt; text-align: left;">${t.bronze[0] || dot}</td>
                            <td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 5.5pt; color: #9a3412;">BRONZE</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #000; text-align: center; font-weight: bold; font-size: 5.5pt; height: 16px;">3</td>
                            <td style="border: 1px solid #000; padding-left: 4px; font-weight: 900; text-transform: uppercase; font-size: 6pt; line-height: 1; text-align: left;">${w.bronze[1] || dot}</td>
                            <td style="border: 1px solid #000; padding-left: 4px; text-transform: uppercase; font-size: 5.5pt; text-align: left;">${t.bronze[1] || dot}</td>
                            <td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 5.5pt; color: #9a3412;">BRONZE</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    });

    const wrappedHtml = `
        <tbody>
            <tr>
                <td style="border: none !important; padding: 0 !important; text-align: left;">
                    <div class="winners-wrapper">
                        ${html}
                    </div>
                </td>
            </tr>
        </tbody>
    `;

    executeIsolatedPrint(wrappedHtml, 'DAFTAR PEMENANG (Open Class)', eventName, eventLogo, 1, true);
};
