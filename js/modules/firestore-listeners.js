// Optimized Firestore Listeners - Converted to One-Time Reads with Caching
import { collection, onSnapshot, query, orderBy, doc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import cacheManager from './db-cache-manager.js';
import { trackFirestoreRead } from './quota-monitor.js';

// ============================================
// ONE-TIME READ FUNCTIONS (Cached)
// ============================================

export async function getClasses(db, eventId, forceRefresh = false) {
    const cacheKey = `classes_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Classes loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching classes from Firestore...');
    const q = query(collection(db, `events/${eventId}/classes`), orderBy('code'));
    const snapshot = await getDocs(q);

    trackFirestoreRead('getClasses', snapshot.size);

    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await cacheManager.cacheData(cacheKey, classes, 60); // Cache 60 menit

    return classes;
}

export async function getAthletes(db, eventId, forceRefresh = false) {
    const cacheKey = `athletes_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Athletes loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching athletes from Firestore...');
    const q = query(collection(db, `events/${eventId}/athletes`), orderBy('name'));
    const snapshot = await getDocs(q);

    trackFirestoreRead('getAthletes', snapshot.size);

    const athletes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await cacheManager.cacheData(cacheKey, athletes, 30); // Cache 30 menit

    return athletes;
}

export async function getBrackets(db, eventId, forceRefresh = false) {
    const cacheKey = `brackets_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Brackets loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching brackets from Firestore...');
    const snapshot = await getDocs(collection(db, `events/${eventId}/brackets`));

    trackFirestoreRead('getBrackets', snapshot.size);

    const brackets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            class: data.class || doc.id,
            ...data
        };
    });
    await cacheManager.cacheData(cacheKey, brackets, 45); // Cache 45 menit

    return brackets;
}

export async function getEventData(db, eventId, forceRefresh = false) {
    const cacheKey = `event_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Event data loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching event data from Firestore...');
    const snapshot = await getDoc(doc(db, 'events', eventId));

    trackFirestoreRead('getEventData', 1);

    if (!snapshot.exists()) return null;

    const eventData = { id: snapshot.id, ...snapshot.data() };
    await cacheManager.cacheData(cacheKey, eventData, 120); // Cache 2 jam

    return eventData;
}

export async function getRewards(db, eventId, forceRefresh = false) {
    const cacheKey = `rewards_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Rewards loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching rewards from Firestore...');
    const snapshot = await getDocs(collection(db, `events/${eventId}/rewards`));

    trackFirestoreRead('getRewards', snapshot.size);

    const rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await cacheManager.cacheData(cacheKey, rewards, 120); // Cache 2 jam

    return rewards;
}

export async function fetchMedalsManual(db, eventId, forceRefresh = false) {
    const cacheKey = `medals_manual_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Manual medals loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching manual medals from Firestore...');
    const snapshot = await getDocs(collection(db, `events/${eventId}/medals_manual`));

    trackFirestoreRead('fetchMedalsManual', snapshot.size);

    const medals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await cacheManager.cacheData(cacheKey, medals, 60); // Cache 60 menit

    return medals;
}

export async function getPayments(db, eventId, forceRefresh = false) {
    const cacheKey = `payments_${eventId}`;

    if (!forceRefresh) {
        const cached = await cacheManager.getCachedData(cacheKey);
        if (cached) {
            console.log('[LISTENERS] Payments loaded from CACHE');
            return cached;
        }
    }

    console.log('[LISTENERS] Fetching payments from Firestore...');
    const snapshot = await getDocs(collection(db, `events/${eventId}/payments`));

    trackFirestoreRead('getPayments', snapshot.size);

    const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await cacheManager.cacheData(cacheKey, payments, 30); // Cache 30 menit

    return payments;
}

// ============================================
// REAL-TIME LISTENERS (Only for Critical Data)
// ============================================

// Hanya gunakan untuk bracket yang SEDANG DIBUKA/DIEDIT
export function listenToBracketActive(db, eventId, className, callback) {
    console.log(`[LISTENERS] Real-time listener ACTIVE for bracket: ${className}`);
    const unsubscribe = onSnapshot(doc(db, `events/${eventId}/brackets`, className), snapshot => {
        trackFirestoreRead('listenToBracketActive', 1);
        callback(snapshot);
    });
    return unsubscribe;
}

// Listener untuk event data (jarang berubah, tapi penting)
export function listenToEventDataRealtime(db, eventId, callback) {
    console.log('[LISTENERS] Real-time listener for event data');
    const unsubscribe = onSnapshot(doc(db, 'events', eventId), snapshot => {
        trackFirestoreRead('listenToEventDataRealtime', 1);
        callback(snapshot);
    });
    return unsubscribe;
}

// ============================================
// BACKWARD COMPATIBILITY (Deprecated)
// ============================================

// Untuk backward compatibility - tapi sekarang pakai cache
export function listenToClasses(db, eventId, callback) {
    console.warn('[LISTENERS] listenToClasses() is DEPRECATED. Use getClasses() instead.');

    // Fallback: load from cache and call callback once
    getClasses(db, eventId).then(classes => {
        callback({ docs: classes.map(c => ({ id: c.id, data: () => c })) });
    });

    return () => { }; // Dummy unsubscribe
}

export function listenToAthletes(db, eventId, callback) {
    console.warn('[LISTENERS] listenToAthletes() is DEPRECATED. Use getAthletes() instead.');

    getAthletes(db, eventId).then(athletes => {
        callback({ docs: athletes.map(a => ({ id: a.id, data: () => a })) });
    });

    return () => { };
}

export function listenToBrackets(db, eventId, callback) {
    console.warn('[LISTENERS] listenToBrackets() is DEPRECATED. Use getBrackets() instead.');

    getBrackets(db, eventId).then(brackets => {
        callback({ docs: brackets.map(b => ({ id: b.id, data: () => b })) });
    });

    return () => { };
}

export function listenToEventData(db, eventId, callback) {
    console.warn('[LISTENERS] listenToEventData() is DEPRECATED. Use getEventData() instead.');

    getEventData(db, eventId).then(eventData => {
        if (eventData) {
            callback({ exists: () => true, data: () => eventData });
        }
    });

    return () => { };
}

export function listenToRewards(db, eventId, callback) {
    console.warn('[LISTENERS] listenToRewards() is DEPRECATED. Use getRewards() instead.');

    getRewards(db, eventId).then(rewards => {
        callback({ docs: rewards.map(r => ({ id: r.id, data: () => r })) });
    });

    return () => { };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function invalidateEventCache(eventId) {
    console.log(`[LISTENERS] Invalidating all cache for event: ${eventId}`);
    await cacheManager.invalidateCache(`classes_${eventId}`);
    await cacheManager.invalidateCache(`athletes_${eventId}`);
    await cacheManager.invalidateCache(`brackets_${eventId}`);
    await cacheManager.invalidateCache(`event_${eventId}`);
    await cacheManager.invalidateCache(`rewards_${eventId}`);
    await cacheManager.invalidateCache(`medals_manual_${eventId}`);
    await cacheManager.invalidateCache(`payments_${eventId}`);
}

export async function refreshAllData(db, eventId) {
    console.log(`[LISTENERS] Force refreshing all data for event: ${eventId}`);
    await invalidateEventCache(eventId);

    // Preload semua data
    const [classes, athletes, brackets, eventData, rewards, medalsManual, payments] = await Promise.all([
        getClasses(db, eventId, true),
        getAthletes(db, eventId, true),
        getBrackets(db, eventId, true),
        getEventData(db, eventId, true),
        getRewards(db, eventId, true),
        fetchMedalsManual(db, eventId, true),
        getPayments(db, eventId, true)
    ]);

    console.log('[LISTENERS] All data refreshed and cached');
    return { classes, athletes, brackets, eventData, rewards, medalsManual, payments };
}
