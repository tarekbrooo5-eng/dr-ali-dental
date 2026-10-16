import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, orderBy, addDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwqDmnTT5RhKLS7u6k53obARlErIOKnH0",
  authDomain: "dr-ali-dental2.firebaseapp.com",
  projectId: "dr-ali-dental2",
  storageBucket: "dr-ali-dental2.firebasestorage.app",
  messagingSenderId: "196920852238",
  appId: "1:196920852238:web:a4d75b1b7dbf9f2408a15f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentPatient = null;
let currentTooth = null;

/* === الدخول والخروج === */
window.login = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch(e) { document.getElementById('login-error').textContent = "❌ خطأ في البريد أو كلمة المرور"; }
};
window.logout = () => signOut(auth);

onAuthStateChanged(auth, user => {
  document.getElementById('login-section').style.display = user ? 'none' : 'block';
  document.getElementById('app').style.display = user ? 'block' : 'none';
  if (user) {
    loadBookings();
    loadPatients();
  }
});

/* === التبويبات === */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'reports') loadPatientSelect();
  });
});

/* === الحجوزات === */
async function loadBookings() {
  const list = document.getElementById('bookings-list');
  list.innerHTML = 'جاري التحميل...';
  const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  if (snap.empty) { list.innerHTML = '<p>لا توجد حجوزات.</p>'; return; }
  list.innerHTML = '';
  snap.forEach(d => {
    const b = d.data();
    const status = b.status || 'pending';
    const statusText = { pending:'قيد الانتظار', confirmed:'مؤكد', cancelled:'ملغي' }[status];
    const div = document.createElement('div');
    div.className = `booking-card ${status}`;
    div.innerHTML = `
      <h3>👤 ${b.name}</h3>
      <p>📞 ${b.phone}</p>
      <p>🦷 ${b.service}</p>
      <p>📅 ${b.date}</p>
      <p>📝 ${b.notes || 'لا يوجد'}</p>
      <p>الحالة: <span class="status-badge status-${status}">${statusText}</span></p>
      <div class="actions">
        ${status !== 'confirmed' ? `<button class="btn-confirm" onclick="updateBooking('${d.id}','confirmed')">تأكيد</button>` : ''}
        ${status !== 'cancelled' ? `<button class="btn-cancel" onclick="updateBooking('${d.id}','cancelled')">إلغاء</button>` : ''}
        <button class="btn-primary" onclick="window.convertToPatient('${b.name}','${b.phone}')">إضافة كمريض</button>
      </div>`;
    list.appendChild(div);
  });
}
window.updateBooking = async (id, status) => {
  await updateDoc(doc(db, "bookings", id), { status });
  loadBookings();
};
window.convertToPatient = (name, phone) => {
  document.getElementById('np-name').value = name;
  document.getElementById('np-phone').value = phone;
  document.getElementById('new-patient-modal').style.display = 'block';
};

/* === المرضى === */
async function loadPatients() {
  const list = document.getElementById('patients-list');
  list.innerHTML = 'جاري التحميل...';
  const snap = await getDocs(collection(db, "patients"));
  if (snap.empty) { list.innerHTML = '<p>لا يوجد مرضى بعد.</p>'; return; }
  list.innerHTML = '';
  snap.forEach(d => {
    const p = d.data();
    const totalCost = Object.values(p.treatments || {}).reduce((s,t) => s + (Number(t.cost)||0), 0);
    const totalPaid = (p.payments || []).reduce((s,pay) => s + (Number(pay.amount)||0), 0);
    const remaining = totalCost - totalPaid;
    const div = document.createElement('div');
    div.className = 'patient-card';
    div.innerHTML = `
      <h3>👤 ${p.name}</h3>
      <p>📞 ${p.phone || '—'}</p>
      <p>💰 المتبقي: <b>${remaining.toLocaleString()}</b> / الإجمالي: ${totalCost.toLocaleString()}</p>
      <div class="actions">
        <button class="btn-primary" onclick="window.openPatient('${d.id}')">فتح الملف</button>
      </div>`;
    list.appendChild(div);
  });
}

window.openNewPatient = () => document.getElementById('new-patient-modal').style.display = 'block';

