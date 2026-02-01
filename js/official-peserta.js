import { db } from './firebase-init.js';
import { collection, getDocs, doc, getDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global data store
let allAthletes = [];
let allClasses = [];
let eventName = "";
let eventLogo = "";

// URL Params
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('id');

async function init() {
    if (!eventId) {
        document.getElementById('participantList').innerHTML = `
            <div class="neu-flat p-20 rounded-[2.5rem] text-center">
                <h3 class="text-xl font-bold text-red-400 uppercase italic">Event ID Tidak Ditemukan</h3>
                <p class="text-xs opacity-50 mt-4">Pastikan Anda menggunakan link yang valid dari panitia.</p>
            </div>
        `;
        return;
    }

    try {
        // Fetch Event Data
        const eventDoc = await getDoc(doc(db, "events", eventId));
        if (eventDoc.exists()) {
            const data = eventDoc.data();
            eventName = data.name || "DAFTAR PESERTA";
            eventLogo = data.logo || "kensho-logo.png";
            document.getElementById('eventName').innerText = eventName;
            document.title = `${eventName} | Official Portal`;
            if (data.logo) {
                document.querySelector('#eventLogo img').src = data.logo;
            }
        }

        // Fetch Classes (for lookup)
        const classSnap = await getDocs(collection(db, `events/${eventId}/classes`));
        allClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch Athletes
        const athleteSnap = await getDocs(query(collection(db, `events/${eventId}/athletes`), orderBy("name", "asc")));
        allAthletes = athleteSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        render(allAthletes);

    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('participantList').innerHTML = `
            <div class="neu-flat p-20 rounded-[2.5rem] text-center">
                <h3 class="text-xl font-bold text-red-400 uppercase italic">Gagal Memuat Data</h3>
                <p class="text-xs opacity-50 mt-4">${err.message}</p>
            </div>
        `;
    }
}

function render(athletes) {
    const listContainer = document.getElementById('participantList');
    const totalCountEl = document.getElementById('totalCount');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    // Filtering
    const filtered = athletes.filter(a => {
        if (!searchTerm) return true;
        return (a.name || "").toLowerCase().includes(searchTerm) ||
               (a.team || "").toLowerCase().includes(searchTerm) ||
               (a.className || "").toLowerCase().includes(searchTerm);
    });

    totalCountEl.innerText = filtered.length;

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="py-20 text-center opacity-30 italic font-black uppercase tracking-widest text-[10px]">
                Tidak ada data peserta yang cocok.
            </div>
        `;
        return;
    }

    // Grouping by Team
    const grouped = {};
    filtered.forEach(a => {
        const team = (a.team || "LAINNYA").toUpperCase();
        if (!grouped[team]) grouped[team] = [];
        grouped[team].push(a);
    });

    let html = '';
    Object.keys(grouped).sort().forEach(team => {
        html += `
            <div class="stagger-card">
                <div class="flex items-center gap-4 mb-6">
                    <h4 class="text-lg font-black italic uppercase text-blue-400 tracking-tighter">${team}</h4>
                    <div class="flex-1 h-[1px] bg-white/5"></div>
                    <span class="text-[10px] font-bold opacity-30 bg-white/5 px-3 py-1 rounded-full">${grouped[team].length} ATLET</span>
                </div>
                
                <div class="neu-flat rounded-[2rem] overflow-hidden">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-left">
                            <thead class="text-[9px] font-black opacity-30 uppercase tracking-[0.2em] bg-white/5">
                                <tr>
                                    <th class="py-5 pl-8 w-16">No</th>
                                    <th class="py-5">Nama Peserta / Anggota</th>
                                    <th class="py-5 text-center">Gender</th>
                                    <th class="py-5">Kategori & Kelas</th>
                                    <th class="py-5 text-right pr-8">TTL</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-white/5">
                                ${grouped[team].map((a, idx) => {
                                    const classInfo = allClasses.find(c => 
                                        (c.code && a.classCode && c.code.toString().trim().toUpperCase() === a.classCode.toString().trim().toUpperCase()) ||
                                        (c.name && a.className && c.name.toString().trim().toUpperCase() === a.className.toString().trim().toUpperCase())
                                    );
                                    
                                    return `
                                        <tr class="hover:bg-white/[0.02] transition-colors">
                                            <td class="py-6 pl-8 font-black opacity-20 text-xs">#${(idx + 1).toString().padStart(2, '0')}</td>
                                            <td class="py-6">
                                                <div class="font-black text-slate-100 uppercase text-sm italic tracking-tight">${a.name}</div>
                                                ${a.members ? `<div class="text-[9px] opacity-40 font-bold mt-1 uppercase leading-tight">👥 members: ${a.members.join(', ')}</div>` : 
                                                  (a.name2 ? `<div class="text-[9px] opacity-40 font-bold mt-1 uppercase leading-tight">👥 team: ${[a.name, a.name2, a.name3].filter(n => n).join(' & ')}</div>` : '')}
                                            </td>
                                            <td class="py-6 text-center">
                                                <span class="px-3 py-1 rounded-lg text-[9px] font-black ${a.gender === 'PUTRA' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'}">
                                                    ${a.gender}
                                                </span>
                                            </td>
                                            <td class="py-6">
                                                <div class="flex flex-col">
                                                    <span class="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">${classInfo?.code || a.classCode || '-'}</span>
                                                    <span class="text-[11px] font-black uppercase text-slate-300 italic">${a.className}</span>
                                                </div>
                                            </td>
                                            <td class="py-6 text-right pr-8">
                                                <span class="text-[10px] font-bold text-slate-500">${a.birthDate || '-'}</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

// Event Listeners
document.getElementById('searchInput').addEventListener('input', () => render(allAthletes));

// Run
init();
