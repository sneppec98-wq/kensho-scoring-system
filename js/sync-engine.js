/**
 * Kensho Tech - Sync Engine
 * Handles IndexedDB local storage and background cloud sync
 */

import { db } from './firebase-init.js';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getTeamSlot } from './bracket-utils.js';

const DB_NAME = 'KenshoScoringDB';
const DB_VERSION = 1;
const MATCH_STORE = 'matches';
const SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes

class SyncEngine {
    constructor() {
        this.db = null;
        this.initDB().then(() => {
            console.log('[SyncEngine] DB Ready');
            this.syncAll(); // Initial check
        });
        this.startSyncTimer();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(MATCH_STORE)) {
                    db.createObjectStore(MATCH_STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async saveMatchResult(matchData) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MATCH_STORE], 'readwrite');
            const store = transaction.objectStore(MATCH_STORE);
            const request = store.add({
                ...matchData,
                synced: false,
                timestamp: Date.now()
            });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async startSyncTimer() {
        setInterval(() => this.syncAll(), SYNC_INTERVAL);
        console.log('[SyncEngine] Interval started: 3 minutes');
    }

    async syncAll() {
        if (!this.db) return;
        this.updateUI('syncing');
        console.log('[SyncEngine] Starting periodic sync check...');

        try {
            const pendingItems = await this.getUnsyncedItems();
            if (pendingItems.length === 0) {
                console.log('[SyncEngine] No pending items to sync.');
                this.updateUI('synced');
                return;
            }

            console.log(`[SyncEngine] Found ${pendingItems.length} items to sync.`);
            let successCount = 0;

            for (const item of pendingItems) {
                try {
                    const success = await this.pushToCloud(item);
                    if (success) {
                        await this.markAsSynced(item.id);
                        successCount++;
                    }
                } catch (err) {
                    console.error(`[SyncEngine] Error syncing item ${item.id}:`, err);
                }
            }

            console.log(`[SyncEngine] Sync session complete. Success: ${successCount}/${pendingItems.length}`);
            this.updateUI(successCount === pendingItems.length ? 'synced' : 'pending');
        } catch (err) {
            console.error('[SyncEngine] Sync loop failed:', err);
            this.updateUI('pending');
        }
    }

    async getUnsyncedItems() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MATCH_STORE], 'readonly');
            const store = transaction.objectStore(MATCH_STORE);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result || [];
                resolve(results.filter(item => !item.synced));
            };
            request.onerror = () => reject(request.error);
        });
    }

    async markAsSynced(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([MATCH_STORE], 'readwrite');
            const store = transaction.objectStore(MATCH_STORE);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const data = getReq.result;
                if (!data) return resolve();
                data.synced = true;
                const updateReq = store.put(data);
                updateReq.onsuccess = () => resolve();
                updateReq.onerror = () => reject(updateReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    }

    updateUI(status) {
        const badge = document.getElementById('syncBadge');
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        if (!badge || !dot || !text) return;

        switch (status) {
            case 'syncing':
                dot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin';
                text.innerText = 'Syncing...';
                badge.className = badge.className.replace('text-slate-500', 'text-blue-400');
                break;
            case 'synced':
                dot.className = 'w-1.5 h-1.5 rounded-full bg-green-500';
                text.innerText = 'Cloud Synced';
                badge.className = badge.className.replace(/text-(blue|yellow|slate)-[0-9]+/, 'text-green-400');
                break;
            case 'pending':
                dot.className = 'w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse';
                text.innerText = 'Pending Sync';
                badge.className = badge.className.replace(/text-(blue|green|slate)-[0-9]+/, 'text-yellow-400');
                break;
        }
    }

    async pushToCloud(data) {
        console.log(`[SyncEngine] Pushing data for ${data.category} to Cloud...`);
        try {
            const { eventId, category, winner, nextSlot, matchId, aka, ao } = data;

            if (!eventId || !category) {
                console.error('[SyncEngine] Missing eventId or category in data:', data);
                return false;
            }

            // 1. Save Match Record (General Log)
            const timestamp = Date.now();
            const resultRef = doc(db, `events/${eventId}/match_results`, `${category}_${timestamp}`);
            await setDoc(resultRef, {
                ...data,
                serverSync: true,
                syncedAt: new Date().toISOString()
            });
            console.log(`[SyncEngine] Match result saved to global log: ${category}_${timestamp}`);

            // 2. 🆕 Update Specific Match Document (for Admin Rekap sync)
            if (matchId) {
                const specificMatchRef = doc(db, `events/${eventId}/brackets/${category}/matches`, matchId);
                await updateDoc(specificMatchRef, {
                    status: 'completed',
                    winnerSide: winner.side,
                    winnerName: winner.name,
                    akaScore: aka?.score || 0,
                    aoScore: ao?.score || 0,
                    completedAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                });
                console.log(`[SyncEngine] Specific match ${matchId} updated to COMPLETED`);
            }

            // 3. Auto-Progression (Update Bracket Tree)
            if (nextSlot) {
                const bracketRef = doc(db, `events/${eventId}/brackets`, category);
                const bracketSnap = await getDoc(bracketRef);

                if (bracketSnap.exists()) {
                    const bracketSnapData = bracketSnap.data();
                    const updatedSvgData = { ...(bracketSnapData.data || {}) };

                    // 🆕 Propagate both Name AND Team (Kontingen)
                    const teamSlot = getTeamSlot(nextSlot);

                    if (nextSlot === 'winner_nama') {
                        updatedSvgData['winner_nama'] = winner.name;
                        updatedSvgData['winner_kontingen'] = winner.team;
                    } else {
                        updatedSvgData[nextSlot] = winner.name;
                        if (teamSlot) updatedSvgData[teamSlot] = winner.team;
                    }

                    await updateDoc(bracketRef, {
                        data: updatedSvgData,
                        lastModified: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`[SyncEngine] Auto-progressed ${winner.name} [${winner.team}] to slot ${nextSlot} in ${category}`);
                } else {
                    console.warn(`[SyncEngine] Bracket document not found for category: ${category}`);
                }
            }

            return true;
        } catch (err) {
            console.error('[SyncEngine] Cloud push error detail:', err);
            return false;
        }
    }
}

export const syncEngine = new SyncEngine();
window.syncEngine = syncEngine; // Expose globally for console access
