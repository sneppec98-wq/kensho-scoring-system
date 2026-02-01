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

            await setDoc(doc(db, `events/${eventId}/metadata`, 'schedule'), {
                schedule: flattenedSchedule,
                config: { days, arenas },
                updatedAt: new Date().toISOString()
            });
            alert("Jadwal berhasil disimpan ke database!");
        } catch (err) {
            console.error(err);
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
        athleteCount: 0
    }));

    let orphanAthletes = 0;
    athletes.forEach(a => {
        const targetClass = classData.find(c => isClassMatch(c, a));
        if (targetClass) {
            targetClass.athleteCount++;
        } else {
            orphanAthletes++;
            console.warn(`⚠️ Atlet "${a.name}" memiliki kategori "${a.className}" [${a.classCode}] yang tidak terdaftar di database.`);
        }
    });

    if (orphanAthletes > 0) {
        console.error(`❌ Total ${orphanAthletes} atlet tidak bisa dijadwalkan karena kategori tidak ditemukan.`);
    }

    // 1.1 Process Beregu classes: Convert 3 athletes -> 1 Team
    classData.forEach(c => {
        const isBeregu = c.type === 'BEREGU' || (c.name || "").toUpperCase().includes('BEREGU');
        if (isBeregu) {
            c.isTeamCategory = true;
            c.athleteCount = Math.ceil(c.athleteCount / 3);
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
            const totalLoad = arena.classes.reduce((sum, cls) => sum + (cls.athleteCount || 0), 0);
            html += `
                        <div class="neu-inset p-8 rounded-[2.5rem] bg-slate-900/20 border border-white/5">
                            <div class="flex items-center justify-between mb-6">
                                <span class="text-[10px] font-black uppercase text-blue-500 tracking-[0.3em]">TATAMI ${arenaIdx + 1}</span>
                                <span class="px-3 py-1 rounded-full bg-slate-800 text-[8px] font-black opacity-50">${arena.classes.length} KELAS</span>
                            </div>
                            <div class="space-y-3">
                    `;

            arena.classes.forEach((cls, idx) => {
                html += `
                            <div class="p-4 rounded-2xl bg-slate-800/40 border border-white/5 hover:border-blue-500/20 transition-all">
                                <div class="flex items-start justify-between">
                                     <div class="flex-1">
                                        <span class="text-[8px] font-black opacity-30 block mb-1 uppercase tracking-widest">${cls.code}</span>
                                        <h5 class="text-[11px] font-black uppercase leading-tight text-white mb-2">${cls.name}</h5>
                                     </div>
                                     <div class="flex flex-col items-center justify-center">
                                        <span class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 text-[10px] font-black">${cls.athleteCount}</span>
                                        <span class="text-[7px] font-black opacity-30 uppercase mt-1">${cls.isTeamCategory ? 'TIM' : 'ATLET'}</span>
                                     </div>
                                </div>
                            </div>
                        `;
            });

            if (arena.classes.length === 0) {
                html += '<p class="text-[10px] italic opacity-20 py-4 text-center">Tidak ada jadwal</p>';
            } else {
                html += `
                            <div class="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                                <span class="text-[9px] font-black uppercase opacity-30 tracking-widest">TOTAL BEBAN</span>
                                <span class="text-xs font-black text-blue-400">${totalLoad} MATCH</span>
                            </div>
                        `;
            }

            html += '</div></div>';
        });

        html += '</div></div>';
    });

    output.innerHTML = html;
};

// End of Schedule Generator
