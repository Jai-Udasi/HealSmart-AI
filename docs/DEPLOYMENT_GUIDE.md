# HealSmartAI — Free Deployment & Hosting Guide

This guide provides a comprehensive deployment and architectural readiness evaluation for **HealSmartAI**, explaining how to host the application for free, why the local SQLite backend behaves differently in serverless environments, and step-by-step instructions for deploying to **Vercel** and container platforms.

---

## 1. Architectural Analysis: Express + SQLite on Serverless (Vercel)

Before deploying HealSmartAI, it is vital to understand how serverless cloud execution environments (such as **Vercel Serverless Functions** or AWS Lambda) differ from traditional stateful servers.

### 1.1 The SQLite & `better-sqlite3` Incompatibility with Vercel Functions

The backend currently uses `better-sqlite3` writing to `./data/healsmart.db` with WAL mode enabled. In a standard Node.js server (`node src/index.js`), this works quickly and reliably because the process runs continuously on a persistent filesystem.

However, when running on **Vercel Serverless Functions**:
1. **Ephemeral & Read-Only Filesystem:**
   - Serverless functions execute in temporary microVM containers. The project directory is **strictly read-only** at runtime.
   - The only writable path is `/tmp` (typically capped at 512 MB to 1024 MB).
   - Any file written to `/tmp` is wiped clean whenever the container spins down (cold start) and is **never shared across concurrent function instances**. If Patient A creates their profile on Instance 1, Instance 2 will not see it.
2. **Native C++ Addon (`better-sqlite3`):**
   - `better-sqlite3` relies on a compiled native C++ binary addon (`.node`). Compiling and packaging this binary across serverless build environments often introduces architecture/ABI mismatch errors.
3. **Database File Locking:**
   - SQLite WAL mode uses shared memory (`.db-shm`) and POSIX file locks (`.db-wal`). Distributed serverless instances attempting to write to separate ephemeral files cannot coordinate relational transactions.

---

## 2. Recommended Free-Tier Deployment Architectures

To maintain **100% free hosting ($0/month)** with persistent user data and fast performance, choose one of the following two verified architectural patterns:

### Option A — Decoupled Architecture (Recommended for Zero-Code-Change Server Deployment)

- **Frontend:** **Vercel Hobby Tier** ($0/month)
  - Hosts the React + Vite Single-Page Application (SPA).
  - High performance edge CDN with automatic SSL certificates.
  - Client-side routing handled via `frontend/vercel.json`.
- **Backend & Database:** **Render Free Web Service** / **Railway** / **Fly.io** ($0/month)
  - Runs the Express backend (`backend/src/index.js`) as a long-lived Node.js process.
  - The local SQLite file (`./data/healsmart.db`) persists on disk, preserving user accounts, patient profiles, doctor assignments, symptom history, and clinical notes.
  - Note on Render Free Tier: Free web services spin down after 15 minutes of inactivity; the initial wake-up request takes ~30 seconds.
- **Authentication:** **Firebase Authentication Free (Spark Plan)** ($0/month)
  - 50,000 monthly active users included for email/password authentication.

### Option B — Fully Serverless Architecture (Requires Cloud SQLite / Postgres Adapter)

- **Frontend:** **Vercel Hobby Tier** ($0/month)
- **Backend API:** **Vercel Serverless Functions** (`/api` routes via `backend/api/index.js`)
- **Database:** **Turso (libSQL)** Free Tier ($0/month) or **Neon Serverless PostgreSQL** Free Tier
  - **Turso** is an open-source, edge-hosted SQLite-compatible database with an HTTP/WebSocket client (`@libsql/client`). It provides 500 databases and 9 GB storage for free.
  - Because Turso speaks SQLite SQL syntax, the existing queries in `database.js`, `patients.js`, `symptoms.js`, and `dashboard.js` remain virtually identical, requiring only the swap of `better-sqlite3` prepared statements to `client.execute(...)`.

---

