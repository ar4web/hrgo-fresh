// goHR auth core — JWT (HS256), refresh rotation, OTP, RBAC, geofence.
// Zero runtime dependencies: node:crypto + built-in fetch only.
// Storage goes through server/db.mjs: SQLite by default (server/data/
// gohr.sqlite — real tables, WAL, migrated automatically from the legacy
// JSON store on first boot), or the legacy JSON file with AUTH_DB_DRIVER=json.

import { createHmac, randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendSms } from './sms.mjs';
import { openStore } from './db.mjs';

export const IS_PROD = process.env.NODE_ENV === 'production';
export const ACCESS_TTL = 15 * 60;            // 15 min
export const REFRESH_TTL = 7 * 24 * 60 * 60;  // 7 days
export const OTP_TTL = 2 * 60;                // 2 minutes
export const OTP_MAX_ATTEMPTS = 3;            // max 3 verify attempts

export const DB_DRIVER = (process.env.AUTH_DB_DRIVER || 'sqlite').toLowerCase();
const DB_PATH = process.env.AUTH_DB_PATH || (DB_DRIVER === 'sqlite'
  ? fileURLToPath(new URL('./data/gohr.sqlite', import.meta.url))
  : fileURLToPath(new URL('./data/auth-db.json', import.meta.url)));
const LEGACY_JSON = process.env.AUTH_DB_LEGACY || fileURLToPath(new URL('./data/auth-db.json', import.meta.url));
let _store = null;

// ── store ──────────────────────────────────────────────────────────────────
export function seedDb() {
  return {
    secret: randomBytes(48).toString('hex'), // HS256 signing secret
    geofence: { allowedCountries: ['SA'], failMode: 'open' }, // failMode: open|closed when geo cannot be resolved
    roles: {
      admin: {
        labelEn: 'Administrator', permissions: ['*']
      },
      manager: {
        labelEn: 'Manager',
        permissions: ['attendance.read', 'attendance.write', 'attendance.read.self', 'employees.read', 'payroll.read', 'documents.read', 'users.read']
      },
      employee: {
        labelEn: 'Employee',
        permissions: ['attendance.read.self', 'attendance.write.self', 'profile.read', 'payslip.read.self']
      },
      vendor: {
        labelEn: 'Vendor',
        permissions: ['profile.read', 'payslip.read.self', 'documents.read.self']
      }
    },
    users: SEED_USERS_V2.map(({ password, ...u }) => ({ ...u, ...passwordHash(password) })),
    refresh: [], // {hash, userId, exp, revoked}
    otps: [],    // {hash, kind:'phone'|'iqama', key, exp, attempts, devCode}
    googlePending: {}, // state -> {verifier, exp}
    oauthCodes: {},    // code -> {userId, exp}
    logs: []     // {ts, event, userId?, ip, country, ok, reason}
  };
}

