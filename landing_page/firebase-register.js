import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBr8_DV7ceDW3osWvuo1fG_PLQJfzl84Yw",
    authDomain: "kensho-scoring-system.firebaseapp.com",
    databaseURL: "https://kensho-scoring-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kensho-scoring-system",
    storageBucket: "kensho-scoring-system.firebasestorage.app",
    messagingSenderId: "63381930133",
    appId: "1:63381930133:web:e4a357421efba912b71b9c",
    measurementId: "G-1FHNLD1ZY3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
