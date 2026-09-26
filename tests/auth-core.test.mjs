// server/auth-core.mjs — unit tests against the real module and a real
// throwaway SQLite file. Every assertion below names the production bug it
// catches; expected values are hand-derived literals, never computed by the
// code under test.
//
// The module keeps its store in a lazily-initialised module-level singleton
// keyed off AUTH_DB_PATH, so the env var is set before the dynamic import and
// the whole file shares one store. Tests are written to stay independent of
// each other by using distinct identities and OTP keys.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DB = join(tmpdir(), `gohr-authcore-test-${process.pid}-${Date.now()}.sqlite`);
process.env.AUTH_DB_PATH = DB;
process.env.AUTH_DB_DRIVER = 'sqlite';
process.env.SMS_PROVIDER = 'console';
delete process.env.AUTH_BYPASS;
delete process.env.NODE_ENV;

let A;
before(async () => { A = await import('../server/auth-core.mjs'); });
after(() => {
  for (const s of ['', '-wal', '-shm']) {
    if (existsSync(DB + s)) { try { rmSync(DB + s); } catch { /* still open */ } }
  }
});

// ── password hashing ───────────────────────────────────────────────────────

test('verifyPassword accepts the correct password', () => {
  // Break: a hashing change that makes the digest not match its own input.
  const u = { ...A.passwordHash('Admin123') };
  assert.equal(A.verifyPassword(u, 'Admin123'), true);
});

test('verifyPassword rejects a wrong password', () => {
  // Break: a comparison that stops checking, granting any password.
  const u = { ...A.passwordHash('Admin123') };
  assert.equal(A.verifyPassword(u, 'Admin1234'), false);
  assert.equal(A.verifyPassword(u, ''), false);
});

test('verifyPassword returns false for a user with no hash instead of throwing', () => {
  // Break: a missing pwHash reaching scrypt, 500-ing the login route for any
  // account whose record was partially written.
  assert.equal(A.verifyPassword(null, 'x'), false);
  assert.equal(A.verifyPassword({}, 'x'), false);
});

test('the same password hashed twice yields different digests', () => {
  // Break: a salt that stops being random, making digests comparable across
  // accounts and letting one hash be reversed by lookup.
  const a = A.passwordHash('same');
  const b = A.passwordHash('same');
  assert.notEqual(a.pwSalt, b.pwSalt);
  assert.notEqual(a.pwHash, b.pwHash);
});

// ── JWT ────────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-value';

test('signJwt round-trips its claims', () => {
  // Break: base64/JSON encoding drift in sign or verify.
  const token = A.signJwt({ sub: 'u-1', typ: 'access' }, SECRET, 60);
  const payload = A.verifyJwt(token, SECRET);
  assert.equal(payload.sub, 'u-1');
  assert.equal(payload.typ, 'access');
});

test('verifyJwt rejects a token signed with a different secret', () => {
  // Break: verify ignoring the secret, so any signed token is accepted.
  const token = A.signJwt({ sub: 'u-1', typ: 'access' }, SECRET, 60);
  assert.equal(A.verifyJwt(token, 'a-different-secret'), null);
});

test('verifyJwt rejects a tampered payload', () => {
  // Break: signature computed over the wrong segment, letting an attacker
  // rewrite the claims (e.g. swap sub for an admin id).
  const [h, p, s] = A.signJwt({ sub: 'u-1', typ: 'access' }, SECRET, 60).split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'u-admin', typ: 'access' })).toString('base64url');
  assert.equal(A.verifyJwt(`${h}.${forged}.${s}`, SECRET), null);
});

test('verifyJwt rejects an expired token', () => {
  // Break: exp not being checked, leaving expired access tokens valid.
  const token = A.signJwt({ sub: 'u-1', typ: 'access' }, SECRET, -10);
  assert.equal(A.verifyJwt(token, SECRET), null);
});

test('verifyJwt rejects a token with no signature', () => {
  // Break: an alg-none style bypass.
  assert.equal(A.verifyJwt('eyJzdWIiOiJ1LTEifQ.', SECRET), null);
  assert.equal(A.verifyJwt('', SECRET), null);
  assert.equal(A.verifyJwt('not-a-token', SECRET), null);
});

// ── identity resolution ────────────────────────────────────────────────────

test('resolveLogin trims and lowercases, so one account has one identity', () => {
  // Break: normalisation drifting between the lookup and the rate-limit key,
  // which is what let trailing whitespace bypass login lockout.
  const u = A.userByLoginId('ADM-001');
  assert.ok(u, 'seed admin must exist');
  for (const variant of ['ADM-001', 'adm-001', 'Adm-001', 'ADM-001 ', '  ADM-001', '\tADM-001']) {
    assert.equal(A.resolveLogin(variant)?.id, u.id, `variant: ${JSON.stringify(variant)}`);
  }
});

test('resolveLogin matches on email as well as login id', () => {
  // Break: email login removed, or matching case-sensitively.
  assert.ok(A.resolveLogin('admin@gohr.com'), 'email login must resolve');
  assert.ok(A.resolveLogin('ADMIN@GOHR.COM'), 'email match must be case-insensitive');
});

test('resolveLogin returns nothing for an unknown identity', () => {
  // Break: a fallback that resolves unknown ids to some account, which is how
  // a typo used to silently sign the user in as an employee.
  assert.ok(!A.resolveLogin('NO-SUCH-USER-9999'), 'unknown id must not resolve');
  assert.ok(!A.resolveLogin(''), 'empty id must not resolve');
  assert.ok(!A.resolveLogin(null), 'null id must not resolve');
});

