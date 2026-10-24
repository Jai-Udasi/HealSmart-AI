'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Doctor Dashboard endpoints require verified authentication AND the 'doctor' role
router.use(requireAuth, requireRole('doctor'));

const DEMO_DASHBOARD_NOTICE =
  'DEMO-ONLY: This dashboard displays role-scoped aggregated statistics for patients explicitly assigned to this doctor account. No real doctor or licensed clinician has reviewed any symptom checks or records in this system.';

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const recentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional().messages({
    'any.only': 'severity filter must be one of [mild, moderate, severe]',
  }),
});

// SQL condition scoping patients strictly to those explicitly assigned to the authenticated doctor
const DOCTOR_PATIENT_SCOPE = `
  p.owner_user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM doctor_patient_assignments dpa
    WHERE dpa.patient_id = p.id AND dpa.doctor_user_id = @doctorId
  )
`;

const DOCTOR_CHECK_SCOPE = `
  (
    sc.patient_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = sc.patient_id
        AND ${DOCTOR_PATIENT_SCOPE}
    )
  )
`;

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/stats
 * Returns role-scoped SQLite aggregate counts across patients assigned to req.user.id.
 * Never exposes global patient aggregates across unassigned patients.
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const doctorId = req.user.id;

    const totalPatients = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM patients p
        WHERE ${DOCTOR_PATIENT_SCOPE}
      `)
      .get({ doctorId }).count;

    const totalSymptomChecks = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
      `)
      .get({ doctorId }).count;

    const totalDoctorNotes = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM doctor_notes dn
        JOIN patients p ON dn.patient_id = p.id
        WHERE ${DOCTOR_PATIENT_SCOPE}
      `)
      .get({ doctorId }).count;

    const emergencyChecksCount = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
          AND json_extract(sc.response, '$.emergency_safety.is_emergency_warning') = 1
      `)
      .get({ doctorId }).count;

    const severityRows = db
      .prepare(`
        SELECT sc.severity, COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
        GROUP BY sc.severity
      `)
      .all({ doctorId });

    const severityBreakdown = { mild: 0, moderate: 0, severe: 0 };
    for (const row of severityRows) {
      if (row.severity in severityBreakdown) {
        severityBreakdown[row.severity] = row.count;
      }
    }

    const checksLast24h = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
          AND sc.created_at >= datetime('now', '-1 day')
      `)
      .get({ doctorId }).count;

    const checksLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
          AND sc.created_at >= datetime('now', '-7 days')
      `)
      .get({ doctorId }).count;

    const notesLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM doctor_notes dn
        JOIN patients p ON dn.patient_id = p.id
        WHERE ${DOCTOR_PATIENT_SCOPE}
          AND dn.created_at >= datetime('now', '-7 days')
      `)
      .get({ doctorId }).count;

    const patientsLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM patients p
        WHERE ${DOCTOR_PATIENT_SCOPE}
          AND p.created_at >= datetime('now', '-7 days')
      `)
      .get({ doctorId }).count;

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_DASHBOARD_NOTICE,
        access_scope: 'assigned_patients_only',
      },
      data: {
        total_patients: totalPatients,
        total_symptom_checks: totalSymptomChecks,
        total_doctor_notes: totalDoctorNotes,
        emergency_warning_checks: emergencyChecksCount,
        severity_breakdown: severityBreakdown,
        recent_activity: {
          symptom_checks_last_24h: checksLast24h,
          symptom_checks_last_7d: checksLast7d,
          doctor_notes_last_7d: notesLast7d,
          new_patients_last_7d: patientsLast7d,
        },
      },
    });
  })
);

/**
 * GET /api/dashboard/recent
 * Returns paginated recent symptom checks scoped strictly to the authenticated doctor's assigned patients.
 */
router.get(
  '/recent',
  validate(recentQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, severity } = req.validatedQuery;
    const offset = (page - 1) * limit;
    const doctorId = req.user.id;

    const severityClause = severity ? 'AND sc.severity = @severity' : '';
    const params = {
      doctorId,
      limit,
      offset,
      ...(severity ? { severity } : {}),
    };

    const total = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks sc
        WHERE ${DOCTOR_CHECK_SCOPE}
          ${severityClause}
      `)
      .get(params).count;

    const rows = db
      .prepare(`
        SELECT
          sc.id,
          sc.patient_id,
          p.first_name AS patient_first_name,
          p.last_name  AS patient_last_name,
          sc.symptoms,
          sc.duration,
          sc.severity,
          sc.response,
          sc.created_at
        FROM symptom_checks sc
        LEFT JOIN patients p ON sc.patient_id = p.id
        WHERE ${DOCTOR_CHECK_SCOPE}
          ${severityClause}
        ORDER BY sc.id DESC
        LIMIT @limit OFFSET @offset
      `)
      .all(params);

    const recentChecks = rows.map((row) => {
      let parsedSymptoms = [];
      let parsedResponse = null;

      try {
        parsedSymptoms = JSON.parse(row.symptoms);
      } catch (_e) {
        parsedSymptoms = [row.symptoms];
      }

      try {
        parsedResponse = JSON.parse(row.response);
      } catch (_e) {
        parsedResponse = null;
      }

      const isEmergencyWarning = Boolean(
        parsedResponse?.emergency_safety?.is_emergency_warning
      );
      const matchedCategories = Array.isArray(parsedResponse?.matched_categories)
        ? parsedResponse.matched_categories.map((c) => c.category)
        : [];

      return {
        id: row.id,
        patient_id: row.patient_id,
        patient_name:
          row.patient_first_name && row.patient_last_name
            ? `${row.patient_first_name} ${row.patient_last_name}`
            : 'Assigned Patient',
        symptoms: parsedSymptoms,
        duration: row.duration,
        severity: row.severity,
        is_emergency_warning: isEmergencyWarning,
        warning_level: parsedResponse?.emergency_safety?.warning_level || 'STANDARD_SAFETY_NOTICE',
        matched_categories: matchedCategories,
        created_at: row.created_at,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_DASHBOARD_NOTICE,
        access_scope: 'assigned_patients_only',
      },
      data: {
        recent_checks: recentChecks,
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
