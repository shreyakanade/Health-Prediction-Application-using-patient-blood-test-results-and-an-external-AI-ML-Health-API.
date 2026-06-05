/* ─────────────────────────────────────────────────
   MIRA Frontend — app.js
   ───────────────────────────────────────────────── */

const API = "http://localhost:5000/api";
let currentView = "dashboard";
let editingId = null;
let searchDebounce = null;

// ─────────────────────────────────────────
// View Management
// ─────────────────────────────────────────

function switchView(view) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`view-${view}`).classList.add("active");
  document.querySelector(`[data-view="${view}"]`)?.classList.add("active");

  const titles = { dashboard: "Dashboard", patients: "Patients", add: "New Patient" };
  document.getElementById("viewTitle").textContent = titles[view] || view;

  const searchWrap = document.getElementById("searchWrap");
  searchWrap.style.display = view === "patients" ? "flex" : "none";

  currentView = view;
  editingId = null;

  if (view === "dashboard")  loadDashboard();
  if (view === "patients")   loadPatients();
  if (view === "add") {
    resetForm();
    document.getElementById("formTitle").textContent = "New Patient Record";
    document.getElementById("formSubtitle").textContent = "Blood test values will be analysed by Claude AI to generate a health risk assessment.";
    document.getElementById("submitBtn").querySelector(".btn-text").textContent = "Generate AI Assessment & Save";
  }
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

// ─────────────────────────────────────────
// API Helpers
// ─────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ─────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────

async function loadDashboard() {
  const [statsRes, patientsRes] = await Promise.all([
    apiFetch("/stats"),
    apiFetch("/patients"),
  ]);
  if (statsRes.ok) {
    const s = statsRes.data;
    document.getElementById("statTotal").textContent   = s.total_patients;
    document.getElementById("statGlucose").textContent = s.avg_glucose || "—";
    document.getElementById("statHaemo").textContent   = s.avg_haemoglobin || "—";
    document.getElementById("statChol").textContent    = s.avg_cholesterol || "—";
  }
  if (patientsRes.ok) {
    const recent = patientsRes.data.slice(0, 5);
    renderPatientCards("recentList", recent);
  }
}

// ─────────────────────────────────────────
// Patients List
// ─────────────────────────────────────────

async function loadPatients(search = "") {
  const url = search ? `/patients?search=${encodeURIComponent(search)}` : "/patients";
  const res = await apiFetch(url);
  if (res.ok) renderPatientCards("patientList", res.data);
}

document.getElementById("searchInput").addEventListener("input", e => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadPatients(e.target.value), 300);
});

// ─────────────────────────────────────────
// Render Cards
// ─────────────────────────────────────────

function getRiskLevel(remarks) {
  if (!remarks) return "unknown";
  const r = remarks.toLowerCase();
  if (r.includes("risk level: high")   || r.includes("risk level:high"))     return "high";
  if (r.includes("risk level: moderate") || r.includes("risk level:moderate")) return "moderate";
  if (r.includes("risk level: low")    || r.includes("risk level:low"))      return "low";
  if (r.includes("high"))     return "high";
  if (r.includes("moderate")) return "moderate";
  if (r.includes("low"))      return "low";
  return "unknown";
}

const AVATAR_COLORS = [
  ["#00d4aa22","#00d4aa"],
  ["#3b82f622","#3b82f6"],
  ["#a78bfa22","#a78bfa"],
  ["#f59e0b22","#f59e0b"],
  ["#ec489922","#ec4899"],
];