window.saveNewPatient = async () => {
  const name = document.getElementById('np-name').value.trim();
  const phone = document.getElementById('np-phone').value.trim();
  const notes = document.getElementById('np-notes').value.trim();
  if (!name) return alert('الاسم مطلوب');
  await addDoc(collection(db, "patients"), {
    name, phone, notes,
    treatments: {}, sessions: [], payments: [],
    createdAt: serverTimestamp()
  });
  document.getElementById('np-name').value = '';
  document.getElementById('np-phone').value = '';
  document.getElementById('np-notes').value = '';
  document.getElementById('new-patient-modal').style.display = 'none';
  loadPatients();
};

/* === ملف المريض === */
window.openPatient = async (id) => {
  const snap = await getDocs(collection(db, "patients"));
  let patient = null;
  snap.forEach(d => { if (d.id === id) patient = { id: d.id, ...d.data() }; });
  if (!patient) return;
  currentPatient = patient;
  renderPatientModal();
  document.getElementById('patient-modal').style.display = 'block';
};

function renderPatientModal() {
  const p = currentPatient;
  const totalCost = Object.values(p.treatments || {}).reduce((s,t) => s + (Number(t.cost)||0), 0);
  const totalPaid = (p.payments || []).reduce((s,pay) => s + (Number(pay.amount)||0), 0);
  const remaining = totalCost - totalPaid;

  const body = document.getElementById('patient-modal-body');
  body.innerHTML = `
    <h2 style="color:var(--dark)">👤 ${p.name}</h2>
    <div class="patient-tabs">
      <button class="active" data-ptab="chart">🦷 مخطط الأسنان</button>
      <button data-ptab="sessions">📅 الجلسات</button>
      <button data-ptab="payments">💰 الدفعات</button>
      <button data-ptab="info">📄 معلومات</button>
    </div>

    <div class="patient-panel active" id="ptab-chart">
      <div class="info-grid">
        <div class="info-box"><div class="label">الإجمالي</div><div class="value">${totalCost.toLocaleString()}</div></div>
        <div class="info-box"><div class="label">المدفوع</div><div class="value" style="color:var(--ok)">${totalPaid.toLocaleString()}</div></div>
        <div class="info-box"><div class="label">المتبقي</div><div class="value" style="color:var(--danger)">${remaining.toLocaleString()}</div></div>
      </div>
      <div class="dental-chart">${renderChart(p.treatments || {})}</div>
    </div>

    <div class="patient-panel" id="ptab-sessions">
      <h3>الجلسات</h3>
      <table class="data-table">
        <thead><tr><th>التاريخ</th><th>الوصف</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>${(p.sessions||[]).map((s,i) => `<tr><td>${s.date}</td><td>${s.description||''}</td><td>${s.note||''}</td><td><button class="btn-danger" onclick="window.deleteSession(${i})">حذف</button></td></tr>`).join('') || '<tr><td colspan="4">لا توجد جلسات</td></tr>'}</tbody>
      </table>
      <h4 style="margin-top:15px">إضافة جلسة</h4>
      <input type="date" id="sess-date" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px">
      <input type="text" id="sess-desc" placeholder="وصف الجلسة" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px;width:100%">
      <input type="text" id="sess-note" placeholder="ملاحظة (اختياري)" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px;width:100%">
      <button class="btn-primary" onclick="window.addSession()">إضافة</button>
    </div>

    <div class="patient-panel" id="ptab-payments">
      <h3>الدفعات</h3>
      <table class="data-table">
        <thead><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>${(p.payments||[]).map((pay,i) => `<tr><td>${pay.date}</td><td>${Number(pay.amount).toLocaleString()}</td><td>${pay.note||''}</td><td><button class="btn-danger" onclick="window.deletePayment(${i})">حذف</button></td></tr>`).join('') || '<tr><td colspan="4">لا توجد دفعات</td></tr>'}</tbody>
      </table>
      <h4 style="margin-top:15px">إضافة دفعة</h4>
      <input type="date" id="pay-date" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px">
      <input type="number" id="pay-amount" placeholder="المبلغ" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px;width:100%">
      <input type="text" id="pay-note" placeholder="ملاحظة (اختياري)" style="padding:8px;margin:5px 0;border:1px solid #ddd;border-radius:6px;width:100%">
      <button class="btn-primary" onclick="window.addPayment()">إضافة</button>
    </div>

    <div class="patient-panel" id="ptab-info">
      <h3>المعلومات</h3>
      <p style="margin:8px 0"><b>الاسم:</b> ${p.name}</p>
      <p style="margin:8px 0"><b>الهاتف:</b> ${p.phone||'—'}</p>
      <p style="margin:8px 0"><b>ملاحظات:</b> ${p.notes||'—'}</p>
    </div>
  `;

  // تفعيل التبويبات الداخلية
  body.querySelectorAll('.patient-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('.patient-tabs button').forEach(b => b.classList.remove('active'));
      body.querySelectorAll('.patient-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('ptab-' + btn.dataset.ptab).classList.add('active');
    });
  });

  // أحداث الأسنان
  body.querySelectorAll('.tooth').forEach(t => {
    t.addEventListener('click', () => window.openTooth(t.dataset.number));
  });
}

