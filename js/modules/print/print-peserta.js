/**
 * PARTICIPANT PRINT MODULE - COBA.HTML STYLE
 */
import { executeIsolatedPrint } from './print-core.js';

export const preparePesertaPrint = (athletes, classes, eventName, eventLogo, searchTerm = "") => {
    const s = searchTerm.toLowerCase();
    const filtered = athletes.filter(a => {
        if (!s) return true;
        return (a.name || "").toLowerCase().includes(s) ||
            (a.team || "").toLowerCase().includes(s) ||
            (a.className || "").toLowerCase().includes(s);
    });

    const grouped = {};
    filtered.forEach(a => {
        const t = a.team || 'Lainnya';
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(a);
    });

    const sortedTeams = Object.keys(grouped).sort();

    let html = `
        <colgroup>
            <col style="width: 5%;">
            <col style="width: auto;">
            <col style="width: 15%;">
            <col style="width: 15%;">
            <col style="width: 30%;">
        </colgroup>
        ${sortedTeams.map((team) => {
        const teamAthletes = grouped[team];
        teamAthletes.sort((a, b) => {
            const classA = classes.find(c => c.name === a.className);
            const classB = classes.find(c => c.name === b.className);
            const codeA = (classA?.code || "").toString();
            const codeB = (classB?.code || "").toString();
            return codeA.localeCompare(codeB, undefined, { numeric: true }) || (a.name || "").localeCompare(b.name || "");
        });

        return `
                <tbody style="page-break-inside: auto;">
                    <tr style="page-break-after: avoid; break-after: avoid;">
                        <td colspan="5" style="border: none; padding: 15px 0 8px 0; text-align: left; font-weight: bold; font-size: 11pt;">
                            NAMA KONTINGEN: <span style="text-decoration: underline;">${team.toUpperCase()}</span>
                        </td>
                    </tr>
                    <tr style="page-break-inside: avoid; break-inside: avoid;">
                        <th style="font-size: 8.5pt; padding: 4px;">No</th>
                        <th style="font-size: 8.5pt; padding: 4px;">Nama Atlet</th>
                        <th style="font-size: 8.5pt; padding: 4px;">L/P</th>
                        <th style="font-size: 8.5pt; padding: 4px;">Tanggal Lahir</th>
                        <th style="font-size: 8.5pt; padding: 4px;">Kelas Pertandingan</th>
                    </tr>
                    ${teamAthletes.map((a, idx) => {
            let nameHTML = `<div style="font-weight: bold; text-align: left; font-size: 8.5pt;">${a.name.toUpperCase()}</div>`;
            if (a.members && a.members.length > 0) {
                nameHTML += `<div style="font-size: 7.5pt; margin-top: 1px; font-weight: normal; font-style: italic; text-align: left;">Anggota: ${a.members.join(', ')}</div>`;
            }

            const g = (a.gender || "").toUpperCase();
            const isFemale = g === 'P' || g === 'PUTRI' || g === 'PEREMPUAN' || g.startsWith('PUTRI');
            const genderShort = isFemale ? 'P' : 'L';

            return `
                            <tr>
                                <td style="font-size: 8pt; padding: 3px;">${idx + 1}</td>
                                <td style="padding: 3px;">${nameHTML}</td>
                                <td style="font-size: 8pt; padding: 3px;">${genderShort}</td>
                                <td style="font-size: 8pt; padding: 3px;">${a.birthDate || '-'}</td>
                                <td style="text-align: left; font-size: 8pt; padding: 3px;">${a.className}</td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            `;
    }).join('')}
        
        <tbody style="border:none; page-break-inside: avoid;">
            <tr>
                <td colspan="5" style="border:none; padding-top:30px;">
                    <div style="display:flex; justify-content:space-between; padding:0 50px;">
                        <div style="text-align:center;">
                            <div style="margin-bottom:50px; font-weight:bold; font-size: 9pt;">Ketua Panitia,</div>
                            <div style="border-bottom:1px solid black; width:160px; margin:0 auto;"></div>
                        </div>
                        <div style="text-align:center;">
                            <div style="margin-bottom:50px; font-weight:bold; font-size: 9pt;">Official Kontingen,</div>
                            <div style="border-bottom:1px solid black; width:160px; margin:0 auto;"></div>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
    `;

    executeIsolatedPrint(html, 'DAFTAR KONTINGEN ATLET', eventName, eventLogo, 5, true);
};
