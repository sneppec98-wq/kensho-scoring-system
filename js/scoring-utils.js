// Kensho Tech Scoring - Utility Functions Module
// Contains sound effects, formatters, and helper functions

// Initialize Web Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
import { customAlert } from './modules/ui-helpers.js';

/**
 * Play buzzer sound (long, low tone for end of match/time)
 */
export function playBuzzer() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

/**
 * Play beep sound (short, high tone for warnings/atoshi-baraku)
 */
export function playBeep() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

/**
 * Format seconds to MM:SS display
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Show toast notification (simple alert replacement)
 * @param {string} message - Message to display
 * @param {string} type - Type: 'success', 'error', 'info'
 */
export function showNotification(message, type = 'info') {
    // For now, use console log (can be upgraded to toast library later)
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Optional: You can add actual toast UI here later
    // For quick implementation, using alert for critical messages
    if (type === 'error') {
        customAlert(message, "Error", "danger");
    }
}

/**
 * Safely get element by ID with existence check
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`[Utils] Element not found: ${id}`);
    }
    return el;
}

/**
 * Update element text content safely
 * @param {string} id - Element ID
 * @param {string} text - Text to set
 */
export function setText(id, text) {
    const el = getElement(id);
    if (el) {
        el.innerText = text;
    }
}

/**
 * Toggle class on element safely
 * @param {string} id - Element ID
 * @param {string} className - Class name to toggle
 * @param {boolean} force - Force add (true) or remove (false)
 */
export function toggleClass(id, className, force) {
    const el = getElement(id);
    if (el) {
        if (force !== undefined) {
            el.classList.toggle(className, force);
        } else {
            el.classList.toggle(className);
        }
    }
}

/**
 * Check if audio context is ready
 * @returns {boolean}
 */
export function isAudioReady() {
    return audioCtx && audioCtx.state === 'running';
}

/**
 * Resume audio context (needed after user interaction on some browsers)
 */
export async function resumeAudio() {
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
        console.log('[Utils] Audio context resumed');
    }
}