window.closePatientModal = () => { document.getElementById('patient-modal').style.display = 'none'; currentPatient = null; };

/* === مخطط الأسنان FDI === */
function renderChart(treatments) {
  const upperRight = [18,17,16,15,14,13,12,11];
  const upperLeft  = [21,22,23,24,25,26,27,28];
  const lowerRight = [48,47,46,45,44,43,42,41];
  const lowerLeft  = [31,32,33,34,35,36,37,38];
  const toothHTML = (n, cls) => {
    const t = treatments[n];
    const status = t ? (t.status || 'pending') : '';
    return `<button class="tooth ${cls} ${status}" data-number="${n}">${n}</button>`;
  };
  return `
    <div class="arch-row">
      ${upperRight.map(n => toothHTML(n, 'upper')).join('')}
      <div class="divider"></div>
      ${upperLeft.map(n => toothHTML(n, 'upper')).join('')}
    </div>
    <div class="arch-row">
      ${lowerRight.map(n => toothHTML(n, 'lower')).join('')}
      <div class="divider"></div>
      ${lowerLeft.map(n => toothHTML(n, 'lower')).join('')}
    </div>
  `;
}

window.openTooth = (num) => {
  if (!currentPatient) return;
  currentTooth = num;
  const t = (currentPatient.treatments || {})[num] || {};
  document.getElementById('tooth-modal-title').textContent = `السن رقم ${num}`;
  document.getElementById('tooth-treatment').value = t.type || '';
  document.getElementById('tooth-status').value = t.status || 'pending';
  document.getElementById('tooth-cost').value = t.cost || '';
  document.getElementById('tooth-note').value = t.note || '';
  document.getElementById('tooth-modal').style.display = 'block';
};
window.closeToothModal = () => document.getElementById('tooth-modal').style.display = 'none';

window.saveTooth = async () => {
  const type = document.getElementById('tooth-treatment').value;
  const ref = doc(db, "patients", currentPatient.id);
  const treatments = { ...(currentPatient.treatments || {}) };
  if (!type) delete treatments[currentTooth];
  else treatments[currentTooth] = {
    type,
    status: document.getElementById('tooth-status').value,
    cost: Number(document.getElementById('tooth-cost').value) || 0,
    note: document.getElementById('tooth-note').value
  };
  await updateDoc(ref, { treatments });
  currentPatient.treatments = treatments;
  window.closeToothModal();
  renderPatientModal();
  loadPatients();
};
window.deleteTooth = async () => {
  if (!confirm('حذف معالجة هذا السن؟')) return;
  const treatments = { ...(currentPatient.treatments || {}) };
  delete treatments[currentTooth];
  await updateDoc(doc(db, "patients", currentPatient.id), { treatments });
  currentPatient.treatments = treatments;
  window.closeToothModal();
  renderPatientModal();
  loadPatients();
};

/* === الجلسات === */
window.addSession = async () => {
  const date = document.getElementById('sess-date').value;
  const desc = document.getElementById('sess-desc').value;
  if (!date) return alert('اختر التاريخ');
  const sessions = [...(currentPatient.sessions || []), { date, description: desc, note: document.getElementById('sess-note').value }];
  await updateDoc(doc(db, "patients", currentPatient.id), { sessions });
  currentPatient.sessions = sessions;
  renderPatientModal();
};
window.deleteSession = async (i) => {
  const sessions = [...(currentPatient.sessions || [])];
  sessions.splice(i, 1);
  await updateDoc(doc(db, "patients", currentPatient.id), { sessions });
  currentPatient.sessions = sessions;
  renderPatientModal();
};

/* === الدفعات === */
window.addPayment = async () => {
  const date = document.getElementById('pay-date').value;
  const amount = Number(document.getElementById('pay-amount').value);
  if (!date || !amount) return alert('أدخل التاريخ والمبلغ');
  const payments = [...(currentPatient.payments || []), { date, amount, note: document.getElementById('pay-note').value }];
  await updateDoc(doc(db, "patients", currentPatient.id), { payments });
  currentPatient.payments = payments;
  renderPatientModal();
  loadPatients();
};
window.deletePayment = async (i) => {
  const payments = [...(currentPatient.payments || [])];
  payments.splice(i, 1);
  await updateDoc(doc(db, "patients", currentPatient.id), { payments });
  currentPatient.payments = payments;
  renderPatientModal();
  loadPatients();
};

