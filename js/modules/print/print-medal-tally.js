/**
 * MEDAL TALLY PRINT MODULE (Logistik & Stok Medali)
 */
import { executeIsolatedPrint } from './print-core.js';
import { calculateMedalTallyNew } from '../verification/view-medal-tally.js';

export const prepareMedalTallyPrint = (athletes, classes, eventName, eventLogo) => {
    const classResults = calculateMedalTallyNew(athletes, classes);
    const hasData = classResults && classResults.length > 0;

    // Hitung Grand Total
    const grandTotal = classResults.reduce((acc, curr) => {
        acc.gold += curr.gold;
        acc.silver += curr.silver;
        acc.bronze += curr.bronze;
        acc.total += curr.total;
        return acc;
    }, { gold: 0, silver: 0, bronze: 0, total: 0 });

    let html = `
        <style>
            .tally-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
            .tally-table th { background: #f3f4f6!important; border: 1.2px solid #000; padding: 6px; font-size: 8.5pt; text-align: left; font-weight: 900; text-transform: uppercase; }
            .tally-table td { border: 1px solid #000; padding: 6px; font-size: 8.5pt; text-align: left; vertical-align: middle; }
            .text-center { text-align: center!important; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .page-break { page-break-before: always; }
            .grand-total-box { margin-top: 30px; border: 3px solid #000; padding: 20px; }
            .total-item { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 10px 0; font-size: 11pt; }
        </style>

        <div class="tally-body-flow">
            <div style="margin-bottom: 20px; text-align: left;">
                <h3 style="margin: 0; font-size: 11pt; text-transform: uppercase;">RINCIAN KEBUTUHAN STOK MEDALI</h3>
                <p style="margin: 5px 0 0 0; font-size: 8pt; opacity: 0.7;">Event: ${eventName} | Dicetak: ${new Date().toLocaleString('id-ID')}</p>
            </div>

            <table class="tally-table">
                <thead>
                    <tr>
                        <th style="width: 35px; text-align: center;">NO</th>
                        <th>KELAS PERTANDINGAN</th>
                        <th style="width: 50px; text-align: center;">ATLET</th>
                        <th style="width: 50px; text-align: center;">GOLD</th>
                        <th style="width: 50px; text-align: center;">SILVER</th>
                        <th style="width: 50px; text-align: center;">BRONZE</th>
                        <th style="width: 55px; text-align: center;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${hasData ? classResults.map((c, idx) => `
                        <tr>
                            <td class="text-center">${idx + 1}</td>
                            <td class="font-black uppercase">${c.name}</td>
                            <td class="text-center">${c.n}</td>
                            <td class="text-center">${c.gold}</td>
                            <td class="text-center">${c.silver}</td>
                            <td class="text-center">${c.bronze}</td>
                            <td class="text-center font-black">${c.total}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="7">TIDAK ADA DATA</td></tr>'}
                </tbody>
            </table>

            <!-- Footnote minimalis -->
            <p style="font-size: 7pt; margin-top: 10px; opacity: 0.6;">* Perhitungan otomatis berdasarkan kategori Festival (Alternasi) dan Open/Beregu.</p>

            <!-- Halaman Akhir: Grand Total -->
            <div class="page-break"></div>
            <div class="grand-total-box">
                <h2 style="margin: 0 0 20px 0; text-align: center; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px;">REKAPITULASI TOTAL STOK MEDALI</h2>
                
                <div class="total-item">
                    <span>TOTAL MEDALI EMAS (GOLD)</span>
                    <span class="font-black">${grandTotal.gold} PCS</span>
                </div>
                <div class="total-item">
                    <span>TOTAL MEDALI PERAK (SILVER)</span>
                    <span class="font-black">${grandTotal.silver} PCS</span>
                </div>
                <div class="total-item">
                    <span>TOTAL MEDALI PERUNGGU (BRONZE)</span>
                    <span class="font-black">${grandTotal.bronze} PCS</span>
                </div>
                <div class="total-item" style="border-bottom: none; font-size: 14pt; margin-top: 10px; padding-top: 20px; border-top: 2px solid #000;">
                    <span class="font-black">GRAND TOTAL KEBUTUHAN</span>
                    <span class="font-black" style="background: #000; color: #fff; padding: 5px 15px;">${grandTotal.total} PCS</span>
                </div>

                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="text-align: center; width: 200px;">
                        <p style="font-size: 9pt;">Disetujui Oleh,</p>
                        <div style="height: 80px;"></div>
                        <p style="font-weight: bold; text-decoration: underline;">( .................................. )</p>
                        <p style="font-size: 8pt;">Ketua Panitia / Koord. Pertandingan</p>
                    </div>
                    <div style="text-align: center; width: 200px;">
                        <p style="font-size: 9pt;">Diterima Bag. Logistik,</p>
                        <div style="height: 80px;"></div>
                        <p style="font-weight: bold; text-decoration: underline;">( .................................. )</p>
                        <p style="font-size: 8pt;">Petugas Logistik Medali</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    executeIsolatedPrint(html, 'REKAP STOK MEDALI', eventName, eventLogo, 6, true);
};