// ── permissions ────────────────────────────────────────────────────────────

test('roleCan grants the admin wildcard for every permission', () => {
  // Break: the wildcard branch removed, locking admins out of their own API.
  for (const perm of ['users.write', 'geofence.read', 'security.write', 'audit.read', 'anything.at.all']) {
    assert.equal(A.roleCan('admin', perm), true, perm);
  }
});

test('roleCan denies a manager the write and admin-only permissions', () => {
  // Break: permission lists bleeding together, or a prefix wildcard matching
  // too much (e.g. "users.read" matching "users.write").
  assert.equal(A.roleCan('manager', 'employees.read'), true);
  assert.equal(A.roleCan('manager', 'users.read'), true);
  assert.equal(A.roleCan('manager', 'users.write'), false);
  assert.equal(A.roleCan('manager', 'geofence.write'), false);
  assert.equal(A.roleCan('manager', 'security.write'), false);
  assert.equal(A.roleCan('manager', 'audit.read'), false);
});

test('roleCan scopes an employee to their own records', () => {
  // Break: self-scoped permissions widening to the team-wide equivalent.
  assert.equal(A.roleCan('employee', 'attendance.read.self'), true);
  assert.equal(A.roleCan('employee', 'attendance.write.self'), true);
  assert.equal(A.roleCan('employee', 'attendance.read'), false);
  assert.equal(A.roleCan('employee', 'attendance.write'), false);
  assert.equal(A.roleCan('employee', 'payroll.read'), false);
  assert.equal(A.roleCan('employee', 'users.read'), false);
});

test('roleCan fails closed for an unknown role', () => {
  // Break: a default-allow, or a lookup that throws on a missing role.
  assert.equal(A.roleCan('nope', 'users.read'), false);
  assert.equal(A.roleCan('', 'users.read'), false);
  assert.equal(A.roleCan(null, 'users.read'), false);
});

test('permissionsOf returns an empty list for an unknown role', () => {
  // Break: permissionsOf throwing on a missing role, which 500s every
  // requirePerm() call for that user.
  assert.deepEqual(A.permissionsOf('nope'), []);
  assert.deepEqual(A.permissionsOf(undefined), []);
});

test('every documented role resolves to a non-empty permission list', () => {
  // Break: a role added to ROLES without a permission entry, which would make
  // that role silently powerless.
  for (const role of A.ROLES) {
    assert.ok(A.permissionsOf(role).length > 0, `${role} has no permissions`);
  }
});

// ── Iqama format ───────────────────────────────────────────────────────────

test('iqamaValid accepts a 10-digit number starting with 2', () => {
  // Break: the pattern loosening, accepting residencies that are not Iqamas.
  assert.equal(A.iqamaValid('2000000001'), true);
  assert.equal(A.iqamaValid('2123456789'), true);
});

