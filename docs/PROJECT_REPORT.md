# HealSmartAI — Comprehensive Project Report

**Project Title:** HealSmartAI — Full-Stack Healthcare Education & Role-Scoped Patient Workflow Platform  
**Repository:** `https://github.com/Jai-Udasi/HealSmart-AI.git`  
**Stack:** React 18, Vite 6, Node.js, Express 5, SQLite (`better-sqlite3`), Firebase Authentication & Firebase Admin SDK, Smart Deterministic Symptom Engine v2  

---

## 1. Introduction

**HealSmartAI** is a full-stack healthcare information and patient workflow web application engineered to bridge the gap between structured personal health record management, educational symptom exploration, and patient-controlled clinician collaboration.

Modern web applications that handle sensitive health-related workflows must enforce strict authentication, fine-grained role-based access control (RBAC), deterministic emergency safety guardrails, and clear medical non-diagnostic boundaries. HealSmartAI demonstrates these software engineering principles in a 100% free-to-run architecture powered by **React + Vite** on the frontend, **Express + SQLite** on the backend, **Firebase Authentication** for cryptographic identity verification, and a **Smart Deterministic Symptom Engine v2** (`backend/src/services/symptomEngine.js`) with an optional, privacy-scrubbed OpenAI educational adapter (`OPENAI_ENABLED=false` by default).

---

## 2. Problem Statement

Individuals seeking general health education online or managing personal health records often encounter three major limitations in typical student or prototype healthcare portals:
1. **Unstructured or Opaque Symptom Guidance:** Simple keyword scripts fail to normalize everyday phrasing (e.g., *"throwing up"*, *"high temp"*, *"winded"*) and fail to consider multi-symptom patterns, symptom duration, or severity, while pure LLM wrappers require paid API credits, introduce latency, and risk hallucinating diagnostic claims or missing emergency red flags.
2. **Weak Authorization & Data Isolation:** Many demonstration health portals rely on client-side role flags or shared tables where any logged-in user can query or overwrite another user's health profile or clinical notes.
3. **Lack of Patient-Controlled Care Sharing:** Patients need a straightforward way to maintain a single, canonical health profile (`1-to-1` account ownership) and explicitly grant—or immediately revoke—access to specific doctors.

---

## 3. Objectives

1. **Cryptographic Authentication & Server-Enforced RBAC:** Verify every protected API request using the official **Firebase Admin SDK** (`firebase-admin/auth` `verifyIdToken()`) and enforce server-side `patient` vs. `doctor` roles stored in SQLite (`users.role`).
2. **1-to-1 Patient Health Profile & Explicit Doctor Consent:** Allow each authenticated user to maintain their own health profile (`GET /api/patients/me`, `PUT /api/patients/me`) and explicitly assign (`POST /api/patients/:id/assign-doctor`) or revoke (`DELETE /api/patients/:id/assign-doctor/:doctorUserId`) doctor access.
3. **100% Free Smart Deterministic Symptom Engine v2:** Build a zero-cost, local symptom analysis engine supporting:
   - Synonym and phrase normalization across 12 clinical synonym groups.
   - 10 structured clinical symptom categories with educational overviews, self-care guidance, and care-seeking triggers.
   - 5 multi-symptom combination rules (e.g., *Respiratory + Fever Pattern*, *GI Hydration Watch Pattern*, *Headache + Fever / Neck Stiffness Watch*).
   - Severity (`mild`, `moderate`, `severe`) and duration context synthesis.
   - Targeted clarifying follow-up questions for a clinician visit.
   - Deterministic emergency red-flag screening that always runs first.
4. **Optional Privacy-Preserving OpenAI Educational Adapter:** Provide a clean backend integration (`backend/src/services/openaiService.js`) disabled by default (`OPENAI_ENABLED=false`) that strips all personal identifiers (PII), enforces an `AbortController` timeout, validates untrusted JSON output, never overrides deterministic emergency warnings, and falls back automatically to the free local engine.
5. **Doctor Clinical Workspace & Notes:** Provide verified doctors with a live SQLite dashboard (`GET /api/dashboard/stats`, `GET /api/dashboard/recent`) and clinical note authoring (`POST /api/notes`) scoped strictly to patients currently assigned to them.

---

## 4. Existing System vs. Proposed System

