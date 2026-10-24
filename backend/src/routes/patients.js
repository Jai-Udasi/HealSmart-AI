'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, canAccessPatient } = require('../middleware/auth');

const router = express.Router();

// All patient endpoints require a verified Firebase ID token
router.use(requireAuth);

const EDUCATIONAL_NOTICE =
  'HealSmartAI Patient Profile — Educational health portal record stored in local SQLite. Not a HIPAA-certified electronic health record.';

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const idParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'Patient ID must be a valid integer',
    'number.integer': 'Patient ID must be an integer',
    'number.positive': 'Patient ID must be a positive number',
  }),
});

const revokeDoctorParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required(),
  doctorUserId: Joi.number().integer().positive().required(),
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

const assignDoctorSchema = Joi.object({
  doctor_user_id: Joi.number().integer().positive().required().messages({
    'any.required': 'doctor_user_id is required',
    'number.base': 'doctor_user_id must be a positive integer',
  }),
});

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

function getAssignedDoctorsForPatient(db, patientId) {
  return db
    .prepare(`
      SELECT u.id, u.email, u.display_name, dpa.assigned_at
      FROM doctor_patient_assignments dpa
      JOIN users u ON dpa.doctor_user_id = u.id
      WHERE dpa.patient_id = ?
      ORDER BY dpa.id ASC
    `)
    .all(patientId);
}

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/patients/me
 * Retrieves the authenticated user's own linked patient profile (or null if not yet created).
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const profile = db
      .prepare('SELECT * FROM patients WHERE owner_user_id = ? ORDER BY id ASC LIMIT 1')
      .get(req.user.id);

    if (!profile) {
      return res.status(200).json({
        success: true,
        meta: { notice: EDUCATIONAL_NOTICE },
        data: { profile: null },
      });
    }

    const assignedDoctors = getAssignedDoctorsForPatient(db, profile.id);
    return res.status(200).json({
      success: true,
      meta: { notice: EDUCATIONAL_NOTICE },
      data: {
        profile: {
          ...profile,
          assigned_doctors: assignedDoctors,
        },
      },
    });
  })
);

/**
 * PUT /api/patients/me
 * Creates or updates the authenticated user's single owned patient profile in SQLite.
 * Guarantees 1-to-1 profile linking and prevents duplicate profiles per account.
 */
router.put(
  '/me',
  validate(createPatientSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const payload = normalizeNullable(req.body);
    const existing = db
      .prepare('SELECT * FROM patients WHERE owner_user_id = ? ORDER BY id ASC LIMIT 1')
      .get(req.user.id);

    try {
      if (!existing) {
        const info = db
          .prepare(`
            INSERT INTO patients (
              owner_user_id, first_name, last_name, date_of_birth, gender,
              email, phone, address, blood_type,
              allergies, medications, notes
            ) VALUES (
              @owner_user_id, @first_name, @last_name, @date_of_birth, @gender,
              @email, @phone, @address, @blood_type,
              @allergies, @medications, @notes
            )
          `)
          .run({
            ...payload,
            owner_user_id: req.user.id,
          });

        const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
        return res.status(201).json({
          success: true,
          meta: { notice: EDUCATIONAL_NOTICE },
          data: {
            ...created,
            assigned_doctors: [],
          },
        });
      }

      db.prepare(`
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
        WHERE id = @id AND owner_user_id = @owner_user_id
      `).run({
        ...payload,
        id: existing.id,
        owner_user_id: req.user.id,
      });

      const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(existing.id);
      const assignedDoctors = getAssignedDoctorsForPatient(db, existing.id);

      return res.status(200).json({
        success: true,
        meta: { notice: EDUCATIONAL_NOTICE },
        data: {
          ...updated,
          assigned_doctors: assignedDoctors,
        },
      });
    } catch (dbErr) {
      if (String(dbErr.code || '').startsWith('SQLITE_CONSTRAINT')) {
        const err = new Error('A patient record with that email address already exists.');
        err.status = 409;
        throw err;
      }
      throw dbErr;
    }
  })
);

