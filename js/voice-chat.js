import { db } from './firebase-init.js';
import { collection, doc, setDoc, onSnapshot, deleteDoc, addDoc, query, where, serverTimestamp, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let localStream = null;
let peerConnections = {};
let currentUser = null;
let isMuted = false;
let audioContext = null;
let analyser = null;
let speakingInterval = null;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export async function initVoiceLounge() {
    // Listener for lounge users to update UI
    onSnapshot(collection(db, "voice_lounge_users"), (snapshot) => {
        const listContainer = document.getElementById('voice-users-list');
        if (!listContainer) return;

        if (snapshot.empty) {
            listContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-6 opacity-20 italic">
                    <p class="text-[10px] font-bold uppercase tracking-widest">Lounge Kosong</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const userDiv = document.createElement('div');
            userDiv.className = `voice-user ${data.isSpeaking ? 'speaking' : ''} mb-2`;
            userDiv.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-black text-red-400">
                    ${data.name.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1">
                    <p class="text-[10px] font-black uppercase tracking-wider">${data.name}</p>
                    <p class="text-[8px] font-bold opacity-30 uppercase">${data.role || 'Panitia'}</p>
                </div>
                ${data.isMuted ? `
                <svg class="w-4 h-4 text-red-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>` : `
                <div class="w-2 h-2 rounded-full bg-green-500 ${data.isSpeaking ? 'pulse-mic' : 'opacity-30'} transition-all duration-300"></div>
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
        throw new Error("Izin mikrofon ditolak atau tidak ditemukan");
    }

    // Register user in lounge
    await setDoc(doc(db, "voice_lounge_users", user.uid), {
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        role: "Panitia", // Fixed for now, can be dynamic
        isMuted: false,
        isSpeaking: false,
        joinedAt: serverTimestamp()
    });

    // Handle incoming calls (Signaling)
    setupSignaling();

    // Call existing users
    const usersSnap = await getDocs(collection(db, "voice_lounge_users"));
    usersSnap.forEach(async (uDoc) => {
        if (uDoc.id !== user.uid) {
            await createCall(uDoc.id);
        }
    });

    return true;
}

function setupSpeakingDetection() {
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
        if (isMuted) return;

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        const isSpeaking = average > 20; // Threshold

        if (isSpeaking !== wasSpeaking && Date.now() - lastUpdate > 1000) {
            wasSpeaking = isSpeaking;
            lastUpdate = Date.now();
            await updateDoc(doc(db, "voice_lounge_users", currentUser.uid), { isSpeaking: isSpeaking });
        }
    }, 200);
}

async function setupSignaling() {
    // Listen for offers addressed to me
    onSnapshot(query(collection(db, "voice_calls"), where("to", "==", currentUser.uid)), async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                if (data.type === 'offer') {
                    await handleOffer(data, change.doc.id);
                } else if (data.type === 'answer') {
                    const pc = peerConnections[data.from];
                    if (pc) await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
                }
            }
        });
    });

    // Listen for ICE candidates
    onSnapshot(query(collection(db, "voice_signals"), where("to", "==", currentUser.uid)), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                const pc = peerConnections[data.from];
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });
    });
}

async function handleOffer(data, callId) {
    const pc = new RTCPeerConnection(servers);
    peerConnections[data.from] = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(collection(db, "voice_signals"), {
                type: 'candidate',
                from: currentUser.uid,
                to: data.from,
                candidate: event.candidate.toJSON()
            });
        }
    };

    pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await addDoc(collection(db, "voice_calls"), {
        type: 'answer',
        from: currentUser.uid,
        to: data.from,
        sdp: answer.sdp,
        timestamp: serverTimestamp()
    });
}

async function createCall(remoteUserId) {
    const pc = new RTCPeerConnection(servers);
    peerConnections[remoteUserId] = pc;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            addDoc(collection(db, "voice_signals"), {
                type: 'candidate',
                from: currentUser.uid,
                to: remoteUserId,
                candidate: event.candidate.toJSON()
            });
        }
    };

    pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await addDoc(collection(db, "voice_calls"), {
        type: 'offer',
        from: currentUser.uid,
        to: remoteUserId,
        sdp: offer.sdp,
        timestamp: serverTimestamp()
    });
}

// Basic cleanup on leave
export async function leaveVoice() {
    if (speakingInterval) clearInterval(speakingInterval);
    if (audioContext) audioContext.close();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (currentUser) {
        await deleteDoc(doc(db, "voice_lounge_users", currentUser.uid));
        // Cleanup my signals/calls
        const q1 = query(collection(db, "voice_calls"), where("from", "==", currentUser.uid));
        const q2 = query(collection(db, "voice_signals"), where("from", "==", currentUser.uid));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        snap1.forEach(d => deleteDoc(d.ref));
        snap2.forEach(d => deleteDoc(d.ref));
    }

    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    localStream = null;
    analyser = null;
}

export function toggleMicMute() {
    if (!localStream) return false;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    updateDoc(doc(db, "voice_lounge_users", currentUser.uid), { isMuted: isMuted, isSpeaking: false });
    return isMuted;
}

// Auto-init on load if relevant
initVoiceLounge();