| Dimension | Typical Prototype / Existing System | HealSmartAI (Proposed & Implemented System) |
|---|---|---|
| **Authentication** | Unsigned local storage flags or custom JWT workarounds | Official Firebase Auth Web SDK + Firebase Admin SDK `getAuth().verifyIdToken()` |
| **Role Management** | User-selectable role dropdown at signup (vulnerable to privilege escalation) | All public signups default to `patient`; role elevation is server-controlled in SQLite |
| **Patient Data Access** | Global patient list visible to all logged-in accounts | Strict ownership (`owner_user_id`) for patients and active assignment (`doctor_patient_assignments`) for doctors |
| **Doctor Access Control** | Permanent or hardcoded visibility | Patient-initiated assignment and immediate single-click revocation |
| **Symptom Analysis** | Single-keyword matching or paid-only external API | Free Smart Deterministic Engine v2 (synonyms, multi-symptom combinations, duration/severity context, follow-ups, red flags) + optional PII-scrubbed OpenAI adapter (`OPENAI_ENABLED=false`) |
| **Medical Safety** | Diagnostic labels or fake confidence percentages | Strictly informational, non-diagnostic language with prominent emergency banners and zero probability scores |

---

## 5. Technology Stack

### Frontend (`E:\HealSmartAI\frontend`)
- **Framework & Bundler:** React `^18.3.1`, Vite `^6.0.5`
- **Routing:** React Router DOM `^6.28.0` (configured with v7 future flags `v7_startTransition` and `v7_relativeSplatPath`)
- **Authentication Client:** Firebase Web SDK `^13.1.0` (`firebase/auth`)
- **HTTP Client:** Axios `^1.7.9` with automatic `Authorization: Bearer <idToken>` request interceptor and configurable `VITE_API_BASE_URL`
- **UI & Icons:** Custom Light Glassmorphism CSS Design System (`src/styles/global.css`), Lucide React `^0.468.0`

### Backend (`E:\HealSmartAI\backend`)
- **Runtime & Web Framework:** Node.js (`>=18`), Express `^5.3.0`
- **Database:** SQLite via `better-sqlite3@^13.0.3` (WAL journal mode, foreign key enforcement, synchronous transactions, idempotent schema migrations)
- **Authentication Verification:** Official Firebase Admin SDK `firebase-admin@^14.5.0` (`firebase-admin/app`, `firebase-admin/auth`)
- **Validation & Security Middleware:** Joi `^18.3.0`, Helmet `^8.3.0`, CORS `^2.8.6`, Express Rate Limit `^8.7.1`
- **Testing:** Node.js built-in test runner (`node --test`), Supertest `^7.1.0`, Playwright Chromium end-to-end verification

---

## 6. System Implementation & Core Modules

### 6.1 Authentication & Account Provisioning Module
- **Files:** `frontend/src/context/AuthContext.jsx`, `backend/src/config/firebaseAdmin.js`, `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`
- **Workflow:** Users register or sign in through Firebase Email/Password authentication (`LoginPage.jsx`, `SignupPage.jsx`, `ForgotPasswordPage.jsx`). On every API call, Axios attaches the Firebase ID token. `requireAuth` verifies the token via `getAuth().verifyIdToken()` and synchronizes the user into the SQLite `users` table with default `role = 'patient'`.
- **Controlled Local-Dev Doctor Approval:** Because public signup cannot self-assign the `doctor` role, local development (`NODE_ENV !== 'production'`) provides `POST /api/auth/dev-approve-doctor` (protected by `LOCAL_DOCTOR_APPROVAL_CODE` and localhost IP checks) and the CLI script `npm run approve-doctor -- <email>`. Both are disabled in production.

### 6.2 Patient Health Profile & Consent Management Module
- **Files:** `backend/src/routes/patients.js`, `frontend/src/pages/PatientsPage.jsx`, `frontend/src/pages/PatientDetailPage.jsx`
- **Workflow:** Each user can create and update a single 1-to-1 health profile (`GET /api/patients/me`, `PUT /api/patients/me`). Attempting to create a duplicate profile via `POST /api/patients` returns `409 Conflict` (`PROFILE_ALREADY_EXISTS`). From the patient profile detail view, the owner can assign any verified doctor (`POST /api/patients/:id/assign-doctor`) or immediately revoke access (`DELETE /api/patients/:id/assign-doctor/:doctorUserId`).

