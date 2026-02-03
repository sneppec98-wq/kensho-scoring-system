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

    const content = modal.querySelector('.neu-flat');

    if (show) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('overflow-hidden');

        // Trigger animation after a small delay for the browser to register display: flex
        setTimeout(() => {
            modal.style.opacity = '1';
            if (content) {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }
        }, 10);
    } else {
        modal.style.opacity = '0';
        if (content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
        }

        // Wait for animation to finish before hiding
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.classList.remove('overflow-hidden');
        }, 300);
    }
};

export const filterTable = (input, tableId) => {
    let filter = input.value.toUpperCase();
    let tr = document.getElementById(tableId).getElementsByTagName("tr");
    for (let i = 1; i < tr.length; i++) {
        let text = tr[i].textContent || tr[i].innerText;
        tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
};


export const switchTab = (tabId, element) => {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.card-menu').forEach(card => card.classList.remove('card-active'));
    if (element) element.classList.add('card-active');
};

/**
 * Premium Custom Confirmation / Prompt Modal
 * Returns a Promise that resolves to true (confirmed) or false (cancelled)
 */
export const customConfirm = ({
    title = "Konfirmasi",
    message = "Apakah Anda yakin ingin melanjutkan?",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    type = "danger", // 'danger' or 'info'
    promptWord = null // If set, user must type this word to confirm
}) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('modal-confirm');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-action-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const promptContainer = document.getElementById('confirm-prompt-container');
        const promptInput = document.getElementById('confirm-input');
        const promptLabel = document.getElementById('confirm-prompt-label');

        const iconDanger = document.getElementById('confirm-icon-danger');
        const iconInfo = document.getElementById('confirm-icon-info');
        const iconContainer = document.getElementById('confirm-icon-container');
        const bgGradient = document.getElementById('confirm-bg-gradient');

        if (!modal) {
            console.warn("Modal confirm not found, falling back to native confirm");
            resolve(confirm(message));
            return;
        }

        // Setup Content
        titleEl.innerText = title;
        messageEl.innerText = message;
        confirmBtn.innerText = confirmText;
        cancelBtn.innerText = cancelText;

        if (!cancelText) {
            cancelBtn.classList.add('hidden');
        } else {
            cancelBtn.classList.remove('hidden');
        }

        // Setup Type Styling
        if (type === 'danger') {
            confirmBtn.className = "flex-1 py-4 rounded-2xl bg-gradient-to-br from-red-600 to-orange-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(220,38,38,0.3)] hover:brightness-110 active:scale-95 transition-all";
            iconContainer.className = "w-20 h-20 rounded-[2rem] neu-inset flex items-center justify-center text-red-500 mx-auto mb-6 border border-red-500/20 shadow-lg transition-transform duration-500 group-hover:rotate-12";
            if (bgGradient) bgGradient.className = "absolute -right-20 -top-20 w-60 h-60 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/15 transition-all";
            iconDanger.classList.remove('hidden');
            iconInfo.classList.add('hidden');
            if (promptLabel) promptLabel.className = "text-[9px] font-black uppercase opacity-40 ml-4 mb-3 block tracking-widest text-red-500";
        } else {
            confirmBtn.className = "flex-1 py-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_15px_30px_rgba(59,130,246,0.3)] hover:brightness-110 active:scale-95 transition-all";
            iconContainer.className = "w-20 h-20 rounded-[2rem] neu-inset flex items-center justify-center text-blue-500 mx-auto mb-6 border border-blue-500/20 shadow-lg transition-transform duration-500 group-hover:rotate-12";
            if (bgGradient) bgGradient.className = "absolute -right-20 -top-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-all";
            iconDanger.classList.add('hidden');
            iconInfo.classList.remove('hidden');
            if (promptLabel) promptLabel.className = "text-[9px] font-black uppercase opacity-40 ml-4 mb-3 block tracking-widest text-blue-500";
        }

        // Setup Prompt
        if (promptWord) {
            promptContainer.classList.remove('hidden');
            promptLabel.innerText = `Ketik "${promptWord}" untuk konfirmasi`;
            promptInput.value = "";
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = "0.3";

            const onInput = () => {
                if (promptInput.value.toUpperCase().trim() === promptWord.toUpperCase().trim()) {
                    confirmBtn.disabled = false;
                    confirmBtn.style.opacity = "1";
                } else {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = "0.3";
                }
            };
            promptInput.oninput = onInput;
        } else {
            promptContainer.classList.add('hidden');
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = "1";
        }

        // Show Modal
        toggleModal('modal-confirm', true);

        // Handlers
        const cleanup = () => {
            toggleModal('modal-confirm', false);
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            window.removeEventListener('keydown', onKeyDown);
        };

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter' && !confirmBtn.disabled) onConfirm();
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        window.addEventListener('keydown', onKeyDown);

        if (promptWord) {
            setTimeout(() => promptInput.focus(), 300);
        }
    });
};

/**
 * Premium Custom Alert
 */
export const customAlert = (message, title = "Informasi", type = "info") => {
    return customConfirm({
        title,
        message,
        confirmText: "Dimengerti",
        cancelText: "",
        type,
        promptWord: null
    });
};
