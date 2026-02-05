// Voice Chat - DISABLED FOR FUNDRAISING
// This module disables voice chat functionality to save Firebase quota
// All functions show a fundraising popup instead of actual functionality

import { customAlert } from './modules/ui-helpers.js';

const FUNDRAISING_MESSAGE = `
🎤 VOICE LOUNGE LAGI MAINTENANCE! 

Waduh, fitur voice chat-nya lagi diistirahatkan dulu nih~ 😔

Kenapa? Soalnya:
• Server WebRTC itu mahal bro! 💸
• Bandwidth suara makan kuota banyak 📡
• Database real-time nya rakus banget 🔥

🙏 BUTUH SPONSOR BUAT AKTIFIN LAGI!

Kalau ada yang mau support fitur ini, 
yuk hubungi tim dev! Siapa tau bisa jadi hero 🦸‍♂️

Thanks udah pengertian gengs! 🫶
`;

// Disabled wrapper functions
export function initVoiceLounge() {
    console.log('[Voice Chat] DISABLED - Fundraising mode active');
    // Do nothing - no Firebase listeners created
}

export async function joinVoice() {
    await customAlert(FUNDRAISING_MESSAGE, "Voice Lagi OFF 🔇", "info");
    return false;
}

export async function leaveVoice() {
    // Silent - user probably didn't join anyway
    return true;
}

export async function toggleMicMute() {
    await customAlert(FUNDRAISING_MESSAGE, "Voice Lagi OFF 🔇", "info");
    return false;
}

// Export dummy state
export const isVoiceActive = false;
export const isMuted = true;

console.log('[Voice Chat] 🔥 DISABLED - Zero quota consumption mode');
