import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const missingKeys = REQUIRED_ENV_KEYS.filter(
  (key) => !import.meta.env[key] || String(import.meta.env[key]).trim() === ''
);

export const firebaseConfigError =
  missingKeys.length > 0
    ? `Missing required Firebase environment variables in frontend/.env.local: ${missingKeys.join(
        ', '
      )}. Copy frontend/.env.example to frontend/.env.local and fill in your Firebase Web App credentials.`
    : null;

let app = null;
let auth = null;

if (!firebaseConfigError) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
      ? { measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID }
      : {}),
  };

  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
}

export { app, auth };
