# HealSmartAI — System Architecture & Data Flow

This document describes the actual implemented architecture of **HealSmartAI** across the React + Vite frontend (`E:\HealSmartAI\frontend`), the Node.js + Express backend (`E:\HealSmartAI\backend`), Firebase Authentication, the SQLite database (`better-sqlite3`), and the Smart Symptom Engine v2.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
  subgraph Client["Frontend — React 18 + Vite 6 (localhost:5173)"]
    UI["Pages & Glassmorphism UI\n(HomePage, SymptomCheckerPage, PatientsPage,\nPatientDetailPage, DashboardPage)"]
    AuthCtx["AuthContext.jsx\n(Firebase onAuthStateChanged + /api/auth/me sync)"]
    AxiosClient["Axios API Client (src/api/client.js)\nAttaches Authorization: Bearer <idToken>"]
  end

  subgraph FirebaseCloud["Google Firebase Authentication"]
    FBClient["Firebase Web SDK (firebase/auth)\nEmail/Password Sign-In, Sign-Up, Password Reset"]
    FBAdmin["Firebase Admin SDK (firebase-admin/auth)\ngetAuth().verifyIdToken()"]
  end

  subgraph Server["Backend — Node.js + Express 5 (127.0.0.1:5000)"]
    SecMW["Security Middleware\nHelmet, CORS, Express Rate Limit, 10kb JSON limit"]
    AuthMW["Auth & RBAC Middleware (src/middleware/auth.js)\nrequireAuth, requireRole, canAccessPatient"]
    Routes["REST API Routers\n/api/health, /api/auth, /api/patients,\n/api/symptoms, /api/notes, /api/dashboard"]
    SymEngine["Smart Deterministic Symptom Engine v2\n(src/services/symptomEngine.js — 100% Free Default)"]
    OpenAISvc["Optional OpenAI Educational Adapter\n(src/services/openaiService.js — Disabled by Default)"]
  end

  subgraph Storage["Persistence Layer — SQLite (better-sqlite3 WAL Mode)"]
    SQLiteDB[("healsmart.db\nusers | patients | symptom_checks |\ndoctor_notes | doctor_patient_assignments")]
  end

  UI --> AuthCtx
  AuthCtx <--> FBClient
  UI --> AxiosClient
  AxiosClient -->|"HTTPS / Vite Proxy /api"| SecMW
  SecMW --> AuthMW
  AuthMW <-->|"RS256 Token Verification"| FBAdmin
  AuthMW <-->|"Upsert User & Read SQLite Role"| SQLiteDB
  AuthMW --> Routes
  Routes -->|"Query / Transaction"| SQLiteDB
  Routes -->|"Deterministic Analysis (Always Runs First)"| SymEngine
  Routes -.->|"Only if OPENAI_ENABLED=true\n(PII Stripped + Timeout)"| OpenAISvc
```

---

## 2. Layered Architecture Breakdown

### 2.1 Frontend Layer (`E:\HealSmartAI\frontend\src`)
- **Entry & Routing (`main.jsx`, `App.jsx`):** Uses React Router v6 (`BrowserRouter` with `v7_startTransition` and `v7_relativeSplatPath` flags). Routes are wrapped in `<ProtectedRoute>` (requires authenticated user; `/dashboard` additionally requires `allowedRoles={['doctor']}`) or `<PublicOnlyRoute>` (`/login`, `/signup`, `/forgot-password`).
- **Authentication State (`context/AuthContext.jsx`):** Subscribes to Firebase `onAuthStateChanged`. Whenever a Firebase user session becomes active, `AuthContext` calls `GET /api/auth/me` to retrieve the user's authoritative SQLite profile (`id`, `firebase_uid`, `email`, `display_name`, `role`, `local_dev_mode`).
- **Centralized API Client (`api/client.js`):** Configured with `baseURL: import.meta.env.VITE_API_BASE_URL || '/api'`. A request interceptor calls `auth.currentUser.getIdToken()` and injects `Authorization: Bearer <token>`. A response interceptor unwraps `response.data` and normalizes backend error payloads into `{ status, message, details }`.

### 2.2 Backend Middleware Pipeline (`E:\HealSmartAI\backend\src`)
Every incoming request passes through the following pipeline in `backend/src/index.js`:
1. **`helmet()`:** Sets HTTP security headers.
2. **`cors()`:** Restricts cross-origin requests to `FRONTEND_URL` (supports comma-separated origins) and `http://localhost:4173`, allowing `Authorization` and `Content-Type` headers.
3. **`express-rate-limit` (`/api`):** Protects endpoints against brute-force or runaway loops (`RATE_LIMIT_MAX=2000` per 15 minutes in development; `200` in production).
4. **Body Parsers:** `express.json({ limit: '10kb' })` and `express.urlencoded({ extended: true, limit: '10kb' })` to prevent payload DoS attacks.
5. **Authentication & RBAC (`middleware/auth.js`):**
   - `requireAuth`: Extracts the Bearer token, verifies it via `verifyFirebaseToken()` in `config/firebaseAdmin.js` (`getAuth().verifyIdToken()`), and upserts the user record in SQLite `users`. New users always receive `role = 'patient'`. Attaches `req.user`.
   - `requireRole(...allowedRoles)`: Verifies `req.user.role` against allowed roles, returning `403 Forbidden` if unauthorized.
   - `canAccessPatient(db, user, patient)`: Returns `true` if `user.role === 'patient'` and `patient.owner_user_id === user.id`, OR if `user.role === 'doctor'` and either `patient.owner_user_id === user.id` or an assignment row exists in `doctor_patient_assignments`.
