'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const DEMO_NOTES_NOTICE =
  'DEMO-ONLY: Fictional clinician note for local demonstration purposes only. No real medical professional has authored or reviewed this record.';

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
    .default('Dr. Attending (Demo)')
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
    patient_name:
      row.patient_first_name && row.patient_last_name
        ? `${row.patient_first_name} ${row.patient_last_name} (Demo)`
        : null,
    author: row.author,
    note_type: row.note_type,
    content: row.content,
    is_fictional_demo_note: true,
    demo_label: 'FICTIONAL DEMO NOTE — NOT REAL MEDICAL ADVICE OR CLINICAL DOCUMENTATION',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/notes
 * List saved demo notes with optional patient_id and note_type filtering and pagination.
 */
router.get(
  '/',
  validate(listNotesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, patient_id, note_type } = req.validatedQuery;
    const offset = (page - 1) * limit;

    // If patient_id filter is provided, verify the demo patient exists
    if (patient_id !== undefined) {
      const patientExists = db
        .prepare('SELECT id FROM patients WHERE id = ?')
        .get(patient_id);
      if (!patientExists) {
        const err = new Error(`Demo patient with ID ${patient_id} not found`);
        err.status = 404;
        throw err;
      }
    }

    const conditions = [];
    const params = { limit, offset };

    if (patient_id !== undefined) {
      conditions.push('dn.patient_id = @patient_id');
      params.patient_id = patient_id;
    }
    if (note_type !== undefined) {
      conditions.push('dn.note_type = @note_type');
      params.note_type = note_type;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db
      .prepare(`SELECT COUNT(*) AS count FROM doctor_notes dn ${whereClause}`)
      .get(params).count;

    const rows = db
      .prepare(`
        SELECT
          dn.*,
          p.first_name AS patient_first_name,
          p.last_name  AS patient_last_name
        FROM doctor_notes dn
        LEFT JOIN patients p ON dn.patient_id = p.id
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
        demo_notice: DEMO_NOTES_NOTICE,
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
 * Create a new fictional demo note linked to an existing demo patient.
 */
router.post(
  '/',
  validate(createNoteSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { patient_id, author, note_type, content } = req.body;

    // Verify demo patient exists
    const patient = db
      .prepare('SELECT id, first_name, last_name FROM patients WHERE id = ?')
      .get(patient_id);

    if (!patient) {
      const err = new Error(`Demo patient with ID ${patient_id} not found`);
      err.status = 404;
      throw err;
    }

    const insertStmt = db.prepare(`
      INSERT INTO doctor_notes (
        patient_id, author, note_type, content
      ) VALUES (
        @patient_id, @author, @note_type, @content
      )
    `);

    const info = insertStmt.run({
      patient_id,
      author,
      note_type,
      content,
    });

    const createdRow = db
      .prepare(`
        SELECT
          dn.*,
          p.first_name AS patient_first_name,
          p.last_name  AS patient_last_name
        FROM doctor_notes dn
        LEFT JOIN patients p ON dn.patient_id = p.id
        WHERE dn.id = ?
      `)
      .get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTES_NOTICE,
      },
      data: formatNoteRow(createdRow),
    });
  })
);

module.exports = router;
