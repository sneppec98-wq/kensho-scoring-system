// Athlete Verification - Exported Functions
import { updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../firebase-init.js";

export const verifyAthlete = async (athleteId, eventId) => {
    try {
        await updateDoc(doc(db, `events/${eventId}/athletes`, athleteId), {
            verified: true,
            verifiedAt: new Date(),
            verifiedBy: window.currentUser?.uid || 'admin'
        });

        await customAlert("Atlet berhasil diverifikasi dan akan muncul di public portal!", "Verifikasi Berhasil", "info");
    } catch (err) {
        console.error("Verify Athlete Error:", err);
        await customAlert("Gagal verifikasi: " + err.message, "Gagal", "danger");
    }
};

export const rejectAthlete = async (athleteId, athleteName, eventId) => {
    const ok = await customConfirm({
        title: "Tolak Pendaftaran",
        message: `Yakin ingin MENOLAK pendaftaran "${athleteName}"? Data akan dihapus permanen.`,
        confirmText: "Ya, Tolak & Hapus",
        type: "danger"
    });

    if (!ok) return;

    try {
        await deleteDoc(doc(db, `events/${eventId}/athletes`, athleteId));
        await customAlert(`Pendaftaran "${athleteName}" berhasil ditolak dan dihapus.`, "Ditolak", "info");
    } catch (err) {
        console.error("Reject Athlete Error:", err);
        await customAlert("Gagal menolak: " + err.message, "Gagal", "danger");
    }
};

window.verifyAthlete = verifyAthlete;
window.rejectAthlete = rejectAthlete;
