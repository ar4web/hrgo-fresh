// goHR — database connection layer.
//
// Two persistence drivers:
//   sqlite (default) — a real SQL database file via node:sqlite (built into
//                      Node 22+, zero external dependencies). Tables for
//                      users, sessions (refresh tokens), OTP challenges and
//                      the audit log; everything else in a meta table.
//   json             — the legacy single-file store (auth-db.json), kept as
//                      a fallback (AUTH_DB_DRIVER=json) and as the import
//                      source when a pre-SQLite store is first migrated.
//
// The working set is loaded into memory at boot and written through to the
// database on every save — auth logic stays identical across drivers.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Collections that get real tables; every other snapshot key lands in meta.
const TABLED = { users: 'users', refresh: 'sessions', otps: 'otps', logs: 'audit_log' };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login_id TEXT,
  role TEXT,
  status TEXT,
  data TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login_id ON users(login_id);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT,
  exp INTEGER,
  revoked INTEGER DEFAULT 0,
  data TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS otps (kind TEXT NOT NULL DEFAULT '', key TEXT NOT NULL DEFAULT '', exp INTEGER, data TEXT NOT NULL, PRIMARY KEY(kind, key));
CREATE TABLE IF NOT EXISTS audit_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_ts ON audit_log(ts);
`;

// A challenge is identified by (kind, key) — 'phone'/+9665…, 'iqama'/2xxxxxxxxx,
// 'reset'/adm-001. Keying on `key` alone made a second request for the same
// identity collide on the primary key, and because every save rewrites the
// whole table inside one transaction, that single collision failed every
// later write too. Existing single-column databases are rebuilt on boot.
function migrateOtps(conn) {
  const cols = conn.prepare('PRAGMA table_info(otps)').all();
  if (!cols.length) {return false;}
  // `kind` only exists once the composite key is in place, so its presence is
  // the signal — counting columns would misread the table and re-run forever.
  if (cols.some(c => c.name === 'kind')) {return false;}
  conn.exec('BEGIN');
  try {
    conn.exec('ALTER TABLE otps RENAME TO otps_legacy');
    conn.exec(`CREATE TABLE otps (kind TEXT NOT NULL DEFAULT '', key TEXT NOT NULL DEFAULT '', exp INTEGER, data TEXT NOT NULL, PRIMARY KEY(kind, key))`);
    // Keep only the newest row per (kind, key) so the rebuild cannot itself
    // hit a uniqueness conflict on a store that already holds duplicates.
    const rows = conn.prepare('SELECT exp, data FROM otps_legacy ORDER BY rowid').all();
    const insOtp = conn.prepare('INSERT INTO otps(kind,key,exp,data) VALUES(?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET exp=excluded.exp, data=excluded.data');
    for (const r of rows) {
      let kind = '';
      let key = '';
      try {
        const parsed = JSON.parse(r.data);
        kind = String(parsed.kind || '');
        key = String(parsed.key || '');
      } catch (_e) { /* unparseable row — drop it, it cannot be verified anyway */ }
      insOtp.run(kind, key, r.exp || 0, r.data);
    }
    conn.exec('DROP TABLE otps_legacy');
    conn.exec('COMMIT');
  } catch (e) {
    try {conn.exec('ROLLBACK');} catch (_e) { /* not in a transaction */ }
    throw e;
  }
  return true;
}

function openSqlite(file) {
  mkdirSync(dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA journal_mode = WAL');
  conn.exec('PRAGMA synchronous = NORMAL');
  conn.exec(SCHEMA);
  migrateOtps(conn);
  return conn;
}

/** Full snapshot → tables (one transaction). Small scale: replace-and-insert. */
function saveSqlite(conn, d) {
  conn.exec('BEGIN');
  try {
    const putMeta = conn.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const [k, v] of Object.entries(d)) {
      if (TABLED[k]) {continue;}
      putMeta.run(k, JSON.stringify(v ?? null));
    }
    conn.exec('DELETE FROM users');
    const insUser = conn.prepare('INSERT INTO users(id,login_id,role,status,data) VALUES(?,?,?,?,?)');
    for (const u of d.users || []) {
      insUser.run(u.id, u.loginId || null, u.role || null, u.status || null, JSON.stringify(u));
    }
    conn.exec('DELETE FROM sessions');
    const insSess = conn.prepare('INSERT INTO sessions(hash,user_id,exp,revoked,data) VALUES(?,?,?,?,?)');
    for (const r of d.refresh || []) {
      insSess.run(r.hash, r.userId || null, r.exp || 0, r.revoked ? 1 : 0, JSON.stringify(r));
    }
    conn.exec('DELETE FROM otps');
    const insOtp = conn.prepare('INSERT INTO otps(kind,key,exp,data) VALUES(?,?,?,?) ON CONFLICT(kind,key) DO UPDATE SET exp=excluded.exp, data=excluded.data');
    for (const o of d.otps || []) {
      insOtp.run(String(o.kind || ''), String(o.key || ''), o.exp || 0, JSON.stringify(o));
    }
    conn.exec('DELETE FROM audit_log');
    const insLog = conn.prepare('INSERT INTO audit_log(ts,data) VALUES(?,?)');
    for (const l of d.logs || []) {
      insLog.run(l.ts || Date.now(), JSON.stringify(l));
    }
    conn.exec('COMMIT');
  } catch (e) {
    try {conn.exec('ROLLBACK');} catch (_e) { /* not in a transaction */ }
    throw e;
  }
}

/** Tables → full snapshot (the exact shape the JSON store had). */
function loadSqlite(conn) {
  const metaCount = conn.prepare('SELECT COUNT(*) AS c FROM meta').get();
  const userCount = conn.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (!metaCount.c && !userCount.c) {return null;} // fresh database file
  const d = {};
  for (const row of conn.prepare('SELECT key,value FROM meta').all()) {
    try {d[row.key] = JSON.parse(row.value);} catch (_e) { /* skip bad row */ }
  }
  d.users = conn.prepare('SELECT data FROM users ORDER BY rowid').all().map(r => JSON.parse(r.data));
  d.refresh = conn.prepare('SELECT data FROM sessions ORDER BY rowid').all().map(r => JSON.parse(r.data));
  d.otps = conn.prepare('SELECT data FROM otps ORDER BY rowid').all().map(r => JSON.parse(r.data));
  d.logs = conn.prepare('SELECT data FROM audit_log ORDER BY seq DESC LIMIT 500').all()
    .map(r => JSON.parse(r.data)).reverse();
  return d;
}

/**
 * Open the store.
 * @returns {{ driver, file, loadSnapshot, saveSnapshot, readLegacy, status }}
 */
export function openStore({ file, legacy }) {
  const conn = openSqlite(file);
  return {
    driver: 'sqlite',
    file,
    loadSnapshot: () => loadSqlite(conn),
    saveSnapshot: (d) => saveSqlite(conn, d),
    readLegacy: () => {
      try {
        if (legacy && existsSync(legacy)) {return JSON.parse(readFileSync(legacy, 'utf8'));}
      } catch (_e) { /* corrupt legacy file → seed fresh */ }
      return null;
    },
    status: () => {
      const tables = ['meta', 'users', 'sessions', 'otps', 'audit_log']
        .map(name => ({ name, count: conn.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c }));
      let integrity = 'ok';
      try {integrity = conn.prepare('PRAGMA integrity_check').get().integrity_check || 'ok';} catch (_e) { /* older engines */ }
      let sizeBytes = 0;
      try {sizeBytes = statSync(file).size;} catch (_e) { /* gone */ }
      return { driver: 'sqlite', file, tables, integrity, sizeBytes };
    }
  };
}
