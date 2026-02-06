import { executeIsolatedPrint } from './print-core.js';

export const prepareBracketPrint = async (athletes, classes, eventName, eventLogo, bracketsMap = {}) => {
    // 1. Filter and Sort by Code (F01, F02, etc.)
    const festivalClasses = classes
        .filter(c => (c.code || "").toString().toUpperCase().startsWith('F'))
        .sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true, sensitivity: 'base' }));

    if (festivalClasses.length === 0) {
        customAlert("Belum ada daftar kelas Festival untuk dicetak.", "Data Kosong", "info");
        return;
    }

    // Gunakan double quotes untuk string HTML agar tidak bentrok dengan backticks di dalam
    let html = `
        <style>
            .bracket-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; table-layout: fixed; }
            .class-title-row { background: #000 !important; -webkit-print-color-adjust: exact; }
            .class-title-row td { color: #fff; font-weight: 900; font-size: 10.5pt; padding: 6px 12px !important; text-transform: uppercase; border: 2px solid #000; letter-spacing: 0.5px; }
            .bracket-table th { background: #f3f4f6!important; -webkit-print-color-adjust: exact; border: 1.5px solid #000; padding: 4px 10px; font-size: 9.5pt; text-align: left; font-weight: 900; color: #333; }
            .bracket-table td { border: 1.2px solid #000; padding: 4px 10px; font-size: 10pt; vertical-align: middle; text-align: left; word-break: break-word; }
            .vs-box { font-weight: 900; color: #ef4444; font-size: 7pt; text-align: center !important; background: #f8fafc; }
            .badge-juara { font-size: 7px; font-weight: 900; padding: 2px 4px; border-radius: 2px; text-transform: uppercase; display: inline-block; }
            .badge-juara-1 { background: #fbbf24 !important; color: #000; -webkit-print-color-adjust: exact; }
            .badge-juara-2 { background: #e2e8f0 !important; color: #64748b; -webkit-print-color-adjust: exact; }
        </style>
        <table class="bracket-table">
            <thead>
                <tr>
                    <th style="width: 65px;">HASIL AKA</th>
                    <th style="width: 180px;">AKA (MERAH)</th>
                    <th style="width: 140px;">KONTINGEN</th>
                    <th style="width: 35px; text-align:center;">VS</th>
                    <th style="width: 180px;">AO (BIRU)</th>
                    <th style="width: 140px;">KONTINGEN</th>
                    <th style="width: 65px;">HASIL AO</th>
                </tr>
            </thead>
            <tbody>
                ` + festivalClasses.map(cls => {
        let participants = [];
        const savedBracket = bracketsMap[cls.name] || bracketsMap[cls.code];

        if (savedBracket && savedBracket.participants) {
            participants = savedBracket.participants;
        } else {
            participants = athletes.filter(a => {
                // Match by Code (F01) first, then fallback to Name matching
                return (a.classCode === cls.code) || (a.className === cls.name);
            });
        }

        if (participants.length === 0) return '';

        const pairs = [];
        for (let i = 0; i < participants.length; i += 2) {
            pairs.push([participants[i], participants[i + 1] || null]);
        }

        const results = savedBracket?.festivalResults || {};
        const classLabel = cls.code + " - " + cls.name;

        let classHeader = `
                        <tr class="class-title-row">
                            <td colspan="7">` + classLabel + `</td>
                        </tr>
                    `;

        let rows = pairs.map((p, idx) => {
            const winnerSide = results[idx];
            let akaBadge = '<div style="color:#ccc; font-size:5pt; letter-spacing:2px;">. . . . .</div>';
            let aoBadge = '<div style="color:#ccc; font-size:5pt; letter-spacing:2px;">. . . . .</div>';

            if (winnerSide === 'aka') {
                akaBadge = '<div class="badge-juara badge-juara-1">JUARA 1</div>';
                aoBadge = '<div class="badge-juara badge-juara-2">JUARA 2</div>';
            } else if (winnerSide === 'ao') {
                aoBadge = '<div class="badge-juara badge-juara-1">JUARA 1</div>';
                akaBadge = '<div class="badge-juara badge-juara-2">JUARA 2</div>';
            }

            let aoName = p[1] ? p[1].name : '- BYE -';
            let aoTeam = p[1] ? p[1].team : '-';

            return `
                            <tr>
                                <td style="background:#fcfcfc;">` + akaBadge + `</td>
                                <td><div style="font-weight:900; text-transform:uppercase; line-height:1.1;">` + p[0].name + `</div></td>
                                <td style="font-size:7pt; opacity:0.8; text-transform:uppercase; line-height:1.1;">` + p[0].team + `</td>
                                <td class="vs-box">VS</td>
                                <td><div style="font-weight:900; text-transform:uppercase; line-height:1.1;">` + aoName + `</div></td>
                                <td style="font-size:7pt; opacity:0.8; text-transform:uppercase; line-height:1.1;">` + aoTeam + `</td>
                                <td style="background:#fcfcfc;">` + aoBadge + `</td>
                            </tr>
                        `;
        }).join('');

        return classHeader + rows;
    }).join('') + `
            </tbody>
        </table>
    `;

    await executeIsolatedPrint(html, 'BAGAN FESTIVAL', eventName, eventLogo, 7, true, true);
};
