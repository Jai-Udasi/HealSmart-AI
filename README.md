# HealSmartAI — Full-Stack Healthcare Information & Patient Workflow Portal

> **Important Disclaimers & Scope Notice**
> - **100% Free Smart Local Symptom Engine (Default) + Optional OpenAI Adapter (Disabled by Default):** Symptom evaluations are powered out-of-the-box by a **free, local, deterministic Smart Symptom Engine** (`backend/src/services/symptomEngine.js`) that performs synonym normalization, multi-symptom combination analysis, context-aware explanations, follow-up question generation, and conservative emergency red-flag screening. An optional backend OpenAI adapter (`backend/src/services/openaiService.js`) is included and **disabled by default (`OPENAI_ENABLED=false`)** so the project requires zero paid API credits or subscriptions to run.
> - **Firebase Authentication & SQLite RBAC:** User identity is verified via the official **Firebase Authentication** Web SDK and **Firebase Admin SDK** (`firebase-admin/auth` `verifyIdToken()`), while application data and role-based access control (`patient` vs. `doctor` roles, 1-to-1 profile ownership, and explicit doctor-patient assignments/revocations) are persisted locally in **SQLite** (`better-sqlite3`).
> - **Non-Diagnostic & Educational Scope:** This application is strictly for software engineering demonstration and general health education. It does **not** diagnose diseases, never calculates diagnosis probabilities or confidence percentages, cannot reliably rule out medical emergencies via keyword screening, and is not a HIPAA-certified clinical system.

---

## 1. Project Overview

**HealSmartAI** is a full-stack healthcare information and role-scoped patient workflow web application built with **React + Vite**, **Node.js + Express**, **Firebase Authentication**, and **SQLite**.

It demonstrates:
- Official Firebase ID token verification middleware (`getAuth().verifyIdToken()`).
- Strict patient/doctor role-based authorization (RBAC) with 1-to-1 patient health profiles and immediate doctor assignment/revocation controls.
- A **Free Smart Symptom Assistant** supporting synonym normalization, multi-symptom pattern combinations, severity/duration context synthesis, clarifying follow-up questions, and deterministic emergency red-flag detection.
- An **Optional OpenAI Educational Adapter** (`OPENAI_ENABLED=false` by default) that strips all personal identifiers, enforces strict request timeouts, never overrides deterministic emergency warnings, and falls back seamlessly to the free local engine.

---

## 2. Technology Stack

| Layer | Technology | Version / Details |
|---|---|---|
| **Frontend Framework** | React + Vite | React `^18.3.1`, Vite `^6.0.5` |
| **Authentication** | Firebase Auth + Official Admin SDK | `firebase@^13.1.0` (Frontend), `firebase-admin@^14.5.0` (Backend `firebase-admin/auth`) |
| **Routing & Icons** | React Router DOM + Lucide React | `react-router-dom@^6.28.0`, `lucide-react@^0.468.0` |
| **HTTP Client** | Axios | `axios@^1.7.9` (attaches `Authorization: Bearer <idToken>` automatically) |
| **Styling** | Custom CSS Design System | Light theme, glassmorphism (`backdrop-filter: blur`), CSS custom properties, responsive mobile drawer |
| **Backend Runtime & Framework** | Node.js + Express | Node.js `>=18`, Express `^5.3.0` |
| **Database** | SQLite (`better-sqlite3`) | `better-sqlite3@^13.0.3` with WAL mode, foreign keys, and non-destructive migrations |
| **Validation & Security** | Joi, Helmet, CORS, Rate Limit | `joi@^18.3.0`, `helmet@^8.3.0`, `cors@^2.8.6`, `express-rate-limit@^8.7.1` |

---

## 3. Free Deterministic Smart Engine vs. Optional OpenAI Integration

| Aspect | Free Smart Local Engine (`local_rule_engine`) | Optional OpenAI Adapter (`openai`) |
|---|---|---|
| **Default Status** | **Enabled by default** (`OPENAI_ENABLED=false`) | **Disabled by default** (`OPENAI_ENABLED=false`) |
| **Cost / Billing** | **100% Free** — runs entirely locally in Node.js with zero external API calls | **Separate Paid API Billing** — OpenAI API usage is billed separately by OpenAI (distinct from ChatGPT Plus) and may incur charges if enabled with a live key |
| **Capabilities** | Synonym & variation normalization, 10 structured clinical categories, 5 multi-symptom combination rules, duration/severity context explanations, clarifying follow-up questions, self-care tips, and red-flag warnings | Supplements `context_explanations`, `follow_up_questions`, `self_care_tips`, and `when_to_seek_medical_advice` using bounded JSON output |
| **Emergency Red-Flag Screening** | **Always runs deterministically first** before any optional AI logic | **Never overrides or suppresses** local emergency warnings; local `emergency_safety` is always preserved |
| **Privacy & PII Protection** | Stays 100% on `127.0.0.1` in local SQLite | Strips all names, emails, phone numbers, Firebase UIDs, and `patient_id` values before any request; redacts email/phone patterns from free text |
| **Fallback Behavior** | Always available | Automatically falls back to the Free Smart Local Engine if disabled, unconfigured, rate-limited, or timed out (`OPENAI_TIMEOUT_MS=8000`) |