6. **Joi Request Validation (`middleware/validate.js`):** Validates and strips unknown fields on `req.body` or `req.query` (`stripUnknown: true`, `abortEarly: false`), returning structured `400 Bad Request` errors with field-level details.
7. **Centralized Error Handling (`middleware/errorHandler.js`):** Catches synchronous and asynchronous errors, maps SQLite constraint errors to `409 Conflict`, and suppresses stack traces when `NODE_ENV === 'production'`.

---

## 3. Core Data Flows

### 3.1 Authentication, Account Provisioning & RBAC Flow

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant SPA as React SPA (AuthContext)
  participant FB as Firebase Auth
  participant API as Express API (requireAuth)
  participant Admin as Firebase Admin SDK
  participant DB as SQLite (users table)

  User->>SPA: Sign Up / Sign In (Email + Password)
  SPA->>FB: signInWithEmailAndPassword / createUserWithEmailAndPassword
  FB-->>SPA: Firebase User + Signed RS256 ID Token
  SPA->>API: GET /api/auth/me (Authorization: Bearer <idToken>)
  API->>Admin: getAuth().verifyIdToken(idToken, checkRevoked)
  Admin-->>API: Decoded Claims (uid, email, name)
  API->>DB: SELECT * FROM users WHERE firebase_uid = ?
  alt First time user
    API->>DB: INSERT INTO users (firebase_uid, email, display_name, role='patient')
  else Existing user
    API->>DB: UPDATE users SET email=?, updated_at=datetime('now')
  end
  DB-->>API: Authoritative User Row (id, role, email, display_name)
  API-->>SPA: 200 OK { data: { id, role, email, local_dev_mode } }
```

### 3.2 Smart Symptom Assistant Evaluation Flow

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as SymptomCheckerPage.jsx
  participant API as POST /api/symptoms/check
  participant Engine as symptomEngine.js (Free Local v2)
  participant OpenAI as openaiService.js (Optional)
  participant DB as SQLite (symptom_checks)

  User->>UI: Enter symptoms, duration, severity, context_notes
  UI->>API: POST /api/symptoms/check (Bearer Token + Payload)
  API->>API: Verify Auth, Joi Schema & Patient Ownership/Assignment
  API->>Engine: evaluateSymptoms({ symptoms, duration, severity, context_notes })
  Note over Engine: 1. Normalize synonyms (12 groups)<br/>2. Screen EMERGENCY_RED_FLAGS<br/>3. Match 10 categories & 5 combinations<br/>4. Build context explanations & follow-ups
  Engine-->>API: Deterministic Result (localResult)
  alt OPENAI_ENABLED === true && API Key configured
    API->>OpenAI: generateOptionalOpenAiGuidance(sanitizedInput, localResult)
    Note over OpenAI: Strips all PII (names, emails, phones, IDs).<br/>Enforces AbortController timeout.<br/>Preserves localResult.emergency_safety!
    OpenAI-->>API: Enhanced Result or Fallback to localResult
  else OPENAI_ENABLED === false (Default Free Mode)
    Note over API: Uses localResult directly (Zero external calls)
  end
  API->>DB: INSERT INTO symptom_checks (...)
  API-->>UI: 201 Created { engine_used, matched_combinations, follow_up_questions, emergency_safety, ... }
```

### 3.3 Patient-Controlled Doctor Assignment & Immediate Revocation Flow

1. **Profile Creation (`PUT /api/patients/me`):** A signed-in patient creates their 1-to-1 health profile (`owner_user_id = req.user.id`).
2. **Doctor Discovery (`GET /api/auth/doctors`):** The patient opens their profile (`PatientDetailPage.jsx`), which fetches all verified users with `role = 'doctor'`.
3. **Granting Access (`POST /api/patients/:id/assign-doctor`):** The patient selects a doctor and clicks **Grant Access**. The backend verifies `patient.owner_user_id === req.user.id` and inserts `(doctor_user_id, patient_id)` into `doctor_patient_assignments`.
4. **Doctor Clinical Access:** The assigned doctor now sees the patient in `GET /api/patients`, `GET /api/dashboard/stats`, and `GET /api/dashboard/recent`, and can view/create clinical notes (`GET /api/notes`, `POST /api/notes`).
5. **Immediate Revocation (`DELETE /api/patients/:id/assign-doctor/:doctorUserId`):** When the patient clicks **Revoke Access**, the row in `doctor_patient_assignments` is deleted immediately. Any subsequent request by that doctor to view the patient, their symptom checks, or their notes immediately fails `canAccessPatient()` with `403 Forbidden`.
