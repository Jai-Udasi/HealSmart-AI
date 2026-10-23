'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/healsmart.db';
const resolvedPath = path.resolve(DB_PATH);

// Ensure the data directory exists
const dataDir = path.dirname(resolvedPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name  TEXT    NOT NULL,
      last_name   TEXT    NOT NULL,
      date_of_birth TEXT  NOT NULL,
      gender      TEXT    NOT NULL CHECK(gender IN ('male','female','other','prefer_not_to_say')),
      email       TEXT    UNIQUE,
      phone       TEXT,
      address     TEXT,
      blood_type  TEXT,
      allergies   TEXT,
      medications TEXT,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS symptom_checks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id    INTEGER REFERENCES patients(id) ON DELETE SET NULL,
      symptoms      TEXT    NOT NULL,
      duration      TEXT,
      severity      TEXT    NOT NULL CHECK(severity IN ('mild','moderate','severe')),
      response      TEXT    NOT NULL,
      disclaimer    TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctor_notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      author      TEXT    NOT NULL DEFAULT 'Dr. Attending',
      note_type   TEXT    NOT NULL DEFAULT 'general' CHECK(note_type IN ('general','diagnosis','prescription','follow_up','lab_result')),
      content     TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_patients_email     ON patients(email);
    CREATE INDEX IF NOT EXISTS idx_symptom_patient    ON symptom_checks(patient_id);
    CREATE INDEX IF NOT EXISTS idx_notes_patient      ON doctor_notes(patient_id);
  `);

  console.log(`[DB] Schema ready → ${resolvedPath}`);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