/**
 * GET /api/patients
 * Role-scoped list of patient records with pagination and optional search filter.
 * - Patient role: only the profile where owner_user_id = req.user.id.
 * - Doctor role: strictly patients explicitly assigned in doctor_patient_assignments (or owned by the doctor).
 * - Never returns unowned legacy records (owner_user_id IS NULL).
 */
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, search } = req.validatedQuery;
    const offset = (page - 1) * limit;
    const userId = req.user.id;
    const isDoctor = req.user.role === 'doctor';

    const scopeClause = isDoctor
      ? `EXISTS (
           SELECT 1 FROM doctor_patient_assignments dpa
           WHERE dpa.patient_id = p.id AND dpa.doctor_user_id = @userId
         )`
      : `p.owner_user_id = @userId`;

    const searchClause = search
      ? `AND (
           p.first_name LIKE @pattern
           OR p.last_name LIKE @pattern
           OR p.email LIKE @pattern
           OR p.phone LIKE @pattern
         )`
      : '';

    const params = {
      userId,
      limit,
      offset,
      ...(search ? { pattern: `%${search}%` } : {}),
    };

    const total = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM patients p
        WHERE p.owner_user_id IS NOT NULL
          AND ${scopeClause}
          ${searchClause}
      `)
      .get(params).count;

    const rows = db
      .prepare(`
        SELECT p.*
        FROM patients p
        WHERE p.owner_user_id IS NOT NULL
          AND ${scopeClause}
          ${searchClause}
        ORDER BY p.id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all(params)
      .map((row) => ({
        ...row,
        assigned_doctors: getAssignedDoctorsForPatient(db, row.id),
      }));

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      meta: {
        notice: EDUCATIONAL_NOTICE,
        access_scope: isDoctor ? 'assigned_patients_only' : 'owned_profile_only',
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
 * Create a patient profile owned by the authenticated user.
 * Prevents duplicate patient profiles for the same authenticated user (409 Conflict).
 */
router.post(
  '/',
  validate(createPatientSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const existingProfile = db
      .prepare('SELECT id FROM patients WHERE owner_user_id = ?')
      .get(req.user.id);

    if (existingProfile) {
      const err = new Error(
        'A patient profile already exists for your account. Please update your existing profile instead of creating a duplicate.'
      );
      err.status = 409;
      err.code = 'PROFILE_ALREADY_EXISTS';
      throw err;
    }

    const payload = normalizeNullable(req.body);

    let info;
    try {
      const insertStmt = db.prepare(`
        INSERT INTO patients (
          owner_user_id, first_name, last_name, date_of_birth, gender,
          email, phone, address, blood_type,
          allergies, medications, notes
        ) VALUES (
          @owner_user_id, @first_name, @last_name, @date_of_birth, @gender,
          @email, @phone, @address, @blood_type,
          @allergies, @medications, @notes
        )
      `);

      info = insertStmt.run({
        ...payload,
        owner_user_id: req.user.id,
      });
    } catch (dbErr) {
      if (String(dbErr.code || '').startsWith('SQLITE_CONSTRAINT')) {
        const err = new Error('A patient profile with that email or account already exists.');
        err.status = 409;
        throw err;
      }
      throw dbErr;
    }

    const created = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      meta: {
        notice: EDUCATIONAL_NOTICE,
      },
      data: {
        ...created,
        assigned_doctors: [],
      },
    });
  })
);

/**
 * GET /api/patients/:id
 * Retrieve a single patient by ID (requires ownership or explicit doctor assignment).
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

    if (!canAccessPatient(db, req.user, patient)) {
      const err = new Error('Access denied: You are not authorized to view this patient record.');
      err.status = 403;
      throw err;
    }

    const assignedDoctors = getAssignedDoctorsForPatient(db, id);

    return res.status(200).json({
      success: true,
      meta: {
        notice: EDUCATIONAL_NOTICE,
      },
      data: {
        ...patient,
        assigned_doctors: assignedDoctors,
      },
    });
  })
);

/**
 * POST /api/patients/:id/assign-doctor
 * Allows the owner of a patient record to explicitly assign a doctor to this patient.
 */
