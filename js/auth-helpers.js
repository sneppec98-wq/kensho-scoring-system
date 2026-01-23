import { auth } from './firebase-init.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const handleLogout = async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('kensho_login_time');
        localStorage.removeItem('kensho_session_id');
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Gagal keluar. Silakan coba lagi.");
    }
};

// Make it available globally if needed for non-module contexts
window.handleLogout = handleLogout;
