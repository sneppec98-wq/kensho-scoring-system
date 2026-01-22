import { db, auth } from './firebase-init.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Logs an activity to Firestore activity_logs collection.
 * @param {string} action - The action being performed (e.g., "Updated Score")
 * @param {string} details - Additional details about the action (e.g., "Aka score changed from 0 to 1")
 * @param {string} [tatami] - Optional tatami number
 */
export const logActivity = async (action, details, tatami = null) => {
    const user = auth.currentUser;
    if (!user) return; // Only log known users

    try {
        await addDoc(collection(db, "activity_logs"), {
            adminName: user.displayName || user.email.split('@')[0],
            adminEmail: user.email,
            action: action,
            details: details,
            tatami: tatami,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};

window.logActivity = logActivity;
