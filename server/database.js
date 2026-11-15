const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { donations: seedDonations, reports: seedReports, impactSummary: seedImpactSummary } = require('./data');

const databasePath = process.env.FOODLOOP_DB_PATH
  ? path.resolve(process.env.FOODLOOP_DB_PATH)
  : path.join(__dirname, 'data', 'foodloop.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);

database.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    profile TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`);
database.exec('PRAGMA foreign_keys = ON');

const donationCount = database.prepare('SELECT COUNT(*) AS count FROM donations').get().count;
if (donationCount === 0) {
  const insertDonation = database.prepare('INSERT INTO donations (id, payload) VALUES (?, ?)');
  database.exec('BEGIN');
  try {
    for (const item of seedDonations) {
      insertDonation.run(item.id, JSON.stringify(item));
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

const reportCount = database.prepare('SELECT COUNT(*) AS count FROM reports').get().count;
if (reportCount === 0) {
  const insertReport = database.prepare('INSERT INTO reports (id, payload) VALUES (?, ?)');
  database.exec('BEGIN');
  try {
    for (const item of seedReports) {
      insertReport.run(item.id, JSON.stringify(item));
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

database.prepare('INSERT OR IGNORE INTO app_state (key, value) VALUES (?, ?)')
  .run('impactSummary', JSON.stringify(seedImpactSummary));

const parseRows = (rows) => rows.map((row) => JSON.parse(row.payload));

const getDonations = () => parseRows(
  database.prepare('SELECT payload FROM donations ORDER BY rowid DESC').all(),
);

const findDonation = (id) => {
  const row = database.prepare('SELECT payload FROM donations WHERE id = ?').get(id);
  return row ? JSON.parse(row.payload) : undefined;
};

const saveDonation = (donation) => {
  database.prepare(`
    INSERT INTO donations (id, payload) VALUES (?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload
  `).run(donation.id, JSON.stringify(donation));
};

const getReports = () => parseRows(
  database.prepare('SELECT payload FROM reports ORDER BY rowid DESC').all(),
);

const saveReport = (report) => {
  database.prepare('INSERT INTO reports (id, payload) VALUES (?, ?)')
    .run(report.id, JSON.stringify(report));
};

const getImpactSummary = () => {
  const row = database.prepare('SELECT value FROM app_state WHERE key = ?').get('impactSummary');
  return JSON.parse(row.value);
};

const saveImpactSummary = (summary) => {
  database.prepare(`
    INSERT INTO app_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('impactSummary', JSON.stringify(summary));
};

const findUserByEmail = (email) => {
  const row = database.prepare(`
    SELECT id, email, password_hash, profile FROM users WHERE email = ? COLLATE NOCASE
  `).get(email);
  return row ? { ...JSON.parse(row.profile), passwordHash: row.password_hash } : undefined;
};

const createUser = ({ id, email, passwordHash, profile }) => {
  database.prepare(`
    INSERT INTO users (id, email, password_hash, profile) VALUES (?, ?, ?, ?)
  `).run(id, email, passwordHash, JSON.stringify(profile));
};

const createSession = (tokenHash, userId, expiresAt) => {
  const now = Date.now();
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  database.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, expiresAt, now);
};

const findUserBySessionTokenHash = (tokenHash) => {
  const row = database.prepare(`
    SELECT users.profile
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Date.now());
  return row ? JSON.parse(row.profile) : undefined;
};

const deleteSession = (tokenHash) => {
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
};

module.exports = {
  getDonations,
  findDonation,
  saveDonation,
  getReports,
  saveReport,
  getImpactSummary,
  saveImpactSummary,
  findUserByEmail,
  createUser,
  createSession,
  findUserBySessionTokenHash,
  deleteSession,
};
