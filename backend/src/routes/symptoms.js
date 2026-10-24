'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, canAccessPatient } = require('../middleware/auth');
const {
  MEDICAL_DISCLAIMER,
  LOCAL_ENGINE_STATEMENT,
} = require('../services/symptomEngine');
const {
  evaluateSymptomsWithOptionalAi,
  getOpenAiConfigStatus,
} = require('../services/openaiService');

const router = express.Router();

// All symptom endpoints require authentication
router.use(requireAuth);

const EDUCATIONAL_NOTICE =
  'NON-DIAGNOSTIC EDUCATIONAL OUTPUT: This service provides general health education only and cannot diagnose conditions or replace professional medical care.';

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const checkSymptomsSchema = Joi.object({
  symptoms: Joi.array()
    .items(Joi.string().trim().min(1).max(120))
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.base': 'symptoms must be an array of symptom strings',
      'array.min': 'At least one symptom must be provided',
      'string.empty': 'Symptom strings cannot be empty',
    }),
  duration: Joi.string().trim().max(100).allow(null, '').default(null),
  severity: Joi.string()
    .valid('mild', 'moderate', 'severe')
    .default('mild')
    .messages({
      'any.only': 'severity must be one of [mild, moderate, severe]',
    }),
  additional_notes: Joi.string().trim().max(1000).allow(null, '').default(null),
  patient_id: Joi.number()
    .integer()
    .positive()
    .allow(null)
    .default(null)
    .messages({
      'number.base': 'patient_id must be a valid positive integer',
      'number.integer': 'patient_id must be an integer',
      'number.positive': 'patient_id must be a positive integer',
    }),
});

const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  patient_id: Joi.number().integer().positive().optional().messages({
    'number.base': 'patient_id filter must be a positive integer',
    'number.integer': 'patient_id filter must be an integer',
    'number.positive': 'patient_id filter must be a positive integer',
  }),
});

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/symptoms/engine-status
 * Returns non-sensitive information about the active symptom engine
 * (Free Smart Local Engine by default vs Optional OpenAI Assistant).
 */
router.get(
  '/engine-status',
  asyncHandler(async (_req, res) => {
    const status = getOpenAiConfigStatus();
    return res.status(200).json({
      success: true,
      data: {
        active_engine: status.active_engine,
        engine_label:
          status.active_engine === 'openai'
            ? 'OpenAI Assistant (with Local Emergency Safety Rules)'
            : 'Free Smart Assistant (Local Deterministic Engine)',
        openai_enabled: status.openai_enabled,
        openai_configured: status.openai_configured,
        free_local_engine_always_active: true,
      },
    });
  })
);

/**
 * POST /api/symptoms/check
 * Evaluate symptoms using the Free Smart Symptom Engine (and optional OpenAI adapter if enabled)
 * and persist to symptom_checks.
 */
router.post(
  '/check',
  validate(checkSymptomsSchema, 'body'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { symptoms, duration, severity, additional_notes, patient_id } = req.body;
    const normalizedDuration = duration === '' ? null : duration;
    const normalizedNotes = additional_notes === '' ? null : additional_notes;

    // Verify patient_id exists and is accessible by req.user if provided,
    // or auto-link to the authenticated patient's own profile if one exists.
    let resolvedPatientId = patient_id ?? null;
    let patientRecord = null;
    if (resolvedPatientId !== null) {
      const fullPatient = db
        .prepare('SELECT * FROM patients WHERE id = ?')
        .get(resolvedPatientId);
      if (!fullPatient) {
        const err = new Error(`Patient record with ID ${resolvedPatientId} not found`);
        err.status = 404;
        throw err;
      }
      if (!canAccessPatient(db, req.user, fullPatient)) {
        const err = new Error(
          'Access denied: You are not authorized to link symptom checks to this patient record.'
        );
        err.status = 403;
        throw err;
      }
      patientRecord = {
        id: fullPatient.id,
        first_name: fullPatient.first_name,
        last_name: fullPatient.last_name,
      };
    } else if (req.user.role === 'patient') {
      const ownProfile = db
        .prepare('SELECT id, first_name, last_name FROM patients WHERE owner_user_id = ? LIMIT 1')
        .get(req.user.id);
      if (ownProfile) {
        resolvedPatientId = ownProfile.id;
        patientRecord = {
          id: ownProfile.id,
          first_name: ownProfile.first_name,
          last_name: ownProfile.last_name,
        };
      }
    }

    // Evaluate symptoms (patient PII/identifiers are NEVER passed to the evaluation service)
    const evaluation = await evaluateSymptomsWithOptionalAi({
      symptoms,
      duration: normalizedDuration,
      severity,
      additional_notes: normalizedNotes,
    });

    const engineUsed = evaluation.engine_used || 'local_rule_engine';

    const insertStmt = db.prepare(`
      INSERT INTO symptom_checks (
        user_id, patient_id, symptoms, duration, severity, additional_notes, engine_used, response, disclaimer
      ) VALUES (
        @user_id, @patient_id, @symptoms, @duration, @severity, @additional_notes, @engine_used, @response, @disclaimer
      )
    `);

    const info = insertStmt.run({
      user_id: req.user.id,
      patient_id: resolvedPatientId,
      symptoms: JSON.stringify(symptoms),
      duration: normalizedDuration,
      severity,
      additional_notes: normalizedNotes,
      engine_used: engineUsed,
      response: JSON.stringify(evaluation),
      disclaimer: MEDICAL_DISCLAIMER,
    });

    const savedRow = db
      .prepare('SELECT * FROM symptom_checks WHERE id = ?')
      .get(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      meta: {
        educational_notice: EDUCATIONAL_NOTICE,
        engine_notice: evaluation.engine_statement || LOCAL_ENGINE_STATEMENT,
        engine_used: engineUsed,
      },
      data: {
        id: savedRow.id,
        engine_used: engineUsed,
        engine_label: evaluation.engine_label,
        patient_id: savedRow.patient_id,
        patient: patientRecord,
        symptoms,
        duration: savedRow.duration,
        severity: savedRow.severity,
        additional_notes: savedRow.additional_notes,
        evaluation,
        disclaimer: savedRow.disclaimer,
        created_at: savedRow.created_at,
      },
    });
  })
);

