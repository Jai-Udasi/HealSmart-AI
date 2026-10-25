# HealSmartAI — Technical Interview Preparation Guide

This document prepares you to present **HealSmartAI** clearly and confidently during technical interviews, viva evaluations, and internship reviews.

---

## 1. 2–3 Minute Live Demonstration Script

### Opening Pitch (30 seconds)
> *"HealSmartAI is a full-stack healthcare education and patient workflow web application I built with React, Vite, Node.js, Express, SQLite, and Firebase Authentication. I designed it around three core engineering goals: first, cryptographic authentication with strict server-enforced patient/doctor role-based access control; second, patient-controlled health profile sharing with immediate access revocation; and third, a 100% free Smart Deterministic Symptom Engine that normalizes everyday symptom phrasing, detects multi-symptom combinations, and screens for emergency red flags—with an optional, PII-scrubbed OpenAI adapter that stays disabled by default so the system has zero paid API dependency."*

### Step 1 — Authentication & 1-to-1 Patient Health Profile (45 seconds)
1. Show `/login` and sign in as a **Patient** account.
2. Open **My Health Profile** (`/patients`) and highlight that each patient account owns a single 1-to-1 health profile (`GET /api/patients/me` and `PUT /api/patients/me`), preventing duplicate records (`409 Conflict`).
3. Click **Edit My Health Profile**, update a medical history item, and show the immediate state update backed by SQLite.

### Step 2 — Smart Deterministic Symptom Assistant (45 seconds)
1. Navigate to **Symptom Checker** (`/symptoms`). Point out the **`Free Smart Local Engine`** badge.
2. Enter everyday phrases: `"high temp"`, `"bad cough"`, `"sore throat"`, choose **Moderate** severity, **4 days** duration, and add a brief context note.
3. Click **Run Smart Symptom Check**.
4. Highlight:
   - **Synonym Normalization:** `"high temp"` mapped to `fever`, `"bad cough"` mapped to `cough`.
   - **Multi-Symptom Pattern Insights:** The engine detected the **Respiratory + Fever Pattern** combination rule rather than just isolated keywords.
   - **Duration/Severity Context & Clinician Follow-Up Questions:** Practical questions generated for a doctor visit, plus non-diagnostic disclaimers.

### Step 3 — Patient-Controlled Doctor Assignment, Clinical Notes & Immediate Revocation (45 seconds)
1. Open the patient's detail page (`/patients/:id`). In **Doctor Access & Care Team**, select a verified doctor and click **Grant Access**.
2. Switch to (or sign in as) the **Doctor** account:
   - Open **Dashboard** (`/dashboard`) to show live SQLite KPIs (`Assigned Patients`, `Total Symptom Checks`, `Emergency Red Flags`).
   - Open the assigned patient's profile, review their symptom check history, and submit a **Clinical Note** (`Follow-Up`).
3. Switch back to the **Patient** account, show the doctor's note in read-only mode, and click **Revoke Access**. Mention that the backend immediately deletes the row in `doctor_patient_assignments`, so any further doctor request returns `403 Forbidden`.

---

## 2. Technical Architecture Explanation (How It Works Under the Hood)

1. **Identity vs. Authorization Separation:**
   - **Firebase Authentication** handles cryptographic identity (Email/Password sign-in, RS256 signed JWTs).
   - **Official Firebase Admin SDK** (`firebase-admin/auth` `getAuth().verifyIdToken()`) verifies every Bearer token on the Express backend (`backend/src/config/firebaseAdmin.js`).
   - **SQLite (`better-sqlite3`)** is the single source of truth for authorization (`users.role`, `patients.owner_user_id`, and `doctor_patient_assignments`). Even if a user tampers with frontend state or sends `{ "role": "doctor" }` to `PUT /api/auth/profile`, Joi validation and server-side RBAC block it.
2. **Deterministic Symptom Engine First, Optional AI Second:**
   - `backend/src/services/symptomEngine.js` runs synchronously in Node.js with zero external latency or cost.
   - Emergency red-flag screening (`EMERGENCY_RED_FLAGS`) always executes deterministically first.
   - `backend/src/services/openaiService.js` is an optional adapter (`OPENAI_ENABLED=false` by default) that strips all PII (names, emails, phone numbers, IDs), enforces an 8-second `AbortController` timeout, validates JSON output, never overrides deterministic `emergency_safety`, and falls back automatically to the local engine on any error.

---

## 3. 20 Likely Technical Interview Questions & Answers

### Architecture & Security
1. **Q: How does authentication work between React and Express in HealSmartAI?**  
   **A:** React authenticates the user with the Firebase Web SDK (`firebase/auth`). An Axios request interceptor in `frontend/src/api/client.js` calls `auth.currentUser.getIdToken()` and attaches `Authorization: Bearer <idToken>` on every API request. On the backend, `requireAuth` calls `getAuth().verifyIdToken()` from the official `firebase-admin/auth` SDK to verify the RS256 signature, issuer, audience, and expiry before upserting the user in SQLite.

