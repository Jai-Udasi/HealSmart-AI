'use strict';

require('dotenv').config();
const { getDb, closeDb } = require('../db/database');

const emailArg = (process.argv[2] || '').trim().toLowerCase();
const roleArg = (process.argv[3] || 'doctor').trim().toLowerCase();

if (!emailArg || !['doctor', 'patient'].includes(roleArg)) {
  console.error('Usage: npm run approve-doctor -- <email> [doctor|patient]');
  process.exit(1);
}

try {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(emailArg);
  if (!user) {
    console.error(`[Error] No registered user found in SQLite with email "${emailArg}". Sign in via the app first.`);
    process.exit(1);
  }

  db.prepare(`UPDATE users SET role = @role, updated_at = datetime('now') WHERE id = @id`).run({
    role: roleArg,
    id: user.id,
  });

  console.log(`[Success] Updated user #${user.id} (${user.email}) to role="${roleArg}".`);
} finally {
  closeDb();
}