function initials(name) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function renderPatientCards(containerId, patients) {
  const el = document.getElementById(containerId);
  if (!patients.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">🩺</div>
      <div class="empty-state__text">No patients found</div>
      <div class="empty-state__sub">Add a new patient to get started.</div>
    </div>`;
    return;
  }

  el.innerHTML = patients.map((p, i) => {
    const risk = getRiskLevel(p.remarks);
    const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const riskLabel = risk.charAt(0).toUpperCase() + risk.slice(1);
    const dob = p.date_of_birth ? new Date(p.date_of_birth) : null;
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / 3.156e10) : "—";

    return `<div class="patient-card" onclick="openModal(${p.id})">
      <div class="patient-avatar" style="background:${color[0]};color:${color[1]}">${initials(p.full_name)}</div>
      <div class="patient-info">
        <div class="patient-info__name">${escHtml(p.full_name)}</div>
        <div class="patient-info__email">${escHtml(p.email)}</div>
      </div>
      <div class="bio-val">
        <div class="bio-val__num">${p.glucose}</div>
        <div class="bio-val__label">Glucose</div>
      </div>
      <div class="bio-val">
        <div class="bio-val__num">${p.haemoglobin}</div>
        <div class="bio-val__label">Haemo.</div>
      </div>
      <div class="bio-val">
        <div class="bio-val__num">${p.cholesterol}</div>
        <div class="bio-val__label">Chol.</div>
      </div>
      <span class="risk-badge risk-badge--${risk}">${riskLabel}</span>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-icon" title="Edit" onclick="editPatient(${p.id})">✏️</button>
        <button class="btn-icon btn-icon--danger" title="Delete" onclick="confirmDelete(${p.id}, '${escHtml(p.full_name).replace(/'/g,"\\'")}')">🗑</button>
      </div>
    </div>`;
  }).join("");
}

// ─────────────────────────────────────────
// Modal — View Patient
// ─────────────────────────────────────────

async function openModal(id) {
  const res = await apiFetch(`/patients/${id}`);
  if (!res.ok) return showToast("Failed to load patient", "error");
  const p = res.data;
  const risk = getRiskLevel(p.remarks);
  const color = AVATAR_COLORS[0];

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-patient-name">${escHtml(p.full_name)}</div>
    <div class="modal-patient-email">${escHtml(p.email)} · DOB: ${p.date_of_birth}</div>
    <div class="modal-bio-grid">
      <div class="modal-bio-item">
        <div class="modal-bio-item__val">${p.glucose}</div>
        <div class="modal-bio-item__label">Glucose mg/dL</div>
      </div>
      <div class="modal-bio-item">
        <div class="modal-bio-item__val">${p.haemoglobin}</div>
        <div class="modal-bio-item__label">Haemoglobin g/dL</div>
      </div>
      <div class="modal-bio-item">
        <div class="modal-bio-item__val">${p.cholesterol}</div>
        <div class="modal-bio-item__label">Cholesterol mg/dL</div>
      </div>
    </div>
    <div class="modal-remarks-title">🤖 AI Health Assessment</div>
    <div class="modal-remarks">${escHtml(p.remarks || "No remarks generated.")}</div>
    <div class="modal-dates">
      <span>Created: ${new Date(p.created_at).toLocaleString()}</span>
      <span>Updated: ${new Date(p.updated_at).toLocaleString()}</span>
    </div>
    <div class="modal-actions">
      <button class="btn btn--ghost btn--sm" onclick="editPatient(${p.id}); closeModalDirect();">✏️ Edit</button>
      <button class="btn btn--danger btn--sm" onclick="confirmDelete(${p.id}, '${escHtml(p.full_name).replace(/'/g,"\\'")}'); closeModalDirect();">🗑 Delete</button>
    </div>
  `;
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal(e) {
  if (e.target === document.getElementById("modalOverlay")) closeModalDirect();
}
function closeModalDirect() {
  document.getElementById("modalOverlay").classList.remove("open");
}

// ─────────────────────────────────────────
// Form — Create / Edit
// ─────────────────────────────────────────

function resetForm() {
  ["f_name","f_dob","f_email","f_glucose","f_haemo","f_chol"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("formErrors").style.display = "none";
  document.getElementById("formErrors").innerHTML = "";
  editingId = null;
}

async function editPatient(id) {
  const res = await apiFetch(`/patients/${id}`);
  if (!res.ok) return showToast("Failed to load patient", "error");
  const p = res.data;

  editingId = id;
  document.getElementById("f_name").value  = p.full_name;
  document.getElementById("f_dob").value   = p.date_of_birth;
  document.getElementById("f_email").value = p.email;
  document.getElementById("f_glucose").value = p.glucose;
  document.getElementById("f_haemo").value   = p.haemoglobin;
  document.getElementById("f_chol").value    = p.cholesterol;

  document.getElementById("formTitle").textContent = "Edit Patient Record";
  document.getElementById("formSubtitle").textContent = "Modifying blood values will trigger a fresh AI assessment.";
  document.getElementById("submitBtn").querySelector(".btn-text").textContent = "Save Changes";

  switchView("add");
}

function cancelForm() {
  resetForm();
  switchView("patients");
}

async function submitForm() {
  const body = {
    full_name:    document.getElementById("f_name").value.trim(),
    date_of_birth: document.getElementById("f_dob").value,
    email:        document.getElementById("f_email").value.trim(),
    glucose:      document.getElementById("f_glucose").value,
    haemoglobin:  document.getElementById("f_haemo").value,
    cholesterol:  document.getElementById("f_chol").value,
  };

  // Client-side pre-validation
  const clientErrors = [];
  if (!body.full_name) clientErrors.push("Full name is required.");
  if (!body.date_of_birth) clientErrors.push("Date of birth is required.");
  else if (new Date(body.date_of_birth) >= new Date()) clientErrors.push("Date of birth cannot be today or a future date.");
  if (!body.email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) clientErrors.push("Invalid email address format.");
  ["glucose","haemoglobin","cholesterol"].forEach(f => {
    if (body[f] === "" || isNaN(parseFloat(body[f]))) clientErrors.push(`${f.charAt(0).toUpperCase()+f.slice(1)} must be a numeric value.`);
  });

  if (clientErrors.length) return showErrors(clientErrors);

  setLoading(true);

  const method = editingId ? "PUT" : "POST";
  const path   = editingId ? `/patients/${editingId}` : "/patients";
  const res = await apiFetch(path, { method, body: JSON.stringify(body) });

  setLoading(false);

  if (res.ok) {
    showToast(editingId ? "Patient updated successfully!" : "Patient added & assessed!", "success");
    resetForm();
    switchView("patients");
  } else {
    const errs = res.data.errors || [res.data.error || "Something went wrong."];
    showErrors(errs);
  }
}

function showErrors(errors) {
  const el = document.getElementById("formErrors");
  el.innerHTML = `<ul>${errors.map(e => `<li>${escHtml(e)}</li>`).join("")}</ul>`;
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setLoading(on) {
  const btn = document.getElementById("submitBtn");
  const text = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  text.style.display   = on ? "none" : "inline";
  loader.style.display = on ? "flex" : "none";
  btn.disabled = on;
}

// ─────────────────────────────────────────
// Delete
// ─────────────────────────────────────────

function confirmDelete(id, name) {
  const overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <h3>Delete Patient?</h3>
      <p>This will permanently delete <strong>${escHtml(name)}</strong> and their health records. This cannot be undone.</p>
      <div class="confirm-btns">
        <button class="btn btn--ghost btn--sm" id="cancelDel">Cancel</button>
        <button class="btn btn--danger btn--sm" id="confirmDel">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#cancelDel").onclick = () => overlay.remove();
  overlay.querySelector("#confirmDel").onclick = async () => {
    overlay.remove();
    const res = await apiFetch(`/patients/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Patient deleted.", "success");
      if (currentView === "patients") loadPatients();
      else loadDashboard();
    } else {
      showToast("Failed to delete patient.", "error");
    }
  };
}

// ─────────────────────────────────────────
// Toasts
// ─────────────────────────────────────────

function showToast(msg, type = "success") {
  const icon = type === "success" ? "✅" : "❌";
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__icon">${icon}</span>${escHtml(msg)}`;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────
// Init
// ─────────────────────────────────────────

loadDashboard();
