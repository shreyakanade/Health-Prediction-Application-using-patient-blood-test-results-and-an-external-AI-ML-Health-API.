# MIRA — Medical Intelligence Robotic Automation

> A health prediction platform combining Python Flask, SQLite, and OPENAI to manage patient blood test records with AI-generated clinical risk assessments.

---

## ✨ Features

- **Full CRUD** — Create, Read, Update, Delete patient records
- **AI Health Assessment** —  analyses Glucose, Haemoglobin, and Cholesterol values and generates a structured clinical risk summary
- **Real-time Search** — Filter patients by name or email
- **Dashboard** — Live aggregated stats across all patients
- **Data Validation** — Client + server-side validation (email format, DOB constraints, numeric blood values)
- **Persistent Storage** — SQLite database (zero-config, file-based)

---

## 🗂 Project Structure

```
mira/
├── backend/
│   ├── app.py           # Flask API (CRUD + AI integration)
│   ├── requirements.txt
│   └── mira.db          # SQLite DB (auto-created, gitignored)
├── frontend/
│   ├── index.html       # Single-page app
│   └── static/
│       ├── css/style.css
│       └── js/app.js
├── start.sh             # One-command startup
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start



### Setup & Run

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/mira-health.git
cd mira-health

# 2. Set your API key (never hardcode this)
export OPENAI_API_KEY=sk-ant-...

# 3. Start MIRA
chmod +x start.sh
./start.sh
```

Then open **http://localhost:5000** in your browser.

### Manual Setup (without start.sh)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | List all patients (optional `?search=`) |
| GET | `/api/patients/:id` | Get single patient |
| POST | `/api/patients` | Create patient + trigger AI prediction |
| PUT | `/api/patients/:id` | Update patient (re-runs AI if blood values changed) |
| DELETE | `/api/patients/:id` | Delete patient |
| GET | `/api/stats` | Dashboard aggregate stats |

---

## 🤖 AI Integration



1. **Risk Level** (Low / Moderate / High)
2. **Key Findings** (notable blood value deviations)
3. **Possible Health Concerns** (conditions suggested by the values)
4. **Recommendation** (one-sentence clinical guidance)

> ⚠️ MIRA is a learning/demo project. AI outputs are NOT a substitute for professional medical advice.

---

## 🧪 Sample Test Values

| Scenario | Glucose | Haemoglobin | Cholesterol |
|----------|---------|-------------|-------------|
| Healthy | 88 | 14.5 | 175 |
| Pre-diabetic | 115 | 13.2 | 210 |
| High Risk | 220 | 9.8 | 290 |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3, Flask, Flask-CORS |
| Database | SQLite (via Python `sqlite3`) |
| AI/ML | Anthropic Claude API (claude-sonnet-4-20250514) |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Fonts | Syne, DM Sans, Space Mono (Google Fonts) |

### Why this stack?
- **Flask** — lightweight, perfect for REST APIs, minimal boilerplate
- **SQLite** — zero-config persistent storage, ideal for demo/prototype scale
- **OPEN AI** — state-of-the-art LLM with excellent clinical reasoning; the structured prompt returns consistent, parseable output
- **Vanilla JS** — no build toolchain needed; keeps the project accessible and fast to run

---

## 📋 CRUD Walkthrough

1. **Create** — Navigate to *New Patient*, fill in details, click *Generate AI Assessment & Save*
2. **Read** — Dashboard shows recent records; Patients view lists all; click any card for details modal
3. **Update** — Click ✏️ on any patient card or in the detail modal; blood value changes re-trigger the AI
4. **Delete** — Click 🗑 and confirm; record is permanently removed

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| 'OPENAI_API_KEY` | *(none)* | **Required** for AI predictions |
| `FLASK_DEBUG` | `True` | Set `False` for production |

> **Security**: Never commit your API key. Use environment variables or a `.env` file (which is gitignored).

---

## 📄 License

MIT — free to use, modify, and distribute for educational purposes.
