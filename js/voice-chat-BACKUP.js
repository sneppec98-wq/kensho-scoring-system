import { rtdb } from './firebase-init.js';
import { ref, set, push, onValue, onChildAdded, onChildRemoved, remove, onDisconnect, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

let localStream = null;
let peerConnections = {};
let currentUser = null;
let isMuted = false;
let audioContext = null;
let analyser = null;
let speakingInterval = null;
let remoteAudios = {}; // Storage for remote audio elements

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export function initVoiceLounge() {
    // Listener for lounge users to update UI
    const usersRef = ref(rtdb, 'voice_lounge/users');
    onValue(usersRef, (snapshot) => {
        const listContainer = document.getElementById('voice-users-list');
        if (!listContainer) return;

        const data = snapshot.val();
        if (!data) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-6 opacity-20 italic">
                    <p class="text-[10px] font-bold uppercase tracking-widest">Lounge Kosong</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = '';
        Object.keys(data).forEach((uid) => {
            const user = data[uid];
            const userDiv = document.createElement('div');
            userDiv.className = `voice-user ${user.isSpeaking ? 'speaking' : ''} mb-2`;
            userDiv.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-black text-red-400">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1">
                    <p class="text-[10px] font-black uppercase tracking-wider">${user.name}</p>
                    <p class="text-[8px] font-bold opacity-30 uppercase">${user.role || 'Panitia'}</p>
                </div>
                ${user.isMuted ? `
                <svg class="w-4 h-4 text-red-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>` : `
                <div class="w-2 h-2 rounded-full bg-green-500 ${user.isSpeaking ? 'pulse-mic' : 'opacity-30'} transition-all duration-300"></div>
                `}
            `;
            listContainer.appendChild(userDiv);
        });
    });
}

export async function joinVoice(user) {
    currentUser = user;

    // Get local audio stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setupSpeakingDetection();
    } catch (err) {
        console.error("Mic Error:", err);
        throw new Error("Izin mikrofon ditolak atau tidak ditemukan");
    }

    // Register user in lounge via RTDB
    const userRef = ref(rtdb, `voice_lounge/users/${user.uid}`);
    await set(userRef, {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        role: "Panitia",
        isMuted: false,
        isSpeaking: false,
        joinedAt: serverTimestamp()
    });

    // Auto-cleanup on disconnect
    onDisconnect(userRef).remove();
    onDisconnect(ref(rtdb, `voice_lounge/calls_to/${user.uid}`)).remove();
    onDisconnect(ref(rtdb, `voice_lounge/signals_to/${user.uid}`)).remove();

    // Handle incoming calls (Signaling)
    setupSignaling();

    // Call existing users
    const usersRef = ref(rtdb, 'voice_lounge/users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        if (users) {
            Object.keys(users).forEach(remoteUid => {
                if (remoteUid !== user.uid && !peerConnections[remoteUid]) {
                    createCall(remoteUid);
                }
            });
        }
    }, { onlyOnce: true });

    return true;
}

function setupSpeakingDetection() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(localStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let wasSpeaking = false;
        let lastUpdate = 0;

        speakingInterval = setInterval(async () => {
            if (isMuted || !currentUser) return;

            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const average = sum / bufferLength;
            const isSpeaking = average > 15; // Lowered threshold slightly

            // Optimized: Throttle and only update if changed
            if (isSpeaking !== wasSpeaking && Date.now() - lastUpdate > 2000) { // 🔥 OPTIMIZED: Match 2s interval
                wasSpeaking = isSpeaking;
                lastUpdate = Date.now();
                update(ref(rtdb, `voice_lounge/users/${currentUser.uid}`), { isSpeaking: isSpeaking });
            }
        }, 2000); // 🔥 OPTIMIZED: Increased from 200ms to 2000ms to reduce Firebase writes by 90%
    } catch (e) {
        console.warn("Audio Context init failed:", e);
    }
}

async function setupSignaling() {
    // Listen for calls to me
    const myCallsRef = ref(rtdb, `voice_lounge/calls_to/${currentUser.uid}`);
    onChildAdded(myCallsRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.type === 'offer') {
            await handleOffer(data);
        } else if (data.type === 'answer') {
            const pc = peerConnections[data.from];
            if (pc && pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
            }
        }
        remove(snapshot.ref);
    });

    // Listen for ICE candidates to me
    const mySignalsRef = ref(rtdb, `voice_lounge/signals_to/${currentUser.uid}`);
    onChildAdded(mySignalsRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const pc = peerConnections[data.from];
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error("Error adding ICE candidate:", e);
            }
        }
        remove(snapshot.ref);
    });
}

function getAudioElement(remoteUid) {
    if (!remoteAudios[remoteUid]) {
        const audio = new Audio();
        audio.autoplay = true;
        remoteAudios[remoteUid] = audio;
    }
    return remoteAudios[remoteUid];
}

async function handleOffer(data) {
    if (peerConnections[data.from]) {
        peerConnections[data.from].close();
    }

    const pc = new RTCPeerConnection(servers);
    peerConnections[data.from] = pc;

    if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(rtdb, `voice_lounge/signals_to/${data.from}`), {
                type: 'candidate',
                from: currentUser.uid,
                candidate: event.candidate.toJSON()
            });
        }
    };

    pc.ontrack = (event) => {
        const audio = getAudioElement(data.from);
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.warn("Audio play blocked:", e));
    };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    push(ref(rtdb, `voice_lounge/calls_to/${data.from}`), {
        type: 'answer',
        from: currentUser.uid,
        sdp: answer.sdp,
        timestamp: serverTimestamp()
    });
}

async function createCall(remoteUserId) {
    const pc = new RTCPeerConnection(servers);
    peerConnections[remoteUserId] = pc;

    if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            push(ref(rtdb, `voice_lounge/signals_to/${remoteUserId}`), {
                type: 'candidate',
                from: currentUser.uid,
                candidate: event.candidate.toJSON()
            });
        }
    };

    pc.ontrack = (event) => {
        const audio = getAudioElement(remoteUserId);
        audio.srcObject = event.streams[0];
        audio.play().catch(e => console.warn("Audio play blocked:", e));
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    push(ref(rtdb, `voice_lounge/calls_to/${remoteUserId}`), {
        type: 'offer',
        from: currentUser.uid,
        sdp: offer.sdp,
        timestamp: serverTimestamp()
    });
}

export async function leaveVoice() {
    if (speakingInterval) clearInterval(speakingInterval);
    if (audioContext && audioContext.state !== 'closed') audioContext.close();

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (currentUser) {
        await remove(ref(rtdb, `voice_lounge/users/${currentUser.uid}`));
        await remove(ref(rtdb, `voice_lounge/calls_to/${currentUser.uid}`));
        await remove(ref(rtdb, `voice_lounge/signals_to/${currentUser.uid}`));
    }

    Object.values(peerConnections).forEach(pc => pc.close());
    Object.values(remoteAudios).forEach(audio => {
        audio.srcObject = null;
        audio.remove();
    });

    peerConnections = {};
    remoteAudios = {};
    localStream = null;
    analyser = null;
    currentUser = null;
}

export function toggleMicMute() {
    if (!localStream) return false;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    if (currentUser) {
        update(ref(rtdb, `voice_lounge/users/${currentUser.uid}`), { isMuted: isMuted, isSpeaking: false });
    }
    return isMuted;
}

initVoiceLounge();
