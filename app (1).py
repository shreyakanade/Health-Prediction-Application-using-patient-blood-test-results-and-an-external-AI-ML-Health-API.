import os
import sqlite3
import json
import re
from datetime import date, datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import anthropic

app = Flask(__name__, static_folder="../frontend/static", template_folder="../frontend/templates")
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "mira.db")

# ─────────────────────────────────────────
# Database Setup
# ─────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                date_of_birth TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                glucose REAL NOT NULL,
                haemoglobin REAL NOT NULL,
                cholesterol REAL NOT NULL,
                remarks TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()

# ─────────────────────────────────────────
# AI Prediction via Anthropic Claude API
# ─────────────────────────────────────────

def get_health_prediction(patient_data: dict) -> str:
    """Call Claude API to predict health condition from blood test results."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return "AI prediction unavailable — ANTHROPIC_API_KEY not configured."

    client = anthropic.Anthropic(api_key=api_key)

    dob = datetime.strptime(patient_data["date_of_birth"], "%Y-%m-%d")
    age = (date.today() - dob.date()).days // 365

    prompt = f"""You are a clinical decision support AI assistant. Analyse the following patient blood test results and provide a concise health risk assessment.

Patient Profile:
- Age: {age} years old
- Glucose: {patient_data['glucose']} mg/dL  (normal fasting: 70–99 mg/dL)
- Haemoglobin: {patient_data['haemoglobin']} g/dL  (normal: men 13.5–17.5, women 12–15.5 g/dL)
- Cholesterol (Total): {patient_data['cholesterol']} mg/dL  (desirable: <200 mg/dL)

Provide a structured clinical remarks summary in this exact format:
1. Risk Level: [Low / Moderate / High]
2. Key Findings: (2–3 bullet points on notable values)
3. Possible Health Concerns: (brief mention of conditions suggested by these values)
4. Recommendation: (1 sentence clinical advice)

Keep it concise, professional, and evidence-based. Do not diagnose — frame as risk indicators only."""

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text.strip()

# ─────────────────────────────────────────
# Validation Helpers
# ─────────────────────────────────────────

def validate_patient(data: dict, is_update=False):
    errors = []

    if not is_update or "full_name" in data:
        if not data.get("full_name", "").strip():
            errors.append("Full name is required.")

    if not is_update or "date_of_birth" in data:
        dob_str = data.get("date_of_birth", "")
        try:
            dob = datetime.strptime(dob_str, "%Y-%m-%d").date()
            if dob >= date.today():
                errors.append("Date of birth cannot be today or a future date.")
        except ValueError:
            errors.append("Invalid date of birth format (expected YYYY-MM-DD).")

    if not is_update or "email" in data:
        email = data.get("email", "")
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            errors.append("Invalid email address format.")

    for field, label, low, high in [
        ("glucose",      "Glucose",      0,  2000),
        ("haemoglobin",  "Haemoglobin",  0,   100),
        ("cholesterol",  "Cholesterol",  0,  2000),
    ]:
        if not is_update or field in data:
            try:
                val = float(data.get(field, ""))
                if val < low or val > high:
                    errors.append(f"{label} must be between {low} and {high}.")
            except (ValueError, TypeError):
                errors.append(f"{label} must be a numeric value.")

    return errors

# ─────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("../frontend", "index.html")

@app.route("/api/patients", methods=["GET"])
def get_patients():
    search = request.args.get("search", "").strip()
    with get_db() as conn:
        if search:
            rows = conn.execute(
                "SELECT * FROM patients WHERE full_name LIKE ? OR email LIKE ? ORDER BY created_at DESC",
                (f"%{search}%", f"%{search}%")
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM patients ORDER BY created_at DESC").fetchall()
    return jsonify([dict(r) for r in rows])

@app.route("/api/patients/<int:pid>", methods=["GET"])
def get_patient(pid):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not row:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(dict(row))

@app.route("/api/patients", methods=["POST"])
def create_patient():
    data = request.get_json()
    errors = validate_patient(data)
    if errors:
        return jsonify({"errors": errors}), 400

    remarks = get_health_prediction(data)

    try:
        with get_db() as conn:
            cur = conn.execute(
                """INSERT INTO patients (full_name, date_of_birth, email, glucose, haemoglobin, cholesterol, remarks)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (data["full_name"].strip(), data["date_of_birth"], data["email"].strip().lower(),
                 float(data["glucose"]), float(data["haemoglobin"]), float(data["cholesterol"]), remarks)
            )
            conn.commit()
            new_id = cur.lastrowid
        with get_db() as conn:
            row = conn.execute("SELECT * FROM patients WHERE id=?", (new_id,)).fetchone()
        return jsonify(dict(row)), 201
    except sqlite3.IntegrityError:
        return jsonify({"errors": ["A patient with this email already exists."]}), 409

@app.route("/api/patients/<int:pid>", methods=["PUT"])
def update_patient(pid):
    data = request.get_json()
    errors = validate_patient(data, is_update=True)
    if errors:
        return jsonify({"errors": errors}), 400

    with get_db() as conn:
        existing = conn.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not existing:
        return jsonify({"error": "Patient not found"}), 404

    merged = dict(existing)
    for k in ["full_name", "date_of_birth", "email", "glucose", "haemoglobin", "cholesterol"]:
        if k in data:
            merged[k] = data[k]

    # Re-run AI prediction if blood values changed
    blood_changed = any(k in data for k in ["glucose", "haemoglobin", "cholesterol", "date_of_birth"])
    if blood_changed:
        merged["remarks"] = get_health_prediction(merged)

    try:
        with get_db() as conn:
            conn.execute(
                """UPDATE patients SET full_name=?, date_of_birth=?, email=?, glucose=?, haemoglobin=?,
                   cholesterol=?, remarks=?, updated_at=datetime('now') WHERE id=?""",
                (merged["full_name"], merged["date_of_birth"], merged["email"],
                 float(merged["glucose"]), float(merged["haemoglobin"]), float(merged["cholesterol"]),
                 merged["remarks"], pid)
            )
            conn.commit()
        with get_db() as conn:
            row = conn.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
        return jsonify(dict(row))
    except sqlite3.IntegrityError:
        return jsonify({"errors": ["A patient with this email already exists."]}), 409

@app.route("/api/patients/<int:pid>", methods=["DELETE"])
def delete_patient(pid):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM patients WHERE id=?", (pid,)).fetchone()
        if not row:
            return jsonify({"error": "Patient not found"}), 404
        conn.execute("DELETE FROM patients WHERE id=?", (pid,))
        conn.commit()
    return jsonify({"message": "Patient deleted successfully"})

@app.route("/api/stats", methods=["GET"])
def get_stats():
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
        avg = conn.execute(
            "SELECT AVG(glucose) as g, AVG(haemoglobin) as h, AVG(cholesterol) as c FROM patients"
        ).fetchone()
    return jsonify({
        "total_patients": total,
        "avg_glucose": round(avg["g"] or 0, 1),
        "avg_haemoglobin": round(avg["h"] or 0, 1),
        "avg_cholesterol": round(avg["c"] or 0, 1),
    })

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
