import { db } from './firebase-init.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dummyEvents = [
    {
        name: "Kejuaraan Karate Kensho Cup 2026",
        location: "Gedung Olahraga Kencana",
        date: "2026-05-20",
        status: "Berlangsung",
        createdAt: new Date().toISOString()
    },
    {
        name: "Seleksi Daerah Open Tournament",
        location: "Karate Training Center",
        date: "2026-06-15",
        status: "Aktif",
        createdAt: new Date().toISOString()
    },
    {
        name: "Traditional Karate Championship",
        location: "Dojo Pusat Kensho",
        date: "2026-04-10",
        status: "Selesai",
        createdAt: new Date().toISOString()
    }
];

export async function seedDummyEvents() {
    try {
        console.log("Seeding dummy events...");
        for (const event of dummyEvents) {
            const docRef = await addDoc(collection(db, "events"), event);
            console.log("Event added with ID:", docRef.id);
        }
        alert("Dummy events added successfully!");
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}
