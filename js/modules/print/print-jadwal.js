import { generatePrintHeaderHTML, executeIsolatedPrint } from './print-core.js';
import { getLatestSchedule } from '../schedule-generator.js';

export const prepareJadwalPrint = (eventName, eventLogo) => {
    const schedule = getLatestSchedule();
    if (!schedule || schedule.length === 0) {
        alert("Silakan generate jadwal terlebih dahulu!");
        return;
    }

    let html = '';

    schedule.forEach((dayData, dayIdx) => {
        html += `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; align-items: start; width: 100%; margin: 10px auto 0;">
        `;

        dayData.forEach((arena, arenaIdx) => {
            const totalLoad = arena.classes.reduce((sum, cls) => sum + (cls.athleteCount || 0), 0);

            html += `
                <div style="break-inside: avoid; margin-bottom: 10px;">
                    <div style="background: #000; color: #fff; padding: 2px 8px; display: inline-block; font-weight: 900; font-size: 7.5pt; text-transform: uppercase; margin-bottom: 3px;">
                        TATAMI ${arenaIdx + 1}
                    </div>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                        <thead>
                            <tr>
                                <th style="border: 1px solid black; background: #f0f0f0; padding: 3px; font-size: 7pt; width: 22px;">NO</th>
                                <th style="border: 1px solid black; background: #f0f0f0; padding: 3px; font-size: 7pt; text-align: left; padding-left: 6px;">KELAS PERTANDINGAN</th>
                                <th style="border: 1px solid black; background: #f0f0f0; padding: 3px; font-size: 7pt; width: 45px;">EST.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${arena.classes.map((cls, idx) => `
                                <tr>
                                    <td style="border: 1px solid black; padding: 2px; text-align: center; font-size: 6.5pt;">${idx + 1}</td>
                                    <td style="border: 1px solid black; padding: 2px 6px; font-weight: bold; text-transform: uppercase; font-size: 6.5pt; line-height: 1; text-align: left;">
                                        ${cls.name}
                                    </td>
                                    <td style="border: 1px solid black; padding: 2px; text-align: center;">
                                        <span style="font-weight: 900; font-size: 7pt;">${cls.athleteCount}</span>
                                        <span style="font-size: 5.5pt; opacity: 0.7;">${cls.isTeamCategory ? 'TIM' : 'ATL'}</span>
                                    </td>
                                </tr>
                            `).join('')}
                            <tr style="background: #f9f9f9;">
                                <td colspan="2" style="border: 1px solid black; padding: 3px; text-align: right; padding-right: 10px; font-weight: 900; font-size: 6.5pt; text-transform: uppercase;">
                                    TOTAL TATAMI ${arenaIdx + 1}
                                </td>
                                <td style="border: 1px solid black; padding: 3px; text-align: center; font-weight: 900; font-size: 7pt; color: #2563eb;">
                                    ${totalLoad}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });

        html += `</div>`;
    });

    // We pass 2 columns as the base count for the header/footer colspan logic if needed
    // But executeIsolatedPrint uses 10 as default. Here the schedule is special because it has sub-tables.
    // However, the master table structure in print-core.js expects one big table.
    // I will wrap this in a single td for the master table.

    const wrappedHtml = `
        <tbody>
            <tr>
                <td style="border: none !important; padding: 0 !important; text-align: left;">
                    <div class="schedule-print-wrapper">
                        ${html}
                    </div>
                </td>
            </tr>
        </tbody>
    `;

    executeIsolatedPrint(wrappedHtml, 'REKAPITULASI JADWAL PERTANDINGAN', eventName, eventLogo, 1, true);
};
