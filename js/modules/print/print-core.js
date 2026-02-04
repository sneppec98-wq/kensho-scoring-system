/**
 * PRINT CORE MODULE - FINAL PAGINATION & BORDER FIX
 */

export const generatePrintHeaderHTML = (eventName, eventLogo, title) => {
    return `
        <header style="text-align: center; margin-bottom: 20px; margin-top: -10px;">
            ${eventLogo ? `<img src="${eventLogo}" style="width: 600px; max-width: 100%; margin-bottom: 12px;">` : ''}
            <div style="font-size: 26px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${title}</div>
            <div style="font-size: 18px; margin-top: 6px; font-weight: bold; color: #333;">${eventName || 'Nama Event'}</div>
        </header>
    `;
};

export const executeIsolatedPrint = (htmlContent, title, eventName, eventLogo, colCount = 10, isPreview = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        customAlert("Pop-up terblokir! Silakan izinkan pop-up untuk mencetak.", "Pop-up Blocked", "danger");
        return;
    }

    // ONLY extract colgroup if it appears at the very beginning (top level) of the content
    // This prevents picking up colgroups from nested tables inside the report
    const leadingColGroupMatch = htmlContent.trim().match(/^<colgroup>[\s\S]*?<\/colgroup>/);
    const colGroup = leadingColGroupMatch ? leadingColGroupMatch[0] : '';
    const bodyContent = leadingColGroupMatch
        ? htmlContent.trim().replace(/^<colgroup>[\s\S]*?<\/colgroup>/, '').trim()
        : htmlContent.trim();

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <base href="${window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)}">
            <style>
                @page {
                    size: 210mm 330mm;
                    margin: 5mm 15mm 5mm 15mm;
                }

                html, body {
                    height: auto;
                    overflow: visible !important;
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .master-print-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    border: none;
                }

                th, td { 
                    border: none; 
                    padding: 8px; 
                    text-align: center; 
                    word-wrap: break-word;
                    font-size: 10pt;
                }
                
                /* ONLY TBODY (DATA) GETS BORDERS */
                tbody th, tbody td {
                    border: 1px solid black;
                }
                
                th { 
                    background-color: #f0f0f0 !important; 
                    text-transform: uppercase;
                }

                /* FORCE PAGE BREAKS FOR THEAD AND TFOOT */
                thead { display: table-header-group; }
                tfoot { display: table-footer-group; }

                /* Allow layout rows to break, but prevent data rows from splitting mid-way */
                .master-print-table > tbody > tr { page-break-inside: auto !important; }
                table:not(.master-print-table) tr { page-break-inside: avoid; }

                .footer-wrapper {
                    border-top: 1px solid #ccc;
                    padding: 4px 0 6px 0;
                    margin-top: 4px;
                    font-size: 10px;
                    width: 100%;
                    background: white;
                }

                .print-btn-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 9999;
                    background: #22c55e;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 50px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
                    border: none;
                    display: ${isPreview ? 'flex' : 'none'};
                    align-items: center;
                    gap: 10px;
                }

                @media print {
                    .no-print, .print-btn-container { display: none !important; }
                    /* Ensure no outer borders on the main table wrapper */
                    .master-print-table { border: none !important; }
                }
            </style>
        </head>
        <body onload="initPrint()">
            <script>
                function initPrint() {
                    const images = document.querySelectorAll('img');
                    let loadedCount = 0;
                    const totalImages = images.length;

                    if (totalImages === 0) {
                        finish();
                        return;
                    }

                    function imageLoaded() {
                        loadedCount++;
                        if (loadedCount === totalImages) {
                            setTimeout(finish, 500);
                        }
                    }

                    images.forEach(img => {
                        if (img.complete) {
                            imageLoaded();
                        } else {
                            img.addEventListener('load', imageLoaded);
                            img.addEventListener('error', imageLoaded);
                        }
                    });

                    // Safety timeout
                    setTimeout(() => {
                        if (loadedCount < totalImages) finish();
                    }, 5000);
                }

                function finish() {
                    window.print();
                    if (!${isPreview}) {
                        setTimeout(() => window.close(), 1000);
                    }
                }
            </script>
            <button class="print-btn-container" onclick="window.print()">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                CETAK SEKARANG
            </button>

            <table class="master-print-table">
                ${colGroup}
                <thead>
                    <tr>
                        <th colspan="${colCount}" style="border: none !important; background: none !important; padding: 0;">
                            ${generatePrintHeaderHTML(eventName, eventLogo, title)}
                        </th>
                    </tr>
                </thead>
                ${bodyContent.includes('<tbody') ? bodyContent : `<tbody>${bodyContent}</tbody>`}
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
};
