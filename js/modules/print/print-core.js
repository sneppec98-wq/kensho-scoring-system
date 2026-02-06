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

export const executeIsolatedPrint = async (htmlContent, title, eventName, eventLogo, colCount = 10, isPreview = false, useTemplate = true) => {
    // 1. Robust Extraction of HTML parts
    const trimmed = htmlContent.trim();

    // Extract Colgroup
    const colGroupMatch = trimmed.match(/<colgroup>([\s\S]*?)<\/colgroup>/i);
    const colGroup = colGroupMatch ? colGroupMatch[1] : '';

    // Extract Thead
    const theadMatch = trimmed.match(/<thead>([\s\S]*?)<\/thead>/i);
    const theadContent = theadMatch ? theadMatch[1] : '';

    // Extract Tbody / Rest
    let bodyContent = trimmed
        .replace(/<colgroup>[\s\S]*?<\/colgroup>/i, '')
        .replace(/<thead>[\s\S]*?<\/thead>/i, '')
        .trim();

    if (bodyContent.toLowerCase().includes('<tbody')) {
        const tbodyMatch = bodyContent.match(/<tbody>([\s\S]*?)<\/tbody>/i);
        bodyContent = tbodyMatch ? tbodyMatch[1] : bodyContent;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        customAlert("Pop-up terblokir! Silakan izinkan pop-up untuk mencetak.", "Pop-up Blocked", "danger");
        return;
    }

    // Reconstruction: Using HTML/CSS instead of SVG Template
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <base href="${window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)}">
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0;
                }

                html, body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                    font-family: 'Inter', 'Franklin Gothic Medium', 'Arial', sans-serif;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                /* Branding Layer (Fixed on every page) */
                .print-branding-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 210mm;
                    height: 40mm;
                    background: #fff;
                    z-index: 1000;
                    display: ${useTemplate ? 'flex' : 'none'};
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2mm 15mm;
                    box-sizing: border-box;
                }

                .branding-logo-box {
                    width: 100%;
                    height: 20mm;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 2px;
                }

                .branding-logo-box img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }

                .branding-text-box {
                    width: 100%;
                    text-align: center;
                }

                .branding-title {
                    font-size: 18pt;
                    font-weight: 900;
                    margin: 0;
                    color: #000;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    line-height: 1;
                }

                .branding-event-name {
                    font-size: 11pt;
                    font-weight: 700;
                    margin: 2px 0 0 0;
                    color: #333;
                    text-transform: uppercase;
                }

                .print-branding-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 210mm;
                    height: 18mm;
                    background: #fff;
                    z-index: 1000;
                    display: ${useTemplate ? 'flex' : 'none'};
                    align-items: center;
                    padding: 0 15mm;
                    box-sizing: border-box;
                }

                .footer-line {
                    position: absolute;
                    top: 0;
                    left: 10mm;
                    right: 10mm;
                    height: 1.5px;
                    background: #231f20;
                }

                .footer-content {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    opacity: 0.8;
                }

                .kensho-footer-logo {
                    height: 10mm;
                    width: auto;
                }

                .footer-brand-text {
                    font-size: 9pt;
                    font-weight: 900;
                    color: #000;
                    text-transform: uppercase;
                    line-height: 1.1;
                }

                /* Table Layer */
                .print-container {
                    position: relative;
                    width: 210mm;
                    margin: 0 auto;
                }

                .master-print-table {
                    position: relative;
                    width: 185mm;
                    margin: 0 auto; /* Margin top/bottom handled by thead/tfoot spacers */
                    border-collapse: collapse;
                    z-index: 5;
                }

                .master-print-table thead {
                    display: table-header-group;
                }

                .master-print-table tfoot {
                    display: table-footer-group;
                }

                .branding-spacer-header {
                    height: 42mm;
                    border: none !important;
                    background: transparent !important;
                    position: relative;
                }

                .branding-spacer-footer {
                    height: 20mm;
                    border: none !important;
                    background: transparent !important;
                    position: relative;
                }

                .master-print-table tr {
                    page-break-inside: avoid;
                }

                th, td { 
                    border: 1px solid #000; 
                    padding: 4px; 
                    text-align: center; 
                    font-size: 8pt;
                    word-wrap: break-word;
                }
                
                th { 
                    background-color: #f0f0f0 !important; 
                    text-transform: uppercase;
                    font-weight: 900;
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
                    border: none;
                    cursor: pointer;
                    display: ${isPreview ? 'flex' : 'none'};
                    align-items: center;
                    gap: 10px;
                    font-family: sans-serif;
                    font-weight: bold;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                @media print {
                    .no-print, .print-btn-container { display: none !important; }
                    .print-branding-header, .print-branding-footer { display: flex !important; }
                }
            </style>
        </head>
        <body onload="window.print()">
            <div class="print-container">
                <!-- Branding Layer (Fixed) -->
                <div class="print-branding-header">
                    <div class="branding-logo-box">
                        ${eventLogo ? `<img src="${eventLogo}" alt="Logo">` : ''}
                    </div>
                    <div class="branding-text-box">
                        <h1 class="branding-title">${title}</h1>
                        <p class="branding-event-name">${eventName}</p>
                    </div>
                </div>

                <div class="print-branding-footer">
                    <div class="footer-line"></div>
                    <div class="footer-content">
                        <img src="kensho-logo.png" class="kensho-footer-logo" alt="Kensho">
                        <div class="footer-brand-text">
                            KENSHO TECH<br>
                            TOURNAMENT APPLICATION
                        </div>
                    </div>
                </div>

                <button class="print-btn-container" onclick="window.print()">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                    CETAK SEKARANG
                </button>

                <table class="master-print-table">
                    <colgroup>
                        ${colGroup}
                    </colgroup>
                    <thead>
                        ${useTemplate ? `<tr><th colspan="${colCount}" class="branding-spacer-header"></th></tr>` : ''}
                        ${!useTemplate ? `
                        <tr>
                            <th colspan="${colCount}" style="border: none !important; background: none !important;">
                                ${generatePrintHeaderHTML(eventName, eventLogo, title)}
                            </th>
                        </tr>
                        ` : ''}
                        ${theadContent}
                    </thead>
                    ${useTemplate ? `
                    <tfoot>
                        <tr><td colspan="${colCount}" class="branding-spacer-footer"></td></tr>
                    </tfoot>
                    ` : ''}
                    <tbody>
                        ${bodyContent}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};
