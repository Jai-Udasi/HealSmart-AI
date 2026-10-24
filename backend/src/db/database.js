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

function hasColumn(dbInstance, tableName, columnName) {
  const columns = dbInstance.pragma(`table_info(${tableName})`);
  return columns.some((col) => col.name === columnName);
}

function runMigrations(dbInstance) {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      firebase_uid    TEXT    NOT NULL UNIQUE,
      email           TEXT    NOT NULL,
      display_name    TEXT,
      role            TEXT    NOT NULL DEFAULT 'patient' CHECK(role IN ('patient','doctor')),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
      first_name      TEXT    NOT NULL,
      last_name       TEXT    NOT NULL,
      date_of_birth   TEXT    NOT NULL,
      gender          TEXT    NOT NULL CHECK(gender IN ('male','female','other','prefer_not_to_say')),
      email           TEXT    UNIQUE,
      phone           TEXT,
      address         TEXT,
      blood_type      TEXT,
      allergies       TEXT,
      medications     TEXT,
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS symptom_checks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
      patient_id       INTEGER REFERENCES patients(id) ON DELETE SET NULL,
      symptoms         TEXT    NOT NULL,
      duration         TEXT,
      severity         TEXT    NOT NULL CHECK(severity IN ('mild','moderate','severe')),
      additional_notes TEXT,
      engine_used      TEXT    NOT NULL DEFAULT 'local_rule_engine',
      response         TEXT    NOT NULL,
      disclaimer       TEXT    NOT NULL,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctor_notes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      doctor_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author          TEXT    NOT NULL DEFAULT 'Attending Physician',
      note_type       TEXT    NOT NULL DEFAULT 'general' CHECK(note_type IN ('general','diagnosis','prescription','follow_up','lab_result')),
      content         TEXT    NOT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctor_patient_assignments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      assigned_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(doctor_user_id, patient_id)
    );
  `);

  // Safe non-destructive column migrations for existing databases
  if (!hasColumn(dbInstance, 'patients', 'owner_user_id')) {
    dbInstance.exec('ALTER TABLE patients ADD COLUMN owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  }
  if (!hasColumn(dbInstance, 'symptom_checks', 'user_id')) {
    dbInstance.exec('ALTER TABLE symptom_checks ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  }
  if (!hasColumn(dbInstance, 'symptom_checks', 'additional_notes')) {
    dbInstance.exec('ALTER TABLE symptom_checks ADD COLUMN additional_notes TEXT;');
  }
  if (!hasColumn(dbInstance, 'symptom_checks', 'engine_used')) {
    dbInstance.exec("ALTER TABLE symptom_checks ADD COLUMN engine_used TEXT NOT NULL DEFAULT 'local_rule_engine';");
  }
  if (!hasColumn(dbInstance, 'doctor_notes', 'doctor_user_id')) {
    dbInstance.exec('ALTER TABLE doctor_notes ADD COLUMN doctor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;');
  }

  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_firebase_uid      ON users(firebase_uid);
    CREATE INDEX IF NOT EXISTS idx_patients_email          ON patients(email);
    CREATE INDEX IF NOT EXISTS idx_patients_owner          ON patients(owner_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_unique_owner ON patients(owner_user_id) WHERE owner_user_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_symptom_patient         ON symptom_checks(patient_id);
    CREATE INDEX IF NOT EXISTS idx_symptom_user            ON symptom_checks(user_id);
    CREATE INDEX IF NOT EXISTS idx_notes_patient           ON doctor_notes(patient_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_doctor      ON doctor_patient_assignments(doctor_user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_patient     ON doctor_patient_assignments(patient_id);
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