// Seed accounts — the login ID prefixes encode the account type
// (ADM/MGR/EMP/VND). Passwords are dev defaults; change via user management.
export const SEED_USERS_V2 = [
  // admins
  { id: 'u-admin', loginId: 'ADM-001', nameEn: 'Admin User', nameAr: 'مدير النظام', role: 'admin', iqama: '2000000001', phone: '+966500000001', email: 'admin@gohr.com', googleSub: '', status: 'active', created: 0, password: 'Admin123' },
  { id: 'u-admin2', loginId: 'ADM-002', nameEn: 'Sara Alharbi', nameAr: 'سارة الحربي', role: 'admin', iqama: '2000000010', phone: '+966500000010', email: 'sara@gohr.test', googleSub: '', status: 'active', created: 0, password: 'admin123' },
  // managers
  { id: 'u-manager', loginId: 'MGR-001', nameEn: 'Manager User', nameAr: 'مدير الفريق', role: 'manager', iqama: '2000000002', phone: '+966500000002', email: 'manager@gohr.test', googleSub: '', status: 'active', created: 0, password: 'manager123' },
  { id: 'u-manager2', loginId: 'MGR-002', nameEn: 'Khalid Alotaibi', nameAr: 'خالد العتيبي', role: 'manager', iqama: '2000000011', phone: '+966500000011', email: 'khalid@gohr.test', googleSub: '', status: 'active', created: 0, password: 'manager123' },
  { id: 'u-manager3', loginId: 'MGR-003', nameEn: 'Nouf Alqahtani', nameAr: 'نوف القحطاني', role: 'manager', iqama: '2000000012', phone: '+966500000012', email: 'nouf@gohr.test', googleSub: '', status: 'active', created: 0, password: 'manager123' },
  // employees
  { id: 'u-employee', loginId: 'EMP-001', nameEn: 'Employee User', nameAr: 'موظف', role: 'employee', iqama: '2000000003', phone: '+966500000003', email: 'employee@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp2', loginId: 'EMP-002', nameEn: 'Mohammed Ali', nameAr: 'محمد علي', role: 'employee', iqama: '2000000020', phone: '+966500000020', email: 'mohammed@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp3', loginId: 'EMP-003', nameEn: 'Ahmad Saleh', nameAr: 'أحمد صالح', role: 'employee', iqama: '2000000021', phone: '+966500000021', email: 'ahmad@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp4', loginId: 'EMP-004', nameEn: 'Reem Abdullah', nameAr: 'ريم عبدالله', role: 'employee', iqama: '2000000022', phone: '+966500000022', email: 'reem@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp5', loginId: 'EMP-005', nameEn: 'Imran Khan', nameAr: 'عمران خان', role: 'employee', iqama: '2000000023', phone: '+966500000023', email: 'imran@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp6', loginId: 'EMP-006', nameEn: 'Hassan Iqbal', nameAr: 'حسن إقبال', role: 'employee', iqama: '2000000024', phone: '+966500000024', email: 'hassan@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp7', loginId: 'EMP-007', nameEn: 'Laila Hassan', nameAr: 'ليلى حسن', role: 'employee', iqama: '2000000025', phone: '+966500000025', email: 'laila@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp8', loginId: 'EMP-008', nameEn: 'Omar Farouk', nameAr: 'عمر فاروق', role: 'employee', iqama: '2000000026', phone: '+966500000026', email: 'omar@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  { id: 'u-emp9', loginId: 'EMP-009', nameEn: 'Yousef Madani', nameAr: 'يوسف مدني', role: 'employee', iqama: '2000000027', phone: '+966500000027', email: 'yousef@gohr.test', googleSub: '', status: 'active', created: 0, password: 'employee123' },
  // vendors
  { id: 'u-vendor', loginId: 'VND-001', nameEn: 'Vendor Partner', nameAr: 'مورّد', role: 'vendor', iqama: '', phone: '+966500000004', email: 'vendor@gohr.test', googleSub: '', status: 'active', created: 0, password: 'vendor123' },
  { id: 'u-vnd2', loginId: 'VND-002', nameEn: 'Gulf Supplies Co.', nameAr: 'شركة خليج للتوريدات', role: 'vendor', iqama: '', phone: '+966500000030', email: 'gulf@vendor.test', googleSub: '', status: 'active', created: 0, password: 'vendor123' },
  { id: 'u-vnd3', loginId: 'VND-003', nameEn: 'Safwa Maintenance', nameAr: 'صفوة الصيانة', role: 'vendor', iqama: '', phone: '+966500000031', email: 'safwa@vendor.test', googleSub: '', status: 'active', created: 0, password: 'vendor123' }
];

/** Backfill loginId/password/status onto databases created before v2. */
export function ensureMigrations(d) {
  let dirty = false;
  const defaults = Object.fromEntries(SEED_USERS_V2.map(u => [u.id, u]));
  for (const u of d.users || []) {
    if (!u.loginId) {
      u.loginId = (defaults[u.id] && defaults[u.id].loginId)
        || `${(u.role || 'EMP').slice(0, 3).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
      dirty = true;
    }
    if (!u.pwHash) {
      Object.assign(u, passwordHash((defaults[u.id] && defaults[u.id].password) || 'gohr12345'));
      dirty = true;
    }
    if (!u.status) {
      u.status = 'active';
      dirty = true;
    }
  }
  if (!d.geofence) {d.geofence = { allowedCountries: ['SA'], failMode: 'open' }; dirty = true;}
  if (!['open', 'closed'].includes(d.geofence.failMode)) {d.geofence.failMode = 'open'; dirty = true;}
  if (d.roles && !d.roles.vendor) {
    d.roles.vendor = { labelEn: 'Vendor', permissions: ['profile.read', 'payslip.read.self', 'documents.read.self'] };
    dirty = true;
  }
  // insert seed accounts added after the DB was created (e.g. the vendor)
  for (const seed of SEED_USERS_V2) {
    if (!(d.users || []).some(u => u.id === seed.id)) {
      const { password, ...rest } = seed;
      d.users.push({ ...rest, ...passwordHash(password) });
      dirty = true;
    }
  }
  if (d.roles && d.roles.manager && !d.roles.manager.permissions.includes('users.read')) {
    d.roles.manager.permissions.push('users.read');
    dirty = true;
  }
  if (dirty) {saveDb();}
  return d;
}

let _db = null;
export function db() {
  if (_db) {return _db;}
  if (DB_DRIVER !== 'json') {
    try {
      _store = openStore({ file: DB_PATH, legacy: LEGACY_JSON });
      const snap = _store.loadSnapshot();
      if (snap) {
        _db = snap;
        return ensureMigrations(_db);
      }
      // fresh database → import the legacy JSON store if one exists
      _db = _store.readLegacy() || seedDb();
      saveDb();
      return ensureMigrations(_db);
    } catch (e) {
      console.error('[auth] sqlite unavailable, using json fallback:', e.message);
      _store = null;
    }
  }
  try {
    if (existsSync(DB_PATH)) {
      _db = JSON.parse(readFileSync(DB_PATH, 'utf8'));
      return ensureMigrations(_db);
    }
  } catch (_e) { /* corrupt db → reseed */ }
  _db = seedDb();
  saveDb();
  return _db;
}
export function saveDb() {
  if (!_db) {return;}
  if (_store) {
    _store.saveSnapshot(_db);
    return;
  }
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  writeFileSync(tmp, JSON.stringify(_db, null, 1));
  renameSync(tmp, DB_PATH);
}

/** Connection status for the admin UI: driver, file, tables, row counts. */
export function dbStatus() {
  db();
  const d = _db;
  const rows = () => ({
    users: (d.users || []).length,
    sessions: (d.refresh || []).filter(r => !r.revoked).length,
    otps: (d.otps || []).length,
    logs: (d.logs || []).length
  });
  if (_store) {
    const st = _store.status();
    st.rows = rows();
    st.legacyJson = existsSync(LEGACY_JSON) ? LEGACY_JSON : null;
    return st;
  }
  return {
    driver: 'json',
    file: DB_PATH,
    integrity: 'n/a',
    sizeBytes: existsSync(DB_PATH) ? statSync(DB_PATH).size : 0,
    tables: [],
    rows: rows()
  };
}
export function logEvent(evt) {
  const d = db();
  d.logs.push({ ts: Date.now(), ...evt });
  if (d.logs.length > 500) {d.logs.splice(0, d.logs.length - 500);}
  saveDb();
}

// ── accounts (ID + password) ──────────────────────────────────────────────
// The login ID decides the account type: ADM-* → admin, MGR-* → manager,
// EMP-* → employee, VND-* → vendor. The role (and therefore what the account
// may do) is stored on the user and enforced by RBAC on every request.
export function passwordHash(pw) {
  const salt = randomBytes(16).toString('hex');
  return { pwSalt: salt, pwHash: scryptSync(String(pw), salt, 64).toString('hex') };
}
export function verifyPassword(user, pw) {
  if (!user || !user.pwHash) {return false;}
  const got = scryptSync(String(pw), user.pwSalt || '', 64);
  const expect = Buffer.from(user.pwHash, 'hex');
  return got.length === expect.length && timingSafeEqual(got, expect);
}
export const ROLES = ['admin', 'manager', 'employee', 'vendor'];
export const DEMO_USER = {
  id: 'u-admin', loginId: 'ADM-001', nameEn: 'Admin User', nameAr: 'مدير النظام',
  role: 'admin', iqama: '2000000001', phone: '+966500000001', email: 'admin@gohr.com',
  googleSub: '', status: 'active', created: 0, permissions: ['*']
};
export const userByLoginId = (loginId) =>
  db().users.find(u => String(u.loginId || '').toLowerCase() === String(loginId || '').trim().toLowerCase());
/** Auth paths accept the login ID OR the account email. */
export const resolveLogin = (identifier) => {
  const id = String(identifier || '').trim();
  const lower = id.toLowerCase();
  return db().users.find(u =>
    String(u.loginId || '').toLowerCase() === lower
    || (id.includes('@') && String(u.email || '').toLowerCase() === lower));
};
export function createUser(fields) {
  const d = db();
  const user = {
    id: `u-${randomBytes(5).toString('hex')}`,
    loginId: String(fields.loginId).trim(),
    nameEn: String(fields.nameEn || fields.loginId).trim(),
    nameAr: String(fields.nameAr || '').trim(),
    role: ROLES.includes(fields.role) ? fields.role : 'employee',
    phone: String(fields.phone || '').trim(),
    iqama: String(fields.iqama || '').trim(),
    email: String(fields.email || '').trim(),
    googleSub: '',
    status: 'active',
    created: Math.floor(Date.now() / 1000),
    ...passwordHash(fields.password)
  };
  d.users.push(user);
  saveDb();
  return user;
}
export function updateUser(id, patch, actorId) {
  const d = db();
  const u = d.users.find(x => x.id === id);
  if (!u) {return null;}
  const safe = {};
  for (const k of ['nameEn', 'nameAr', 'phone', 'iqama', 'email']) {
    if (patch[k] !== undefined) {safe[k] = String(patch[k]).trim();}
  }
  if (patch.role && ROLES.includes(patch.role)) {safe.role = patch.role;}
  if (patch.status === 'active' || patch.status === 'disabled') {
    if (u.id === actorId && patch.status === 'disabled') {return { error: 'cannot_disable_self' };}
    safe.status = patch.status;
  }
  if (patch.password) {
    if (String(patch.password).length < getPolicy().passwordMinLength) {return { error: 'password_too_short' };}
    Object.assign(safe, passwordHash(patch.password));
  }
  Object.assign(u, safe);
  saveDb();
  return u;
}
export function deleteUser(id, actorId) {
  const d = db();
  const i = d.users.findIndex(x => x.id === id);
  if (i < 0) {return { error: 'not_found' };}
  if (d.users[i].id === actorId) {return { error: 'cannot_delete_self' };}
  d.users.splice(i, 1);
  saveDb();
  return { ok: true };
}

// ── security policy + password lifecycle ──────────────────────────────────
export function getPolicy() {
  return {
    passwordMinLength: (db().policy && db().policy.passwordMinLength) || 6,
    selfSignup: !!(db().policy && db().policy.selfSignup)
  };
}
export function setPolicy(patch) {
  const d = db();
  d.policy = { ...(d.policy || {}), ...(patch || {}) };
  saveDb();
  return d.policy;
}
export function changePassword(userId, currentPw, newPw) {
  const u = db().users.find(x => x.id === userId);
  if (!u) {return { error: 'not_found' };}
  if (!verifyPassword(u, currentPw)) {return { error: 'wrong_current_password' };}
  const min = getPolicy().passwordMinLength;
  if (String(newPw || '').length < min) {return { error: 'password_too_short' };}
  Object.assign(u, passwordHash(newPw));
  u.pwChangedAt = Math.floor(Date.now() / 1000);
  const revoked = revokeAllFor(userId); // a password change kills every session
  saveDb();
  logEvent({ event: 'password_change', userId, ok: true, reason: `${revoked} sessions revoked` });
  return { ok: true, revoked };
}
/** Forgot password: sends a reset OTP to the phone on file. The response is
 * identical whether or not the ID exists (anti-enumeration). */
export async function requestReset(loginId) {
  const u = resolveLogin(loginId);
  if (!u || !u.phone) {return { sent: true, expiresInSeconds: OTP_TTL };}
  const out = await requestOtp('reset', String(u.loginId).toLowerCase());
  logEvent({ event: 'password_forgot', userId: u.id, ok: true, reason: 'otp_sent' });
  return out;
}
export function resetPassword(loginId, code, newPw) {
  const u = resolveLogin(loginId);
  if (!u) {return { ok: true };} // silent for unknown IDs
  // policy first — a rejected attempt must not burn the single-use code
  const min = getPolicy().passwordMinLength;
  if (String(newPw || '').length < min) {return { error: 'password_too_short' };}
  const check = consumeOtp('reset', String(u.loginId).toLowerCase(), code);
  if (!check.ok) {return { error: check.reason };}
  Object.assign(u, passwordHash(newPw));
  u.pwChangedAt = Math.floor(Date.now() / 1000);
  revokeAllFor(u.id);
  saveDb();
  logEvent({ event: 'password_reset', userId: u.id, ok: true, reason: 'otp' });
  return { ok: true };
}

// ── JWT (HS256) ────────────────────────────────────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function sig(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}
export function signJwt(payload, secret, ttl) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl }));
  return `${head}.${body}.${sig(`${head}.${body}`, secret)}`;
}
export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {return null;}
  const expect = sig(`${parts[0]}.${parts[1]}`, secret);
  const got = parts[2];
  if (expect.length !== got.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(got))) {return null;}
  let payload;
  try {payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));} catch (_e) {return null;}
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {return null;}
  return payload;
}

// ── rate limiting (in-memory sliding window; per process) ─────────────────
const _buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (_buckets.get(key) || []).filter(ts => now - ts < windowMs);
  if (arr.length >= max) {
    const retryAfter = Math.ceil((arr[0] + windowMs - now) / 1000);
    _buckets.set(key, arr);
    return { ok: false, retryAfter };
  }
  arr.push(now);
  _buckets.set(key, arr);
  return { ok: true };
}

/** Read-only limiter check — reports lockout without recording an attempt. */
export function rateLimitPeek(key, max, windowMs) {
  const now = Date.now();
  const arr = (_buckets.get(key) || []).filter(ts => now - ts < windowMs);
  _buckets.set(key, arr);
  if (arr.length >= max) {
    return { ok: false, retryAfter: Math.ceil((arr[0] + windowMs - now) / 1000) };
  }
  return { ok: true };
}

/** Clear a bucket — call after a successful auth so wins never accumulate. */
export function rateLimitReset(key) {
  _buckets.delete(key);
}

// ── tokens ─────────────────────────────────────────────────────────────────
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export function issueTokens(user, ip) {
  const d = db();
  const access = signJwt({ sub: user.id, role: user.role, typ: 'access', jti: randomBytes(8).toString('hex') }, d.secret, ACCESS_TTL);
  const refresh = randomBytes(48).toString('hex');
  d.refresh.push({ hash: sha256(refresh), userId: user.id, exp: Math.floor(Date.now() / 1000) + REFRESH_TTL, revoked: false, created: Math.floor(Date.now() / 1000), ip: String(ip || '').slice(0, 45) });
  if (d.refresh.length > 400) {d.refresh.splice(0, d.refresh.length - 400);}
  saveDb();
  return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', expiresIn: ACCESS_TTL, user: publicUser(user) };
}
export function listSessions(userId) {
  const now = Math.floor(Date.now() / 1000);
  return db().refresh
    .filter(r => r.userId === userId && !r.revoked && r.exp > now)
    .map(r => ({ created: r.created, ip: r.ip || '', exp: r.exp }));
}
export function revokeAllFor(userId) {
  const d = db();
  let n = 0;
  d.refresh.forEach(r => {
    if (r.userId === userId && !r.revoked) {
      r.revoked = true;
      n += 1;
    }
  });
  if (n) {saveDb();}
  return n;
}
export function rotateRefresh(rawToken, ip) {
  const d = db();
  const h = sha256(String(rawToken || ''));
  const now = Math.floor(Date.now() / 1000);
  const row = d.refresh.find(r => r.hash === h && !r.revoked);
  if (!row) {
    // Rotation grace: a token rotated seconds ago may still be in flight
    // from another tab or a parallel request (they share localStorage).
    // Re-issue a sibling session instead of failing them — otherwise one
    // tab logs out every other tab. Bounded: 30s window, 3 re-issues.
    const parent = d.refresh.find(r =>
      r.prevHash === h && !r.graceDone
      && now - (r.rotatedAt || 0) < 30
      && (r.graceCount || 0) < 3
      && r.exp > now);
    if (parent) {
      const pUser = d.users.find(u => u.id === parent.userId);
      if (pUser && pUser.status !== 'disabled') {
        parent.graceCount = (parent.graceCount || 0) + 1;
        parent.graceDone = true;
        saveDb();
        return issueTokens(pUser, ip || '');
      }
    }
    return null;
  }
  if (row.exp < now) {return null;}
  row.prevHash = h; // enable the grace window for parallel siblings
  row.rotatedAt = now;
  row.revoked = true; // rotation: the presented token is single-use
  const user = d.users.find(u => u.id === row.userId);
  if (!user) {return null;}
  return issueTokens(user, ip || '');
}
export function revokeRefresh(rawToken) {
  const d = db();
  const h = sha256(String(rawToken || ''));
  const row = d.refresh.find(r => r.hash === h && !r.revoked);
  if (row) {
    row.revoked = true;
    saveDb();
    return true;
  }
  return false;
}

// ── RBAC ───────────────────────────────────────────────────────────────────
export function publicUser(u) {
  const d = db();
  return { id: u.id, loginId: u.loginId || '', nameEn: u.nameEn, nameAr: u.nameAr, role: u.role, permissions: permissionsOf(u.role), email: u.email || '', phone: u.phone || '', status: u.status || 'active' };
}
export function permissionsOf(role) {
  return (db().roles[role] || {}).permissions || [];
}
export function roleCan(role, perm) {
  const list = permissionsOf(role);
  if (list.includes('*')) {return true;}
  if (list.includes(perm)) {return true;}
  const mod = perm.split('.')[0];
  return list.includes(`${mod}.*`);
}
/** Auth middleware: returns {user, payload} or an error object. */
export function requireAuth(req) {
  if (process.env.AUTH_BYPASS === '1' && !IS_PROD) {
    return { user: DEMO_USER, payload: { sub: 'u-admin', role: 'admin', typ: 'access' } };
  }
  const d = db();
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {return { error: [401, 'missing_token'] };}
  const payload = verifyJwt(token, d.secret);
  if (!payload || payload.typ !== 'access') {return { error: [401, 'invalid_or_expired_token'] };}
  const user = d.users.find(u => u.id === payload.sub);
  if (!user) {return { error: [401, 'unknown_user'] };}
  if (user.status === 'disabled') {return { error: [403, 'account_disabled'] };}
  // a token issued before the last password change no longer counts
  if (user.pwChangedAt && payload.iat && payload.iat <= user.pwChangedAt) {return { error: [401, 'password_changed'] };}
  return { user, payload };
}
export function requirePerm(req, perm) {
  if (process.env.AUTH_BYPASS === '1' && !IS_PROD) {
    return { user: DEMO_USER, payload: { sub: 'u-admin', role: 'admin', typ: 'access' } };
  }
  const auth = requireAuth(req);
  if (auth.error) {return auth;}
  if (!roleCan(auth.user.role, perm)) {return { error: [403, 'forbidden'], user: auth.user };}
  return auth;
}

// ── OTP ────────────────────────────────────────────────────────────────────
export async function requestOtp(kind, key) {
  const d = db();
  const code = String(100000 + (parseInt(randomBytes(4).toString('hex'), 16) % 900000)); // 6-digit, crypto-secure
  d.otps.push({ hash: sha256(`${kind}:${key}:${code}`), kind, key, exp: Math.floor(Date.now() / 1000) + OTP_TTL, attempts: 0, devCode: code });
  if (d.otps.length > 60) {d.otps.splice(0, d.otps.length - 60);}
  saveDb();
  // SMS provider is pluggable (SMS_PROVIDER=console|twilio|webhook). The code
  // is echoed in dev responses only, never in production.
  const sms = await sendSms(key, `goHR verification code: ${code} (valid ${OTP_TTL}s)`);
  logEvent({ event: 'sms_sent', ip: '', ok: !!sms.ok, reason: `${sms.provider}${sms.reason ? ':' + sms.reason : ''}` });
  return { sent: sms.ok !== false, expiresInSeconds: OTP_TTL, maxAttempts: OTP_MAX_ATTEMPTS, devCode: IS_PROD ? undefined : code };
}
export function consumeOtp(kind, key, code) {
  const d = db();
  const now = Math.floor(Date.now() / 1000);
  const h = sha256(`${kind}:${key}:${String(code || '')}`);
  const candidates = d.otps.filter(o => o.kind === kind && o.key === key);
  const row = [...candidates].reverse().find(o => o.exp > now);
  if (!row) {
    const expired = candidates.at(-1);
    if (expired) {
      const index = d.otps.indexOf(expired);
      if (index >= 0) {d.otps.splice(index, 1);}
      saveDb();
      return { ok: false, reason: 'code_expired' };
    }
    return { ok: false, reason: 'invalid_code' };
  }
  if (row.hash !== h) {
    row.attempts += 1;
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      const index = d.otps.indexOf(row);
      if (index >= 0) {d.otps.splice(index, 1);}
      saveDb();
      return { ok: false, reason: 'too_many_attempts' };
    }
    saveDb();
    return { ok: false, reason: 'invalid_code' };
  }
  const index = d.otps.indexOf(row);
  if (index >= 0) {d.otps.splice(index, 1);} // single use
  saveDb();
  return { ok: true };
}

// ── identity lookups ───────────────────────────────────────────────────────
export const iqamaValid = (iqama) => /^2\d{9}$/.test(String(iqama || '')); // starts with '2', 10 digits
export function findUser({ phone, iqama, loginId }) {
  const d = db();
  return d.users.find(u =>
    (phone && u.phone === phone)
    || (iqama && u.iqama === iqama)
    || (loginId && String(u.loginId || '').toLowerCase() === String(loginId).trim().toLowerCase()));
}
export function upsertGoogleUser(profile) {
  const d = db();
  let u = d.users.find(x => (profile.sub && x.googleSub === profile.sub) || (profile.email && x.email && x.email.toLowerCase() === String(profile.email).toLowerCase()));
  if (!u) {
    u = { id: `u-g-${randomBytes(4).toString('hex')}`, nameEn: profile.name || profile.email || 'Google user', nameAr: '', role: 'employee', iqama: '', phone: '', email: profile.email || '', googleSub: profile.sub || '' };
    d.users.push(u);
    saveDb();
  } else if (profile.sub && !u.googleSub) {
    u.googleSub = profile.sub;
    saveDb();
  }
  return u;
}

// ── geofence ───────────────────────────────────────────────────────────────
export function resolveIp(req) {
  const trustProxy = process.env.TRUST_PROXY === '1' || process.env.AUTH_TRUST_PROXY === '1';
  const xf = trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const ip = xf || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}
export function isPrivateIp(ip) {
  return !ip || ip === '127.0.0.1' || ip === '0.0.0.0' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === 'local';
}
const geoCache = new Map();
export async function lookupCountry(ip) {
  // Test hook: '8.8.8.8=US;95.96.97.98=SA;=SA' → per-IP rules, empty prefix = default.
  if (process.env.AUTH_GEO_STUB) {
    for (const rule of process.env.AUTH_GEO_STUB.split(';')) {
      const eq = rule.indexOf('=');
      if (eq < 0) {continue;}
      const prefix = rule.slice(0, eq);
      const cc = rule.slice(eq + 1);
      if (cc && prefix && ip.startsWith(prefix)) {return { country: cc, source: 'stub' };}
    }
    const def = process.env.AUTH_GEO_STUB.split(';').find(r => r.startsWith('='));
    if (def) {return { country: def.slice(1), source: 'stub' };}
  }
  if (isPrivateIp(ip)) {return { country: 'LOCAL', source: 'local' };}
  if (geoCache.has(ip)) {return geoCache.get(ip);}
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, { signal: AbortSignal.timeout(2500) });
    const json = await res.json();
    if (json && json.status === 'success' && json.countryCode) {
      const out = { country: json.countryCode, source: 'ip-api' };
      geoCache.set(ip, out);
      setTimeout(() => geoCache.delete(ip), 10 * 60 * 1000).unref?.();
      return out;
    }
  } catch (_e) { /* offline / blocked → unresolved */ }
  return { country: '', source: 'unresolved' };
}
export function geofenceDecide(geo) {
  const d = db();
  const list = d.geofence.allowedCountries || ['SA'];
  if (geo.source === 'local') {return { allowed: true, reason: 'local' };}
  if (!geo.country) {return { allowed: d.geofence.failMode !== 'closed', reason: 'geo_unresolved' };}
  return { allowed: list.includes(geo.country), reason: list.includes(geo.country) ? 'country_allowed' : 'country_not_allowed' };
}

// ── google oauth (PKCE) ────────────────────────────────────────────────────
export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
export function googleStart(origin) {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  db().googlePending[state] = { verifier, exp: Math.floor(Date.now() / 1000) + 600 };
  saveDb();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
export async function googleExchange(code, state, origin) {
  const d = db();
  const pending = d.googlePending[state];
  if (!pending || pending.exp < Math.floor(Date.now() / 1000)) {return { error: 'invalid_state' };}
  delete d.googlePending[state];
  saveDb();
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code_verifier: pending.verifier,
        redirect_uri: `${origin}/auth/google/callback`,
        grant_type: 'authorization_code'
      }),
      signal: AbortSignal.timeout(8000)
    });
    const tok = await res.json();
    if (!tok.access_token) {return { error: 'token_exchange_failed' };}
    const profRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tok.access_token}` },
      signal: AbortSignal.timeout(8000)
    });
    return { profile: await profRes.json() };
  } catch (_e) {
    return { error: 'google_unreachable' };
  }
}
export function issueOauthCode(userId, state) {
  const d = db();
  const code = randomBytes(24).toString('hex');
  d.oauthCodes[code] = { userId, exp: Math.floor(Date.now() / 1000) + 120, state: String(state || '') };
  saveDb();
  return code;
}
export function consumeOauthCode(code) {
  const d = db();
  const row = d.oauthCodes[code];
  if (!row || row.exp < Math.floor(Date.now() / 1000)) {return null;}
  delete d.oauthCodes[code];
  saveDb();
  const user = d.users.find(u => u.id === row.userId) || null;
  return user ? { user, state: row.state || '' } : null;
}