/* === التقارير === */
async function loadPatientSelect() {
  const sel = document.getElementById('report-patient-select');
  sel.innerHTML = '<option value="">— اختر مريضاً —</option>';
  const snap = await getDocs(collection(db, "patients"));
  snap.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.data().name;
    sel.appendChild(opt);
  });
}

function downloadExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}

function printPDF(html, title) {
  const w = window.open('', '', 'width=900,height=700');
  w.document.write(`<html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:'Cairo',Tahoma,sans-serif;padding:20px;direction:rtl}
    table{width:100%;border-collapse:collapse;margin-top:15px}
    th,td{border:1px solid #333;padding:8px;text-align:right}
    th{background:#eee}h1{color:#1565c0;text-align:center}</style></head>
    <body><h1>عيادة د. علي حسن</h1><h3 style="text-align:center">${title}</h3>${html}</body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
}

window.exportPatientsExcel = async () => {
  const snap = await getDocs(collection(db, "patients"));
  const rows = [];
  snap.forEach(d => {
    const p = d.data();
    const totalCost = Object.values(p.treatments||{}).reduce((s,t)=>s+(Number(t.cost)||0),0);
    const totalPaid = (p.payments||[]).reduce((s,x)=>s+(Number(x.amount)||0),0);
    rows.push({
      'الاسم': p.name, 'الهاتف': p.phone||'',
      'الإجمالي': totalCost, 'المدفوع': totalPaid, 'المتبقي': totalCost-totalPaid,
      'عدد الجلسات': (p.sessions||[]).length
    });
  });
  downloadExcel(rows, 'patients.xlsx');
};

window.exportPatientsPDF = async () => {
  const snap = await getDocs(collection(db, "patients"));
  let html = '<table><tr><th>الاسم</th><th>الهاتف</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>';
  snap.forEach(d => {
    const p = d.data();
    const totalCost = Object.values(p.treatments||{}).reduce((s,t)=>s+(Number(t.cost)||0),0);
    const totalPaid = (p.payments||[]).reduce((s,x)=>s+(Number(x.amount)||0),0);
    html += `<tr><td>${p.name}</td><td>${p.phone||''}</td><td>${totalCost}</td><td>${totalPaid}</td><td>${totalCost-totalPaid}</td></tr>`;
  });
  html += '</table>';
  printPDF(html, 'تقرير المرضى');
};

window.exportPatientPaymentsExcel = async () => {
  const id = document.getElementById('report-patient-select').value;
  if (!id) return alert('اختر مريضاً');
  const snap = await getDocs(collection(db, "patients"));
  let patient = null;
  snap.forEach(d => { if (d.id === id) patient = d.data(); });
  const rows = (patient.payments||[]).map(p => ({ 'التاريخ': p.date, 'المبلغ': p.amount, 'ملاحظة': p.note||'' }));
  downloadExcel(rows, `payments-${patient.name}.xlsx`);
};

window.exportPatientPaymentsPDF = async () => {
  const id = document.getElementById('report-patient-select').value;
  if (!id) return alert('اختر مريضاً');
  const snap = await getDocs(collection(db, "patients"));
  let patient = null;
  snap.forEach(d => { if (d.id === id) patient = d.data(); });
  const totalPaid = (patient.payments||[]).reduce((s,x)=>s+(Number(x.amount)||0),0);
  const totalCost = Object.values(patient.treatments||{}).reduce((s,t)=>s+(Number(t.cost)||0),0);
  let html = `<p><b>المريض:</b> ${patient.name}</p>
    <p><b>الإجمالي:</b> ${totalCost} — <b>المدفوع:</b> ${totalPaid} — <b>المتبقي:</b> ${totalCost-totalPaid}</p>
    <table><tr><th>التاريخ</th><th>المبلغ</th><th>ملاحظة</th></tr>`;
  (patient.payments||[]).forEach(p => {
    html += `<tr><td>${p.date}</td><td>${p.amount}</td><td>${p.note||''}</td></tr>`;
  });
  html += '</table>';
  printPDF(html, `دفعات ${patient.name}`);
};