/**
 * GET /api/symptoms/history
 * Retrieve paginated symptom-check history with optional patient_id filter.
 */
router.get(
  '/history',
  validate(historyQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, patient_id } = req.validatedQuery;
    const offset = (page - 1) * limit;
    const userId = req.user.id;
    const isDoctor = req.user.role === 'doctor';

    let total;
    let rows;

    if (patient_id !== undefined) {
      const targetPatient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id);
      if (!targetPatient) {
        const err = new Error(`Patient record with ID ${patient_id} not found`);
        err.status = 404;
        throw err;
      }
      if (!canAccessPatient(db, req.user, targetPatient)) {
        const err = new Error(
          'Access denied: You are not authorized to view symptom history for this patient.'
        );
        err.status = 403;
        throw err;
      }

      total = db
        .prepare('SELECT COUNT(*) AS count FROM symptom_checks WHERE patient_id = @patient_id')
        .get({ patient_id }).count;

      rows = db
        .prepare(`
          SELECT sc.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
          FROM symptom_checks sc
          LEFT JOIN patients p ON sc.patient_id = p.id
          WHERE sc.patient_id = @patient_id
          ORDER BY sc.id DESC
          LIMIT @limit OFFSET @offset
        `)
        .all({ patient_id, limit, offset });
    } else {
      const scopeWhere = isDoctor
        ? `(sc.user_id = @userId OR (sc.patient_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM doctor_patient_assignments dpa
             JOIN patients p2 ON dpa.patient_id = p2.id
             WHERE dpa.patient_id = sc.patient_id
               AND dpa.doctor_user_id = @userId
               AND p2.owner_user_id IS NOT NULL
           )))`
        : `(sc.user_id = @userId OR (sc.patient_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM patients p2
             WHERE p2.id = sc.patient_id
               AND p2.owner_user_id = @userId
           )))`;

      total = db
        .prepare(`SELECT COUNT(*) AS count FROM symptom_checks sc WHERE ${scopeWhere}`)
        .get({ userId }).count;

      rows = db
        .prepare(`
          SELECT sc.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name
          FROM symptom_checks sc
          LEFT JOIN patients p ON sc.patient_id = p.id
          WHERE ${scopeWhere}
          ORDER BY sc.id DESC
          LIMIT @limit OFFSET @offset
        `)
        .all({ userId, limit, offset });
    }

    const formattedChecks = rows.map((row) => {
      let parsedSymptoms = [];
      let parsedEvaluation = null;
      try {
        parsedSymptoms = JSON.parse(row.symptoms);
      } catch (_e) {
        parsedSymptoms = [row.symptoms];
      }
      try {
        parsedEvaluation = JSON.parse(row.response);
      } catch (_e) {
        parsedEvaluation = { raw: row.response };
      }

      const engineUsed =
        row.engine_used || parsedEvaluation?.engine_used || 'local_rule_engine';

      return {
        id: row.id,
        engine_used: engineUsed,
        patient_id: row.patient_id,
        patient_name:
          row.patient_first_name && row.patient_last_name
            ? `${row.patient_first_name} ${row.patient_last_name}`
            : null,
        symptoms: parsedSymptoms,
        duration: row.duration,
        severity: row.severity,
        additional_notes: row.additional_notes || null,
        evaluation: parsedEvaluation,
        disclaimer: row.disclaimer,
        created_at: row.created_at,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      meta: {
        educational_notice: EDUCATIONAL_NOTICE,
        engine_notice: LOCAL_ENGINE_STATEMENT,
      },
      data: {
        checks: formattedChecks,
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

module.exports = router;
