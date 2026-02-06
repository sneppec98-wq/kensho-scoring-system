// Quota Monitor - Track database reads untuk monitoring penggunaan

class QuotaMonitor {
    constructor() {
        this.reads = this.loadFromStorage();
        this.startDate = this.reads.startDate || new Date().toDateString();

        // Reset counter jika hari berbeda
        if (this.startDate !== new Date().toDateString()) {
            this.reset();
        }

        this.setupUI();
    }

    loadFromStorage() {
        const stored = localStorage.getItem('kensho_quota_monitor');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (err) {
                return this.getDefaultData();
            }
        }
        return this.getDefaultData();
    }

    getDefaultData() {
        return {
            total: 0,
            operations: [],
            startDate: new Date().toDateString()
        };
    }

    saveToStorage() {
        this.reads.startDate = this.startDate;
        localStorage.setItem('kensho_quota_monitor', JSON.stringify(this.reads));
    }

    trackRead(operation, count = 1) {
        this.reads.total += count;
        this.reads.operations.push({
            operation,
            count,
            timestamp: new Date().toISOString()
        });

        // Keep only last 100 operations
        if (this.reads.operations.length > 100) {
            this.reads.operations = this.reads.operations.slice(-100);
        }

        this.saveToStorage();
        this.updateUI();

        console.log(`[QUOTA] ${operation}: +${count} reads (Total: ${this.reads.total})`);

        // Warning jika mendekati limit harian
        if (this.reads.total > 40000) {
            console.warn(`[QUOTA] ⚠️ WARNING: ${this.reads.total} reads hari ini!`);
        }
    }

    setupUI() {
        // Create floating quota indicator
        const indicator = document.createElement('div');
        indicator.id = 'quota-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.85);
            color: #60a5fa;
            padding: 12px 20px;
            border-radius: 12px;
            font-family: 'Inter', monospace;
            font-size: 11px;
            font-weight: 700;
            z-index: 99999;
            cursor: pointer;
            border: 1px solid rgba(96, 165, 250, 0.3);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        `;
        indicator.innerHTML = `📊 Quota: <span id="quota-count">0</span> reads`;

        indicator.addEventListener('click', () => this.showDetails());
        indicator.addEventListener('mouseenter', () => {
            indicator.style.transform = 'scale(1.05)';
            indicator.style.borderColor = 'rgba(96, 165, 250, 0.6)';
        });
        indicator.addEventListener('mouseleave', () => {
            indicator.style.transform = 'scale(1)';
            indicator.style.borderColor = 'rgba(96, 165, 250, 0.3)';
        });

        document.body.appendChild(indicator);
        this.updateUI();
    }

    updateUI() {
        const countEl = document.getElementById('quota-count');
        if (countEl) {
            countEl.textContent = this.reads.total.toLocaleString();

            const indicator = document.getElementById('quota-indicator');
            if (this.reads.total > 40000) {
                indicator.style.background = 'rgba(220, 38, 38, 0.85)';
                indicator.style.borderColor = 'rgba(220, 38, 38, 0.5)';
            } else if (this.reads.total > 20000) {
                indicator.style.background = 'rgba(245, 158, 11, 0.85)';
                indicator.style.borderColor = 'rgba(245, 158, 11, 0.5)';
            } else {
                indicator.style.background = 'rgba(0, 0, 0, 0.85)';
                indicator.style.borderColor = 'rgba(96, 165, 250, 0.3)';
            }
        }
    }

    showDetails() {
        const recent = this.reads.operations.slice(-10).reverse();
        const details = recent.map(op =>
            `• ${op.operation}: ${op.count} reads @ ${new Date(op.timestamp).toLocaleTimeString()}`
        ).join('\n');

        alert(`
📊 Quota Monitor

Total Reads Today: ${this.reads.total.toLocaleString()}
Start: ${this.startDate}

Recent Operations (last 10):
${details || 'No operations yet'}

Limit Harian Firebase: 50,000 reads (Spark Plan)
        `.trim());
    }

    reset() {
        this.reads = this.getDefaultData();
        this.startDate = new Date().toDateString();
        this.saveToStorage();
        this.updateUI();
        console.log('[QUOTA] Counter reset');
    }

    getStats() {
        return {
            total: this.reads.total,
            startDate: this.startDate,
            recentOperations: this.reads.operations.slice(-20)
        };
    }
}

// Singleton instance
const quotaMonitor = new QuotaMonitor();

// Intercept Firestore reads (optional monitoring layer)
export function trackFirestoreRead(operation, estimatedCount = 1) {
    quotaMonitor.trackRead(operation, estimatedCount);
}

export default quotaMonitor;
