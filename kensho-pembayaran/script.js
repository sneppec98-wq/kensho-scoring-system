import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM",
    authDomain: "adm-spartan-sport-2f4ec.firebaseapp.com",
    databaseURL: "https://adm-spartan-sport-2f4ec-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "adm-spartan-sport-2f4ec",
    storageBucket: "adm-spartan-sport-2f4ec.firebasestorage.app",
    messagingSenderId: "847888051133",
    appId: "1:847888051133:web:fdd362c642c654bd2080d4",
    measurementId: "G-SC7SBDVHZ2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventId = "WgVTkA88gmI6ogrW39hf";

let allAthletes = [];
let allClasses = {};

document.addEventListener('DOMContentLoaded', async () => {
    const teamSelect = document.getElementById('select-team');
    const urlParams = new URLSearchParams(window.location.search);
    let initialTeam = urlParams.get('team');

    try {
        // 1. Fetch ALL athletes once
        const athleteSnap = await getDocs(collection(db, `events/${eventId}/athletes`));
        allAthletes = athleteSnap.docs.map(d => d.data());

        // 2. Fetch ALL classes for accurate mapping
        const classSnap = await getDocs(collection(db, `events/${eventId}/classes`));
        classSnap.forEach(d => {
            const data = d.data();
            allClasses[data.code?.toUpperCase() || data.id?.toUpperCase()] = data;
        });

        // 2. Extract Unique Teams
        const uniqueTeams = [...new Set(allAthletes.map(a => (a.team || "").trim().toUpperCase()))]
            .filter(t => t !== "")
            .sort();

        // 3. Populate Dropdown
        teamSelect.innerHTML = '<option value="">-- Pilih Kontingen --</option>' +
            uniqueTeams.map(t => `<option value="${t}" ${initialTeam && initialTeam.toUpperCase() === t ? 'selected' : ''}>${t}</option>`).join('');

        // 4. Handle Selection Change
        teamSelect.onchange = (e) => {
            const selected = e.target.value;
            if (selected) {
                // Update URL without full reload for better experience, or just reload with param
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('team', selected);
                window.history.pushState({}, '', newUrl);

                processTeamData(selected);
            }
        };

        // 5. Initial Load if parameter exists
        if (initialTeam) {
            processTeamData(initialTeam);
        } else {
            // Show empty table or default
            updateInvoiceTable({ fest: 0, open: 0, beregu: 0, kontingen: 0, cashback: 0 }, "PILIH KONTINGEN");
        }

    } catch (err) {
        console.error("Gagal sinkronisasi data:", err);
        teamSelect.innerHTML = '<option value="">-- Gagal Memuat Data --</option>';
    }

    setupStaticActions();
});

function processTeamData(teamName, isBatch = false) {
    const teamNameUpper = teamName.toUpperCase().trim();

    // Update Brand Label
    const billToEl = document.getElementById('bill-to');
    if (billToEl) billToEl.innerText = `OFFICIAL KONTINGEN ${teamNameUpper}`;

    // Generate Unique Invoice Number (Hash based on team name)
    const generateInvoiceId = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const numericId = Math.abs(hash % 900000) + 100000;
        return `#INV-${numericId}`;
    };

    const invEl = document.getElementById('invoice-number');
    if (invEl) invEl.innerText = generateInvoiceId(teamNameUpper);

    // Filter data from cached allAthletes
    const teamAthletes = allAthletes.filter(a => (a.team || "").trim().toUpperCase() === teamNameUpper);

    let festCount = 0;
    let openCount = 0;
    let bereguCount = 0;

    teamAthletes.forEach(a => {
        const clsCode = (a.classCode || "").toUpperCase();
        const classInfo = allClasses[clsCode];

        if (classInfo) {
            if (classInfo.type === 'BEREGU') {
                bereguCount++;
            } else {
                const isF = (classInfo.code || "").toString().toUpperCase().startsWith('F');
                if (isF) festCount++; else openCount++;
            }
        } else {
            // Fallback to string matching if class data not found
            const clsName = (a.className || "").toUpperCase();
            if (clsName.includes("BEREGU")) {
                bereguCount++;
            } else if (clsCode.startsWith("F") || clsName.includes("FESTIVAL")) {
                festCount++;
            } else {
                openCount++;
            }
        }
    });

    // Perbaikan: Cashback dihitung dari TOTAL SELURUH entri (Open + Festival + Beregu)
    const totalEntries = festCount + openCount + bereguCount;

    updateInvoiceTable({
        fest: festCount,
        open: openCount,
        beregu: bereguCount,
        kontingen: teamAthletes.length > 0 ? 1 : 0,
        cashback: totalEntries
    }, "", isBatch);
}

