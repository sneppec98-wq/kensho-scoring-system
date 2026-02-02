import { customAlert } from './ui-helpers.js';

export const renderPrintingAthleteList = (athletes, searchTerm = "") => {
    const container = document.getElementById('printing-athlete-list');
    if (!container) return;

    const s = searchTerm.toLowerCase();
    const filtered = athletes.filter(a => (a.name || "").toLowerCase().includes(s));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-30 italic">
                Tidak ada data nama atlet yang ditemukan.
            </div>
        `;
        return;
    }

    // Sort alphabetically
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = filtered.map(a => `
        <div class="neu-inset p-4 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all border border-transparent">
            <div class="truncate pr-4">
                <p class="text-[10px] font-bold text-slate-200 uppercase tracking-wider truncate">${a.name}</p>
                <p class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">${a.team || '-'}</p>
            </div>
            <button onclick="copyToClipboard('${a.name.replace(/'/g, "\\'")}', this)" 
                class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95"
                title="Salin Nama">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
            </button>
        </div>
    `).join('');
};

export const copyToClipboard = (text, element) => {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        if (element) {
            const originalHTML = element.innerHTML;
            element.innerHTML = `
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
            `;
            element.classList.add('bg-emerald-500/20');

            setTimeout(() => {
                element.innerHTML = originalHTML;
                element.classList.remove('bg-emerald-500/20');
            }, 2000);
        }
    }).catch(err => {
        console.error('Gagal menyalin:', err);
        customAlert("Gagal menyalin teks ke clipboard.", "Error", "danger");
    });
};
