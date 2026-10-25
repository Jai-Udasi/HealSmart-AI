# HealSmartAI — End-to-End User Guide

This guide walks through every user workflow in **HealSmartAI** for both **Patient** and **Doctor** roles.

---

## 1. Prerequisites & Starting the Application Locally

1. **Start the Express + SQLite Backend (Terminal 1):**
   ```powershell
   Set-Location E:\HealSmartAI\backend
   npm run dev
   ```
   Wait until you see:
   `🏥 HealSmartAI API running — http://localhost:5000/api/health`

2. **Start the React + Vite Frontend (Terminal 2):**
   ```powershell
   Set-Location E:\HealSmartAI\frontend
   npm run dev
   ```
   Open **`http://localhost:5173`** in your browser.

---

## 2. Creating an Account & Signing In

1. Navigate to `http://localhost:5173/signup` (or click **Create an account** on the Sign-In page).
2. Enter your **Full Name**, **Email Address**, and a **Password** (at least 6 characters).
3. Click **Create Account**.
   - **Security Note:** Every new account registered through public signup is automatically assigned the **`patient`** role in SQLite. Users cannot self-select the `doctor` role during registration.
4. Once signed in, the left sidebar displays your name, email, verified role badge (`Patient Account` or `Doctor Account`), and role-appropriate navigation links.
5. If you ever forget your password, click **Forgot password?** on `/login` (`/forgot-password`) to trigger a Firebase password-reset email.

---

## 3. Patient Workflow 1 — Creating & Updating Your 1-to-1 Health Profile

Each patient account owns a single canonical health profile (`1-to-1` relationship).

1. Click **My Health Profile** (`/patients`) in the left sidebar.
2. If you have not created your health profile yet, click **Create Health Profile**:
   - **Full Name:** e.g., `Aarav Sharma`
   - **Age:** e.g., `29`
   - **Gender:** Select `Male`, `Female`, `Other`, or `Prefer not to say`
   - **Email & Phone:** Optional contact details
   - **Medical History / Context Notes:** Comma-separated items (e.g., `Seasonal allergies, Mild asthma`)
3. Click **Create My Profile**.
4. Your profile card immediately appears on `/patients` and the top button changes to **Edit My Health Profile**.
5. Clicking **Edit My Health Profile** at any time updates your existing SQLite record (`PUT /api/patients/me`) rather than creating duplicate rows.

---

## 4. Patient Workflow 2 — Using the Smart Symptom Assistant

1. Click **Symptom Checker** (`/symptoms`) in the left sidebar.
2. Notice the engine status badge in the top-right header: **`Free Smart Local Engine`** (`100% Free` deterministic rule & combination engine).
3. **Add Symptoms:**
   - Click any of the **Quick-Select Common Symptoms** chips (`Fever`, `Cough`, `Sore Throat`, `Headache`, `Fatigue`, `Nausea`, `Vomiting`, `Diarrhea`, `Dizziness`, `Shortness of Breath`, `Chest Pain`), **or**
   - Type everyday phrases into the input box (separated by commas or new lines) and click **Add**. The engine automatically normalizes everyday variations (e.g., `"high temp"` → `fever`, `"throwing up"` → `vomiting`, `"tummy ache"` → `abdominal pain`).
4. **Add Optional Context:**
   - **Duration:** Choose a preset chip (`Just started today`, `2-3 days`, `4-7 days`, `More than a week`) or type a custom duration.
   - **Severity:** Select `Mild`, `Moderate`, or `Severe`.
   - **Additional Context Notes:** Optionally describe non-identifying context (up to 500 characters), such as `"Started after a cold, worse at night"`.
5. Click **Run Smart Symptom Check**.
6. **Review Your Structured Educational Guidance:**
   - **Emergency Red-Flag Banner:** Appears prominently at the top if urgent keywords (e.g., `chest pain`, `shortness of breath`) are detected.
   - **Normalized Symptom Mapping:** Shows how your phrases mapped to canonical symptom concepts.
   - **Multi-Symptom Pattern Insights:** Explains combined symptom patterns when multiple related symptoms occur together (e.g., *Respiratory + Fever Pattern* or *GI Hydration Watch Pattern*).
   - **Duration & Severity Context Notes:** Explains how your selected severity and duration affect general care considerations.
   - **General Self-Care Tips & When to Seek Medical Care:** Practical non-diagnostic guidance.
   - **Helpful Questions for a Clinician Visit:** Targeted clarifying questions to prepare for a doctor consultation.
7. **Symptom History:** Scroll down to **Recent Symptom Evaluations** (or open your profile detail page) to review saved evaluations stored in SQLite.

---

## 5. Promoting a Test Account to `Doctor` (Local Development Only)

Because public signup always assigns `role = 'patient'`, HealSmartAI includes two controlled local-development methods (`NODE_ENV !== 'production'`) to promote a second test account to `doctor`:

### Method A — Using the Sidebar Modal in Local Dev
1. Sign up a second user account (e.g., `dr.meera@example.com`).
2. In the bottom of the left sidebar, click **Doctor Approval (Local Dev)**.
3. Enter the local approval code from `backend/.env` (`LOCAL_DOCTOR_APPROVAL_CODE`):
   ```text
   HEALSMART-LOCAL-DEV-DOCTOR
   ```
4. Optionally set the Doctor Display Name (e.g., `Dr. Meera Nair`) and click **Approve Doctor Role**.
5. Your role badge immediately updates to **`Doctor Account`**, unlocking the **Dashboard** (`/dashboard`) and **Assigned Patients** (`/patients`) views.

### Method B — Using the Backend CLI Script
From `E:\HealSmartAI\backend`, run:
```powershell
npm run approve-doctor -- dr.meera@example.com
```

---

## 6. Patient Workflow 3 — Assigning & Revoking a Doctor

Patients have complete control over which doctors can view their health profile, symptom checks, and clinical notes.

1. Sign in with your **Patient** account and go to **My Health Profile** (`/patients`).
2. Click **Open Profile & Manage Doctor Access** on your profile card to open `/patients/:id`.
3. In the **Doctor Access & Care Team** card:
   - Select a verified doctor from the dropdown (e.g., `Dr. Meera Nair (dr.meera@example.com)`).
   - Click **Grant Access**.
4. The doctor now appears under **Currently Assigned Doctors**.
5. **To Revoke Access Immediately:**
   - Click **Revoke Access** next to the doctor's name.
   - The doctor's access is terminated immediately in SQLite (`DELETE /api/patients/:id/assign-doctor/:doctorUserId`). The doctor can no longer view your profile, symptom history, or clinical notes.

---

## 7. Doctor Workflow — Clinical Dashboard & Authoring Notes

1. Sign in with an approved **Doctor** account (`role = 'doctor'`).
2. **Clinical Dashboard (`/dashboard`):**
   - View live SQLite KPIs scoped strictly to patients currently assigned to you: **Assigned Patients**, **Total Symptom Checks**, **Emergency Red-Flag Checks**, **Checks (Last 24h)**, and **Top Symptom Categories**.
   - Click any row in the **Recent Assigned-Patient Symptom Evaluations** table to jump directly to that patient's record.
3. **Assigned Patients Directory (`/patients`):**
   - Lists only the patients who have explicitly granted you access.
4. **Reviewing History & Adding Clinical Notes (`/patients/:id`):**
   - Inspect the patient's medical history tags and full chronological **Symptom Evaluation History**.
   - In the **Clinical & Educational Notes** section, choose a category (`General`, `Follow-Up`, or `Observation`), enter your note (`5–2000` characters), and click **Add Clinical Note**.
   - The patient can view your note in read-only mode on their own profile page.
