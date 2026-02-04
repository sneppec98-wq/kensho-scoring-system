// Firebase Modular SDK Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRMDmIfNWhICl7CLYgd2MteLpjI4OzkgM",
  authDomain: "adm-spartan-sport-2f4ec.firebaseapp.com",
  databaseURL: "https://adm-spartan-sport-2f4ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "adm-spartan-sport-2f4ec",
  storageBucket: "adm-spartan-sport-2f4ec.firebasestorage.app",
  messagingSenderId: "847888051133",
  appId: "1:847888051133:web:fdd362c642c654bd2080d4",
  measurementId: "G-SC7SBDVHZ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const analytics = getAnalytics(app);

console.log("[FIREBASE] Initialized Project:", firebaseConfig.projectId);

// Set Auth Persistence to SESSION (Auto-logout on close)
setPersistence(auth, browserSessionPersistence)
  .then(() => console.log("[AUTH] Persistence set to SESSION (Auto-logout enabled)"))
  .catch((err) => console.error("[AUTH] Persistence Error:", err));

// Immediate Cleanup on Close (Optional but safer)
window.addEventListener('beforeunload', () => {
  // We don't sign out here because it's async and window might close before completion
  // But we clear session-related localStorage
  localStorage.removeItem('kensho_session_id');
});

// Export for use in other modules
export { app, auth, db, rtdb, analytics };

// GLOBAL SERVICE WORKER CLEANUP (To fix 404 issues in development)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister().then(success => {
        if (success) console.log('Successfully unregistered Service Worker');
      });
    }
  }).catch(err => console.log('SW cleanup failed:', err));
}