> **Verification Note:** During development and automated testing of HealSmartAI, `OPENAI_ENABLED` remained `false` with no OpenAI API key required, and **zero paid OpenAI API requests were made**. Optional OpenAI adapter behavior was verified exclusively via local mock injection.

---

## 4. Architecture & Folder Structure

```text
E:\HealSmartAI\
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── firebaseAdmin.js    # Official Firebase Admin SDK (firebase-admin/auth) verifyIdToken()
│   │   ├── db/
│   │   │   └── database.js         # SQLite connection, WAL pragma, non-destructive migrations
│   │   ├── middleware/
│   │   │   ├── auth.js             # requireAuth, requireRole, and canAccessPatient RBAC helpers
│   │   │   ├── asyncHandler.js     # Async route wrapper
│   │   │   ├── errorHandler.js     # Centralized JSON error handler
│   │   │   └── validate.js         # Reusable Joi validation middleware
│   │   ├── routes/
│   │   │   ├── health.js           # GET /api/health (Public)
│   │   │   ├── auth.js             # GET /api/auth/me, PUT /api/auth/profile, POST /api/auth/dev-approve-doctor
│   │   │   ├── patients.js         # 1-to-1 profile (/me), CRUD, assign-doctor, and revoke-doctor
│   │   │   ├── symptoms.js         # Smart symptom evaluation, engine-status, & scoped history
│   │   │   ├── dashboard.js        # Doctor-only assigned-patient stats & recent checks feed
│   │   │   └── notes.js            # Assigned-patient clinical notes list & doctor-only creation
│   │   ├── scripts/
│   │   │   └── approveDoctor.js    # Local-dev CLI script to promote a user email to 'doctor'
│   │   ├── services/
│   │   │   ├── symptomEngine.js    # Free Smart Deterministic Symptom & Combination Engine (v2)
│   │   │   └── openaiService.js    # Optional OpenAI adapter (disabled by default, PII-scrubbed)
│   │   └── index.js                # Express app setup, security middleware, 127.0.0.1 server
│   ├── .env.example                # Safe placeholder environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js           # Axios client with Firebase Bearer token interceptor
│   │   ├── components/
│   │   │   ├── Layout.jsx          # Role-aware sidebar, local-dev doctor modal, sign-out button
│   │   │   ├── ProtectedRoute.jsx  # ProtectedRoute & PublicOnlyRoute wrappers
│   │   │   └── UI.jsx              # GlassCard, Button, FormField, NoticeBanner, Loading/Error
│   │   ├── config/
│   │   │   └── firebase.js         # Environment-based Firebase Web SDK initialization
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Firebase Auth state + SQLite role synchronization
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignupPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── AccessDeniedPage.jsx
│   │   │   ├── HomePage.jsx
│   │   │   ├── SymptomCheckerPage.jsx
│   │   │   ├── PatientsPage.jsx
│   │   │   ├── PatientDetailPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── styles/
│   │   │   └── global.css          # Light glassmorphism design tokens & responsive rules
│   │   ├── App.jsx                 # React Router v6 public & protected route definitions
│   │   └── main.jsx                # React DOM entry
│   ├── .env.example                # Safe placeholder VITE_FIREBASE_* variables
│   ├── index.html
│   ├── vite.config.js              # Vite dev/preview server & /api proxy to :5000
│   └── package.json
├── .gitignore
└── README.md
```

---

## 5. Environment Variables & Setup

### Backend (`E:\HealSmartAI\backend\.env`)

Copy `backend/.env.example` to `backend/.env`:

```ini
HOST=127.0.0.1
PORT=5000
NODE_ENV=development
DB_PATH=./data/healsmart.db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
FRONTEND_URL=http://localhost:5173

# Firebase Admin SDK Configuration (Required for Token Verification)
FIREBASE_PROJECT_ID=your-firebase-project-id
# Optional path to local Firebase service account JSON file
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

# Controlled local-development-only approval code for promoting a test user to 'doctor' role
LOCAL_DOCTOR_APPROVAL_CODE=HEALSMART-LOCAL-DEV-DOCTOR

# Optional OpenAI Integration (DISABLED BY DEFAULT — Free Smart Local Engine is used when false)
# IMPORTANT: OpenAI API billing is separate from ChatGPT subscriptions and enabling it with a real key may incur charges.
OPENAI_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=8000
```