2. **Q: Why did you store user roles in SQLite instead of letting users pick their role on the signup form?**  
   **A:** Allowing a client-side signup form to pass `role: "doctor"` is a classic privilege escalation vulnerability. In HealSmartAI, all public signups are provisioned with `role = 'patient'` in SQLite (`backend/src/middleware/auth.js`), and `PUT /api/auth/profile` explicitly rejects `role` in its Joi schema (`400 Bad Request`).

3. **Q: How do you test doctor workflows locally if public signup only creates patients?**  
   **A:** I implemented two controlled local-development mechanisms (`NODE_ENV !== 'production'`): a localhost-only endpoint `POST /api/auth/dev-approve-doctor` guarded by `LOCAL_DOCTOR_APPROVAL_CODE` (`HEALSMART-LOCAL-DEV-DOCTOR`), and a CLI script `npm run approve-doctor -- <email>` (`backend/src/scripts/approveDoctor.js`). Both are strictly disabled in production.

4. **Q: How does your backend prevent Horizontal Privilege Escalation (IDOR) between patients?**  
   **A:** Every route accessing a patient record (`/api/patients/:id`, `/api/symptoms/history`, `/api/notes`) runs `canAccessPatient(db, req.user, patient)`. For a `patient` user, it checks `patient.owner_user_id === req.user.id`. If Patient B requests `/api/patients/1` belonging to Patient A, the server returns `403 Forbidden`.

5. **Q: How does doctor access assignment and revocation work in the database?**  
   **A:** It uses a junction table `doctor_patient_assignments (doctor_user_id, patient_id)` with `UNIQUE(doctor_user_id, patient_id)` and `ON DELETE CASCADE`. Granting access inserts a row; clicking **Revoke Access** executes `DELETE FROM doctor_patient_assignments WHERE doctor_user_id = ? AND patient_id = ?`. Because `canAccessPatient()` and all `/api/dashboard/*` queries join against this table live on every request, revocation takes effect instantaneously.

6. **Q: Why did you remove or avoid any custom JWT verification fallback in `firebaseAdmin.js`?**  
   **A:** Custom JWT parsing or manual x509 certificate caching is error-prone. Using the official `firebase-admin/auth` `getAuth().verifyIdToken()` guarantees Google's standard checks for `iss`, `aud`, `exp`, `sub`, RS256 cryptographic signature, and token revocation (`checkRevoked = true` when service account credentials are provided).

### Database & Backend Engineering
7. **Q: Why did you choose `better-sqlite3` and enable `WAL` mode?**  
   **A:** `better-sqlite3` provides fast, synchronous prepared statements and atomic transactions in Node.js without external database server overhead for local development. Enabling `PRAGMA journal_mode = WAL;` allows concurrent reads while a write is occurring, and `PRAGMA foreign_keys = ON;` enforces relational integrity across `users`, `patients`, `symptom_checks`, `doctor_notes`, and `doctor_patient_assignments`.

8. **Q: How do you prevent SQL injection across search and filter endpoints?**  
   **A:** Every SQLite query uses parameterized `?` placeholders via `db.prepare(...).get/all/run(...)`. User input is never interpolated into SQL strings.

9. **Q: How did you enforce a 1-to-1 relationship between a user account and their health profile?**  
   **A:** I added `GET /api/patients/me` and `PUT /api/patients/me` which look up `WHERE owner_user_id = req.user.id`, plus a guard in `POST /api/patients` that checks if a profile already exists for `req.user.id` and returns `409 Conflict` (`PROFILE_ALREADY_EXISTS`).

10. **Q: How are database schema changes managed as the project evolved from Phase 1 to Phase 4C?**  
    **A:** `backend/src/db/database.js` runs idempotent migrations on startup using `CREATE TABLE IF NOT EXISTS` and inspects `PRAGMA table_info(...)` before executing `ALTER TABLE ADD COLUMN` (for example, adding `owner_user_id`, `context_notes`, and `engine_used` without losing existing data).

11. **Q: How do you handle input validation and error responses in Express?**  
    **A:** A reusable `validate(schema, target)` middleware in `backend/src/middleware/validate.js` validates `req.body` or `req.query` with Joi (`abortEarly: false`, `stripUnknown: true`). Unhandled errors flow to `errorHandler.js`, which returns a uniform `{ success: false, error: { message, details } }` JSON payload and hides stack traces in production.

### Smart Symptom Assistant & Optional OpenAI Integration
12. **Q: How does the Free Smart Symptom Engine v2 improve upon basic keyword matching?**  
    **A:** Instead of exact single-word matching, `symptomEngine.js` implements a 4-stage pipeline:
    1) Normalizes everyday phrases across 12 synonym groups (e.g., `"high temp"` → `fever`, `"winded"` → `shortness of breath`).
    2) Screens against deterministic `EMERGENCY_RED_FLAGS`.
    3) Evaluates both 10 individual clinical categories and 5 multi-symptom combination rules (`COMBINATION_RULES`), such as `fever + cough/sore throat` or `nausea + vomiting + diarrhea`.
    4) Synthesizes duration/severity context explanations and clinician follow-up questions.

