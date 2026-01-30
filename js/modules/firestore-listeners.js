// Firestore Real-time Listeners
import { db } from '../firebase-init.js';
import { collection, onSnapshot, query, orderBy, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const setupAthletesListener = (eventId, callback) => {
    const q = query(collection(db, `events/${eventId}/athletes`), orderBy("name"));
    return onSnapshot(q, snapshot => {
        const athletes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(athletes);
    });
};

export const setupClassesListener = (eventId, callback) => {
    const q = query(collection(db, `events/${eventId}/classes`), orderBy("code"));
    return onSnapshot(q, snapshot => {
        const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(classes);
    });
};

export const setupBracketsListener = (eventId, callback) => {
    return onSnapshot(collection(db, `events/${eventId}/brackets`), snapshot => {
        const brackets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(brackets);
    });
};

export const setupEventListener = (eventId, callback) => {
    return onSnapshot(doc(db, 'events', eventId), snapshot => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() });
        }
    });
};