test('iqamaValid rejects everything else', () => {
  // Break: a partial pattern that lets a passport or phone number through.
  for (const bad of ['1000000001', '3000000001', '200000001', '20000000011', '20000abcd', '', null, undefined]) {
    assert.equal(A.iqamaValid(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

// ── OTP ────────────────────────────────────────────────────────────────────

test('re-requesting an OTP replaces the challenge instead of duplicating it', () => {
  // Break: requestOtp pushing a second row for the same (kind, key), which
  // collided on the primary key and made every later saveDb() fail — an
  // unauthenticated remote DoS that took login down for the whole process.
  const key = '+966509990001';
  return Promise.all([
    A.requestOtp('phone', key, '+966500000001'),
    A.requestOtp('phone', key, '+966500000001'),
    A.requestOtp('phone', key, '+966500000001')
  ]).then(() => {
    const stored = A.db().otps.filter(o => o.kind === 'phone' && o.key === key);
    assert.equal(stored.length, 1, 'exactly one live challenge per identity');
  });
});

test('a challenge is delivered to a dialable number, not to the identity string', async () => {
  // Break: requestOtp using its `key` argument for BOTH the challenge identity
  // and the SMS destination. Callers pass an Iqama (2000000002) or a login id
  // (emp-003) as the key, so the code was SMS'd to "2000000002". A real
  // provider rejects that outright, so Iqama login and password reset fail
  // silently while the route still reports success.
  const r = await A.requestOtp('reset', 'emp-003', '+966500000003');
  assert.equal(r.sent, true);
  assert.equal(r.destination, '+966500000003');
  // the challenge is still keyed on the identity, so the right code verifies
  assert.equal(A.consumeOtp('reset', 'emp-003', r.devCode).ok, true);
});

test('a challenge with no dialable destination is refused, not silently dropped', async () => {
  // Break: an undeliverable code still being recorded as "sent", so the user is
  // told to check a message that will never arrive and the account is
  // unreachable through its only recovery path.
  const r = await A.requestOtp('reset', 'emp-004'); // no destination given
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'no_dialable_destination');
  // and no usable challenge is left behind
  assert.equal(A.consumeOtp('reset', 'emp-004', '000000').ok, false);
});

test('a non-dialable destination string is rejected', async () => {
  // Break: the destination being passed through unchecked, so a login id or an
  // empty value reaches the SMS provider as a destination.
  // NOTE: a bare 10-digit Iqama ("2000000002") is format-indistinguishable
  // from a phone number, so no pattern can reject it — that is precisely why
  // the callers now pass user.phone explicitly rather than reusing the key.
  // This test covers the cases a pattern CAN catch.
  // The pattern is E.164-shaped (optional +, 7-15 digits, no leading zero),
  // which is the right strictness for a pluggable SMS provider: it cannot know
  // each country's national numbering plan, so a short-but-well-formed
  // international number is accepted and the provider has the final say.
  for (const bad of ['emp-003', 'not-a-number', '+96650000000300123', '', '   ', '+', '00',
                     '+966 50 000 0003', '00966500000003']) {
    const r = await A.requestOtp('reset', `x-${bad}`, bad);
    assert.equal(r.sent, false, `"${bad}" must not be treated as dialable`);
    assert.equal(r.reason, 'no_dialable_destination', `"${bad}"`);
  }
});

test('a valid international number is accepted', async () => {
  // Break: an over-strict pattern rejecting legitimate Saudi or Gulf numbers.
  for (const good of ['+966500000003', '+966512345678', '966500000003', '+971501234567']) {
    const r = await A.requestOtp('phone', `p-${good}`, good);
    assert.equal(r.sent, true, `"${good}" should be dialable`);
  }
});

test('the store is still writable after repeated OTP requests', () => {
  // Break: a poisoned in-memory otps array that makes every subsequent write
  // throw, so login/refresh/user CRUD all return 500 until restart.
  assert.doesNotThrow(() => A.saveDb());
});

test('a new OTP code supersedes the previous one', () => {
  // Break: both codes staying valid, so a code the user already replaced can
  // still be used to sign in.
  const key = '+966509990002';
  return A.requestOtp('phone', key, '+966500000001').then((first) => {
    return A.requestOtp('phone', key, '+966500000001').then((second) => {
      assert.notEqual(first.devCode, second.devCode, 'a re-request must issue a fresh code');
      assert.equal(A.consumeOtp('phone', key, second.devCode).ok, true, 'newest code verifies');
      assert.equal(A.consumeOtp('phone', key, first.devCode).ok, false, 'superseded code is dead');
    });
  });
});

test('an OTP is single use', () => {
  // Break: the row surviving consumption, allowing replay of a one-time code.
  const key = '+966509990003';
  return A.requestOtp('phone', key, '+966500000001').then((r) => {
    assert.equal(A.consumeOtp('phone', key, r.devCode).ok, true);
    assert.equal(A.consumeOtp('phone', key, r.devCode).ok, false, 'second use must fail');
  });
});

test('a wrong OTP code is refused and counted against the attempt limit', () => {
  // Break: the attempt counter not incrementing, giving unlimited guesses at a
  // 6-digit code (1 in a million, 3 tries).
  const key = '+966509990004';
  return A.requestOtp('phone', key, '+966500000001').then(() => {
    for (let i = 0; i < A.OTP_MAX_ATTEMPTS; i++) {
      assert.equal(A.consumeOtp('phone', key, '000000').ok, false, `attempt ${i + 1} must fail`);
    }
    const after = A.db().otps.find(o => o.kind === 'phone' && o.key === key);
    assert.equal(after, undefined, 'the challenge is dropped once attempts are exhausted');
  });
});

test('OTP kinds are keyed independently', () => {
  // Break: keying on the identity alone, so a 'reset' challenge for an
  // employee and a 'phone' challenge for the same person collide.
  const key = '+966509990005';
  return A.requestOtp('phone', key, '+966500000001').then(() => {
    return A.requestOtp('reset', key, '+966500000001').then((r) => {
      const stored = A.db().otps.filter(o => o.key === key);
      assert.equal(stored.length, 2, 'phone and reset challenges coexist');
      assert.equal(A.consumeOtp('reset', key, r.devCode).ok, true, 'the reset code verifies');
      assert.equal(A.consumeOtp('phone', key, r.devCode).ok, false, 'the phone code does not');
    });
  });
});

test('an OTP issued for one identity cannot be redeemed by another', () => {
  // Break: consumeOtp matching on the code alone rather than (kind, key).
  const mine = '+966509990006';
  const theirs = '+966509990007';
  return A.requestOtp('phone', mine, '+966500000001').then((r) => {
    assert.equal(A.consumeOtp('phone', theirs, r.devCode).ok, false);
  });
});

test('an expired OTP is refused as expired, not merely invalid', () => {
  // Break: the exp check dropped, so a stale code stays redeemable.
  const key = '+966509990008';
  return A.requestOtp('phone', key, '+966500000001').then((r) => {
    const row = A.db().otps.find(o => o.kind === 'phone' && o.key === key);
    row.exp = Math.floor(Date.now() / 1000) - 1;
    A.saveDb();
    const out = A.consumeOtp('phone', key, r.devCode);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'code_expired');
  });
});

// ── rate limiting ──────────────────────────────────────────────────────────

test('rateLimit blocks once the cap is reached and reports a retry delay', () => {
  // Break: the limiter letting attempts through, enabling online guessing.
  const key = 'test:rl:' + Date.now();
  for (let i = 0; i < 3; i++) {
    assert.equal(A.rateLimit(key, 3, 60_000).ok, true, `attempt ${i + 1} must pass`);
  }
  const blocked = A.rateLimit(key, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0, 'a retry delay must be reported');
});

test('rateLimitPeek reports lockout without recording an attempt', () => {
  // Break: a peek that consumes budget, so merely checking would lock a user out.
  const key = 'test:peek:' + Date.now();
  assert.equal(A.rateLimitPeek(key, 2, 60_000).ok, true);
  assert.equal(A.rateLimitPeek(key, 2, 60_000).ok, true);
  // Two peeks consumed nothing, so the first real attempt must still pass.
  assert.equal(A.rateLimit(key, 2, 60_000).ok, true, 'peek must not have consumed the budget');
  assert.equal(A.rateLimit(key, 2, 60_000).ok, true);
  assert.equal(A.rateLimit(key, 2, 60_000).ok, false, 'the third real attempt trips the limit');
});

test('rateLimitReset clears a lockout', () => {
  // Break: no way to clear, locking a legitimate user out for the full window.
  const key = 'test:reset:' + Date.now();
  A.rateLimit(key, 1, 60_000);
  assert.equal(A.rateLimit(key, 1, 60_000).ok, false);
  A.rateLimitReset(key);
  assert.equal(A.rateLimit(key, 1, 60_000).ok, true);
});

// ── geofence ───────────────────────────────────────────────────────────────

test('geofenceDecide allows a country on the list', () => {
  // Break: the allow-list inverted or ignored.
  const out = A.geofenceDecide({ ok: true, country: 'SA', source: 'ip-api' });
  assert.equal(out.allowed, true);
});

test('geofenceDecide blocks a country that is not on the list', () => {
  // Break: fail-open by default letting a non-Saudi login through.
  const out = A.geofenceDecide({ ok: true, country: 'US', source: 'ip-api' });
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'country_not_allowed');
});

test('geofenceDecide falls back to the configured failMode when geo is unknown', () => {
  // Break: an unresolvable country being treated as allowed regardless of the
  // configured failMode, so the admin setting does nothing.
  const saved = A.db().geofence.failMode;
  A.db().geofence.failMode = 'closed';
  assert.equal(A.geofenceDecide({ ok: false, source: 'unresolved' }).allowed, false);
  A.db().geofence.failMode = 'open';
  assert.equal(A.geofenceDecide({ ok: false, source: 'unresolved' }).allowed, true);
  A.db().geofence.failMode = saved;
});

test('geofenceDecide treats a local source as allowed regardless of failMode', () => {
  // Break: a local request being sent to the external geo lookup at all.
  A.db().geofence.failMode = 'closed';
  assert.equal(A.geofenceDecide({ source: 'local' }).allowed, true);
  A.db().geofence.failMode = 'open';
});

test('geofenceDecide honours an expanded allow-list', () => {
  // Break: the country list being read once and cached, so an admin widening
  // it has no effect.
  const saved = JSON.parse(JSON.stringify(A.db().geofence));
  A.db().geofence.allowedCountries = ['SA', 'AE'];
  assert.equal(A.geofenceDecide({ ok: true, country: 'AE', source: 'ip-api' }).allowed, true);
  A.db().geofence = saved;
  assert.equal(A.geofenceDecide({ ok: true, country: 'AE', source: 'ip-api' }).allowed, false);
});

test('isPrivateIp recognises loopback and RFC1918 ranges', () => {
  // Break: private-range detection dropping, so a proxied or local request is
  // sent to the external geo lookup instead of being treated as local.
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.1.1']) {
    assert.equal(A.isPrivateIp(ip), true, ip);
  }
  // node reports these for a local client on a dual-stack listener
  for (const ip of ['::1', '::ffff:127.0.0.1', '::ffff:127.0.0.53', 'local', '']) {
    assert.equal(A.isPrivateIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '203.0.113.9', '2001:4860:4860::8888']) {
    assert.equal(A.isPrivateIp(ip), false, ip);
  }
});

// ── store migrations ───────────────────────────────────────────────────────

test('ensureMigrations restores a missing roles matrix', () => {
  // Break: the roles backfill only running when roles already exists, so a
  // snapshot missing that key made every requirePerm() throw.
  const d = { secret: 's', geofence: { allowedCountries: ['SA'], failMode: 'open' }, users: [], logs: [] };
  A.ensureMigrations(d);
  assert.ok(d.roles, 'roles must exist after migration');
  assert.deepEqual(d.roles.admin.permissions, ['*']);
  assert.ok(d.roles.vendor.permissions.includes('payslip.read.self'));
  assert.deepEqual(A.permissionsOf('admin'), ['*']);
});

test('ensureMigrations mints a signing secret when the store has none', () => {
  // Break: no secret backfill, so signJwt threw on an undefined key and every
  // login returned 500.
  const d = { geofence: { allowedCountries: ['SA'], failMode: 'open' }, users: [], logs: [] };
  A.ensureMigrations(d);
  assert.equal(typeof d.secret, 'string');
  assert.ok(d.secret.length >= 32, 'the minted secret must be long enough to sign with');
  const token = A.signJwt({ sub: 'u-1', typ: 'access' }, d.secret, 60);
  assert.equal(A.verifyJwt(token, d.secret).sub, 'u-1');
});

test('ensureMigrations leaves an existing secret and roles untouched', () => {
  // Break: the migration clobbering live values, which would silently
  // invalidate every issued token and every stored permission.
  const roles = { admin: { labelEn: 'Administrator', permissions: ['*'] } };
  const d = { secret: 'keep-me', roles, users: [], logs: [] };
  A.ensureMigrations(d);
  assert.equal(d.secret, 'keep-me');
  assert.equal(d.roles, roles, 'the existing roles object must be reused, not replaced');
});

// ── session lifecycle ──────────────────────────────────────────────────────

test('revokeAllFor kills every session for a user', () => {
  // Break: revocation missing a session, so a password reset leaves a live
  // refresh token behind.
  const u = A.userByLoginId('MGR-001');
  const tokens = A.issueTokens(u, '1.1.1.1');
  assert.ok(A.listSessions(u.id).length > 0, 'a session exists before revocation');
  A.revokeAllFor(u.id);
  assert.equal(A.listSessions(u.id).length, 0, 'no session survives revocation');
  assert.equal(A.rotateRefresh(tokens.refreshToken, '1.1.1.1'), null, 'the refresh token is dead');
});

test('a rotated refresh token is dead once its replacement exists', () => {
  // Break: prevHash being set to the row's OWN hash, so the grace lookup
  // matched the token the client had just rotated. Re-presenting a spent token
  // then minted a fresh session, which is precisely what rotation exists to
  // prevent — a stolen token stayed usable after the legitimate client rotated.
  const u = A.userByLoginId('MGR-001');
  const first = A.issueTokens(u, '1.1.1.7');
  const second = A.rotateRefresh(first.refreshToken, '1.1.1.7');
  assert.ok(second, 'the first rotation succeeds');
  const third = A.rotateRefresh(second.refreshToken, '1.1.1.7');
  assert.ok(third, 'the second rotation succeeds');
  // the original token is spent and stays spent
  assert.equal(A.rotateRefresh(first.refreshToken, '1.1.1.7'), null,
    'a token rotated two generations ago must be refused');
});

test('a parallel-tab replay is recorded as a security event', () => {
  // Break: the reuse going unrecorded, so a stolen token being replayed looks
  // identical to a second tab refreshing and nobody ever learns about it.
  // Counts reuse events rather than slicing by index: the audit log is capped,
  // so an index-based slice is unreliable once the cap is reached.
  const u = A.createUser({ loginId: 'TST-RFS-002', nameEn: 'Reuse Logged', role: 'employee', password: 'reuse-pass1' });
  const pair = A.issueTokens(u, '1.1.1.8');
  A.rotateRefresh(pair.refreshToken, '1.1.1.8');
  const reuseEvents = () => A.db().logs.filter(e => /reuse/i.test(String(e.event))).length;
  const before = reuseEvents();
  A.rotateRefresh(pair.refreshToken, '1.1.1.8'); // the replay
  assert.ok(reuseEvents() > before,
    `a replay must be logged as a reuse event (saw ${reuseEvents()}, had ${before})`);
});

test('exhausting the grace window kills the whole token family', () => {
  // Break: the grace budget never being enforced, so a captured token could be
  // replayed indefinitely. Once the bounded window is spent, every session
  // descended from that login must die. Uses a fresh user so the assertion
  // cannot be satisfied by unrelated sessions from another test.
  const u = A.createUser({ loginId: 'TST-RFS-001', nameEn: 'Reuse Family', role: 'employee', password: 'reuse-pass1' });
  const first = A.issueTokens(u, '1.1.1.9');
  A.rotateRefresh(first.refreshToken, '1.1.1.9');
  let issued = 0;
  let stopped = false;
  for (let i = 0; i < 12; i++) {
    const out = A.rotateRefresh(first.refreshToken, '1.1.1.9');
    if (!out) {stopped = true; break;}
    issued += 1;
  }
  assert.ok(stopped, 'the grace window must be finite — 12 replays cannot all succeed');
  assert.ok(issued <= A.OTP_MAX_ATTEMPTS + 2, `grace must stay bounded, issued ${issued}`);
  assert.equal(A.listSessions(u.id).length, 0,
    'every session in the family is revoked once reuse is proven');
});

test('the refresh token that legitimately rotated still works once', () => {
  // Break: the fix over-correcting and refusing the very next rotation, which
  // would log the user out on every page load.
  const u = A.userByLoginId('EMP-002');
  const pair = A.issueTokens(u, '1.1.1.10');
  const next = A.rotateRefresh(pair.refreshToken, '1.1.1.10');
  assert.ok(next && next.refreshToken, 'rotation must yield a usable successor');
  const next2 = A.rotateRefresh(next.refreshToken, '1.1.1.10');
  assert.ok(next2 && next2.refreshToken, 'and the successor must rotate too');
});

test('refresh rotation is bound to a family so a family can be revoked', () => {
  // Break: rows carrying no family id, so there is no unit to revoke when reuse
  // is detected and the attacker keeps the rest of the chain.
  const u = A.userByLoginId('MGR-003');
  const a = A.issueTokens(u, '1.1.1.11');
  const rows = A.db().refresh.filter(r => r.userId === u.id);
  const row = rows.find(r => r.hash && !r.family);
  assert.equal(row, undefined, 'every issued refresh row must belong to a family');
  const b = A.rotateRefresh(a.refreshToken, '1.1.1.11');
  const successor = A.db().refresh.find(r => r.userId === u.id && r.family);
  assert.ok(successor, 'the rotated row must inherit the family');
  assert.ok(b, 'rotation still works');
});

test('a revoked refresh token cannot be exchanged', () => {
  // Break: logout not revoking, so a stolen refresh token outlives the session.
  const u = A.userByLoginId('EMP-001');
  const tokens = A.issueTokens(u, '1.1.1.2');
  A.revokeRefresh(tokens.refreshToken);
  assert.equal(A.rotateRefresh(tokens.refreshToken, '1.1.1.2'), null);
});

test('changePassword revokes existing sessions', () => {
  // Break: the revocation call dropped from the password-change path, so a
  // session stolen before the change survives it.
  const created = A.createUser({
    loginId: 'TST-CHG-001', nameEn: 'Change Test', role: 'employee', password: 'before-pass1'
  });
  const old = A.issueTokens(created, '1.1.1.3');
  A.changePassword(created.id, 'before-pass1', 'after-pass2');
  assert.equal(A.rotateRefresh(old.refreshToken, '1.1.1.3'), null, 'old refresh must be dead');
  assert.equal(A.verifyPassword(A.db().users.find(u => u.id === created.id), 'after-pass2'), true);
});

test('changePassword refuses the wrong current password', () => {
  // Break: the current-password check removed, letting anyone who knows a
  // login id take over the account.
  const created = A.createUser({
    loginId: 'TST-CHG-002', nameEn: 'Change Test 2', role: 'employee', password: 'right-pass1'
  });
  const out = A.changePassword(created.id, 'wrong-pass1', 'new-pass2');
  assert.equal(out.error, 'wrong_current_password');
  assert.equal(A.verifyPassword(A.db().users.find(u => u.id === created.id), 'right-pass1'), true,
    'the original password must still work');
});

test('changePassword refuses a new password below the policy minimum', () => {
  // Break: the length check dropped, allowing a one-character password.
  const created = A.createUser({
    loginId: 'TST-CHG-003', nameEn: 'Change Test 3', role: 'employee', password: 'good-pass1'
  });
  const out = A.changePassword(created.id, 'good-pass1', 'x');
  assert.equal(out.error, 'password_too_short');
});

test('an admin-initiated password reset revokes the target sessions', async () => {
  // Break: the revocation call dropped from updateUser. The victim keeps a
  // working access token AND a working refresh token after the admin resets
  // their password, so the remediation is cosmetic and a stolen session
  // outlives it. changePassword already does this correctly — the admin path
  // must match it.
  const created = A.createUser({
    loginId: 'TST-ADM-001', nameEn: 'Admin Reset', role: 'employee', password: 'first-pass1'
  });
  const stolen = A.issueTokens(created, '1.1.1.5');
  assert.ok(A.listSessions(created.id).length > 0, 'a session exists before the reset');

  const out = A.updateUser(created.id, { password: 'second-pass2' }, 'u-admin');
  assert.ok(!out.error, `the reset must succeed, got ${JSON.stringify(out.error)}`);

  assert.equal(A.rotateRefresh(stolen.refreshToken, '1.1.1.5'), null,
    'the stolen refresh token must be dead after an admin reset');
  assert.equal(A.listSessions(created.id).length, 0, 'no session survives the reset');

  // and the access token must be rejected too, via pwChangedAt
  const auth = A.requireAuth({ headers: { authorization: `Bearer ${stolen.accessToken}` } });
  assert.equal(auth.error?.[1], 'password_changed');

  assert.equal(A.verifyPassword(A.db().users.find(u => u.id === created.id), 'second-pass2'), true,
    'the new password works');
});

test('an admin update that does not touch the password keeps sessions alive', () => {
  // Break: the revocation firing on every update, which would log the user out
  // every time an admin fixes their name or phone number.
  const created = A.createUser({
    loginId: 'TST-ADM-002', nameEn: 'Admin Edit', role: 'employee', password: 'keep-pass1'
  });
  const live = A.issueTokens(created, '1.1.1.6');
  A.updateUser(created.id, { nameEn: 'Renamed' }, 'u-admin');
  assert.equal(A.listSessions(created.id).length, 1, 'a rename must not revoke sessions');
  assert.ok(A.rotateRefresh(live.refreshToken, '1.1.1.6'), 'the refresh token must still work');
});

test('an admin reset refuses a password below the policy minimum', () => {
  // Break: the length check dropped, letting an admin set a one-character
  // password on any account.
  const created = A.createUser({
    loginId: 'TST-ADM-003', nameEn: 'Short Reset', role: 'employee', password: 'good-pass1'
  });
  const out = A.updateUser(created.id, { password: 'x' }, 'u-admin');
  assert.equal(out.error, 'password_too_short');
  assert.equal(A.verifyPassword(A.db().users.find(u => u.id === created.id), 'good-pass1'), true,
    'the old password must still work after a refused reset');
});

test('a role escalation through updateUser takes effect immediately', () => {
  // Break: the role field not being written, so promoting an account silently
  // does nothing while the UI reports success.
  const created = A.createUser({
    loginId: 'TST-ADM-004', nameEn: 'Promote', role: 'employee', password: 'promo-pass1'
  });
  A.updateUser(created.id, { role: 'manager' }, 'u-admin');
  const u = A.db().users.find(x => x.id === created.id);
  assert.equal(u.role, 'manager');
  assert.equal(A.roleCan('manager', 'employees.read'), true);
});

test('an unknown role is refused rather than silently coerced', () => {
  // Break: role validation dropped on update, so a typo grants a role that has
  // no permission entry and the account becomes powerless.
  const created = A.createUser({
    loginId: 'TST-ADM-005', nameEn: 'Bad Role', role: 'employee', password: 'role-pass1'
  });
  const out = A.updateUser(created.id, { role: 'superuser' }, 'u-admin');
  assert.ok(out.error, 'an unknown role must be refused');
  assert.equal(A.db().users.find(x => x.id === created.id).role, 'employee');
});

// ── Google account linking ─────────────────────────────────────────────────

test('a Google sign-in does not hijack a local account by email alone', () => {
  // Break: the email branch of the lookup being unconditional. Google account
  // creation does not require the address to be verified, so anyone who
  // registers a Google account using a colleague's address — including the
  // seeded admin@gohr.com — would be issued that colleague's session.
  const before = A.userByLoginId('ADM-001');
  const attacker = A.upsertGoogleUser({ sub: 'google-attacker-1', email: 'admin@gohr.com', email_verified: false, name: 'Attacker' });
  assert.notEqual(attacker.id, before.id,
    'an unverified Google email must not resolve to an existing local account');
  assert.equal(attacker.role, 'employee', 'a fresh Google account is an employee');
});

test('a verified Google email can link to the matching local account', () => {
  // Break: the verified path being broken, so legitimate Google users can never
  // reach the account they already have.
  const created = A.createUser({
    loginId: 'TST-GGL-001', nameEn: 'Google Link', role: 'employee',
    password: 'link-pass1', email: 'link.tester@example.com'
  });
  const linked = A.upsertGoogleUser({ sub: 'google-good-1', email: 'link.tester@example.com', email_verified: true, name: 'Google Link' });
  assert.equal(linked.id, created.id, 'a verified email links to the real account');
  assert.equal(linked.googleSub, 'google-good-1', 'the Google subject is recorded');
});

test('a Google subject match links regardless of the email field', () => {
  // Break: the sub lookup dropped, so a returning Google user is duplicated
  // into a second account on every sign-in.
  const first = A.upsertGoogleUser({ sub: 'google-stable-1', email: 'stable@example.com', email_verified: true, name: 'Stable' });
  const second = A.upsertGoogleUser({ sub: 'google-stable-1', email: 'stable@example.com', email_verified: true, name: 'Stable' });
  assert.equal(second.id, first.id, 'the same Google subject must resolve to one account');
  const matches = A.db().users.filter(u => u.googleSub === 'google-stable-1');
  assert.equal(matches.length, 1, 'no duplicate account is created');
});

// ── failed writes must not persist ─────────────────────────────────────────

test('a write that cannot be persisted leaves no trace in memory', () => {
  // Break: mutating the in-memory snapshot without a rollback point. The
  // snapshot is the source of truth and every later save flushes it, so a
  // mutation whose persist FAILS would still be applied a moment later — that
  // is how one bad OTP request took the whole API down for the life of the
  // process.
  //
  // A real constraint violation makes the persist throw: two rows sharing a
  // login_id break the users.login_id unique index, the same class of failure
  // as the original OTP collision.
  A.createUser({ loginId: 'TST-RB-001', nameEn: 'Rollback', role: 'employee', password: 'roll-pass1' });
  const goodCount = A.db().users.length;
  const nameBefore = A.db().users.find(u => u.loginId === 'TST-RB-001').nameEn;

  assert.throws(
    () => A.mutate((d) => { d.users.push({ id: 'u-dup', loginId: 'TST-RB-001', nameEn: 'DUPLICATE', role: 'employee', status: 'active' }); }),
    /UNIQUE|constraint/i,
    'the persist must fail on the unique index'
  );

  assert.equal(A.db().users.filter(u => u.loginId === 'TST-RB-001').length, 1,
    'the rolled-back row must not linger in the snapshot');
  assert.equal(A.db().users.length, goodCount, 'the user count returns to its pre-failure value');
  assert.equal(A.db().users.find(u => u.loginId === 'TST-RB-001').nameEn, nameBefore,
    'the existing record is untouched');

  // …and the store is immediately usable again.
  assert.doesNotThrow(() => A.saveDb(), 'a later save must succeed');
  assert.equal(A.db().users.filter(u => u.loginId === 'TST-RB-001').length, 1);
});

test('a successful mutation is persisted by mutate()', () => {
  // Break: mutate() swallowing the write, so the change looks applied in memory
  // but never reaches disk and vanishes on restart.
  const created = A.createUser({ loginId: 'TST-RB-002', nameEn: 'Persist OK', role: 'employee', password: 'ok-pass1' });
  const out = A.mutate((d) => {
    const u = d.users.find(x => x.id === created.id);
    u.nameEn = 'Persisted';
    return u;
  });
  assert.equal(out.nameEn, 'Persisted');
  // read it back through a fresh load path
  const reloaded = A.db().users.find(x => x.id === created.id);
  assert.equal(reloaded.nameEn, 'Persisted');
});

// ── rate limiter must not grow without bound ───────────────────────────────

test('the rate limiter does not retain expired buckets forever', async () => {
  // Break: buckets only being pruned for the key being touched. The keys embed
  // user-supplied values (login id, phone), so an attacker sending millions of
  // distinct values grows the map permanently — a memory-exhaustion DoS.
  const before = A.rateLimiterSize();
  for (let i = 0; i < 500; i++) {
    A.rateLimit(`flood:${i}:${Date.now()}`, 5, 5); // 5ms window
  }
  const grown = A.rateLimiterSize();
  assert.ok(grown >= before + 500, `the limiter did record the new keys (${before} -> ${grown})`);
  // The loop above is synchronous, so the window has not actually elapsed yet.
  // Wait past it, otherwise every bucket still counts as live.
  await new Promise(r => setTimeout(r, 25));
  A.sweepRateLimits();
  const swept = A.rateLimiterSize();
  // Buckets from earlier tests may still be live, so assert the flood itself is
  // gone rather than that only the baseline remains.
  assert.ok(grown - swept >= 500,
    `all 500 expired flood buckets must be swept (${grown} -> ${swept}, only ${grown - swept} removed)`);
  assert.ok(swept >= before - 5, 'the sweep must not remove live buckets');
});

test('the rate limiter refuses to exceed its bucket cap', () => {
  // Break: no ceiling on distinct keys, so a flood is unbounded even with a
  // sweep, between sweeps.
  const cap = A.RATE_LIMIT_MAX_BUCKETS;
  assert.ok(cap > 0, 'a bucket cap must be configured');
  const before = A.rateLimiterSize();
  for (let i = 0; i < cap + 200; i++) {
    A.rateLimit(`cap-flood:${i}:${Date.now()}`, 5, 600_000);
  }
  const size = A.rateLimiterSize();
  assert.ok(size <= cap, `bucket count must stay at or below the cap (${size} > ${cap})`);
  assert.ok(before >= 0);
});

test('a swept bucket does not lock a legitimate user out', () => {
  // Break: the sweep evicting a LIVE bucket, silently removing the lockout
  // that is protecting an account under attack.
  const key = 'sweep-live:' + Date.now();
  for (let i = 0; i < 5; i++) { A.rateLimit(key, 5, 600_000); }
  assert.equal(A.rateLimit(key, 5, 600_000).ok, false, 'the bucket is locked');
  A.sweepRateLimits();
  assert.equal(A.rateLimit(key, 5, 600_000).ok, false, 'a live lockout must survive the sweep');
});

test('publicUser never leaks the password hash or salt', () => {
  // Break: a spread that carries pwHash/pwSalt to the client, handing an
  // offline cracking target to anyone who can read /auth/me.
  const u = A.userByLoginId('ADM-001');
  const pub = A.publicUser(u);
  assert.equal(pub.pwHash, undefined);
  assert.equal(pub.pwSalt, undefined);
  assert.equal(pub.googleSub, undefined);
  assert.equal(pub.role, 'admin');
  assert.ok(Array.isArray(pub.permissions));
});

test('createUser rejects a duplicate login id without corrupting the store', () => {
  // Break: the uniqueness check dropped, so the raw SQLite error escapes AND
  // the duplicate stays in the in-memory array — making every later save fail,
  // exactly the poison the OTP table had. The client already handles this code.
  const out = A.createUser({
    loginId: 'ADM-001', nameEn: 'Clash', role: 'admin', password: 'whatever1'
  });
  assert.equal(out.error, 'login_id_taken');
  assert.equal(out.id, undefined, 'no user object is returned on refusal');
  const clashes = A.db().users.filter(u => String(u.loginId).toLowerCase() === 'adm-001');
  assert.equal(clashes.length, 1, 'the rejected user was never added to the array');
  assert.doesNotThrow(() => A.saveDb(), 'the store must still be writable');
});

test('createUser rejects a duplicate login id regardless of case or padding', () => {
  // Break: normalising only one side of the comparison, so "adm-001 " creates a
  // second account for the same person.
  for (const variant of ['adm-001', 'ADM-001 ', '  Adm-001']) {
    const out = A.createUser({ loginId: variant, nameEn: 'Clash', role: 'admin', password: 'whatever1' });
    assert.equal(out.error, 'login_id_taken', `variant ${JSON.stringify(variant)} must be refused`);
  }
});

test('createUser refuses an empty login id', () => {
  // Break: a blank id being accepted, creating an account that cannot be
  // looked up but still authenticates by email.
  const out = A.createUser({ loginId: '   ', nameEn: 'Blank', role: 'employee', password: 'whatever1' });
  assert.ok(out.error, 'a blank login id must be refused');
});

test('a disabled account cannot be logged into', () => {
  // Break: the status check dropped from login, so a terminated employee keeps
  // working credentials.
  const created = A.createUser({
    loginId: 'TST-DIS-001', nameEn: 'Disable Test', role: 'employee', password: 'pass12345'
  });
  assert.equal(A.verifyPassword(A.db().users.find(u => u.id === created.id), 'pass12345'), true);
  A.updateUser(created.id, { status: 'disabled' }, 'u-admin');
  assert.equal(A.db().users.find(u => u.id === created.id).status, 'disabled');
  // requireAuth is what gates every protected route.
  const auth = A.requireAuth({ headers: { authorization: `Bearer ${A.issueTokens(created, '1.1.1.4').accessToken}` } });
  assert.equal(auth.error?.[1], 'account_disabled');
});

// ── db status ──────────────────────────────────────────────────────────────

test('dbStatus reports the driver, tables and integrity', () => {
  // Break: the admin Users page losing its storage panel, or integrity going
  // unmonitored.
  const st = A.dbStatus();
  assert.equal(st.driver, 'sqlite');
  assert.equal(st.integrity, 'ok');
  const names = st.tables.map(x => x.name);
  for (const t of ['meta', 'users', 'sessions', 'otps', 'audit_log']) {
    assert.ok(names.includes(t), `missing table ${t}`);
  }
});