router.post(
  '/:id/assign-doctor',
  validate(idParamSchema, 'params'),
  validate(assignDoctorSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id } = req.validatedParams;
    const { doctor_user_id } = req.body;

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    if (patient.owner_user_id === null || patient.owner_user_id !== req.user.id) {
      const err = new Error('Access denied: Only the owner of this patient record can assign a doctor.');
      err.status = 403;
      throw err;
    }

    const doctorUser = db
      .prepare("SELECT id, email, display_name, role FROM users WHERE id = ? AND role = 'doctor'")
      .get(doctor_user_id);

    if (!doctorUser) {
      const err = new Error(`Doctor user with ID ${doctor_user_id} not found`);
      err.status = 404;
      throw err;
    }

    db.prepare(`
      INSERT OR IGNORE INTO doctor_patient_assignments (doctor_user_id, patient_id)
      VALUES (?, ?)
    `).run(doctor_user_id, id);

    const assignedDoctors = getAssignedDoctorsForPatient(db, id);

    return res.status(200).json({
      success: true,
      data: {
        patient_id: id,
        doctor: doctorUser,
        assigned_doctors: assignedDoctors,
      },
    });
  })
);

/**
 * DELETE /api/patients/:id/assign-doctor/:doctorUserId
 * Allows the owner of a patient record to revoke a doctor's access immediately.
 */
router.delete(
  '/:id/assign-doctor/:doctorUserId',
  validate(revokeDoctorParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id, doctorUserId } = req.validatedParams;

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    if (patient.owner_user_id === null || patient.owner_user_id !== req.user.id) {
      const err = new Error('Access denied: Only the owner of this patient record can revoke doctor access.');
      err.status = 403;
      throw err;
    }

    const info = db
      .prepare('DELETE FROM doctor_patient_assignments WHERE patient_id = ? AND doctor_user_id = ?')
      .run(id, doctorUserId);

    if (info.changes === 0) {
      const err = new Error(`Doctor #${doctorUserId} is not currently assigned to this patient record.`);
      err.status = 404;
      throw err;
    }

    const assignedDoctors = getAssignedDoctorsForPatient(db, id);

    return res.status(200).json({
      success: true,
      data: {
        patient_id: id,
        revoked: true,
        revoked_doctor_user_id: doctorUserId,
        assigned_doctors: assignedDoctors,
      },
    });
  })
);

/**
 * POST /api/patients/:id/revoke-doctor
 * Alternative POST endpoint to revoke a doctor's access by doctor_user_id in body.
 */
router.post(
  '/:id/revoke-doctor',
  validate(idParamSchema, 'params'),
  validate(assignDoctorSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { id } = req.validatedParams;
    const { doctor_user_id } = req.body;

    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      const err = new Error(`Patient with ID ${id} not found`);
      err.status = 404;
      throw err;
    }

    if (patient.owner_user_id === null || patient.owner_user_id !== req.user.id) {
      const err = new Error('Access denied: Only the owner of this patient record can revoke doctor access.');
      err.status = 403;
      throw err;
    }

    db.prepare('DELETE FROM doctor_patient_assignments WHERE patient_id = ? AND doctor_user_id = ?')
      .run(id, doctor_user_id);

    const assignedDoctors = getAssignedDoctorsForPatient(db, id);

    return res.status(200).json({
      success: true,
      data: {
        patient_id: id,
        revoked_doctor_user_id: doctor_user_id,
        assigned_doctors: assignedDoctors,
      },
    });
  })
);

/**
 * PUT /api/patients/:id
 * Update an existing patient by ID (requires ownership or explicit doctor assignment).
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

    if (!canAccessPatient(db, req.user, existing)) {
      const err = new Error('Access denied: You are not authorized to update this patient record.');
      err.status = 403;
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

    try {
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
    } catch (dbErr) {
      if (String(dbErr.code || '').startsWith('SQLITE_CONSTRAINT')) {
        const err = new Error('A patient record with that email address already exists.');
        err.status = 409;
        throw err;
      }
      throw dbErr;
    }

    const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    const assignedDoctors = getAssignedDoctorsForPatient(db, id);

    return res.status(200).json({
      success: true,
      meta: {
        notice: EDUCATIONAL_NOTICE,
      },
      data: {
        ...updated,
        assigned_doctors: assignedDoctors,
      },
    });
  })
);

/**
 * DELETE /api/patients/:id
 * Delete a patient by ID (only the patient record owner can delete).
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

    if (existing.owner_user_id === null || existing.owner_user_id !== req.user.id) {
      const err = new Error('Access denied: Only the owner of this patient record can delete it.');
      err.status = 403;
      throw err;
    }

    db.prepare('DELETE FROM patients WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      meta: {
        notice: EDUCATIONAL_NOTICE,
      },
      data: {
        message: `Patient profile #${id} deleted successfully`,
        id,
      },
    });
  })
);

module.exports = router;
