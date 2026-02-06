// Visibility Manager - Pause listeners saat tab tidak aktif untuk hemat quota

class VisibilityManager {
    constructor() {
        this.listeners = [];
        this.isPaused = false;
        this.setupVisibilityListener();
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[VISIBILITY] Tab hidden - Pausing listeners');
                this.pauseAllListeners();
            } else {
                console.log('[VISIBILITY] Tab visible - Resuming listeners');
                this.resumeListeners();
            }
        });
    }

    registerListener(name, unsubscribeFn, resumeFn) {
        this.listeners.push({
            name,
            unsubscribe: unsubscribeFn,
            resume: resumeFn,
            active: true
        });
        console.log(`[VISIBILITY] Registered listener: ${name}`);
    }

    pauseAllListeners() {
        if (this.isPaused) return;

        this.listeners.forEach(listener => {
            if (listener.active && listener.unsubscribe) {
                try {
                    listener.unsubscribe();
                    listener.active = false;
                    console.log(`[VISIBILITY] Paused: ${listener.name}`);
                } catch (err) {
                    console.warn(`[VISIBILITY] Failed to pause ${listener.name}:`, err);
                }
            }
        });

        this.isPaused = true;
    }

    resumeListeners() {
        if (!this.isPaused) return;

        this.listeners.forEach(listener => {
            if (!listener.active && listener.resume) {
                try {
                    listener.resume();
                    listener.active = true;
                    console.log(`[VISIBILITY] Resumed: ${listener.name}`);
                } catch (err) {
                    console.warn(`[VISIBILITY] Failed to resume ${listener.name}:`, err);
                }
            }
        });

        this.isPaused = false;
    }

    unregisterListener(name) {
        const index = this.listeners.findIndex(l => l.name === name);
        if (index !== -1) {
            const listener = this.listeners[index];
            if (listener.unsubscribe) {
                listener.unsubscribe();
            }
            this.listeners.splice(index, 1);
            console.log(`[VISIBILITY] Unregistered: ${name}`);
        }
    }

    clearAllListeners() {
        this.listeners.forEach(listener => {
            if (listener.unsubscribe) {
                listener.unsubscribe();
            }
        });
        this.listeners = [];
        console.log('[VISIBILITY] All listeners cleared');
    }
}

const visibilityManager = new VisibilityManager();
export default visibilityManager;
