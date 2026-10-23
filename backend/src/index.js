'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const { getDb, closeDb } = require('./db/database');

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ── Security & transport middleware ────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:4173', // Vite preview
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Rate limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests, please try again later.' },
  },
});
app.use('/api', limiter);

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Request logger (dev only) ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);

// Placeholder stubs for future phases (returns 501 Not Implemented)
const stub = (label) => (_req, res) =>
  res.status(501).json({ success: false, error: { message: `${label} — coming in a later phase` } });

app.use('/api/patients',  stub('Patients API'));
app.use('/api/symptoms',  stub('Symptoms API'));
app.use('/api/dashboard', stub('Dashboard API'));
app.use('/api/notes',     stub('Notes API'));

// ── 404 & error handlers ───────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Initialise DB then start server ───────────────────────────────────────
try {
  getDb(); // runs migrations synchronously
} catch (err) {
  console.error('[FATAL] Cannot initialise database:', err.message);
  process.exit(1);
}

const server = app.listen(PORT, () => {
  console.log(`\n🏥  HealSmartAI API running`);
  console.log(`    http://localhost:${PORT}/api/health`);
  console.log(`    ENV: ${process.env.NODE_ENV || 'development'}\n`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully…`);
  server.close(() => {
    closeDb();
    console.log('[Server] Closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  shutdown('uncaughtException');
});

module.exports = app; // for testing
