// Excel Import/Export Functions
import { showProgress, updateProgress, hideProgress, sleep, toggleModal, customAlert, customConfirm } from './ui-helpers.js';
import { db } from '../firebase-init.js';
import { doc, setDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global variables
export let pendingImportData = [];

export const downloadClassTemplate = () => {
    const headers = [["KODE", "NAMA KELAS", "KATEGORI UMUR", "JENIS KELAMIN", "MIN USIA", "MAX USIA", "MIN BERAT", "MAX BERAT"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Kelas");

    ws['!cols'] = [
        { wch: 10 }, { wch: 35 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, "Template_Kelas_Kensho.xlsx");
};

// Helper: Find value by flexible header aliases
const findVal = (row, aliases) => {
    const keys = Object.keys(row);
    for (const alias of aliases) {
        const found = keys.find(k => {
            const uk = k.toUpperCase().trim();
            const ua = alias.toUpperCase().trim();
            return uk === ua || uk.includes(ua);
        });
        if (found) return row[found];
    }
    return null;
};

// Helper: Parse Indonesian Date (03 Juli 2016)
function parseIndoDate(dateVal) {
    if (!dateVal) return "";
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];

    const dateStr = dateVal.toString().toUpperCase().trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const months = {
        'JANUARI': '01', 'FEBRUARI': '02', 'MARET': '03', 'APRIL': '04', 'MEI': '05', 'JUNI': '06',
        'JULI': '07', 'AGUSTUS': '08', 'SEPTEMBER': '09', 'OKTOBER': '10', 'NOVEMBER': '11', 'DESEMBER': '12',
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MEI': '05', 'JUN': '06',
        'JUL': '07', 'AGU': '08', 'SEP': '09', 'OKT': '10', 'NOV': '11', 'DES': '12'
    };

    const parts = dateStr.split(/[\s/-]+/);
    if (parts.length === 3) {
        if (parts[0].length === 4 && parts[2].length === 4) {
            const yearCandidate = parseInt(parts[2]);
            if (yearCandidate > 2000) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].slice(-2)}`;
            }
        }

        let day = parts[0].padStart(2, '0');
        if (day.length > 2) day = day.slice(-2);

        let month = months[parts[1]] || parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = "20" + year;
        if (year.length === 4) return `${year}-${month}-${day}`;

        if (parts[0].length === 4) {
            return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
    }
    return dateStr;
}

export const importClassesFromExcel = async (event, eventId) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                await customAlert("File Excel kosong atau tidak valid.", "Impor Gagal", "danger");
                return;
            }

            const okImport = await customConfirm({
                title: "Konfirmasi Impor",
                message: `Impor ${jsonData.length} kelas dari Excel? (Data lama dengan kode yang sama akan diperbarui)`,
                confirmText: "Ya, Impor Semua",
                type: 'info'
            });

            if (okImport) {
                showProgress('IMPORT KELAS', jsonData.length);
                try {
                    let successCount = 0;
                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        let type = "PERORANGAN";
                        let genderRaw = "PUTRA";

                        for (const key of Object.keys(row)) {
                            const upperKey = key.toUpperCase().trim();
                            const val = (row[key] || "").toString().toUpperCase().trim();

                            if (upperKey.includes("TIPE") || upperKey.includes("TYPE") || upperKey.includes("JENIS")) {
                                if (val.includes("BEREGU") || val.includes("TEAM") || val.includes("GROUP")) type = "BEREGU";
                                else if (val.includes("INDIVIDU") || val.includes("PERORANGAN") || val.includes("SINGLE")) type = "PERORANGAN";
                            }
                            if (upperKey.includes("KELAMIN") || upperKey.includes("GENDER") || upperKey.includes("SEX")) {
                                if (val.includes("PEREMPUAN") || val.includes("PUTRI") || val === "P" || val === "PI") genderRaw = "PUTRI";
                                else if (val.includes("LAKI") || val.includes("PUTRA") || val === "L" || val === "PA") genderRaw = "PUTRA";
                            }
                        }

                        const classData = {
                            code: (row["KODE"] || "").toString().toUpperCase().trim(),
                            name: (row["NAMA KELAS"] || "").toString().toUpperCase().trim(),
                            ageCategory: row["KATEGORI UMUR"] || "",
                            gender: genderRaw,
                            ageMin: row["MIN USIA"] || 0,
                            ageMax: row["MAX USIA"] || 99,
                            weightMin: row["MIN BERAT"] || 0,
                            weightMax: row["MAX BERAT"] || 999,
                            type: type
                        };

                        if (classData.code && classData.name) {
                            await setDoc(doc(db, `events/${eventId}/classes`, classData.code), classData);
                            successCount++;
                        }
                        updateProgress(i + 1, jsonData.length);
                    }
                    await customAlert(`Berhasil mengimpor ${successCount} kelas!`, "Impor Selesai", "info");
                    event.target.value = "";
                } catch (err) {
                    console.error("Excel Import Error (Internal):", err);
                    await customAlert("Terjadi kesalahan saat menyimpan data: " + err.message, "Gagal", "danger");
                } finally {
                    hideProgress();
                }
            }
        } catch (err) {
            console.error("Excel Import Error (External):", err);
            await customAlert("Gagal membaca file Excel. Pastikan formatnya benar.", "Error File", "danger");
        }
    };
    reader.readAsArrayBuffer(file);
};

export const importAthletesFromExcel = async (event, eventId, latestClasses) => {
    const file = event.target.files[0];
    if (!file) return;

    showProgress('MEMBACA FILE', 1);
    document.getElementById('loader-status').innerText = 'DIPROSES... MOHON TUNGGU SEBENTAR';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            await sleep(100);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            let targetSheet = null;
            let jsonData = [];

            document.getElementById('loader-title').innerText = 'MENCARI DATA';

            for (let i = 0; i < workbook.SheetNames.length; i++) {
                const sheetName = workbook.SheetNames[i];
                updateProgress(i + 1, workbook.SheetNames.length);
                document.getElementById('loader-status').innerText = `MEMERIKSA SHEET: ${sheetName}`;
                await sleep(10);
                const isHidden = workbook.Workbook && workbook.Workbook.Sheets && workbook.Workbook.Sheets[i] && workbook.Workbook.Sheets[i].Hidden !== 0;
                if (isHidden) continue;

                const sheet = workbook.Sheets[sheetName];
                const tempJson = XLSX.utils.sheet_to_json(sheet);
                if (tempJson.length > 0) {
                    const firstRow = tempJson[0];
                    const hasName = findVal(firstRow, ["NAMA ATLET", "NAME"]);
                    const hasCode = findVal(firstRow, ["KODE", "CODE"]);
                    if (hasName || hasCode) {
                        targetSheet = sheet;
                        jsonData = tempJson;
                        break;
                    }
                }
            }

            if (!targetSheet) {
                targetSheet = workbook.Sheets[workbook.SheetNames[0]];
                jsonData = XLSX.utils.sheet_to_json(targetSheet);
            }

            const validData = jsonData.filter(row => {
                const name = (findVal(row, ["NAMA ATLET", "NAME"]) || "").toString().trim();
                const code = (findVal(row, ["KODE", "CODE", "ID"]) || "").toString().trim();
                return name.length > 0 && code.length > 0;
            });

            if (validData.length === 0) {
                await customAlert("Tidak ditemukan data atlet valid di file Excel ini.\nPastikan kolom 'NAMA ATLET' dan 'KODE' sudah terisi.", "Data Tidak Ditemukan", "danger");
                hideProgress();
                return;
            }

            // ---------------------------------------------------------
            // SMART LOGIC: Fetch Existing Data for Comparison
            // ---------------------------------------------------------
            document.getElementById('loader-status').innerText = 'MENGAMBIL DATA EKSISTING...';
            const existingSnap = await getDocs(collection(db, `events/${eventId}/athletes`));
            const existingMap = {};
            existingSnap.docs.forEach(doc => {
                const d = doc.data();
                // Create unique key: NAME_TEAM_CODE
                const key = `${d.name}_${d.team}_${d.classCode}`.toUpperCase().trim();
                existingMap[key] = { id: doc.id, ...d };
            });

            const classMap = {};
            latestClasses.forEach(cls => {
                if (cls.code) classMap[cls.code.toString().toUpperCase().trim()] = {
                    name: cls.name, type: cls.type || 'PERORANGAN'
                };
            });

            pendingImportData = [];
            let newCount = 0;
            let updateCount = 0;
            let skipCount = 0;
            let errorCount = 0;
            const previewBody = document.getElementById('import-preview-body');
            previewBody.innerHTML = '';

            validData.forEach(row => {
                const name = (findVal(row, ["NAMA ATLET", "NAME"]) || "").toString().toUpperCase().trim();
                const code = (findVal(row, ["KODE", "CODE", "ID"]) || "").toString().toUpperCase().trim();
                const team = (findVal(row, ["KONTINGEN", "TEAM", "REGU"]) || "INDEPENDEN").toString().toUpperCase().trim();
                const genderRaw = (findVal(row, ["JENIS", "SEX", "KELAMIN", "GENDER"]) || "L").toString().toUpperCase().trim();
                const weight = parseFloat(findVal(row, ["BERAT", "WEIGHT"])) || 0;
                const birthRaw = findVal(row, ["LAHIR", "BIRTH", "DATE"]);

                const classConfig = classMap[code];
                const isClassOk = !!classConfig;
                if (!isClassOk) errorCount++;

                const gender = (genderRaw.includes("P") || genderRaw.includes("PI")) ? "PUTRI" : "PUTRA";
                const birth = parseIndoDate(birthRaw);

                const members = [];
                if (classConfig && classConfig.type === 'BEREGU') {
                    const m2 = findVal(row, ["ANGGOTA 2", "MEMBER 2"]);
                    const m3 = findVal(row, ["ANGGOTA 3", "MEMBER 3"]);
                    if (m2) members.push(m2.toString().toUpperCase().trim());
                    if (m3) members.push(m3.toString().toUpperCase().trim());
                }

                // SMART CHECK
                const lookupKey = `${name}_${team}_${code}`.toUpperCase().trim();
                const existing = existingMap[lookupKey];
                let action = 'ADD';
                let actionLabel = '[+] BARU';
                let actionClass = 'text-green-400 bg-green-400/10';

                if (existing) {
                    // Compare fields to see if update is needed
                    const isSame = existing.gender === gender &&
                        existing.birthDate === birth &&
                        existing.weight === weight &&
                        JSON.stringify(existing.members || []) === JSON.stringify(members);

                    if (isSame) {
                        action = 'SKIP';
                        actionLabel = '[=] SAMA';
                        actionClass = 'text-slate-400 bg-slate-400/10 opacity-50';
                        skipCount++;
                    } else {
                        action = 'UPDATE';
                        actionLabel = '[~] UPDATE';
                        actionClass = 'text-blue-400 bg-blue-400/10';
                        updateCount++;
                    }
                } else {
                    newCount++;
                }

                const athlete = {
                    name: name,
                    team: team,
                    code: code,
                    className: classConfig ? classConfig.name : `KELAS TIDAK DITEMUKAN (${code})`,
                    isOk: isClassOk,
                    gender: gender,
                    birthDate: birth,
                    weight: weight,
                    members: members,
                    action: action,
                    existingId: existing ? existing.id : null
                };

                pendingImportData.push(athlete);

                previewBody.innerHTML += `
                    <tr class="border-b border-white/5 ${!isClassOk ? 'bg-red-500/5' : (action === 'SKIP' ? 'opacity-40' : '')}">
                        <td class="p-4">
                            <span class="px-2 py-1 rounded text-[8px] font-black ${actionClass}">${actionLabel}</span>
                        </td>
                        <td class="p-4 text-white">
                            <div class="font-bold">${athlete.name}</div>
                            ${members.length > 0 ? `<div class="text-[8px] opacity-40 uppercase mt-1">👥 ${members.join(' & ')}</div>` : ''}
                        </td>
                        <td class="p-4 opacity-70 font-bold">${athlete.team}</td>
                        <td class="p-4 text-blue-400 font-bold text-xs">
                            <div class="flex flex-col">
                                <span class="text-[8px] opacity-40 font-black">${athlete.code || ''}</span>
                                <span class="${!isClassOk ? 'text-red-500' : ''}">${athlete.className || '-'}</span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            document.getElementById('preview-total-count').innerText = validData.length;
            document.getElementById('preview-ready-count').innerText = newCount;
            document.getElementById('preview-update-count').innerText = updateCount;
            document.getElementById('preview-skip-count').innerText = skipCount;
            document.getElementById('preview-error-count').innerText = errorCount;

            hideProgress();
            toggleModal('modal-import-athlete-preview', true);
            event.target.value = "";
        } catch (err) {
            console.error(err);
            await customAlert("Error reading Excel: " + err.message, "Gagal Baca Excel", "danger");
            hideProgress();
        }
    };
    reader.readAsArrayBuffer(file);
};

export const proceedWithConfirmedImport = async (eventId) => {
    if (pendingImportData.length === 0) return;

    const toProcess = pendingImportData.filter(a => a.action !== 'SKIP');
    if (toProcess.length === 0) {
        await customAlert("Tidak ada data baru atau perubahan yang perlu disimpan.", "Tidak Ada Perubahan", "info");
        toggleModal('modal-import-athlete-preview', false);
        return;
    }

    const errors = toProcess.filter(a => !a.isOk).length;
    if (errors > 0) {
        const okProceed = await customConfirm({
            title: "Data Bermasalah",
            message: `Ada ${errors} data dengan kode kelas yang TIDAK DITEMUKAN. Lanjutkan?`,
            confirmText: "Lanjutkan Saja",
            type: 'danger'
        });
        if (!okProceed) return;
    }

    const btn = document.getElementById('btnConfirmImport');
    btn.disabled = true;
    btn.innerText = "PROSES CLOUD...";

    showProgress('IMPORT DATABASE', toProcess.length);
    try {
        let saved = 0;
        let updated = 0;

        for (let i = 0; i < toProcess.length; i++) {
            const a = toProcess[i];
            const data = {
                name: a.name,
                team: a.team,
                gender: a.gender,
                birthDate: a.birthDate,
                weight: a.weight,
                classCode: a.code,
                className: a.className,
                members: a.members,
                updatedAt: new Date().toISOString()
            };

            if (a.action === 'UPDATE' && a.existingId) {
                await updateDoc(doc(db, `events/${eventId}/athletes`, a.existingId), data);
                updated++;
            } else {
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, `events/${eventId}/athletes`), data);
                saved++;
            }

            updateProgress(i + 1, toProcess.length);
            if (i % 20 === 0) await sleep(5);
        }

        await customAlert(`PROSES SELESAI!\n- Peserta Baru: ${saved}\n- Peserta Terupdate: ${updated}\n- Dilewati (Sama): ${pendingImportData.length - toProcess.length}`, "Sinkronisasi Berhasil", "info");
        toggleModal('modal-import-athlete-preview', false);
    } catch (err) {
        console.error("Import Execution Error:", err);
        await customAlert("Gagal impor: " + err.message, "Error Cloud", "danger");
    } finally {
        btn.disabled = false;
        btn.innerText = "Impor Sekarang";
        hideProgress();
    }
};
