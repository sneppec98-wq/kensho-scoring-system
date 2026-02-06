import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, onSnapshot, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const APP_VERSION = "3.4.0";
let licenseUnsubscribe = null;
let accountUnsubscribe = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Not logged in, redirect to login if not already there
        if (!window.location.href.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return;
    }

    // A. MONITOR SESSION DURATION (DISABLED)
    /*
    const loginTime = localStorage.getItem('kensho_login_time');
    const MAX_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 jam dalam milidetik

    if (loginTime) {
        const elapsedTime = Date.now() - parseInt(loginTime);
        if (elapsedTime > MAX_SESSION_DURATION) {
            handleViolation("⌛ SESI BERAKHIR\nSesi login Anda telah habis (maksimal 12 jam). Silakan login ulang.");
            return;
        }
    } else {
        // Jika tidak ada login_time tapi user terautentikasi (mungkin baru update versi)
        // Set waktu sekarang sebagai fallback
        localStorage.setItem('kensho_login_time', Date.now().toString());
    }
    */

    // B. MONITOR ACCOUNT STATUS & SESSION (Web & Desktop)
    try {
        let userDocRef = null;
        const email = user.email.toLowerCase();

        // Find user document
        const qAdmin = query(collection(db, "admins"), where("email", "==", email));
        const snapAdmin = await getDocs(qAdmin);
        if (!snapAdmin.empty) {
            userDocRef = doc(db, "admins", snapAdmin.docs[0].id);
        } else {
            const qUser = query(collection(db, "users"), where("email", "==", email));
            const snapUser = await getDocs(qUser);
            if (!snapUser.empty) {
                userDocRef = doc(db, "users", snapUser.docs[0].id);
            }
        }

        if (userDocRef) {
            if (accountUnsubscribe) accountUnsubscribe();
            accountUnsubscribe = onSnapshot(userDocRef, (snap) => {
                if (!snap.exists()) {
                    handleViolation("Data akun tidak ditemukan.");
                    return;
                }
                const data = snap.data();

                // 1. Status Check
                if (data.status === 'blocked') {
                    handleViolation("🚫 AKUN DIBLOKIR\nAkses dicabut oleh Admin.");
                    return;
                }
                if (data.status === 'pending') {
                    handleViolation("⏳ AKUN MENUNGGU PERSETUJUAN\nSilakan hubungi Owner.");
                    return;
                }

                // 2. Session Check (Single Login)
                const localSession = localStorage.getItem('kensho_session_id');
                if (data.currentSessionId && localSession && data.currentSessionId !== localSession) {
                    handleViolation("⚠️ LOGIN GANDA TERDETEKSI\nAkun Anda telah log out karena login dari tempat/browser lain.");
                    return;
                }
            });
        }
    } catch (err) {
        console.error("Account Guard Error:", err);
    }


    // B. MONITOR DESKTOP LICENSE (Desktop Only)
    if (window.electronAPI) {
        try {
            // 0. Version Check
            const settingsSnap = await getDoc(doc(db, "settings", "app"));
            if (settingsSnap.exists()) {
                const minVer = settingsSnap.data().minVersion;
                if (minVer && APP_VERSION < minVer) {
                    handleViolation("⚠️ VERSI KEDALUWARSA\nSilakan unduh versi terbaru.");
                    return;
                }
            }

            const hwid = await window.electronAPI.getMachineId();
            const docRef = doc(db, "installations", hwid);

            // Real-time listener
            if (licenseUnsubscribe) licenseUnsubscribe();

            licenseUnsubscribe = onSnapshot(docRef, (snapshot) => {
                if (!snapshot.exists()) {
                    handleViolation("Perangkat tidak terdaftar.");
                    return;
                }

                const data = snapshot.data();
                const status = data.status;
                const expiry = data.expiryDate ? data.expiryDate.toDate() : null;
                const now = new Date();

                // 1. Check Status
                if (status === 'blocked') {
                    handleViolation("⚠️ PERANGKAT DIBLOKIR\nInstalasi dicabut oleh Admin.");
                    return;
                }
                // Removed 'pending' status check from here as it's handled by account monitoring

                // 2. Check Expiry
                if (expiry && now > expiry) {
                    handleViolation("⚠️ LISENSI KEDALUWARSA\nMasa aktif aplikasi habis.");
                    return;
                }

                // 3. Check Binding (1 Email = 1 HWID)
                if (data.boundEmail && data.boundEmail !== user.email.toLowerCase()) {
                    handleViolation(`⚠️ KONFLIK AKUN\nPerangkat terikat dg: ${data.boundEmail} `);
                    return;
                }
            });

        } catch (err) {
            console.error("License Guard Error:", err);
        }
    }
});

function handleViolation(message) {
    alert(message);
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
}
