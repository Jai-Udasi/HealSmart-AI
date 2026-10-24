'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole, canAccessPatient } = require('../middleware/auth');

const router = express.Router();

// All notes routes require authentication
router.use(requireAuth);

const CLINICAL_NOTES_NOTICE =
  'Educational Clinical Note — Recorded by an authorized doctor account in local SQLite. Not a legal medical record or clinical diagnosis.';

const VALID_NOTE_TYPES = ['general', 'diagnosis', 'prescription', 'follow_up', 'lab_result'];

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const listNotesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  patient_id: Joi.number().integer().positive().optional().messages({
    'number.base': 'patient_id filter must be a positive integer',
    'number.integer': 'patient_id filter must be an integer',
    'number.positive': 'patient_id filter must be a positive integer',
  }),
  note_type: Joi.string()
    .valid(...VALID_NOTE_TYPES)
    .optional()
    .messages({
      'any.only': `note_type filter must be one of [${VALID_NOTE_TYPES.join(', ')}]`,
    }),
});

const createNoteSchema = Joi.object({
  patient_id: Joi.number().integer().positive().required().messages({
    'any.required': 'patient_id is required',
    'number.base': 'patient_id must be a valid positive integer',
    'number.integer': 'patient_id must be an integer',
    'number.positive': 'patient_id must be a positive integer',
  }),
  author: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .allow('')
    .messages({
      'string.min': 'author display name must be at least 2 characters',
      'string.max': 'author display name cannot exceed 100 characters',
    }),
  note_type: Joi.string()
    .valid(...VALID_NOTE_TYPES)
    .default('general')
    .messages({
      'any.only': `note_type must be one of [${VALID_NOTE_TYPES.join(', ')}]`,
    }),
  content: Joi.string()
    .trim()
    .min(3)
    .max(2000)
    .required()
    .messages({
      'any.required': 'content is required',
      'string.empty': 'content cannot be empty',
      'string.min': 'content must be at least 3 characters',
      'string.max': 'content cannot exceed 2000 characters',
    }),
});

function formatNoteRow(row) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    doctor_user_id: row.doctor_user_id,
    doctor_email: row.doctor_email || null,
    patient_name:
      row.patient_first_name && row.patient_last_name
        ? `${row.patient_first_name} ${row.patient_last_name}`
        : null,
    author: row.author,
    note_type: row.note_type,
    content: row.content,
    disclaimer_label: 'EDUCATIONAL CLINICAL NOTE — NON-DIAGNOSTIC',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/notes
 * List saved clinical notes scoped strictly to the authenticated user's accessible patients.
 * - Patient role: notes for their own patient profile (owner_user_id = req.user.id).
 * - Doctor role: notes for patients currently assigned to req.user.id in doctor_patient_assignments.
 */
router.get(
  '/',
  validate(listNotesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, patient_id, note_type } = req.validatedQuery;
    const offset = (page - 1) * limit;
    const userId = req.user.id;
    const isDoctor = req.user.role === 'doctor';

    if (patient_id !== undefined) {
      const targetPatient = db
        .prepare('SELECT * FROM patients WHERE id = ?')
        .get(patient_id);
      if (!targetPatient) {
        const err = new Error(`Patient with ID ${patient_id} not found`);
        err.status = 404;
        throw err;
      }
      if (!canAccessPatient(db, req.user, targetPatient)) {
        const err = new Error('Access denied: You are not authorized to view notes for this patient.');
        err.status = 403;
        throw err;
      }
    }

    const scopeCondition = isDoctor
      ? `EXISTS (
           SELECT 1 FROM doctor_patient_assignments dpa
           WHERE dpa.patient_id = dn.patient_id AND dpa.doctor_user_id = @userId
         )`
      : `p.owner_user_id = @userId`;

    const conditions = ['p.owner_user_id IS NOT NULL', scopeCondition];
    const params = { userId, limit, offset };

    if (patient_id !== undefined) {
      conditions.push('dn.patient_id = @patient_id');
      params.patient_id = patient_id;
    }
    if (note_type !== undefined) {
      conditions.push('dn.note_type = @note_type');
      params.note_type = note_type;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const total = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM doctor_notes dn
        JOIN patients p ON dn.patient_id = p.id
        ${whereClause}
      `)
      .get(params).count;

    const rows = db
      .prepare(`
        SELECT
          dn.*,
          p.first_name AS patient_first_name,
          p.last_name  AS patient_last_name,
          u.email      AS doctor_email
        FROM doctor_notes dn
        JOIN patients p ON dn.patient_id = p.id
        LEFT JOIN users u ON dn.doctor_user_id = u.id
        ${whereClause}
        ORDER BY dn.id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all(params);

    const notes = rows.map(formatNoteRow);
    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      meta: {
        notice: CLINICAL_NOTES_NOTICE,
      },
      data: {
        notes,
        pagination: {
          total,
          page,
          limit,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      },
    });
  })
);

/**
 * POST /api/notes
 * Restricted strictly to users with `doctor` role (`requireRole('doctor')`).
 * Furthermore, the doctor must be explicitly assigned to the target patient record.
 */
router.post(
  '/',
  requireRole('doctor'),
  validate(createNoteSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { patient_id, author, note_type, content } = req.body;

    const patient = db
      .prepare('SELECT * FROM patients WHERE id = ?')
      .get(patient_id);

    if (!patient) {
      const err = new Error(`Patient with ID ${patient_id} not found`);
      err.status = 404;
      throw err;
    }

    // Strictly verify explicit assignment in doctor_patient_assignments
    const isAssigned = db
      .prepare(
        'SELECT 1 FROM doctor_patient_assignments WHERE doctor_user_id = ? AND patient_id = ?'
      )
      .get(req.user.id, patient.id);

    if (!patient.owner_user_id || !isAssigned) {
      const err = new Error(
        'Access denied: Doctors can only create notes for patients explicitly assigned to them.'
      );
      err.status = 403;
      throw err;
    }

    const resolvedAuthor =
      (author && author.trim()) ||
      req.user.display_name ||
      req.user.email ||
      'Assigned Physician';

    const insertStmt = db.prepare(`
      INSERT INTO doctor_notes (
        patient_id, doctor_user_id, author, note_type, content
      ) VALUES (
        @patient_id, @doctor_user_id, @author, @note_type, @content
      )
    `);

    const info = insertStmt.run({
      patient_id,
      doctor_user_id: req.user.id,
      author: resolvedAuthor,
      note_type,
      content,
    });

    const createdRow = db
      .prepare(`
        SELECT
          dn.*,
          p.first_name AS patient_first_name,
          p.last_name  AS patient_last_name,
          u.email      AS doctor_email
        FROM doctor_notes dn
        LEFT JOIN patients p ON dn.patient_id = p.id
        LEFT JOIN users u ON dn.doctor_user_id = u.id
        WHERE dn.id = ?
      `)
      .get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      meta: {
        notice: CLINICAL_NOTES_NOTICE,
      },
      data: formatNoteRow(createdRow),
    });
  })
);

module.exports = router;
