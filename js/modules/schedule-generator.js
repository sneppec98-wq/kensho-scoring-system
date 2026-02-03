// Schedule Generator & Print logic
import { db } from '../firebase-init.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentSchedule = null;

export const renderSchedule = (classes, athletes, containerId = 'scheduleContent') => {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    // Helper for robust matching
    const isClassMatch = (cls, athlete) => {
        const cCode = (cls.code || "").toString().trim().toUpperCase();
        const cName = (cls.name || "").toString().trim().toUpperCase();
        const aCode = (athlete.classCode || "").toString().trim().toUpperCase();
        const aName = (athlete.className || "").toString().trim().toUpperCase();

        if (aCode && cCode && aCode === cCode) return true;
        if (aName && cName && aName === cName) return true;

        // Fuzzy match: strip non-alphanumeric
        const fuzzyC = cName.replace(/[^A-Z0-9]/g, '');
        const fuzzyA = aName.replace(/[^A-Z0-9]/g, '');
        return fuzzyC && fuzzyA && fuzzyC === fuzzyA;
    };

    // Filter only classes that have athletes using robust matching
    const activeClasses = classes.filter(c =>
        athletes.some(a => isClassMatch(c, a))
    );

    let html = `
        <div class="space-y-8 no-print">
            <div class="neu-inset p-8 rounded-[2rem] border border-white/5 bg-slate-900/40">
                <div class="flex flex-col md:flex-row gap-6 items-end">
                    <div class="flex-1">
                        <label class="text-[9px] font-black uppercase opacity-40 ml-4 mb-2 block tracking-widest text-blue-400">JUMLAH HARI PERTANDINGAN</label>
                        <input type="number" id="schedDays" value="1" min="1" 
                            class="w-full neu-inset bg-slate-900/50 px-6 py-4 rounded-2xl outline-none text-xs font-bold text-white border-white/5">
                    </div>
                    <div class="flex-1">
                        <label class="text-[9px] font-black uppercase opacity-40 ml-4 mb-2 block tracking-widest text-blue-400">JUMLAH TATAMI (ARENA)</label>
                        <input type="number" id="schedArenas" value="2" min="1"
                            class="w-full neu-inset bg-slate-900/50 px-6 py-4 rounded-2xl outline-none text-xs font-bold text-white border-white/5">
                    </div>
                    <div class="flex flex-col md:flex-row gap-4">
                        <button onclick="window.processScheduleGeneration()" 
                            class="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all">
                            GENERATE JADWAL
                        </button>
                        <button id="btnSaveSchedule" onclick="window.saveSchedule()" 
                            class="px-8 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(22,163,74,0.3)] transition-all">
                            SIMPAN JADWAL
                        </button>
                    </div>
                </div>
            </div>
            <div id="scheduleOutput"></div>
        </div>
    `;

    container.innerHTML = html;

    // Export generator function to window for the button
    window.processScheduleGeneration = () => {
        const days = parseInt(document.getElementById('schedDays').value) || 1;
        const arenas = parseInt(document.getElementById('schedArenas').value) || 1;

        const schedule = generateBalancedSchedule(activeClasses, athletes, days, arenas, isClassMatch);
        currentSchedule = schedule;
        renderScheduleResult(schedule);
    };

    window.saveSchedule = async () => {
        const eventId = window.location.search.split('id=')[1]?.split('&')[0];
        if (!eventId) {
            alert("Gagal menyimpan: ID Event tidak ditemukan.");
            return;
        }

        if (!currentSchedule) {
            alert("Belum ada jadwal untuk disimpan!");
            return;
        }

        const btn = document.getElementById('btnSaveSchedule');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = "MENYIMPAN...";

        try {
            const days = parseInt(document.getElementById('schedDays').value) || 1;
            const arenas = parseInt(document.getElementById('schedArenas').value) || 1;

            // Flatten 2D array [Day[Arena]] into 1D array for Firestore compatibility
            const flattenedSchedule = currentSchedule.flat();

            // Save schedule metadata
            await setDoc(doc(db, `events/${eventId}/metadata`, 'schedule'), {
                schedule: flattenedSchedule,
                config: { days, arenas },
                updatedAt: new Date().toISOString()
            });

            console.log(`[Schedule] ✅ Schedule metadata saved`);

            // 🆕 CREATE/UPDATE TATAMI DOCUMENTS WITH SCHEDULED CLASSES
            console.log(`[Schedule] Creating/Updating ${arenas} tatami documents with scheduled classes...`);

            const tatamiUpdatePromises = [];

            for (let i = 1; i <= arenas; i++) {
                const tatamiRef = doc(db, `events/${eventId}/tatamis`, i.toString());

                // Get all classes assigned to this tatami across all days
                // After manual edits, arena property will reflect the final tatami assignment
                const classesInThisTatami = flattenedSchedule
                    .filter(bucket => parseInt(bucket.arena) === i)
                    .flatMap(bucket => bucket.classes || []);

                // Calculate totals
                const totalAthletes = classesInThisTatami.reduce(
                    (sum, cls) => sum + (cls.rawCount || cls.athleteCount || 0), 0
                );

                const totalClasses = classesInThisTatami.length;

                // Prepare scheduledClasses array with detailed info
                const scheduledClasses = classesInThisTatami.map((cls, idx) => ({
                    classCode: cls.code || '',
                    className: cls.name || '',
                    athleteCount: cls.athleteCount || 0,
                    rawCount: cls.rawCount || cls.athleteCount || 0,
                    ageCategory: cls.ageCategory || '',
                    type: cls.type || '',
                    isTeamCategory: cls.isTeamCategory || false,
                    order: idx + 1,
                    day: cls.day || 1
                }));

                // Calculate estimated times (basic estimation: 10 min per athlete)
                let currentTime = 9 * 60; // Start at 9:00 AM in minutes
                scheduledClasses.forEach(cls => {
                    const estimatedDuration = Math.max(30, cls.rawCount * 10); // Min 30 min, 10 min per athlete
                    const startHour = Math.floor(currentTime / 60);
                    const startMin = currentTime % 60;
                    currentTime += estimatedDuration;
                    const endHour = Math.floor(currentTime / 60);
                    const endMin = currentTime % 60;

                    cls.estimatedTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}-${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                    cls.estimatedDuration = estimatedDuration;
                });

                // Check if tatami document exists
                const tatamiSnap = await getDoc(tatamiRef);
                const existingData = tatamiSnap.exists() ? tatamiSnap.data() : {};

                // Create/Update tatami document
                const tatamiData = {
                    tatamiId: i.toString(),
                    tatamiName: `Tatami ${i}`,
                    status: existingData.status || 'ready',

                    // 🆕 SCHEDULED CLASSES (Final schedule after manual edits)
                    scheduledClasses: scheduledClasses,

                    // Summary stats
                    totalClasses: totalClasses,
                    totalAthletes: totalAthletes,

                    // Current match (preserve if exists, otherwise null)
                    currentMatch: existingData.currentMatch || null,

                    // Timestamps
                    createdAt: existingData.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    lastScheduleUpdate: new Date().toISOString()
                };

                console.log(`[Schedule] 📋 Tatami ${i}: ${totalClasses} kelas, ${totalAthletes} peserta`);
                console.log(`[Schedule] 🔍 Tatami ${i} data:`, JSON.stringify(tatamiData, null, 2));

                // Add promise with individual error handling
                const tatamiPromise = setDoc(tatamiRef, tatamiData)
                    .then(() => {
                        console.log(`[Schedule] ✅ Tatami ${i} saved successfully to Firestore`);
                    })
                    .catch((error) => {
                        console.error(`[Schedule] ❌ Failed to save Tatami ${i}:`, error);
                        console.error(`[Schedule] ❌ Error code: ${error.code}`);
                        console.error(`[Schedule] ❌ Error message: ${error.message}`);
                        throw error; // Re-throw to be caught by outer try-catch
                    });

                tatamiUpdatePromises.push(tatamiPromise);
            }

            // Wait for all tatami updates
            console.log(`[Schedule] ⏳ Waiting for ${tatamiUpdatePromises.length} tatami updates...`);
            await Promise.all(tatamiUpdatePromises);
            console.log(`[Schedule] 🏟️ All ${arenas} tatami documents updated successfully!`);

            // Success message
            const totalClassesAll = flattenedSchedule.reduce((sum, b) => sum + (b.classes?.length || 0), 0);
            const totalAthletesAll = flattenedSchedule.reduce((sum, b) => sum + (b.load || 0), 0);

            alert(`Jadwal berhasil disimpan!
            
✅ Schedule metadata saved
🏟️ ${arenas} tatami documents updated
📋 Total ${totalClassesAll} kelas
👥 Total ${totalAthletesAll} peserta`);

        } catch (err) {
            console.error('[Schedule] Error saving:', err);
            console.error('[Schedule] Error stack:', err.stack);
            alert("Gagal menyimpan ke database: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };

    const loadExistingSchedule = async () => {
        const eventId = window.location.search.split('id=')[1]?.split('&')[0];
        if (!eventId || currentSchedule) return;

        try {
            const snap = await getDoc(doc(db, `events/${eventId}/metadata`, 'schedule'));
            if (snap.exists()) {
                const data = snap.data();
                const flattened = data.schedule;
                const { days, arenas } = data.config;

                // Reconstruct 2D array Day -> Arena
                const reconstructed = [];
                for (let d = 1; d <= days; d++) {
                    const dayData = flattened.filter(b => b.day === d);
                    // Sort by arena number just in case
                    dayData.sort((a, b) => a.arena - b.arena);
                    reconstructed.push(dayData);
                }

                currentSchedule = reconstructed;
                document.getElementById('schedDays').value = days;
                document.getElementById('schedArenas').value = arenas;
                renderScheduleResult(currentSchedule);
            }
        } catch (err) {
            console.error("Load schedule error:", err);
        }
    };

    if (currentSchedule) {
        renderScheduleResult(currentSchedule);
    } else {
        loadExistingSchedule();
    }
};

export const getLatestSchedule = () => currentSchedule;

const generateBalancedSchedule = (classes, athletes, numDays, numArenas, isClassMatch) => {
    // 1. Prepare data: Calculate load per class accurately without double-counting
    const classData = classes.map(c => ({
        ...c,
        athleteCount: 0,
        rawCount: 0
    }));

    let orphanAthletes = 0;
    athletes.forEach(a => {
        const targetClass = classData.find(c => isClassMatch(c, a));
        if (targetClass) {
            targetClass.athleteCount++;
            targetClass.rawCount++;
        } else {
            orphanAthletes++;
            console.warn(`⚠️ Atlet "${a.name}" memiliki kategori "${a.className}" [${a.classCode}] yang tidak terdaftar di database.`);
        }
    });

    if (orphanAthletes > 0) {
        console.error(`❌ Total ${orphanAthletes} atlet tidak bisa dijadwalkan karena kategori tidak ditemukan.`);
    }

    // 1.1 Process Beregu classes: Each entry is 1 Team
    classData.forEach(c => {
        const isBeregu = c.type === 'BEREGU' || (c.name || "").toUpperCase().includes('BEREGU');
        if (isBeregu) {
            c.isTeamCategory = true;
            // Since 1 record = 1 Team, raw athlete count is record count * 3
            c.rawCount = c.athleteCount * 3;
        } else {
            c.rawCount = c.athleteCount;
        }
    });

    // Remove classes with 0 athletes for the scheduler
    const filteredClassData = classData.filter(c => c.athleteCount > 0);

    // Priority Helper based on USER requirements
    const getPriority = (cls) => {
        const name = (cls.name || "").toUpperCase();
        const code = (cls.code || "").toString().toUpperCase();
        const ageCategory = (cls.ageCategory || "").toUpperCase();
        const isFest = code.startsWith('F') || name.includes('FESTIVAL');
        const isBeregu = cls.type === 'BEREGU' || name.includes('BEREGU');
        const isKata = name.includes('KATA');
        const isKumite = name.includes('KUMITE');

        // 1. Category Type Priority (Primary)
        let typeScore = 99;
        if (!isFest && isBeregu) typeScore = 1;
        else if (!isFest && isKata) typeScore = 2;
        else if (!isFest && isKumite) typeScore = 3;
        else if (isFest && isKata) typeScore = 4;
        else if (isFest && isKumite) typeScore = 5;

        // 2. Age Category Priority (Secondary)
        let ageScore = 99;
        if (!isFest) {
            // OPEN Order
            if (ageCategory.includes("PRA USIA DINI")) ageScore = 1;
            else if (ageCategory.includes("USIA DINI")) ageScore = 2;
            else if (ageCategory.includes("PRA PEMULA")) ageScore = 3;
            else if (ageCategory.includes("PEMULA")) ageScore = 4;
            else if (ageCategory.includes("KADET") || ageCategory.includes("CADET")) ageScore = 5;
            else if (ageCategory.includes("JUNIOR")) ageScore = 6;
            else if (ageCategory.includes("UNDER 21")) ageScore = 7;
            else if (ageCategory.includes("SENIOR")) ageScore = 8;
        } else {
            // FESTIVAL Order
            if (ageCategory.includes("TK")) ageScore = 1;
            else if (ageCategory.includes("SD 1-3") || ageCategory.includes("SD 1 - 3")) ageScore = 2;
            else if (ageCategory.includes("SD 4-6") || ageCategory.includes("SD 4 - 6")) ageScore = 3;
            else if (ageCategory.includes("SMP")) ageScore = 4;
            else if (ageCategory.includes("SMA")) ageScore = 5;
            else if (ageCategory.includes("MHS") || ageCategory.includes("UMUM")) ageScore = 6;
        }

        // Combine: Type (Primary) + Age (Secondary)
        return (typeScore * 100) + ageScore;
    };

    // Sort classes for allocation (still use count for general balance, but priority within buckets)
    filteredClassData.sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return b.athleteCount - a.athleteCount;
    });

    // 2. Initialize Buckets (Day -> Arena -> Load)
    const schedule = [];
    for (let d = 1; d <= numDays; d++) {
        const dayBuckets = [];
        for (let a = 1; a <= numArenas; a++) {
            dayBuckets.push({ day: d, arena: a, load: 0, classes: [] });
        }
        schedule.push(dayBuckets);
    }

    // 3. Assign classes to buckets
    filteredClassData.forEach(cls => {
        // Find the bucket with the minimum current load
        let flatBuckets = schedule.flat();
        let minBucket = flatBuckets[0];
        flatBuckets.forEach(b => {
            if (b.load < minBucket.load) minBucket = b;
        });

        minBucket.classes.push(cls);
        minBucket.load += cls.athleteCount;
    });

    // Final sorting for each bucket based on USER requirement
    schedule.flat().forEach(bucket => {
        bucket.classes.sort((a, b) => {
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pA - pB;

            // Same priority? Use original order (code)
            const codeA = (a.code || "").toString().toUpperCase();
            const codeB = (b.code || "").toString().toUpperCase();
            return codeA.localeCompare(codeB, undefined, { numeric: true });
        });
    });

    return schedule;
};

const renderScheduleResult = (schedule) => {
    const output = document.getElementById('scheduleOutput');
    if (!output) return;

    let html = '';
    schedule.forEach((dayData, dayIdx) => {
        html += `
            <div class="mb-12">
                <h3 class="text-xl font-black italic uppercase text-blue-400 mb-6 flex items-center gap-4">
                    <span class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 italic not-italic text-sm">#D${dayIdx + 1}</span>
                    JADWAL PERTANDINGAN - HARI KE-${dayIdx + 1}
                </h3>
                <div class="grid grid-cols-1 xl:grid-cols-${dayData.length} gap-6">
        `;

        dayData.forEach((arena, arenaIdx) => {
            html += `
                        <div class="neu-inset p-8 rounded-[2.5rem] bg-slate-900/20 border border-white/5">
                            <div class="flex items-center justify-between mb-6">
                                <span class="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em]">TATAMI ${arenaIdx + 1}</span>
                                <span class="px-3 py-1 rounded-full bg-slate-800 text-[8px] font-black opacity-50">${arena.classes.length} KELAS</span>
                            </div>
                            <div class="space-y-6">
                    `;

            const renderClassList = (classList, title, colorClass) => {
                if (classList.length === 0) return '';
                const phaseTotal = classList.reduce((sum, cls) => sum + (cls.rawCount || cls.athleteCount || 0), 0);
                return `
                <div class="space-y-3">
                    <div class="flex justify-between items-center ml-2 mb-2">
                        <p class="text-[9px] font-black ${colorClass} uppercase tracking-[0.2em]">${title}</p>
                        <span class="text-[9px] font-black opacity-40 uppercase tracking-widest">${phaseTotal} PESERTA</span>
                    </div>
                    ${classList.map(item => {
                    const cls = item.data;
                    const idxInArena = item.originalIdx;
                    return `
                                <div class="p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-blue-500/20 transition-all group/card relative overflow-hidden">
                                    <div class="flex items-start justify-between">
                                         <div class="flex-1">
                                            <span class="text-[8px] font-black opacity-30 block mb-1 uppercase tracking-widest">${cls.code}</span>
                                            <h5 class="text-[11px] font-black uppercase leading-tight text-white mb-2">${cls.name}</h5>
                                            
                                            <!-- Move Button -->
                                            <button onclick="window.openMoveMatchDialog(${dayIdx}, ${arenaIdx}, ${idxInArena})" 
                                                class="opacity-0 group-hover/card:opacity-100 transition-opacity bg-blue-600/80 hover:bg-blue-600 text-white text-[7px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center gap-2">
                                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                                                PINDAH KELAS
                                            </button>
                                         </div>
                                         <div class="flex flex-col items-center justify-center">
                                            <span class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 text-[10px] font-black">${cls.athleteCount}</span>
                                            <span class="text-[7px] font-black opacity-30 uppercase mt-1">${cls.isTeamCategory ? 'TIM' : 'ATLET'}</span>
                                         </div>
                                    </div>
                                </div>
                            `;
                }).join('')}
                </div>
                `;
            };

            const openClasses = arena.classes.map((c, i) => ({ data: c, originalIdx: i })).filter(item => {
                const cls = item.data;
                const name = (cls.name || "").toUpperCase();
                const code = (cls.code || "").toString().toUpperCase();
                return !(code.startsWith('F') || name.includes('FESTIVAL'));
            });
            const festivalClasses = arena.classes.map((c, i) => ({ data: c, originalIdx: i })).filter(item => {
                const cls = item.data;
                const name = (cls.name || "").toUpperCase();
                const code = (cls.code || "").toString().toUpperCase();
                return (code.startsWith('F') || name.includes('FESTIVAL'));
            });

            const openTotal = openClasses.reduce((sum, item) => sum + (item.data.rawCount || item.data.athleteCount || 0), 0);
            const festivalTotal = festivalClasses.reduce((sum, item) => sum + (item.data.rawCount || item.data.athleteCount || 0), 0);
            const totalPeserta = openTotal + festivalTotal;

            html += renderClassList(openClasses, 'KELAS OPEN', 'text-blue-400');
            html += renderClassList(festivalClasses, 'KELAS FESTIVAL', 'text-emerald-400');

            if (arena.classes.length === 0) {
                html += '<p class="text-[10px] italic opacity-20 py-4 text-center">Tidak ada jadwal</p>';
            } else {
                html += `
                            <div class="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                                <span class="text-[9px] font-black uppercase opacity-30 tracking-widest">TOTAL PESERTA</span>
                                <span class="text-xs font-black text-blue-400">${totalPeserta} ATLET</span>
                            </div>
                        `;
            }

            html += '</div></div > ';
        });

        html += '</div></div>';
    });

    output.innerHTML = html;
};

// --- MANAGE CLASS MOVEMENT ---
window.openMoveMatchDialog = (dayIdx, arenaIdx, clsIdx) => {
    const cls = currentSchedule[dayIdx][arenaIdx].classes[clsIdx];
    if (!cls) return;

    // Create a custom modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'move-match-overlay';
    overlay.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-6';

    // Generate Target Options
    let targetOptionsDay = '';
    for (let d = 0; d < currentSchedule.length; d++) {
        targetOptionsDay += `<option value="${d}" ${d === dayIdx ? 'selected' : ''}>HARI KE-${d + 1}</option>`;
    }

    let targetOptionsArena = '';
    // Current day arena count
    for (let a = 0; a < currentSchedule[dayIdx].length; a++) {
        targetOptionsArena += `<option value="${a}" ${a === arenaIdx ? 'selected' : ''}>TATAMI ${a + 1}</option>`;
    }

    overlay.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
            <div class="w-16 h-16 rounded-2xl neu-inset flex items-center justify-center text-blue-500 mx-auto mb-6 border border-blue-500/20">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
            </div>
            <h4 class="text-lg font-black text-white text-center uppercase tracking-widest mb-2">PINDAHKAN KELAS</h4>
            <p class="text-[11px] font-black text-blue-400 text-center uppercase tracking-widest mb-8">${cls.name}</p>
            
            <div class="space-y-6 mb-8">
                <div>
                    <label class="text-[9px] font-black uppercase opacity-40 ml-4 mb-2 block tracking-widest text-blue-400">PILIH HARI TUJUAN</label>
                    <select id="moveTargetDay" class="w-full neu-inset bg-slate-900/50 px-6 py-4 rounded-2xl outline-none text-xs font-bold text-white border-white/5 appearance-none">
                        ${targetOptionsDay}
                    </select>
                </div>
                <div>
                    <label class="text-[9px] font-black uppercase opacity-40 ml-4 mb-2 block tracking-widest text-blue-400">PILIH TATAMI TUJUAN</label>
                    <select id="moveTargetArena" class="w-full neu-inset bg-slate-900/50 px-6 py-4 rounded-2xl outline-none text-xs font-bold text-white border-white/5 appearance-none">
                        ${targetOptionsArena}
                    </select>
                </div>
            </div>

            <div class="flex gap-4">
                <button onclick="document.getElementById('move-match-overlay').remove()" 
                    class="flex-1 py-4 rounded-2xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 hover:bg-slate-700 transition-all">
                    BATAL
                </button>
                <button onclick="window.confirmExecuteMove(${dayIdx}, ${arenaIdx}, ${clsIdx})" 
                    class="flex-1 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(59,130,246,0.3)] hover:scale-[1.05] transition-all">
                    PINDAH SEKARANG
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Dynamic Arena Update when Day Changes
    const daySelect = document.getElementById('moveTargetDay');
    daySelect.onchange = () => {
        const d = parseInt(daySelect.value);
        let arenaOpts = '';
        for (let a = 0; a < currentSchedule[d].length; a++) {
            arenaOpts += `<option value="${a}">TATAMI ${a + 1}</option>`;
        }
        document.getElementById('moveTargetArena').innerHTML = arenaOpts;
    };
};

window.confirmExecuteMove = (sDay, sArena, sCls) => {
    const tDay = parseInt(document.getElementById('moveTargetDay').value);
    const tArena = parseInt(document.getElementById('moveTargetArena').value);

    if (sDay === tDay && sArena === tArena) {
        document.getElementById('move-match-overlay').remove();
        return;
    }

    // Move logic
    const cls = currentSchedule[sDay][sArena].classes.splice(sCls, 1)[0];

    // Update the record metadata for day/arena
    cls.day = tDay + 1;
    cls.arena = tArena + 1;

    // Add to target
    currentSchedule[tDay][tArena].classes.push(cls);

    // Recalculate loads
    const calcLoad = (arena) => arena.classes.reduce((sum, c) => sum + (c.athleteCount || 0), 0);
    currentSchedule[sDay][sArena].load = calcLoad(currentSchedule[sDay][sArena]);
    currentSchedule[tDay][tArena].load = calcLoad(currentSchedule[tDay][tArena]);

    document.getElementById('move-match-overlay').remove();
    renderScheduleResult(currentSchedule);

    // Alert
    const notification = document.createElement('div');
    notification.className = 'fixed top-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl z-[10000] animate-in slide-in-from-top-full duration-500';
    notification.innerText = 'KELAS BERHASIL DIPINDAHKAN';
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('animate-out', 'fade-out', 'duration-500');
        setTimeout(() => notification.remove(), 500);
    }, 2000);
};

// End of Schedule Generator
