// Kensho Tech Scoring - Firebase Integration Module
// Handles all Firebase Real-time Database operations for live scoring sync

import { rtdb } from './firebase-init.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/**
 * Broadcast current scoring data to Firebase RTDB
 * @param {Object} scoreData - Object containing all score/timer data
 * @returns {Promise} Firebase set operation promise
 */
export function broadcastScoreData(scoreData) {
    const tatamiId = scoreData.tatami || 'tatami1';
    const scoringRef = ref(rtdb, `livescoring/${tatamiId}`);

    const data = {
        akaScore: scoreData.akaScore || 0,
        aoScore: scoreData.aoScore || 0,
        timeLeft: scoreData.timeLeft || 0,
        timerText: scoreData.timerText || '00:00',
        isTimerRunning: scoreData.isTimerRunning || false,
        isTimerEnabled: scoreData.isTimerEnabled !== false,
        penaltiesAka: scoreData.penaltiesAka || { c1: false, c2: false, c3: false, hc: false, h: false },
        penaltiesAo: scoreData.penaltiesAo || { c1: false, c2: false, c3: false, hc: false, h: false },
        tatami: tatamiId,
        nameAka: scoreData.nameAka || '',
        nameAo: scoreData.nameAo || '',
        teamAka: scoreData.teamAka || '',
        teamAo: scoreData.teamAo || '',
        round: scoreData.round || '',
        category: scoreData.category || '',
        kataAka: scoreData.kataAka || '',
        kataAo: scoreData.kataAo || '',
        senshu: scoreData.senshu || null,
        isAtoshiBaraku: scoreData.isAtoshiBaraku || false,
        isWinnerDeclared: scoreData.isWinnerDeclared || false,
        winnerSide: scoreData.winnerSide || null,
        vrAka: scoreData.vrAka || false,
        vrAo: scoreData.vrAo || false,
        isHantei: scoreData.isHantei || false,
        scoringMode: scoreData.scoringMode || 'kumite',
        kataType: scoreData.kataType || 'individual',
        kataScoreAka: scoreData.kataScoreAka || 0,
        kataScoreAo: scoreData.kataScoreAo || 0,
        judgeScoresAka: scoreData.judgeScoresAka || [0, 0, 0, 0, 0],
        judgeScoresAo: scoreData.judgeScoresAo || [0, 0, 0, 0, 0],
        akaFlags: scoreData.akaFlags || 0,
        aoFlags: scoreData.aoFlags || 0,
        showWinnerBanner: scoreData.showWinnerBanner || false,
        lastUpdate: Date.now()
    };

    return set(scoringRef, data)
        .then(() => {
            console.log('[Firebase] Data synced to:', tatamiId);
            // Update UI status indicator if exists
            const statusEl = document.getElementById('userNameDisplay');
            if (statusEl) {
                statusEl.classList.add('text-green-400');
                statusEl.classList.remove('text-red-400');
            }
            return true;
        })
        .catch((err) => {
            console.error("[Firebase] Sync Error:", err);
            const statusEl = document.getElementById('userNameDisplay');
            if (statusEl) {
                statusEl.classList.remove('text-green-400');
                statusEl.classList.add('text-red-400');
            }
            throw err;
        });
}

/**
 * Listen to score updates from Firebase RTDB
 * @param {string} tatamiId - Tatami identifier
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} Unsubscribe function
 */
export function listenToScoreUpdates(tatamiId, callback) {
    const scoringRef = ref(rtdb, `livescoring/${tatamiId}`);

    const unsubscribe = onValue(scoringRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log('[Firebase] Received update for:', tatamiId);
            callback(data);
        }
    }, (error) => {
        console.error('[Firebase] Listen error:', error);
    });

    return unsubscribe;
}

/**
 * Reset/clear scoring data for a specific tatami
 * @param {string} tatamiId - Tatami identifier
 * @returns {Promise} Firebase set operation promise
 */
export function resetTatamiData(tatamiId) {
    const scoringRef = ref(rtdb, `livescoring/${tatamiId}`);

    const emptyData = {
        akaScore: 0,
        aoScore: 0,
        timeLeft: 0,
        timerText: '00:00',
        isTimerRunning: false,
        isTimerEnabled: true,
        penaltiesAka: { c1: false, c2: false, c3: false, hc: false, h: false },
        penaltiesAo: { c1: false, c2: false, c3: false, hc: false, h: false },
        tatami: tatamiId,
        nameAka: '',
        nameAo: '',
        teamAka: '',
        teamAo: '',
        round: '',
        category: '',
        kataAka: '',
        kataAo: '',
        isWinnerDeclared: false,
        winnerSide: null,
        lastUpdate: Date.now()
    };

    return set(scoringRef, emptyData)
        .then(() => {
            console.log('[Firebase] Reset data for:', tatamiId);
            return true;
        })
        .catch((err) => {
            console.error('[Firebase] Reset error:', err);
            throw err;
        });
}

/**
 * Get current tatami data once (no real-time)
 * @param {string} tatamiId - Tatami identifier
 * @returns {Promise<Object>} Promise resolving to tatami data
 */
export function getTatamiDataOnce(tatamiId) {
    return new Promise((resolve, reject) => {
        const scoringRef = ref(rtdb, `livescoring/${tatamiId}`);
        onValue(scoringRef, (snapshot) => {
            if (snapshot.exists()) {
                resolve(snapshot.val());
            } else {
                resolve(null);
            }
        }, { onlyOnce: true });
    });
}

// Export helper to check Firebase connection status
export function checkFirebaseConnection() {
    if (!rtdb) {
        console.error('[Firebase] RTDB not initialized');
        return false;
    }
    console.log('[Firebase] RTDB connection active');
    return true;
}
