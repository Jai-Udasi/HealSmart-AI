# HealSmartAI — Full-Stack Healthcare Education & Patient Workflow Platform

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-React_18_%7C_Vite_6-blue.svg)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js_%7C_Express_5-green.svg)]()
[![Database](https://img.shields.io/badge/Database-SQLite_3_(WAL)-lightgrey.svg)]()
[![Auth](https://img.shields.io/badge/Auth-Firebase_Admin_v14-orange.svg)]()
[![Cost](https://img.shields.io/badge/Cost-100%25_Free_to_Run-success.svg)]()

> **Notice & Educational Disclaimer**  
> **HealSmartAI** is an informational software engineering project and educational health resource. It does **not** diagnose diseases, compute clinical probabilities, prescribe medications, or replace professional medical consultation. If you are experiencing a medical emergency, immediately contact your local emergency services (such as 911).

---

## 1. Executive Summary

**HealSmartAI** is a full-stack healthcare education and role-scoped patient workflow web application. Built with **React 18 + Vite 6**, **Node.js + Express 5**, **SQLite (`better-sqlite3`)**, and **Firebase Authentication**, the platform provides:

- **Cryptographic Authentication & Server-Enforced RBAC:** Integrates the official Firebase Admin SDK (`firebase-admin/auth` `verifyIdToken()`) with server-side SQLite authorization separating `patient` and `doctor` roles.
- **1-to-1 Patient Health Profile & Doctor Consent Management:** Each registered patient manages a single canonical health profile (`GET /api/patients/me`, `PUT /api/patients/me`) and retains full authority to explicitly grant (`POST /api/patients/:id/assign-doctor`) or immediately revoke (`DELETE /api/patients/:id/assign-doctor/:doctorUserId`) clinical access to specific doctors.
- **100% Free Smart Deterministic Symptom Engine v2:** Analyzes user symptoms locally with zero external API calls or billing. Features 12 synonym normalization groups, 10 clinical categories, 5 multi-symptom combination rules, severity/duration context explanations, clarifying follow-up questions, and deterministic emergency red-flag screening.
- **Optional Privacy-Preserving OpenAI Educational Adapter:** An optional integration (`OPENAI_ENABLED=false` by default) that strips all PII (names, emails, phone numbers, identifiers), enforces strict timeouts, validates responses, never overrides deterministic emergency safety warnings, and gracefully falls back to the free local engine.
- **Doctor Clinical Workspace & Notes:** Verified doctors access live SQLite KPIs (`/api/dashboard/stats`, `/api/dashboard/recent`) and can author structured clinical observation notes (`/api/notes`) strictly scoped to currently assigned patients.

---

## 2. Documentation Index

Comprehensive technical documentation is organized in the [`docs/`](file:///E:/HealSmartAI/docs/) directory:

| Document | Description |
|---|---|
| [**Project Report**](file:///E:/HealSmartAI/docs/PROJECT_REPORT.md) | Introduction, problem statement, objectives, existing vs. proposed systems, implementation details, limitations, and future scope. |
| [**Architecture & Data Flow**](file:///E:/HealSmartAI/docs/ARCHITECTURE.md) | System components, request pipeline, and Mermaid sequence diagrams for authentication, symptom checks, and doctor consent. |
| [**Database Schema Reference**](file:///E:/HealSmartAI/docs/DATABASE_SCHEMA.md) | Relational ER diagram, table columns, constraints, foreign keys, and indexes for `users`, `patients`, `symptom_checks`, `doctor_notes`, and `doctor_patient_assignments`. |
| [**REST API Documentation**](file:///E:/HealSmartAI/docs/API_DOCUMENTATION.md) | Endpoint specifications, HTTP methods, headers, authentication/authorization requirements, request payloads, and response envelopes. |
| [**Testing & Verification Report**](file:///E:/HealSmartAI/docs/TESTING_REPORT.md) | Summary of 89 automated checks across Phase 4A (44 checks), Phase 4B (28 checks), Phase 4C (17 checks), and Playwright browser tests. |
| [**End-to-End User Guide**](file:///E:/HealSmartAI/docs/USER_GUIDE.md) | Step-by-step walkthrough for patient signup, 1-to-1 health profile setup, symptom checks, doctor assignment, and doctor dashboard usage. |
| [**Technical Interview Preparation**](file:///E:/HealSmartAI/docs/INTERVIEW_PREPARATION.md) | 2–3 minute demonstration script, architectural breakdown, 20 interview Q&As, and key engineering challenges solved. |
| [**Screenshot Checklist**](file:///E:/HealSmartAI/docs/SCREENSHOT_CHECKLIST.md) | 11 key desktop and mobile screenshot specifications with capture instructions and viewports. |
| [**Free Deployment Guide**](file:///E:/HealSmartAI/docs/DEPLOYMENT_GUIDE.md) | In-depth Vercel serverless compatibility analysis, free-tier hosting architectures ($0/month on Vercel + Render/Turso), and step-by-step setup. |

---

## 3. Technology Stack

| Layer | Technologies & Libraries | Key Responsibilities |
|---|---|---|
| **Frontend** | React `^18.3.1`, Vite `^6.0.5`, React Router DOM `^6.28.0`, Lucide React | Single-page application, responsive glassmorphism UI, client-side route protection |
| **HTTP Client** | Axios `^1.7.9` | Centralized API client with automatic Firebase Bearer token injection and error normalization |
| **Authentication** | Firebase Web SDK `^13.1.0` & Firebase Admin SDK `^14.5.0` | Client-side email/password authentication & cryptographic RS256 token verification (`verifyIdToken()`) |
| **Backend** | Node.js `>=18`, Express `^5.3.0` | REST API, role-based authorization, rate limiting, and input validation |
| **Database** | SQLite 3 via `better-sqlite3@^13.0.3` | Relational persistence, WAL mode, foreign key enforcement, automatic idempotent migrations |
| **Security & Validation** | Joi `^18.3.0`, Helmet `^8.3.0`, CORS `^2.8.6`, Express Rate Limit `^8.7.1` | Request schema validation, secure HTTP headers, origin whitelisting, DoS protection |
| **Symptom Engine** | Smart Deterministic Symptom Engine v2 (`backend/src/services/symptomEngine.js`) | 100% free local rule matching, synonym mapping, multi-symptom combinations, red flags |

---

## 4. Local Installation & Development Setup

### Prerequisites
- Node.js `>= 18.0.0`
- npm `>= 9.0.0`
- A free Firebase project with **Email/Password** authentication enabled.

### Step 1: Clone Repository
```powershell
git clone https://github.com/Jai-Udasi/HealSmart-AI.git
Set-Location E:\HealSmartAI
```

### Step 2: Configure Backend Environment
Navigate to `backend/` and copy `.env.example` to `.env`:
```powershell
Set-Location E:\HealSmartAI\backend
Copy-Item .env.example .env
```
Edit `backend/.env` with your values:
```ini
HOST=127.0.0.1
PORT=5000
NODE_ENV=development
DB_PATH=./data/healsmart.db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=2000
FRONTEND_URL=http://localhost:5173

# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

# Local Dev Doctor Promotion Code
LOCAL_DOCTOR_APPROVAL_CODE=HEALSMART-LOCAL-DEV-DOCTOR

# Optional OpenAI (Keep false for 100% free mode)
OPENAI_ENABLED=false
```

### Step 3: Configure Frontend Environment
Navigate to `frontend/` and copy `.env.example` to `.env.local`:
```powershell
Set-Location E:\HealSmartAI\frontend
Copy-Item .env.example .env.local
```
Fill in your Firebase Web App configuration:
```ini
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=/api
```

### Step 4: Run the Application

**Terminal 1 — Backend API Server (`http://localhost:5000`):**
```powershell
Set-Location E:\HealSmartAI\backend
npm install
npm run dev
```

**Terminal 2 — Frontend Dev Server (`http://localhost:5173`):**
```powershell
Set-Location E:\HealSmartAI\frontend
npm install
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 5. Doctor Role Promotion (Local Development)

Public registration creates accounts with `role = 'patient'`. To test doctor-specific features (such as `/dashboard`, viewing assigned patients, and authoring clinical notes) in local development:

1. Sign up a test user (e.g. `doctor@example.com`).
2. Promote the user via the CLI script:
   ```powershell
   Set-Location E:\HealSmartAI\backend
   npm run approve-doctor -- doctor@example.com
   ```
   *Alternatively*, click **Doctor Approval (Local Dev)** in the frontend sidebar and enter `HEALSMART-LOCAL-DEV-DOCTOR`.  
   *(Note: Both mechanisms are strictly disabled when `NODE_ENV=production`).*

---

## 6. Testing & Quality Verification

Run unit, security, and integration verification suites:

```powershell
# Frontend production build
Set-Location E:\HealSmartAI\frontend
npm run build

# Backend verification
Set-Location E:\HealSmartAI\backend
npm test
```

Verified test coverage includes:
- **Phase 4A (44/44 passing):** Firebase token verification, RBAC route guarding, SQLite user provisioning.
- **Phase 4B (28/28 passing):** 1-to-1 patient profiles, duplicate prevention (`409`), cross-patient `403` isolation, doctor assignment and immediate revocation.
- **Phase 4C (17/17 passing):** Symptom synonym normalization, combination patterns, context notes, red-flag screening, PII scrubbing, mock OpenAI adapter fallback, and browser E2E workflows.

---

## 7. License & Credits

This project was developed for educational and portfolio demonstration purposes.  
Built by **Jai Udasi** ([GitHub Profile](https://github.com/Jai-Udasi)).
