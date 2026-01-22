// Firebase Modular SDK Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// Enable Offline Persistence for Firestore
import { enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.warn("Persistence failed: multiple tabs open");
  } else if (err.code == 'unimplemented') {
    console.warn("Persistence is not available in this browser");
  }
});

// Export for use in other modules
export { app, auth, db, rtdb, analytics };
