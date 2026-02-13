import { db } from '../firebase-init.js';
import { collection, addDoc, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global state
let allClasses = [];
let currentEventId = null;

/**
 * Initialize registration handler with event ID and classes
 */
export async function initRegistration(eventId, classes) {
    currentEventId = eventId;
    allClasses = classes;

    // Setup form submit handler
    const form = document.getElementById('registrationForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Setup dynamic class dropdown updates
    const categorySelect = document.getElementById('reg-category');
    const genderSelect = document.getElementById('reg-gender');

    if (categorySelect) categorySelect.addEventListener('change', updateClassDropdown);
    if (genderSelect) genderSelect.addEventListener('change', updateClassDropdown);

    // Initialize Flatpickr for birthdate
    const birthdateInput = document.getElementById('reg-birthdate');
    if (birthdateInput) {
        flatpickr(birthdateInput, {
            locale: 'id',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            allowInput: true
        });
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    // Hide previous messages
    document.getElementById('reg-success').classList.add('hidden');
    document.getElementById('reg-error').classList.add('hidden');

    // Get form data
    const formData = {
        name: document.getElementById('reg-name').value.trim().toUpperCase(),
        team: document.getElementById('reg-team').value.trim().toUpperCase(),
        gender: document.getElementById('reg-gender').value,
        birthDate: document.getElementById('reg-birthdate').value,
        category: document.getElementById('reg-category').value,
        matchType: document.getElementById('reg-match-type').value,
        classId: document.getElementById('reg-class').value,
        whatsapp: document.getElementById('reg-whatsapp').value.trim(),
        weight: document.getElementById('reg-weight').value.trim(),
    };

    // Find selected class details
    const selectedClass = allClasses.find(c => c.id === formData.classId || c.name === formData.classId);
    if (!selectedClass) {
        showError('Kelas tidak valid. Silakan pilih kelas yang tersedia.');
        return;
    }

    // Prepare athlete data (match existing structure)
    const athleteData = {
        name: formData.name,
        team: formData.team,
        gender: formData.gender,
        birthDate: formData.birthDate,
        className: selectedClass.name,
        classCode: selectedClass.code || '',
        whatsapp: formData.whatsapp,
        weight: formData.weight,
        verified: false,  // Needs admin verification
        registeredAt: new Date(),
        registeredVia: 'public_portal'
    };

    // Validate WhatsApp format
    if (!validateWhatsApp(formData.whatsapp)) {
        showError('Format WhatsApp tidak valid. Gunakan format: 08xxxxxxxxxx');
        return;
    }

    try {
        // Disable submit button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Mendaftar...';

        // Save to Firestore
        await addDoc(collection(db, `events/${currentEventId}/athletes`), athleteData);

        // Show success
        showSuccess();

        // Reset form
        e.target.reset();
        document.getElementById('reg-class').innerHTML = '<option value="">-- Pilih Kategori & Gender Terlebih Dahulu --</option>';

        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Daftarkan Peserta
        `;

    } catch (error) {
        console.error('Registration error:', error);
        showError(`Terjadi kesalahan: ${error.message}`);

        // Re-enable button
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Daftarkan Peserta
        `;
    }
}

/**
 * Update class dropdown based on category and gender selection
 */
window.updateClassDropdown = function updateClassDropdown() {
    const category = document.getElementById('reg-category').value;
    const gender = document.getElementById('reg-gender').value;
    const weight = parseFloat(document.getElementById('reg-weight').value) || 0;
    const matchType = document.getElementById('reg-match-type').value; // kumite / kata
    const classSelect = document.getElementById('reg-class');

    if (!category || !gender) {
        classSelect.innerHTML = '<option value="">-- Pilih Kategori & Gender Terlebih Dahulu --</option>';
        return;
    }

    // Filter classes
    let filteredClasses = allClasses.filter(c => {
        // 1. Check category (Festival classes start with 'F')
        const isFestival = (c.code || '').toString().toUpperCase().startsWith('F');
        const categoryMatch = (category === 'festival' && isFestival) || (category === 'open' && !isFestival);

        // 2. Check gender field directly
        const genderMatch = (c.gender === gender);

        // 3. Check Match Type (Kumite/Kata)
        let matchTypeMatch = true;
        if (matchType) {
            const className = (c.name || "").toUpperCase();
            const classCode = (c.code || "").toUpperCase();
            if (matchType === 'kumite') {
                matchTypeMatch = className.includes('KUMITE') || classCode.includes('KUM');
            } else if (matchType === 'kata') {
                matchTypeMatch = className.includes('KATA') || classCode.includes('KAT');
            }
        }

        // 4. Check Weight Range (Rigid filter for Kumite)
        let weightMatch = true;
        if (matchType === 'kumite' && weight > 0) {
            // Check against weightMin and weightMax from class data
            const wMin = parseFloat(c.weightMin) || 0;
            const wMax = parseFloat(c.weightMax) || 999;
            weightMatch = (weight >= wMin && weight <= wMax);
        }

        return categoryMatch && genderMatch && matchTypeMatch && weightMatch;
    });

    // Populate dropdown
    if (filteredClasses.length === 0) {
        classSelect.innerHTML = '<option value="">-- Tidak ada kelas tersedia (Cek BB/Kategori) --</option>';
    } else {
        classSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
            filteredClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
};

/**
 * Validate WhatsApp number format
 */
function validateWhatsApp(phone) {
    // Basic validation: starts with 08 and has 10-13 digits
    const phoneRegex = /^08\d{8,11}$/;
    return phoneRegex.test(phone);
}

/**
 * Show success message
 */
function showSuccess() {
    const successEl = document.getElementById('reg-success');
    successEl.classList.remove('hidden');

    // Scroll to message
    setTimeout(() => {
        successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        successEl.classList.add('hidden');
    }, 5000);
}

/**
 * Show error message
 */
function showError(message) {
    const errorEl = document.getElementById('reg-error');
    const errorMsg = document.getElementById('reg-error-message');

    errorMsg.textContent = message;
    errorEl.classList.remove('hidden');

    // Scroll to message
    setTimeout(() => {
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    // Auto-hide after 8 seconds
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 8000);
}
