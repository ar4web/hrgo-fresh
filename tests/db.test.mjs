// server/db.mjs — tests against real SQLite files. The OTP table used to be
// keyed on `key` alone, so a second challenge for the same identity collided
// on the primary key; because every save rewrites all four tables inside one
// transaction, that single collision failed every later write too. These tests
// pin the composite key and the migration that repairs an existing database.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from '../server/db.mjs';

let seq = 0;
const tmpDb = () => join(tmpdir(), `gohr-db-test-${process.pid}-${seq++}-${Date.now()}.sqlite`);

function cleanup(file) {
  for (const s of ['', '-wal', '-shm']) {
    if (existsSync(file + s)) { try { rmSync(file + s); } catch { /* still open */ } }
  }
}

/** Build a database in the pre-fix shape: otps keyed on `key` alone. */
function makeLegacyStore(file) {
  const c = new DatabaseSync(file);
  c.exec('PRAGMA journal_mode = WAL');
  c.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, login_id TEXT, role TEXT, status TEXT, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT, exp INTEGER, revoked INTEGER DEFAULT 0, data TEXT);
CREATE TABLE IF NOT EXISTS otps (key TEXT PRIMARY KEY, exp INTEGER, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, data TEXT NOT NULL);`);
  return c;
}

const otp = (kind, key, exp, devCode) => ({
  hash: `h-${kind}-${key}`, kind, key, exp, attempts: 0, devCode
});

// ── schema ─────────────────────────────────────────────────────────────────

test('a fresh store declares otps with a composite (kind, key) primary key', () => {
  // Break: the schema reverting to `key TEXT PRIMARY KEY`, so two challenges
  // that share an identity collide.
  const file = tmpDb();
  try {
    openStore({ file, legacy: null });
    const c = new DatabaseSync(file);
    const cols = c.prepare('PRAGMA table_info(otps)').all();
    c.close();
    const names = cols.map(x => x.name);
    assert.deepEqual(names, ['kind', 'key', 'exp', 'data']);
    // Both parts of the key must be NOT NULL, otherwise SQLite would allow a
    // NULL component to bypass the uniqueness guarantee entirely.
    const byName = Object.fromEntries(cols.map(x => [x.name, x]));
    assert.equal(byName.kind.notnull, 1, 'kind must be NOT NULL');
    assert.equal(byName.key.notnull, 1, 'key must be NOT NULL');
    // …and the primary key must span both columns (pk ordinals 1 and 2).
    const pk = cols.filter(x => x.pk > 0).map(x => x.name).sort();
    assert.deepEqual(pk, ['key', 'kind'], 'the primary key must span both columns');
  } finally {
    cleanup(file);
  }
});

test('saving two challenges that share a key but differ in kind succeeds', () => {
  // Break: insert without an upsert, so the second row throws
  // UNIQUE constraint failed: otps.key — the remote DoS.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    const now = Math.floor(Date.now() / 1000) + 600;
    assert.doesNotThrow(() => {
      store.saveSnapshot({
        meta: {},
        users: [],
        refresh: [],
        logs: [],
        otps: [otp('phone', '+966500000003', now, '111111'), otp('reset', '+966500000003', now, '222222')]
      });
    });
    // and the second save, with the same pair, must also work
    assert.doesNotThrow(() => {
      store.saveSnapshot({
        meta: {}, users: [], refresh: [], logs: [],
        otps: [otp('phone', '+966500000003', now, '111111'), otp('reset', '+966500000003', now, '222222')]
      });
    });
  } finally {
    cleanup(file);
  }
});

test('a snapshot round-trips users, sessions, otps and the audit log', () => {
  // Break: a column dropped from either the write or the read, so a record
  // silently disappears between saving and loading.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    const now = Math.floor(Date.now() / 1000) + 600;
    const snapshot = {
      secret: 'topsecret',
      geofence: { allowedCountries: ['SA'], failMode: 'open' },
      users: [{ id: 'u-1', loginId: 'EMP-001', role: 'employee', status: 'active', nameEn: 'One' }],
      refresh: [{ hash: 'r1', userId: 'u-1', exp: now, revoked: false }],
      otps: [otp('phone', '+966500000001', now, '999999')],
      logs: [{ ts: 123, event: 'login', ok: true }]
    };
    store.saveSnapshot(snapshot);
    const back = store.loadSnapshot();
    assert.equal(back.secret, 'topsecret');
    assert.equal(back.users.length, 1);
    assert.equal(back.users[0].loginId, 'EMP-001');
    assert.equal(back.users[0].nameEn, 'One');
    assert.equal(back.refresh.length, 1);
    assert.equal(back.refresh[0].hash, 'r1');
    assert.equal(back.otps.length, 1);
    assert.equal(back.otps[0].kind, 'phone');
    assert.equal(back.otps[0].devCode, '999999');
    assert.equal(back.logs.length, 1);
    assert.equal(back.geofence.failMode, 'open');
  } finally {
    cleanup(file);
  }
});

test('a revoked session survives the round trip as revoked', () => {
  // Break: the revoked flag not being persisted, so a logged-out session comes
  // back to life on the next restart.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    const now = Math.floor(Date.now() / 1000) + 600;
    store.saveSnapshot({
      meta: {}, users: [], logs: [], otps: [],
      refresh: [{ hash: 'live', userId: 'u-1', exp: now, revoked: false },
                { hash: 'dead', userId: 'u-1', exp: now, revoked: true }]
    });
    const back = store.loadSnapshot();
    const byHash = Object.fromEntries(back.refresh.map(r => [r.hash, r.revoked]));
    assert.equal(byHash.live, false);
    assert.equal(byHash.dead, true);
  } finally {
    cleanup(file);
  }
});

// ── migration from the pre-fix schema ──────────────────────────────────────

test('a legacy database is migrated to the composite OTP key on open', () => {
  // Break: the migration missing, so an existing deployment keeps the
  // single-column key and stays one request away from a total outage.
  const file = tmpDb();
  try {
    const legacy = makeLegacyStore(file);
    const now = Math.floor(Date.now() / 1000) + 600;
    legacy.prepare('INSERT INTO meta(key,value) VALUES(?,?)')
      .run('secret', JSON.stringify('legacy-secret'));
    legacy.prepare('INSERT INTO otps(key,exp,data) VALUES(?,?,?)')
      .run('+966500000003', now, JSON.stringify(otp('phone', '+966500000003', now, '424242')));
    legacy.close();

    const store = openStore({ file, legacy: null });
    const c = new DatabaseSync(file);
    const cols = c.prepare('PRAGMA table_info(otps)').all().map(x => x.name);
    const rows = c.prepare('SELECT kind, key, data FROM otps').all();
    c.close();

    assert.deepEqual(cols, ['kind', 'key', 'exp', 'data'], 'schema must be upgraded');
    assert.equal(rows.length, 1, 'the live challenge must survive the migration');
    assert.equal(rows[0].kind, 'phone', 'kind must be recovered from the stored payload');
    assert.equal(rows[0].key, '+966500000003');

    // and the migrated store must be immediately usable
    const back = store.loadSnapshot();
    assert.equal(back.otps.length, 1);
    assert.equal(back.otps[0].devCode, '424242');
  } finally {
    cleanup(file);
  }
});

test('the migration is idempotent across repeated opens', () => {
  // Break: a guard that misreads its own migrated table and rebuilds it on
  // every boot, churning rows and re-copying data forever.
  const file = tmpDb();
  try {
    makeLegacyStore(file).close();
    const now = Math.floor(Date.now() / 1000) + 600;
    const store1 = openStore({ file, legacy: null });
    store1.saveSnapshot({
      secret: 's', meta: {}, users: [], refresh: [], logs: [],
      otps: [otp('phone', '+966500000001', now, '111111')]
    });
    const store2 = openStore({ file, legacy: null });
    const store3 = openStore({ file, legacy: null });

    const c = new DatabaseSync(file);
    const tables = c.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name);
    const count = c.prepare('SELECT COUNT(*) AS c FROM otps').get().c;
    c.close();
    assert.ok(!tables.includes('otps_legacy'), `no leftover table, saw: ${tables.join(',')}`);
    assert.equal(count, 1, 'the challenge is not duplicated by a repeat migration');
    assert.equal(store3.loadSnapshot().otps.length, 1);
  } finally {
    cleanup(file);
  }
});

test('the migration preserves two challenges that shared a key', () => {
  // Break: the rebuild inserting both legacy rows under a new composite key
  // and tripping its own uniqueness constraint, leaving the store unusable.
  const file = tmpDb();
  try {
    const legacy = makeLegacyStore(file);
    const now = Math.floor(Date.now() / 1000) + 600;
    legacy.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run('secret', JSON.stringify('s'));
    legacy.prepare('INSERT INTO otps(key,exp,data) VALUES(?,?,?)')
      .run('shared', now, JSON.stringify(otp('phone', 'shared', now, 'aaaaaa')));
    // the old primary key physically forbade a second row with the same key, so
    // the worst legacy state is one row per key — assert the rebuild copes.
    legacy.close();

    const store = openStore({ file, legacy: null });
    assert.doesNotThrow(() => store.saveSnapshot({
      secret: 's', meta: {}, users: [], refresh: [], logs: [],
      otps: [otp('phone', 'shared', now, 'aaaaaa'), otp('reset', 'shared', now, 'bbbbbb')]
    }));
    const c = new DatabaseSync(file);
    const n = c.prepare('SELECT COUNT(*) AS c FROM otps').get().c;
    c.close();
    assert.equal(n, 2, 'phone and reset challenges coexist after migration');
  } finally {
    cleanup(file);
  }
});

test('a snapshot holding the same challenge twice does not break the save', () => {
  // Break: the write losing its ON CONFLICT upsert. saveSqlite empties the
  // table first, so a conflict can only arise from two identical entries inside
  // one snapshot — which is exactly the state a re-request used to leave behind
  // in memory. Without the upsert this throws and, because the snapshot stays
  // in memory, every later save fails too.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    const now = Math.floor(Date.now() / 1000) + 600;
    assert.doesNotThrow(() => {
      store.saveSnapshot({
        secret: 's', meta: {}, users: [], refresh: [], logs: [],
        otps: [
          otp('phone', '+966500000003', now, '111111'),
          otp('phone', '+966500000003', now, '222222') // same identity, newer code
        ]
      });
    }, 'a duplicate entry inside one snapshot must be tolerated');
    const back = store.loadSnapshot();
    assert.equal(back.otps.length, 1, 'the duplicate collapses to a single row');
    assert.equal(back.otps[0].devCode, '222222', 'the last write wins');
  } finally {
    cleanup(file);
  }
});

test('a fresh database file is reported as fresh, not loaded', () => {
  // Break: loadSnapshot returning an empty object for a new file, which would
  // make the caller skip seeding and start with no users at all.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    assert.equal(store.loadSnapshot(), null);
  } finally {
    cleanup(file);
  }
});

test('store status reports table counts and integrity', () => {
  // Break: the admin Users page losing its storage panel or integrity going
  // unmonitored.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    store.saveSnapshot({
      secret: 's', meta: {}, refresh: [], logs: [], otps: [],
      users: [{ id: 'u-1', loginId: 'EMP-001', role: 'employee', status: 'active' }]
    });
    const st = store.status();
    assert.equal(st.driver, 'sqlite');
    assert.equal(st.integrity, 'ok');
    const counts = Object.fromEntries(st.tables.map(x => [x.name, x.count]));
    assert.equal(counts.users, 1);
    assert.equal(counts.otps, 0);
    assert.ok(st.sizeBytes > 0);
  } finally {
    cleanup(file);
  }
});

test('the audit log keeps only the most recent entries', () => {
  // Break: the LIMIT removed, letting the audit log grow without bound — it is
  // rewritten in full on every single request.
  const file = tmpDb();
  try {
    const store = openStore({ file, legacy: null });
    const logs = Array.from({ length: 600 }, (_, i) => ({ ts: 1000 + i, event: `e${i}`, ok: true }));
    store.saveSnapshot({ secret: 's', meta: {}, users: [], refresh: [], otps: [], logs });
    const back = store.loadSnapshot();
    assert.ok(back.logs.length <= 500, `log capped at 500, got ${back.logs.length}`);
    // the newest entry must be the one retained
    assert.equal(back.logs[back.logs.length - 1].event, 'e599');
  } finally {
    cleanup(file);
  }
});