### Frontend (`E:\HealSmartAI\frontend\.env.local`)

Copy `frontend/.env.example` to `frontend/.env.local` and provide your Firebase Web App configuration:

```ini
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

---

## 6. Running Locally (Windows PowerShell)

### Terminal 1 — Start the Express + SQLite Backend (`127.0.0.1:5000`)

```powershell
Set-Location E:\HealSmartAI\backend
npm run dev
```

### Terminal 2 — Start the React + Vite Frontend (`localhost:5173`)

```powershell
Set-Location E:\HealSmartAI\frontend
npm run dev
```

### Controlled Local-Dev Doctor Role Approval

Public signup always provisions accounts with `role = 'patient'`. In local development (`NODE_ENV !== 'production'`), you can promote a registered user to `doctor` either:
1. Via the **Doctor Approval (Local Dev)** button in the sidebar using `LOCAL_DOCTOR_APPROVAL_CODE` (`HEALSMART-LOCAL-DEV-DOCTOR`), or
2. Via the backend CLI script:
   ```powershell
   Set-Location E:\HealSmartAI\backend
   npm run approve-doctor -- doctor@example.com
   ```

---

## 7. API Endpoints Overview

All endpoints except `GET /api/health` require `Authorization: Bearer <Firebase_ID_Token>`.

| Method | Endpoint | Auth / Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | API uptime, environment, SQLite version, and query latency. |
| `GET` | `/api/auth/me` | Authenticated | Current user's SQLite profile, verified `role`, and `local_dev_mode` flag. |
| `PUT` | `/api/auth/profile` | Authenticated | Update `display_name` in SQLite (blocks `role` spoofing with `400`). |
| `POST` | `/api/auth/dev-approve-doctor` | Local-Dev Only | Controlled localhost role promotion requiring `LOCAL_DOCTOR_APPROVAL_CODE`. |
| `GET` | `/api/auth/doctors` | Authenticated | Lists verified `doctor` accounts for patient assignment/revocation. |
| `GET` | `/api/patients/me` | Authenticated | Retrieve the signed-in user's 1-to-1 health profile (`null` if not created yet). |
| `PUT` | `/api/patients/me` | Authenticated | Create or update the signed-in user's 1-to-1 health profile. |
| `GET` | `/api/patients` | Authenticated | Owned profile (patient) or assigned patients list (doctor). |
| `POST` | `/api/patients` | Authenticated | Create a 1-to-1 patient profile (`409` if duplicate for same owner). |
| `GET/PUT/DELETE` | `/api/patients/:id` | Owner / Assigned Doctor | Scoped access to a patient record (`DELETE` is owner-only). |
| `POST` | `/api/patients/:id/assign-doctor` | Owner Only | Grant a doctor access to this patient record. |
| `DELETE` | `/api/patients/:id/assign-doctor/:doctorUserId` | Owner Only | Immediately revoke a doctor's access to this patient record. |
| `GET` | `/api/symptoms/engine-status` | Authenticated | Reports active symptom engine (`local_rule_engine` vs `openai`). |
| `POST` | `/api/symptoms/check` | Authenticated | Evaluate symptoms, combinations, follow-ups, and red flags; persist to SQLite. |
| `GET` | `/api/symptoms/history` | Authenticated | Paginated symptom-check history scoped to owner or assigned doctor. |
| `GET/POST` | `/api/notes` | Owner / Assigned Doctor | View clinical notes (owner or assigned doctor) or create note (assigned doctor only). |
| `GET` | `/api/dashboard/stats` | `doctor` Role Only | Live SQLite aggregate KPIs scoped strictly to currently assigned patients. |
| `GET` | `/api/dashboard/recent` | `doctor` Role Only | Paginated recent symptom checks for currently assigned patients. |

---

## 8. Medical & Privacy Disclaimers

- **Not Medical Advice:** Nothing in HealSmartAI constitutes medical advice, clinical diagnosis, prognosis, or emergency triage. Always seek the advice of a physician or qualified healthcare provider with any questions regarding a medical condition.
- **Emergency Screening Limitation:** Keyword screening cannot reliably rule out medical emergencies. If you think you may be experiencing a medical emergency, call your local emergency number (e.g., 911) immediately.
- **Not HIPAA-Certified:** This software is an educational demonstration project and is not certified for storing real protected health information (PHI) in production clinical environments.