## 3. Step-by-Step Deployment Guide: Frontend on Vercel + Backend on Render

### Step 3.1 Push Clean Code to GitHub

1. Confirm your `.gitignore` excludes sensitive files:
   - `node_modules/`
   - `backend/.env`
   - `frontend/.env.local`
   - `backend/data/*.db*`
   - `service-account.json`
2. Push your project to your GitHub repository:
   ```bash
   git add .
   git commit -m "docs: finalize deployment guide and architecture readiness"
   git push origin main
   ```

---

### Step 3.2 Configure Firebase Authorized Domains

To allow users to sign in from your deployed frontend domain:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project -> **Build** -> **Authentication** -> **Settings** tab.
3. Scroll down to **Authorized domains**.
4. Click **Add domain** and enter your Vercel deployment domain (e.g. `healsmart-ai.vercel.app` or your custom domain).

---

### Step 3.3 Deploy Backend on Render (Free Web Service)

1. Sign up / Log in to [Render](https://render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository: `https://github.com/Jai-Udasi/HealSmart-AI.git`.
4. Configure the service settings:
   - **Name:** `healsmart-ai-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Instance Type:** `Free`
5. Configure Environment Variables in Render:
   | Key | Example Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production security optimizations |
   | `PORT` | `10000` | Port automatically assigned by Render |
   | `HOST` | `0.0.0.0` | Bind to all interfaces for cloud routing |
   | `FRONTEND_URL` | `https://healsmart-ai.vercel.app` | Allowed CORS origin |
   | `FIREBASE_PROJECT_ID` | `your-firebase-project-id` | Firebase project identifier |
   | `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | Paste the raw JSON string of your service account key |
   | `RATE_LIMIT_MAX` | `200` | Production rate limit per 15 min |
   | `OPENAI_ENABLED` | `false` | Keep free local engine active |
6. Click **Create Web Service**. Wait for the build and deployment to complete.
7. Note down your Render backend URL (e.g. `https://healsmart-ai-backend.onrender.com`).
8. Test health endpoint: `https://healsmart-ai-backend.onrender.com/api/health` -> should return `{"success":true,"status":"healthy"}`.

---

### Step 3.4 Deploy Frontend on Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New...** -> **Project**.
2. Import your GitHub repository (`HealSmart-AI`).
3. Configure the Vercel project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Verify `frontend/vercel.json` exists with SPA client-side routing rules:
   ```json
   {
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
5. Configure Environment Variables in Vercel:
   | Key | Example Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | Your Firebase API Key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | `your-messaging-sender-id` |
   | `VITE_FIREBASE_APP_ID` | `your-app-id` |
   | `VITE_API_BASE_URL` | `https://healsmart-ai-backend.onrender.com/api` |
6. Click **Deploy**. Vercel will bundle the React app and deploy it across its global CDN.

---

## 4. Post-Deployment Verification Checklist

After deploying frontend and backend:

1. [ ] **Health Check:** Open `https://<backend-url>/api/health` and verify HTTP 200 with database status `connected`.
2. [ ] **Client-Side Routing:** Navigate to `https://<frontend-url>/login`, `https://<frontend-url>/signup`, and refresh the page to confirm `vercel.json` rewrites resolve without 404s.
3. [ ] **Firebase Authentication:** Sign up a new user on production; verify the Firebase user is created and redirected to `/`.
4. [ ] **Profile Creation:** Complete **My Health Profile**; verify the profile persists in SQLite and reloads on page refresh.
5. [ ] **Smart Symptom Assistant:** Submit symptoms with duration and severity; confirm the `Free Smart Local Engine` returns normalized symptoms, pattern combinations, and follow-up questions.
6. [ ] **CORS Verification:** Verify in browser developer tools Network tab that API requests return HTTP 200 with proper `Access-Control-Allow-Origin` headers matching your Vercel URL.
7. [ ] **Production Security Check:** Verify `POST /api/auth/dev-approve-doctor` returns `403 Forbidden` in production (`NODE_ENV=production`).
