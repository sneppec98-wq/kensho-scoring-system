// Database Cache Manager - Aggressive Caching untuk Hemat Quota Firestore
// Menggunakan IndexedDB untuk persistent cache + Memory cache untuk akses cepat

class DatabaseCacheManager {
    constructor(dbName = 'KenshoCache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.memoryCache = new Map();
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[CACHE] IndexedDB initialized:', this.dbName);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    const store = db.createObjectStore('cache', { keyPath: 'key' });
                    store.createIndex('expiry', 'expiry', { unique: false });
                    console.log('[CACHE] Object store created');
                }
            };
        });
    }

    async cacheData(key, data, ttlMinutes = 30) {
        await this.initPromise;

        const expiry = Date.now() + (ttlMinutes * 60 * 1000);
        const cacheEntry = {
            key,
            data,
            expiry,
            timestamp: Date.now()
        };

        // Save to memory cache
        this.memoryCache.set(key, cacheEntry);

        // Save to IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.put(cacheEntry);

            request.onsuccess = () => {
                console.log(`[CACHE] Saved: ${key} (TTL: ${ttlMinutes}m)`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getCachedData(key, skipExpiry = false) {
        await this.initPromise;

        // Try memory cache first (fastest)
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key);
            if (skipExpiry || entry.expiry > Date.now()) {
                console.log(`[CACHE] Memory HIT: ${key}`);
                return entry.data;
            } else {
                console.log(`[CACHE] Memory EXPIRED: ${key}`);
                this.memoryCache.delete(key);
            }
        }

        // Fallback to IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result;
                if (!entry) {
                    console.log(`[CACHE] MISS: ${key}`);
                    resolve(null);
                    return;
                }

                if (skipExpiry || entry.expiry > Date.now()) {
                    console.log(`[CACHE] IndexedDB HIT: ${key}`);
                    // Restore to memory cache
                    this.memoryCache.set(key, entry);
                    resolve(entry.data);
                } else {
                    console.log(`[CACHE] IndexedDB EXPIRED: ${key}`);
                    this.invalidateCache(key);
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async invalidateCache(key) {
        await this.initPromise;

        // Remove from memory
        this.memoryCache.delete(key);

        // Remove from IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log(`[CACHE] Invalidated: ${key}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllCache() {
        await this.initPromise;

        // Clear memory
        this.memoryCache.clear();

        // Clear IndexedDB
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[CACHE] All cache cleared');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearExpiredCache() {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');
            const index = store.index('expiry');
            const range = IDBKeyRange.upperBound(Date.now());
            const request = index.openCursor(range);

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    this.memoryCache.delete(cursor.value.key);
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`[CACHE] Cleared ${deletedCount} expired entries`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    getCacheStats() {
        return {
            memorySize: this.memoryCache.size,
            keys: Array.from(this.memoryCache.keys())
        };
    }
}

// Singleton instance
const cacheManager = new DatabaseCacheManager();

// Auto-cleanup expired cache setiap 5 menit
setInterval(() => {
    cacheManager.clearExpiredCache().catch(err =>
        console.error('[CACHE] Auto-cleanup failed:', err)
    );
}, 5 * 60 * 1000);

export default cacheManager;
