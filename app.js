import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwqDmnTT5RhKLS7u6k53obARlErIOKnH0",
  authDomain: "dr-ali-dental2.firebaseapp.com",
  projectId: "dr-ali-dental2",
  storageBucket: "dr-ali-dental2.firebasestorage.app",
  messagingSenderId: "196920852238",
  appId: "1:196920852238:web:a4d75b1b7dbf9f2408a15f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const bookingForm = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const service = document.getElementById('service').value;
    const date = document.getElementById('date').value;
    const notes = document.getElementById('notes').value;

    try {
        await addDoc(collection(db, "bookings"), {
            name: name, phone: phone, service: service,
            date: date, notes: notes, status: "pending",
            createdAt: serverTimestamp()
        });
        formMessage.textContent = "✅ تم إرسال طلب الحجز بنجاح! سيتم التواصل معك قريباً للتأكيد.";
        formMessage.className = "success";
        formMessage.classList.remove("hidden");
        bookingForm.reset();
    } catch (error) {
        console.error("خطأ في إضافة الحجز: ", error);
        formMessage.textContent = "❌ حدث خطأ أثناء إرسال الحجز. يرجى المحاولة مرة أخرى.";
        formMessage.className = "error";
        formMessage.classList.remove("hidden");
    }
});