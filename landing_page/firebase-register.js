import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
