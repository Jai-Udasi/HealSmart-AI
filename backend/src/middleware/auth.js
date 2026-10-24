'use strict';

const { verifyFirebaseToken } = require('../config/firebaseAdmin');
const { getDb } = require('../db/database');

/**
 * Express middleware that:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Verifies the Firebase ID token via the official Firebase Admin SDK (`getAuth().verifyIdToken()`).
 * 3. Rejects missing, malformed, expired, invalid, or revoked tokens with 401.
 * 4. Provisions or retrieves the corresponding SQLite `users` record (`role = 'patient'` by default).
 *    Never trusts any role claim sent from the client request body/headers.
 *    Never logs raw tokens or sensitive credentials.
 */
async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      const err = new Error('Authentication required: Missing or malformed Authorization Bearer token.');
      err.status = 401;
      err.code = 'AUTH_REQUIRED';
      return next(err);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      const err = new Error('Authentication required: Empty Bearer token.');
      err.status = 401;
      err.code = 'AUTH_REQUIRED';
      return next(err);
    }

    let decoded;
    try {
      decoded = await verifyFirebaseToken(token);
    } catch (verifyErr) {
      const code = verifyErr.code || '';
      if (code === 'app/invalid-credential' || verifyErr.status === 500) {
        return next(verifyErr);
      }

      let message = 'Invalid or unauthorized authentication token.';
      if (code === 'auth/id-token-expired') {
        message = 'Session expired: Firebase ID token has expired. Please sign in again.';
      } else if (code === 'auth/id-token-revoked') {
        message = 'Session revoked: Firebase ID token has been revoked. Please sign in again.';
      } else if (code === 'auth/argument-error') {
        message = 'Malformed authentication token.';
      }
      const err = new Error(message);
      err.status = 401;
      err.code = 'INVALID_TOKEN';
      return next(err);
    }

    const firebaseUid = decoded.uid;
    const email = (decoded.email || `${firebaseUid}@firebase.local`).toLowerCase();
    const displayName = decoded.name || email.split('@')[0] || 'HealSmart User';

    const db = getDb();
    let userRow = db
      .prepare('SELECT * FROM users WHERE firebase_uid = ?')
      .get(firebaseUid);

    if (!userRow) {
      // Always provision new users with 'patient' role — never trust client role claims
      const insertStmt = db.prepare(`
        INSERT INTO users (firebase_uid, email, display_name, role)
        VALUES (@firebase_uid, @email, @display_name, 'patient')
      `);
      const info = insertStmt.run({
        firebase_uid: firebaseUid,
        email,
        display_name: displayName,
      });
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else if (userRow.email !== email && decoded.email) {
      db.prepare(`
        UPDATE users
        SET email = @email, updated_at = datetime('now')
        WHERE id = @id
      `).run({ email, id: userRow.id });
      userRow.email = email;
    }

    req.user = {
      id: userRow.id,
      firebase_uid: userRow.firebase_uid,
      email: userRow.email,
      display_name: userRow.display_name,
      role: userRow.role, // Strictly from backend SQLite `users` table
      created_at: userRow.created_at,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Role-based authorization middleware.
 * Checks `req.user.role` (loaded from backend SQLite `users` table).
 *
 * @param {...string} allowedRoles - e.g. 'doctor' or 'patient'
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      const err = new Error('Authentication required.');
      err.status = 401;
      return next(err);
    }

    if (!allowedRoles.includes(req.user.role)) {
      const err = new Error(
        `Access denied: This resource requires role [${allowedRoles.join(' or ')}], but your account role is '${req.user.role}'.`
      );
      err.status = 403;
      return next(err);
    }

    return next();
  };
}

/**
 * Helper to verify whether `req.user` is authorized to access a given `patient` row.
 * - Rejects legacy unowned records (`owner_user_id IS NULL`) for all users.
 * - If `req.user.id === patientRow.owner_user_id`: owner always has access to their own profile.
 * - If `req.user.role === 'doctor'`: requires an explicit row in `doctor_patient_assignments`.
 */
function canAccessPatient(db, user, patientRow) {
  if (!patientRow || patientRow.owner_user_id === null || patientRow.owner_user_id === undefined) {
    return false;
  }

  if (patientRow.owner_user_id === user.id) {
    return true;
  }

  if (user.role === 'doctor') {
    const assignment = db
      .prepare(
        'SELECT 1 FROM doctor_patient_assignments WHERE doctor_user_id = ? AND patient_id = ?'
      )
      .get(user.id, patientRow.id);
    return Boolean(assignment);
  }

  return false;
}

module.exports = {
  requireAuth,
  requireRole,
  canAccessPatient,
};
