'use strict';

const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const updateProfileSchema = Joi.object({
  display_name: Joi.string().trim().min(2).max(80).required().messages({
    'string.min': 'Display name must be at least 2 characters',
    'string.max': 'Display name cannot exceed 80 characters',
  }),
  role: Joi.any().forbidden().messages({
    'any.unknown': 'Client-side role assignment or modification is forbidden',
  }),
  firebase_uid: Joi.any().forbidden(),
  id: Joi.any().forbidden(),
});

const devApproveDoctorSchema = Joi.object({
  approval_code: Joi.string().trim().min(6).max(128).required().messages({
    'any.required': 'Local development approval_code is required',
  }),
  target_role: Joi.string().valid('doctor', 'patient').default('doctor'),
  display_name: Joi.string().trim().min(2).max(80).optional(),
});

/**
 * GET /api/auth/me
 * Returns the authenticated user's backend SQLite profile and role.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
        local_dev_mode: process.env.NODE_ENV !== 'production',
      },
    });
  })
);

/**
 * PUT /api/auth/profile
 * Updates the authenticated user's display_name in SQLite.
 * Explicitly forbids modifying `role` or `firebase_uid`.
 */
router.put(
  '/profile',
  requireAuth,
  validate(updateProfileSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { display_name } = req.body;

    db.prepare(`
      UPDATE users
      SET display_name = @display_name,
          updated_at   = datetime('now')
      WHERE id = @id
    `).run({
      display_name,
      id: req.user.id,
    });

    const updated = db
      .prepare('SELECT id, firebase_uid, email, display_name, role, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        user: updated,
      },
    });
  })
);

/**
 * POST /api/auth/dev-approve-doctor
 * Controlled local-development-only mechanism to approve/promote an authenticated account
 * to the 'doctor' role (or revert to 'patient') using a backend verification passcode.
 * Disabled in production and restricted to localhost connections.
 */
router.post(
  '/dev-approve-doctor',
  requireAuth,
  validate(devApproveDoctorSchema, 'body'),
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('Local development doctor approval is disabled in production.');
      err.status = 403;
      throw err;
    }

    const remoteIp = req.ip || req.socket?.remoteAddress || '';
    const isLocalhost =
      remoteIp === '127.0.0.1' ||
      remoteIp === '::1' ||
      remoteIp === '::ffff:127.0.0.1';

    if (!isLocalhost) {
      const err = new Error('Local development doctor approval is restricted to localhost.');
      err.status = 403;
      throw err;
    }

    const expectedCode = (
      process.env.LOCAL_DOCTOR_APPROVAL_CODE || 'HEALSMART-LOCAL-DEV-DOCTOR'
    ).trim();
    const providedCode = String(req.body.approval_code || '').trim();

    const expectedBuf = Buffer.from(expectedCode, 'utf8');
    const providedBuf = Buffer.from(providedCode, 'utf8');
    const isValidCode =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isValidCode) {
      const err = new Error('Access denied: Invalid local development doctor approval code.');
      err.status = 403;
      err.code = 'INVALID_APPROVAL_CODE';
      throw err;
    }

    const targetRole = req.body.target_role || 'doctor';
    const nextDisplayName = req.body.display_name || req.user.display_name;
    const db = getDb();
    db.prepare(`
      UPDATE users
      SET role         = @role,
          display_name = @display_name,
          updated_at   = datetime('now')
      WHERE id = @id
    `).run({
      role: targetRole,
      display_name: nextDisplayName,
      id: req.user.id,
    });

    const updated = db
      .prepare('SELECT id, firebase_uid, email, display_name, role, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    return res.status(200).json({
      success: true,
      meta: {
        notice: 'LOCAL-DEV-ONLY: Role updated via controlled local development approval mechanism.',
      },
      data: {
        user: updated,
      },
    });
  })
);

/**
 * GET /api/auth/doctors
 * Lists verified doctor accounts so a patient owner can assign or revoke doctor access to their record.
 */
router.get(
  '/doctors',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const doctors = db
      .prepare(`
        SELECT id, email, display_name, role, created_at
        FROM users
        WHERE role = 'doctor'
        ORDER BY id ASC
      `)
      .all();

    return res.status(200).json({
      success: true,
      data: {
        doctors,
      },
    });
  })
);

module.exports = router;
