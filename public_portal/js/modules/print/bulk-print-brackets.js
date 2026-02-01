import { db } from '../../firebase-init.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Bulk Print Brackets - Combined PDF in F4 Landscape
 * @param {string} eventId 
 * @param {string} eventName 
 * @param {string} eventLogo 
 * @param {string} type - 'open' or 'festival'
 */
export const bulkPrintBrackets = async (eventId, eventName, eventLogo, type = 'open') => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up terblokir! Silakan izinkan pop-up.");
        return;
    }

    try {
        // 1. Fetch all bracket data
        const bracketSnap = await getDocs(collection(db, `events/${eventId}/brackets`));
        const brackets = bracketSnap.docs.map(d => ({ name: d.id, ...d.data() }));

        if (brackets.length === 0) {
            alert("Belum ada bagan yang digenerate untuk event ini.");
            printWindow.close();
            return;
        }

        // 2. Fetch classes for sorting and filtering
        const classSnap = await getDocs(query(collection(db, `events/${eventId}/classes`), orderBy("name", "asc")));
        const allClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Filter brackets based on type
        const filteredBrackets = brackets.filter(b => {
            const classInfo = allClasses.find(c => c.name === b.name);
            const isFestival = (classInfo?.code || "").toString().toUpperCase().startsWith('F');
            return type === 'festival' ? isFestival : !isFestival;
        });

        if (filteredBrackets.length === 0) {
            alert(`Belum ada bagan ${type.toUpperCase()} yang digenerate.`);
            printWindow.close();
            return;
        }

        // Sort filtered brackets
        const sortedBrackets = filteredBrackets.sort((a, b) => {
            const idxA = allClasses.findIndex(c => c.name === a.name);
            const idxB = allClasses.findIndex(c => c.name === b.name);
            return idxA - idxB;
        });

        // 3. Load SVG Template
        const response = await fetch('assets/Master.svg');
        const svgTemplateText = await response.text();

        // 4. Generate HTML content
        let contentHtml = '';
        sortedBrackets.forEach((bracket, index) => {
            // Each bracket is a full page
            contentHtml += `
                <div class="bracket-page">
                    <div class="svg-wrapper" id="bracket-svg-${index}">
                        ${svgTemplateText}
                    </div>
                </div>
            `;
        });

        // 5. Write to Print Window
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bulk Print Brackets - ${eventName}</title>
                <style>
                    @page {
                        size: 330mm 210mm; /* F4 Landscape */
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: #f0f0f0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .bracket-page {
                        width: 330mm;
                        height: 210mm;
                        background: white;
                        page-break-after: always;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        overflow: hidden;
                    }
                    .svg-wrapper {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    svg {
                        width: 95% !important;
                        height: 95% !important;
                        max-width: none !important;
                        max-height: none !important;
                    }
                    @media print {
                        body { background: white; }
                        .no-print { display: none !important; }
                    }
                    .print-btn {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 9999;
                        padding: 15px 30px;
                        background: #2563eb;
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: bold;
                        cursor: pointer;
                        box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
                    }
                </style>
            </head>
            <body>
                <button class="print-btn no-print" onclick="window.print()">CETAK SEMUA BAGAN ${type.toUpperCase()} (F4 LANDSCAPE)</button>
                ${contentHtml}
                <script>
                    const eventName = "${eventName}";
                    const bracketsData = ${JSON.stringify(sortedBrackets)};
                    
                    const GOLDEN_PRESETS = {
                        2: ['fn1', 'fn2'],
                        3: ['sn3', 'sn4', 'fn1'],
                        4: ['sn1', 'sn2', 'sn3', 'sn4'],
                        5: ['qn7', 'qn8', 'sn1', 'sn2', 'sn3'],
                        6: ['qn3', 'qn4', 'qn7', 'qn8', 'sn1', 'sn3'],
                        7: ['qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8', 'sn1'],
                        8: ['qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8'],
                        9: ['p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7'],
                        10: ['p_n_7', 'p_n_8', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn6', 'qn7'],
                        11: ['p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn7'],
                        12: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5', 'qn7'],
                        13: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5'],
                        14: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn5'],
                        15: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1'],
                        16: ['p_n_1', 'p_n_2', 'p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16']
                    };

                    function getSlotComponents(svg, slotId) {
                        if (slotId.startsWith('p_n_')) {
                            const x = slotId.replace('p_n_', '');
                            return [slotId, "p_k_" + x, "n_k_" + x, "S_" + x, "sp_" + x, (x === "1" ? "p_nama_1" : "")].filter(id => id);
                        }
                        if (slotId.startsWith('qn')) {
                            const x = slotId.replace('qn', '');
                            return ["qn" + x, "qk" + x, "qnk" + x, "qs" + x, "qsp" + x];
                        }
                        if (slotId.startsWith('sn')) {
                            const x = slotId.replace('sn', '');
                            return ["sn" + x, "sk" + x, "snk" + x, "ss" + x, "ssp" + x];
                        }
                        if (slotId.startsWith('fn')) {
                            return slotId === 'fn1' ? ["text5989", "text5993", "text5997", "fs1", "text5985"] : ["fn2", "fk2", "fnk2", "fs2", "fsp2"];
                        }
                        return [];
                    }

                    function showPath(svg, startId) {
                        const components = getSlotComponents(svg, startId);
                        components.forEach(id => {
                            const el = svg.getElementById(id);
                            if (el) el.style.opacity = "1";
                        });

                        if (startId.startsWith('p_n_')) {
                            let x = parseInt(startId.replace('p_n_', ''));
                            showPath(svg, "qn" + Math.ceil(x / 2));
                        } else if (startId.startsWith('qn')) {
                            let x = parseInt(startId.replace('qn', ''));
                            showPath(svg, "sn" + Math.ceil(x / 2));
                        } else if (startId.startsWith('sn')) {
                            let x = parseInt(startId.replace('sn', ''));
                            showPath(svg, "fn" + (x <= 2 ? '1' : '2'));
                        }
                    }

                    bracketsData.forEach((data, index) => {
                        const svg = document.querySelector("#bracket-svg-" + index + " svg");
                        if (!svg) return;

                        // 1. Clean Placeholders
                        const placeholders = ["NAMA PESERTA", "SKOR", "NAMA EVENT", "KONTINGEN PESERTA", "KELAS KATEGORI", "1/1"];
                        svg.querySelectorAll('text, tspan').forEach(el => {
                            if (placeholders.includes(el.textContent.trim())) el.textContent = "";
                        });

                        // 2. Set Headers
                        const eventEl = svg.querySelector('#Nama_event');
                        if (eventEl) (eventEl.querySelector('tspan') || eventEl).textContent = eventName;
                        const classEl = svg.querySelector('#Kelas_Kategori');
                        if (classEl) (classEl.querySelector('tspan') || classEl).textContent = data.name;

                        // 3. Hide all slots
                        for (let i = 1; i <= 16; i++) {
                            getSlotComponents(svg, "p_n_" + i).forEach(id => { const el = svg.getElementById(id); if (el) el.style.opacity = "0"; });
                            if (i <= 8) getSlotComponents(svg, "qn" + i).forEach(id => { const el = svg.getElementById(id); if (el) el.style.opacity = "0"; });
                            if (i <= 4) getSlotComponents(svg, "sn" + i).forEach(id => { const el = svg.getElementById(id); if (el) el.style.opacity = "0"; });
                            if (i <= 2) getSlotComponents(svg, "fn" + i).forEach(id => { const el = svg.getElementById(id); if (el) el.style.opacity = "0"; });
                        }

                        // 4. Fill Data & Show Paths
                        const participants = data.participants || [];
                        const pattern = GOLDEN_PRESETS[participants.length] || [];
                        
                        participants.forEach((p, idx) => {
                            const slotId = pattern[idx];
                            if (!slotId) return;

                            const nameEl = svg.getElementById(slotId);
                            if (nameEl) (nameEl.querySelector('tspan') || nameEl).textContent = p.name;
                            
                            const numMatches = slotId.match(/\\d+/);
                            const num = numMatches ? numMatches[0] : "";
                            const teamId = slotId.startsWith('p_n_') ? "p_k_" + num : "";
                            if (teamId) {
                                const teamEl = svg.getElementById(teamId);
                                if (teamEl) (teamEl.querySelector('tspan') || teamEl).textContent = p.team || "-";
                            }

                            showPath(svg, slotId);
                        });

                        // 5. Fill Winners
                        if (data.winners) {
                            Object.keys(data.winners).forEach(id => {
                                const el = svg.getElementById(id);
                                if (el) (el.querySelector('tspan') || el).textContent = data.winners[id];
                            });
                        }
                    });
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();

    } catch (err) {
        console.error("Bulk Print Error:", err);
        alert("Gagal menyiapkan dokumen cetak.");
        printWindow.close();
    }
};