13. **Q: Why does HealSmartAI avoid showing diagnostic probability percentages (e.g., "75% Influenza")?**  
    **A:** Presenting fabricated or heuristic percentages creates a misleading impression of clinical diagnosis. HealSmartAI is strictly an educational health information tool, so all outputs use non-diagnostic educational categories, self-care tips, and care-seeking guidance.

14. **Q: How is the optional OpenAI integration designed so the app remains 100% free and safe?**  
    **A:** It is controlled by `OPENAI_ENABLED=false` in `backend/.env`. When `false`, zero external API calls are made. Even if enabled, the local deterministic engine always runs first, and its `emergency_safety` red-flag output is unconditionally preserved so an LLM can never suppress an emergency warning.

15. **Q: How do you protect patient privacy if someone enables the optional OpenAI adapter?**  
    **A:** `sanitizePayloadForOpenAi()` in `backend/src/services/openaiService.js` builds a strict allowlist containing only normalized symptom strings, duration, severity, and regex-redacted context notes (`[REDACTED_EMAIL]`, `[REDACTED_PHONE]`). Patient names, emails, phone numbers, `patient_id`, and Firebase UIDs are never sent.

16. **Q: What happens if `OPENAI_ENABLED=true` but the OpenAI API times out or returns invalid JSON?**  
    **A:** `openaiService.js` uses an `AbortController` timeout (`OPENAI_TIMEOUT_MS=8000`) and strict schema validation (`validateOpenAiResponse`). On any error, timeout, or malformed JSON, it catches the failure and returns the deterministic `localResult` with `engine_used: 'local_rule_engine'` and a `fallback_reason`.

### Frontend & Deployment
17. **Q: How did you solve the `429 Too Many Requests` issue and state synchronization after profile creation?**  
    **A:** First, I tuned `express-rate-limit` so development environments allow `2000` requests per 15-minute window while production remains strict (`200`). Second, in `PatientsPage.jsx`, I updated `handleCreateOrUpdateMyProfile`, `handleAssignDoctor`, and `handleRevokeDoctor` to immediately update the local `patients` state from the `PUT`/`POST`/`DELETE` response payload rather than relying solely on a secondary refetch.

18. **Q: How does React Router protect private and doctor-only pages on the frontend?**  
    **A:** `ProtectedRoute.jsx` checks `AuthContext`. While Firebase and `/api/auth/me` are loading, it renders a spinner; if unauthenticated, it redirects to `/login`; if `allowedRoles={['doctor']}` is set (as on `/dashboard`) and `profile.role !== 'doctor'`, it renders `AccessDeniedPage.jsx`.

19. **Q: Can this Express + `better-sqlite3` backend be deployed directly to Vercel Serverless Functions as-is?**  
    **A:** The React + Vite frontend deploys directly to Vercel Hobby (`frontend/vercel.json`). However, the backend uses `better-sqlite3`, which writes to a local SQLite file (`./data/healsmart.db`). Because Vercel Serverless Functions have an ephemeral, read-only filesystem (except `/tmp`, which is wiped between cold starts and not shared across instances), deploying the backend to Vercel Functions requires either switching the database driver to a serverless SQLite/Postgres service like **Turso (libSQL)** or **Neon**, or hosting the Express backend on a persistent container service.

20. **Q: How did you verify that all features and security boundaries actually work?**  
    **A:** Across Phases 4A, 4B, and 4C, I wrote automated Node.js integration and unit test suites plus Playwright headless Chromium browser tests covering 89 total checks: token verification, cross-patient `403` isolation, duplicate profile `409` prevention, doctor assignment and immediate revocation, synonym/combination symptom matching, PII scrubbing, and production Vite builds.

---

## 4. Key Engineering Challenges & How They Were Solved

1. **Challenge:** Preventing privilege escalation while still allowing interviewers/developers to test both `patient` and `doctor` roles locally.  
   **Solution:** Enforced server-side `role = 'patient'` on all signups and blocked `role` edits in `/api/auth/profile`, while creating a localhost-only, `NODE_ENV !== 'production'` approval endpoint (`POST /api/auth/dev-approve-doctor`) and CLI script (`npm run approve-doctor`).
2. **Challenge:** Building an intelligent symptom checker without requiring paid LLM API keys.  
   **Solution:** Engineered `symptomEngine.js` (v2) with 12 synonym groups, 10 clinical categories, 5 multi-symptom combination rules, severity/duration context synthesis, and deterministic emergency red-flag detection, paired with an optional, disabled-by-default OpenAI adapter.
3. **Challenge:** Ensuring immediate UI feedback when creating a 1-to-1 health profile on `/patients`.  
   **Solution:** Synchronized both `myProfile` and `patients` state arrays directly from the `PUT /api/patients/me` response in `PatientsPage.jsx`, eliminating stale empty states and redundant network round-trips.
