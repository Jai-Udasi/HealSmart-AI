'use strict';

const { getDb } = require('../db/database');

/**
 * GET /api/health
 * Returns server status, uptime, and basic DB connectivity check.
 */
function health(req, res) {
  const start = process.hrtime.bigint();

  // Verify DB is reachable
  let dbStatus = 'ok';
  let dbVersion = null;
  try {
    const db = getDb();
    dbVersion = db.prepare('SELECT sqlite_version() AS ver').get().ver;
  } catch (err) {
    dbStatus = 'error';
    console.error('[Health] DB check failed:', err.message);
  }

  const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'HealSmartAI API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        sqlite_version: dbVersion,
        latency_ms: parseFloat(latencyMs.toFixed(3)),
      },
    },
  });
}

const router = require('express').Router();
router.get('/', health);

module.exports = router;