### 6.3 Smart Deterministic Symptom Assistant & Optional OpenAI Module
- **Files:** `backend/src/services/symptomEngine.js`, `backend/src/services/openaiService.js`, `backend/src/routes/symptoms.js`, `frontend/src/pages/SymptomCheckerPage.jsx`
- **Workflow:**
  1. Accepts quick-select chips or comma/newline-separated symptom phrases, optional duration, severity (`mild` | `moderate` | `severe`), context notes (`<=500` chars), and optional patient linkage.
  2. Runs `evaluateSymptoms()` in `symptomEngine.js`: normalizes synonyms, screens against `EMERGENCY_RED_FLAGS`, matches across 10 clinical categories and 5 multi-symptom combination rules, synthesizes severity/duration context notes, and compiles clarifying follow-up questions.
  3. If `OPENAI_ENABLED=true` and `OPENAI_API_KEY` is configured, passes only sanitized, non-PII symptom strings to `generateOptionalOpenAiGuidance()`, preserving deterministic `emergency_safety` unconditionally.
  4. Persists the check to `symptom_checks` in SQLite when linked to a patient record or automatically to the signed-in user's own patient profile.

### 6.4 Doctor Clinical Dashboard & Notes Module
- **Files:** `backend/src/routes/dashboard.js`, `backend/src/routes/notes.js`, `frontend/src/pages/DashboardPage.jsx`, `frontend/src/pages/PatientDetailPage.jsx`
- **Workflow:** Verified doctors access `/dashboard` to view real-time SQLite KPIs (`total_patients`, `total_symptom_checks`, `emergency_flags_count`, `checks_last_24h`, and top categories) computed strictly across their currently assigned patients. Doctors can open an assigned patient's record to review their symptom history and author structured clinical notes (`general`, `follow_up`, `observation`). Once a patient revokes a doctor's assignment, the patient immediately disappears from the doctor's dashboard and all patient/note/history endpoints return `403 Forbidden`.

---

## 7. System Limitations

1. **Educational & Non-Diagnostic Scope:** HealSmartAI is an informational software engineering project. It does not diagnose medical conditions, prescribe treatments, or compute diagnostic probability scores.
2. **Keyword Emergency Screening Boundary:** Emergency red-flag detection relies on deterministic phrase matching and severity rules; it cannot replace professional clinical triage or emergency medical services (`911` / local emergency responders).
3. **Not HIPAA / Production PHI Certified:** While strict authentication, parameterized SQL queries, and PII scrubbing are implemented, the application is intended for demonstration with fictional health data rather than regulated clinical production use.
4. **Local SQLite File Storage Constraint for Serverless:** The default `better-sqlite3` file database (`backend/data/healsmart.db`) is ideal for local development and persistent-disk servers, but requires migrating to a managed cloud database (such as Turso/libSQL or Neon PostgreSQL) if deploying the Express backend to stateless serverless platforms like Vercel Functions.

---

## 8. Conclusion & Future Scope

### Conclusion
HealSmartAI delivers a complete, verified full-stack healthcare information and patient workflow platform. Across Phases 1 through 4C, the system has been hardened with official Firebase Admin token verification, SQLite-backed RBAC, 1-to-1 patient health profile management, immediate doctor access revocation, a 100% free Smart Deterministic Symptom Engine v2, and an optional PII-safe OpenAI educational adapter. All unit, API security, RBAC isolation, and Playwright Chromium browser tests pass with zero paid API dependencies.

### Future Scope
- **Serverless Database Adapter (Turso / libSQL or PostgreSQL):** Add a database driver abstraction so the backend can switch seamlessly between local `better-sqlite3` and cloud-hosted Turso (`@libsql/client`) for 100% serverless deployment on Vercel Functions.
- **Appointment Scheduling & Time-Bounded Access Grants:** Allow patients to grant temporary time-boxed access windows to doctors tied to scheduled consultations.
- **Exportable Health Summary PDF:** Allow patients to export their health profile, symptom check timeline, and doctor notes as a formatted PDF handout for in-person clinic visits.
- **Multilingual Educational Content:** Expand the deterministic symptom knowledge base and UI strings to support multiple languages for broader health literacy.
