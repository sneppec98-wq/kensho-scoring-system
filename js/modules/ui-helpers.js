// UI Helper Functions
export const showProgress = (title, items) => {
    document.getElementById('loader-title').innerText = title;
    document.getElementById('loader-status').innerText = `MEMPROSES ${items} DATA...`;
    document.getElementById('loader-progress-bar').style.width = '0%';
    document.getElementById('loader-percent').innerText = '0%';
    document.getElementById('loading-overlay').style.display = 'flex';
};

export const updateProgress = (current, total) => {
    const percent = Math.round((current / total) * 100);
    document.getElementById('loader-progress-bar').style.width = `${percent}%`;
    document.getElementById('loader-percent').innerText = `${percent}%`;
    document.getElementById('loader-status').innerText = `DATA KE-${current} DARI ${total} SELESAI`;
};

export const hideProgress = () => {
    document.getElementById('loading-overlay').style.display = 'none';
};

export const sleep = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

export const toggleModal = (modalId, show) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('flex', show);
    document.body.classList.toggle('overflow-hidden', show);
};

export const filterTable = (input, tableId) => {
    let filter = input.value.toUpperCase();
    let tr = document.getElementById(tableId).getElementsByTagName("tr");
    for (let i = 1; i < tr.length; i++) {
        let text = tr[i].textContent || tr[i].innerText;
        tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
};

export const EXPECTED_CONTINGENTS = [
    "INKAI DOJO AVATAR",
    "INKANAS DOJO DOMINORISE",
    "INKANAS KALISAT",
    "INKAI BRIGIF 9",
    "SHOTOKAI DOJO ARGAPURO",
    "SHOTOKAI DOJO DHARMA ALAM",
    "TAKO DOJO TKTDW",
    "INKAI DOJO RAMBIPUJI",
    "INKAI DOJO AMBULU",
    "INKAI DOJO KORAMIL WULUHAN",
    "INKANAS SUMBERSARI",
    "INKANAS DOJO LEDOKOMBO",
    "INKAI DOJO SKYAIR JEMBER",
    "INKAI GANESHA KARATE CLUB",
    "INKAI DOJO KODIM 0824",
    "INKAI SMK N 5",
    "INKAI GEMA 45",
    "INKAI DOJO CAHYA BANTALA",
    "LEMKARI JEMBER",
    "INKADO DOJO PENDOWO SEMBORO",
    "INKADO DOJO ONE KODIM JEMBER KARATE AKADEMI",
    "INKAI DOJO KTB",
    "INKAI YONIF 509",
    "INKANAS BHARADAKSA"
];

export const switchTab = (tabId, element) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.card-menu').forEach(card => card.classList.remove('card-active'));
    if (element) element.classList.add('card-active');
};
