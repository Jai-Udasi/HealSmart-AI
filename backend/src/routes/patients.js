'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const DEMO_NOTICE = 'DEMO-ONLY: Fictional patient record for demonstration purposes. Do not store real personal or protected health information (PHI).';

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'Patient ID must be a valid integer',
    'number.integer': 'Patient ID must be an integer',
    'number.positive': 'Patient ID must be a positive number',
  }),
});

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow('').default(''),
});

const VALID_BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const createPatientSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(80).required(),
  last_name: Joi.string().trim().min(1).max(80).required(),
  date_of_birth: Joi.string()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .required()
    .messages({
      'string.pattern.base': 'date_of_birth must be in YYYY-MM-DD format',
    }),
  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(150).allow(null, '').default(null),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-() .]{7,25}$/)
    .allow(null, '')
    .default(null)
    .messages({
      'string.pattern.base': 'phone must be a valid phone number (7-25 characters)',
    }),
  address: Joi.string().trim().max(255).allow(null, '').default(null),
  blood_type: Joi.string().valid(...VALID_BLOOD_TYPES).allow(null, '').default(null),
  allergies: Joi.string().trim().max(500).allow(null, '').default(null),
  medications: Joi.string().trim().max(500).allow(null, '').default(null),
  notes: Joi.string().trim().max(1000).allow(null, '').default(null),
});

const updatePatientSchema = Joi.object({
  first_name: Joi.string().trim().min(1).max(80),
  last_name: Joi.string().trim().min(1).max(80),
  date_of_birth: Joi.string()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .messages({
      'string.pattern.base': 'date_of_birth must be in YYYY-MM-DD format',
    }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(150).allow(null, ''),
  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-() .]{7,25}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'phone must be a valid phone number (7-25 characters)',
    }),
  address: Joi.string().trim().max(255).allow(null, ''),
  blood_type: Joi.string().valid(...VALID_BLOOD_TYPES).allow(null, ''),
  allergies: Joi.string().trim().max(500).allow(null, ''),
  medications: Joi.string().trim().max(500).allow(null, ''),
  notes: Joi.string().trim().max(1000).allow(null, ''),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

// Helper to normalize empty strings to null for nullable columns (especially UNIQUE email)
function normalizeNullable(obj) {
  const nullableFields = ['email', 'phone', 'address', 'blood_type', 'allergies', 'medications', 'notes'];
  const result = { ...obj };
  for (const key of nullableFields) {
    if (key in result && result[key] === '') {
      result[key] = null;
    }
  }
  return result;
}

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/patients
 * List patients with pagination and optional search filter.
 */
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, search } = req.validatedQuery;
    const offset = (page - 1) * limit;

    let countStmt;
    let listStmt;
    let total;
    let rows;

    if (search) {
      const pattern = `%${search}%`;
      countStmt = db.prepare(`
        SELECT COUNT(*) AS count FROM patients
        WHERE first_name LIKE @pattern
           OR last_name LIKE @pattern
           OR email LIKE @pattern
           OR phone LIKE @pattern
      `);
      listStmt = db.prepare(`
        SELECT * FROM patients
        WHERE first_name LIKE @pattern
           OR last_name LIKE @pattern
           OR email LIKE @pattern
           OR phone LIKE @pattern
        ORDER BY id DESC
        LIMIT @limit OFFSET @offset
      `);
      total = countStmt.get({ pattern }).count;
      rows = listStmt.all({ pattern, limit, offset });
    } else {
      countStmt = db.prepare('SELECT COUNT(*) AS count FROM patients');
      listStmt = db.prepare('SELECT * FROM patients ORDER BY id DESC LIMIT @limit OFFSET @offset');
      total = countStmt.get().count;
      rows = listStmt.all({ limit, offset });
    }

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTICE,
      },
      data: {
        patients: rows,
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
 * POST /api/patients
 * Create a new fictional demo patient record.
 */
router.post(
  '/',
  validate(createPatientSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const payload = normalizeNullable(req.body);

    const insertStmt = db.prepare(`
      INSERT INTO patients (
        first_name, last_name, date_of_birth, gender,
        email, phone, address, blood_type,
        allergies, medications, notes
      ) VALUES (
        @first_name, @last_name, @date_of_birth, @gender,
        @email, @phone, @address, @blood_type,
        @allergies, @medications, @notes
      )
    `);

    const info = insertStmt.run(payload);
    const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTICE,
      },
      data: created,
    });
  })
);

/**
 * GET /api/patients/:id
 * Retrieve a single patient by ID.
 */
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id } = req.validatedParams;

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTICE,
      },
      data: patient,
    });
  })
);

/**
 * PUT /api/patients/:id
 * Update an existing patient by ID.
 */
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updatePatientSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id } = req.validatedParams;

    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!existing) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    const updates = normalizeNullable(req.body);
    const merged = {
      first_name: updates.first_name ?? existing.first_name,
      last_name: updates.last_name ?? existing.last_name,
      date_of_birth: updates.date_of_birth ?? existing.date_of_birth,
      gender: updates.gender ?? existing.gender,
      email: 'email' in updates ? updates.email : existing.email,
      phone: 'phone' in updates ? updates.phone : existing.phone,
      address: 'address' in updates ? updates.address : existing.address,
      blood_type: 'blood_type' in updates ? updates.blood_type : existing.blood_type,
      allergies: 'allergies' in updates ? updates.allergies : existing.allergies,
      medications: 'medications' in updates ? updates.medications : existing.medications,
      notes: 'notes' in updates ? updates.notes : existing.notes,
      id,
    };

    const updateStmt = db.prepare(`
      UPDATE patients
      SET first_name    = @first_name,
          last_name     = @last_name,
          date_of_birth = @date_of_birth,
          gender        = @gender,
          email         = @email,
          phone         = @phone,
          address       = @address,
          blood_type    = @blood_type,
          allergies     = @allergies,
          medications   = @medications,
          notes         = @notes,
          updated_at    = datetime('now')
      WHERE id = @id
    `);

    updateStmt.run(merged);
    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTICE,
      },
      data: updated,
    });
  })
);

/**
 * DELETE /api/patients/:id
 * Delete a patient by ID.
 */
router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id } = req.validatedParams;

    const existing = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!existing) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    db.prepare('DELETE FROM patients WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_NOTICE,
      },
      data: {
        message: `Patient with ID ${id} deleted successfully`,
        id,
      },
    });
  })
);

module.exports = router;
