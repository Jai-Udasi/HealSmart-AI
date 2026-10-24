'use strict';

const express = require('express');
const Joi = require('joi');
const { getDb } = require('../db/database');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const DEMO_DASHBOARD_NOTICE =
  'DEMO-ONLY: This dashboard displays aggregated statistics from local fictional demonstration records. No real doctor or licensed clinician has reviewed any symptom checks or records in this system.';

// ── Joi Validation Schemas ─────────────────────────────────────────────────

const recentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional().messages({
    'any.only': 'severity filter must be one of [mild, moderate, severe]',
  }),
});

// ── Route Handlers ─────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/stats
 * Returns real SQLite aggregate counts across patients, symptom_checks, and doctor_notes.
 */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const db = getDb();

    const totalPatients = db
      .prepare('SELECT COUNT(*) AS count FROM patients')
      .get().count;

    const totalSymptomChecks = db
      .prepare('SELECT COUNT(*) AS count FROM symptom_checks')
      .get().count;

    const totalDoctorNotes = db
      .prepare('SELECT COUNT(*) AS count FROM doctor_notes')
      .get().count;

    // Count symptom checks where the rule engine flagged emergency_safety.is_emergency_warning = true
    const emergencyChecksCount = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks
        WHERE json_extract(response, '$.emergency_safety.is_emergency_warning') = 1
      `)
      .get().count;

    // Breakdown by severity
    const severityRows = db
      .prepare(`
        SELECT severity, COUNT(*) AS count
        FROM symptom_checks
        GROUP BY severity
      `)
      .all();

    const severityBreakdown = { mild: 0, moderate: 0, severe: 0 };
    for (const row of severityRows) {
      if (row.severity in severityBreakdown) {
        severityBreakdown[row.severity] = row.count;
      }
    }

    // Recent activity in the last 24 hours and 7 days based on SQLite datetime
    const checksLast24h = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks
        WHERE created_at >= datetime('now', '-1 day')
      `)
      .get().count;

    const checksLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM symptom_checks
        WHERE created_at >= datetime('now', '-7 days')
      `)
      .get().count;

    const notesLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM doctor_notes
        WHERE created_at >= datetime('now', '-7 days')
      `)
      .get().count;

    const patientsLast7d = db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM patients
        WHERE created_at >= datetime('now', '-7 days')
      `)
      .get().count;

    return res.status(200).json({
      success: true,
      meta: {
        demo_notice: DEMO_DASHBOARD_NOTICE,
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
 * Returns paginated recent symptom checks with fictional patient names, severity,
 * creation date, and emergency warning status.
 */
router.get(
  '/recent',
  validate(recentQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const { page, limit, severity } = req.validatedQuery;
    const offset = (page - 1) * limit;

    let total;
    let rows;

    if (severity) {
      total = db
        .prepare('SELECT COUNT(*) AS count FROM symptom_checks WHERE severity = @severity')
        .get({ severity }).count;

      rows = db
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
          WHERE sc.severity = @severity
          ORDER BY sc.id DESC
          LIMIT @limit OFFSET @offset
        `)
        .all({ severity, limit, offset });
    } else {
      total = db
        .prepare('SELECT COUNT(*) AS count FROM symptom_checks')
        .get().count;

      rows = db
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
          ORDER BY sc.id DESC
          LIMIT @limit OFFSET @offset
        `)
        .all({ limit, offset });
    }

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
            ? `${row.patient_first_name} ${row.patient_last_name} (Demo)`
            : 'Anonymous Demo User',
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
