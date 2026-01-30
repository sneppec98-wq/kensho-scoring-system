// Schedule Generator & Print
export const generateSchedule = () => {
    alert("Fitur generate jadwal akan segera hadir!");
    // TODO: Implement schedule generation logic
};

export const renderSchedule = (scheduleData) => {
    const container = document.getElementById('scheduleContent');
    if (!container) return;

    if (!scheduleData || scheduleData.length === 0) {
        container.innerHTML = `
            <div class="text-center p-12 opacity-40">
                <div class="text-6xl mb-4">📅</div>
                <p class="text-sm font-bold">JADWAL BELUM DIBUAT</p>
                <button onclick="generateSchedule()" 
                    class="mt-4 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-xl font-bold transition-all">
                    GENERATE JADWAL
                </button>
            </div>
        `;
        return;
    }

    // Render schedule table
    let html = '<div class="overflow-x-auto"><table class="w-full"><thead class="bg-slate-800/50">';
    html += '<tr><th class="p-4">WAKTU</th><th class="p-4">KELAS</th><th class="p-4">ARENA</th><th class="p-4">PESERTA</th></tr></thead><tbody>';

    scheduleData.forEach(item => {
        html += `
            <tr class="border-b border-white/5">
                <td class="p-4 font-bold text-blue-400">${item.time}</td>
                <td class="p-4">${item.className}</td>
                <td class="p-4">${item.arena}</td>
                <td class="p-4 opacity-70">${item.participants}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
};

export const printSchedule = (eventName, scheduleData, eventLogo = null) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <html>
        <head>
            <title>Jadwal Pertandingan - ${eventName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');
                body { 
                    font-family: 'Montserrat', sans-serif; 
                    padding: 40px; 
                    color: #000;
                    background: white;
                }
                .print-header { text-align: center; margin-bottom: 35px; border-bottom: 4px solid #000; padding-bottom: 30px; }
                .logo { height: 120px; max-width: 80%; object-fit: contain; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto; }
                .logo-placeholder { width: 120px; height: 120px; border: 4px solid #000; display: flex; align-items: center; justify-center; margin: 0 auto 20px auto; font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 20pt; letter-spacing: 2px; }
                h1 { font-size: 26pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 4px; color: #000; line-height: 1.2; }
                .event-name { font-size: 14pt; font-weight: 800; margin: 12px 0 0 0; text-transform: uppercase; color: #333; letter-spacing: 2px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 9.5pt; }
                th, td { border: 1px solid #000; padding: 10px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: 800; text-transform: uppercase; }
                .footer { 
                    position: fixed; 
                    bottom: 40px; 
                    left: 40px; 
                    right: 40px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                }
                .brand-info { display: flex; align-items: center; gap: 10px; font-size: 8pt; font-weight: 800; color: #999; text-transform: uppercase; }
                .brand-logo { width: 25px; height: 25px; }
                @media print {
                    @page { size: 215mm 330mm !important; margin: 10mm !important; }
                    body { padding: 0; margin: 0; }
                    .print-page { height: 310mm; display: flex; flex-direction: column; padding: 0; margin: 0; }
                    .footer { bottom: 10mm; left: 10mm; right: 10mm; position: relative; margin-top: auto; }
                }
            </style>
        </head>
        <body>
            <div class="print-page">
                <div class="print-header">
                    ${(eventLogo && eventLogo.length > 5)
            ? `<img src="${eventLogo}" class="logo">`
            : `<div class="logo-placeholder">LOGO</div>`}
                    <h1>JADWAL PERTANDINGAN</h1>
                    <p class="event-name">${eventName}</p>
                </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">WAKTU</th>
                        <th>KELAS TANDING</th>
                        <th style="width: 80px; text-align: center;">ARENA</th>
                        <th>DAFTAR PESERTA</th>
                    </tr>
                </thead>
                <tbody>
                    ${scheduleData && scheduleData.length > 0 ? scheduleData.map(item => `
                        <tr>
                            <td style="font-weight: bold;">${item.time || '-'}</td>
                            <td style="font-weight: 700;">${item.className || '-'}</td>
                            <td style="text-align: center;">${item.arena || '-'}</td>
                            <td style="font-size: 8.5pt;">${item.participants || '-'}</td>
                        </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 40px; opacity: 0.3;">BELUM ADA JADWAL</td></tr>'}
                </tbody>
            </table>
            <div class="footer">
                <div class="brand-info">
                    <img src="kensho-logo.png" class="brand-logo">
                    <span>KENSHO - Digital Scoring System</span>
                </div>
                <div style="font-size: 8pt; color: #999; font-weight: 700;">Halaman 1</div>
            </div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