function updateInvoiceTable(data, teamDisplay = "", isBatch = false) {
    const tbody = document.querySelector('tbody');
    const prices = { fest: 250000, open: 250000, beregu: 300000, kontingen: 100000, cashback: 25000 };

    let html = '';
    let total = 0;

    const addRow = (label, sub, qty, price) => {
        if (qty === 0 && label !== "Kontingen") return;
        const lineTotal = qty * price;
        total += lineTotal;
        html += `
            <tr ${isBatch ? '' : 'style="opacity: 0; transform: translateX(-10px);"'}>
                <td>
                    <strong>${label}</strong>
                    <p>${sub}</p>
                </td>
                <td class="text-center">${qty}</td>
                <td class="text-right">Rp ${price.toLocaleString('id-ID')}</td>
                <td class="text-right">Rp ${lineTotal.toLocaleString('id-ID')}</td>
            </tr>
        `;
    };

    addRow("Perorangan Festival", "Kategori Tanding / Kata Festival", data.fest, prices.fest);
    addRow("Perorangan Open", "Kategori Prestasi (Open)", data.open, prices.open);
    addRow("Beregu Open", "Kategori Kata Beregu / Team Open", data.beregu, prices.beregu);
    addRow("Kontingen", "Biaya Administrasi Kontingen", data.kontingen, prices.kontingen);

    // Space & Cashback
    html += `<tr class="spacer-row" style="height: 20px; border: none;"><td colspan="4" style="border: none;"></td></tr>`;

    const cbTotal = data.cashback * prices.cashback;
    total -= cbTotal;
    html += `
        <tr ${isBatch ? '' : 'style="opacity: 0; transform: translateX(-10px);"'}>
            <td>
                <strong>CashBack</strong>
                <p>Potongan biaya pendaftaran per atlet</p>
            </td>
            <td class="text-center">${data.cashback}</td>
            <td class="text-right">- Rp ${prices.cashback.toLocaleString('id-ID')}</td>
            <td class="text-right">- Rp ${cbTotal.toLocaleString('id-ID')}</td>
        </tr>
    `;

    tbody.innerHTML = html;
    document.getElementById('grand-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;

    if (!isBatch) {
        // Trigger animation
        const rows = tbody.querySelectorAll('tr:not(.spacer-row)');
        rows.forEach((row, index) => {
            setTimeout(() => {
                row.style.transition = 'all 0.4s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateX(0)';
            }, index * 80);
        });
    }
}

function setupStaticActions() {
    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) btnPrint.onclick = () => window.print();

    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
        btnDownload.onclick = () => {
            alert('Gunakan opsi "Save as PDF" pada menu Cetak untuk hasil maksimal.');
        };
    }

    const btnDownloadAll = document.getElementById('btn-download-all');
    if (btnDownloadAll) {
        btnDownloadAll.onclick = async () => {
            await downloadAllInvoices();
        };
    }
}

async function downloadAllInvoices() {
    const printContainer = document.getElementById('print-all-container');
    const mainContent = document.querySelector('.invoice-card');
    const teamSelect = document.getElementById('select-team');

    // Get all unique teams from the dropdown options
    const teams = Array.from(teamSelect.options)
        .map(opt => opt.value)
        .filter(val => val !== "");

    if (teams.length === 0) {
        alert("Tidak ada data kontingen untuk didownload.");
        return;
    }

    // Show loading state
    const originalText = document.getElementById('btn-download-all').innerText;
    document.getElementById('btn-download-all').innerText = "Menyiapkan PDF...";
    document.getElementById('btn-download-all').disabled = true;

    printContainer.innerHTML = '';

    // Temporarily hide the main card to avoid double printing
    const originalMainDisplay = mainContent.style.display;
    mainContent.classList.add('no-print');

    try {
        for (let i = 0; i < teams.length; i++) {
            const teamName = teams[i];

            // We use a temporary div to generate the invoice content
            // We reuse the existing logic by temporarily setting the UI
            processTeamData(teamName, true);

            // Clone the current invoice card
            const clone = mainContent.cloneNode(true);
            clone.classList.remove('no-print');

            // Add page break except for the last one
            if (i < teams.length - 1) {
                const pb = document.createElement('div');
                pb.className = 'page-break';
                printContainer.appendChild(clone);
                printContainer.appendChild(pb);
            } else {
                printContainer.appendChild(clone);
            }
        }

        // Wait a bit for animations/rendering if needed
        await new Promise(resolve => setTimeout(resolve, 500));

        window.print();

    } catch (err) {
        console.error("Gagal generate PDF:", err);
        alert("Terjadi kesalahan saat menyiapkan PDF.");
    } finally {
        // Restore UI
        mainContent.classList.remove('no-print');
        mainContent.style.display = originalMainDisplay;
        printContainer.innerHTML = '';
        document.getElementById('btn-download-all').innerText = originalText;
        document.getElementById('btn-download-all').disabled = false;

        // Reset to original selection if possible
        const currentTeam = new URLSearchParams(window.location.search).get('team');
        if (currentTeam) processTeamData(currentTeam);
    }
}
