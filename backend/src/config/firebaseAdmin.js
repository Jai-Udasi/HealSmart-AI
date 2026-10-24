'use strict';

const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

let initMode = 'uninitialized';

/**
 * Initializes the official Firebase Admin SDK (`firebase-admin/app` & `firebase-admin/auth`).
 *
 * Supported credential/configuration modes (in priority order):
 * 1. `FIREBASE_SERVICE_ACCOUNT_PATH` — path to a Firebase Admin service account JSON file.
 *    Fails securely if the path is set but the file is missing or invalid.
 * 2. `GOOGLE_APPLICATION_CREDENTIALS` — Application Default Credentials.
 * 3. `FIREBASE_PROJECT_ID` — initializes the official Firebase Admin SDK for `getAuth().verifyIdToken()`,
 *    which verifies token issuer, audience, expiry, cryptographic RS256 signature, and subject (`uid`).
 *
 * Never uses a custom JWT verifier fallback, never hardcodes private keys, and never logs secrets.
 */
function initFirebaseAdmin() {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return { auth: getAuth(existingApps[0]), initMode };
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const serviceAccountPath = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

  if (serviceAccountPath) {
    const resolvedSaPath = path.resolve(serviceAccountPath);
    if (!fs.existsSync(resolvedSaPath)) {
      const err = new Error(
        `Firebase Admin setup error: FIREBASE_SERVICE_ACCOUNT_PATH is set to "${serviceAccountPath}", but the file does not exist at "${resolvedSaPath}". Provide a valid Firebase Admin service account JSON file or remove FIREBASE_SERVICE_ACCOUNT_PATH.`
      );
      err.status = 500;
      throw err;
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(fs.readFileSync(resolvedSaPath, 'utf8'));
    } catch (parseErr) {
      const err = new Error(
        `Firebase Admin setup error: Failed to parse service account JSON at "${resolvedSaPath}": ${parseErr.message}`
      );
      err.status = 500;
      throw err;
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: projectId || serviceAccount.project_id,
    });
    initMode = 'service_account_file';
    console.log('[Auth] Official Firebase Admin SDK initialized with service account credentials.');
    return { auth: getAuth(app), initMode };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const app = initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
    initMode = 'application_default_credentials';
    console.log('[Auth] Official Firebase Admin SDK initialized with Application Default Credentials.');
    return { auth: getAuth(app), initMode };
  }

  if (projectId) {
    const app = initializeApp({ projectId });
    initMode = 'project_id';
    console.log(
      `[Auth] Official Firebase Admin SDK initialized with FIREBASE_PROJECT_ID (${projectId}). ` +
        'Note: Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env to enable live token revocation checks (checkRevoked=true).'
    );
    return { auth: getAuth(app), initMode };
  }

  const err = new Error(
    'Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID (and recommended FIREBASE_SERVICE_ACCOUNT_PATH pointing to your Firebase Admin service-account JSON key) in backend/.env.'
  );
  err.status = 500;
  throw err;
}

/**
 * Verifies a Firebase ID token strictly through the official Firebase Admin SDK `getAuth().verifyIdToken()`.
 * Checks issuer (`https://securetoken.google.com/<projectId>`), audience (`<projectId>`),
 * expiration (`exp`), RS256 cryptographic signature, and user identity (`uid` / `sub`).
 * When full service account or ADC credentials are configured, also checks token revocation (`checkRevoked = true`).
 */
async function verifyFirebaseToken(idToken) {
  const { auth, initMode: mode } = initFirebaseAdmin();
  const checkRevoked = mode === 'service_account_file' || mode === 'application_default_credentials';
  return auth.verifyIdToken(idToken, checkRevoked);
}

module.exports = {
  initFirebaseAdmin,
  verifyFirebaseToken,
};
