// goHR auth API — route table. Mounted by server/index.mjs (standalone) and
// proxied by vite (/auth, /api → API_URL, default http://localhost:8080).

import {
  db, saveDb, logEvent, issueTokens, rotateRefresh, revokeRefresh, revokeAllFor, listSessions,
  requireAuth, requirePerm, rateLimit, rateLimitPeek, rateLimitReset, verifyPassword, userByLoginId, resolveLogin, createUser, updateUser, deleteUser, ROLES,
  getPolicy, setPolicy, changePassword, requestReset, resetPassword, dbStatus,
  requestOtp, consumeOtp, iqamaValid, findUser, upsertGoogleUser,
  resolveIp, lookupCountry, geofenceDecide, googleConfigured, googleStart,
  googleExchange, issueOauthCode, consumeOauthCode, IS_PROD, publicUser, permissionsOf
} from './auth-core.mjs';

const ALLOWED_ORIGINS = (process.env.AUTH_CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

let _req = null;
const json = (res, code, obj, req = _req) => {
  const body = JSON.stringify(obj);
  const origin = req?.headers?.origin || (req ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}` : '');
  const headers = {
    'content-type': 'application/json; charset=utf-8'
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers['access-control-allow-headers'] = 'authorization, content-type';
    headers['access-control-allow-methods'] = 'GET, POST, PUT, OPTIONS';
  }
  res.writeHead(code, headers);
  res.end(body);
};
const bearer = (req) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 65536) {return {};}
  }
  try {return JSON.parse(raw || '{}');} catch (_e) {return {};}
}

// Shared login path: geofence → tokens → audit log. `bypass` is for /auth/test.
async function loginFor(res, user, req, { bypass = false, event = 'login', state } = {}) {
  const ip = resolveIp(req);
  const geo = await lookupCountry(ip);
  const fence = geofenceDecide(geo);
  if (!bypass && !fence.allowed) {
    logEvent({ event: 'login_blocked', userId: user.id, ip, country: geo.country || geo.source, ok: false, reason: fence.reason });
    json(res, 403, { error: 'country_not_allowed', country: geo.country || null, allowedCountries: db().geofence.allowedCountries });
    return false;
  }
  const tokens = issueTokens(user, ip);
  logEvent({ event, userId: user.id, ip, country: geo.country || geo.source, ok: true, reason: bypass ? 'dev_bypass' : fence.reason });
  json(res, 200, state ? { ...tokens, state } : tokens);
  return true;
}

const maskPhone = (p) => (p ? `${p.slice(0, 6)}••••${p.slice(-2)}` : '');

export async function handleAuth(req, res) {
  _req = req;
  const respond = (code, obj) => json(res, code, obj, req);
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  if (req.method === 'OPTIONS') {_req = null; return respond( 204, {});}

  try {
    // ── health ──
    if (path === '/' || path === '/auth/health') {
      return respond( 200, { ok: true, service: 'gohr-auth', env: IS_PROD ? 'production' : 'development', google: googleConfigured() });
    }

    // ── simple login: login ID + password ──
    // The ID prefix says what the account is (ADM/MGR/EMP/VND); the stored
    // role is the source of truth and drives RBAC + post-login routing.
    if (req.method === 'POST' && path === '/auth/login') {
      const ip0 = resolveIp(req);
      const body = await readBody(req);
      const rlKey = `login:${ip0}:${String(body.loginId || '').toLowerCase()}`;
      // lockout counts FAILED attempts only — successful sign-ins must never
      // trip it; a success clears the bucket for this key.
      const rl = rateLimitPeek(rlKey, 5, 10 * 60 * 1000);
      if (!rl.ok) {
        logEvent({ event: 'login', loginId: body.loginId, ip: ip0, ok: false, reason: 'rate_limited' });
        res.setHeader('retry-after', String(rl.retryAfter));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: rl.retryAfter });
      }
      const user = resolveLogin(body.loginId);
      if (!user || !verifyPassword(user, body.password)) {
        rateLimit(rlKey, 5, 10 * 60 * 1000);
        logEvent({ event: 'login', loginId: body.loginId, ip: ip0, ok: false, reason: user ? 'bad_password' : 'unknown_login_id' });
        return respond( 401, { error: 'invalid_credentials' });
      }
      if (user.status === 'disabled') {
        logEvent({ event: 'login', userId: user.id, ip: ip0, ok: false, reason: 'account_disabled' });
        return respond( 403, { error: 'account_disabled' });
      }
      rateLimitReset(rlKey); // a win wipes prior failures
      return loginFor(res, user, req, { event: 'login' });
    }

    // ── OTP: request (rate limited: 3 per number / 10 min, 10 per IP / 10 min) ──
    if (req.method === 'POST' && path === '/auth/otp/request') {
      const body = await readBody(req);
      const ip0 = resolveIp(req);
      const limiterKey = body.phone ? `otp:phone:${body.phone}` : body.iqama ? `otp:iqama:${body.iqama}` : `otp:ip:${ip0}`;
      const rlKey = rateLimit(limiterKey, 3, 10 * 60 * 1000);
      const rlIp = rateLimit(`otp:ip:${ip0}`, 10, 10 * 60 * 1000);
      if (!rlKey.ok || !rlIp.ok) {
        logEvent({ event: 'otp_request', ip: ip0, ok: false, reason: 'rate_limited' });
        res.setHeader('retry-after', String(Math.max(rlKey.retryAfter || 0, rlIp.retryAfter || 0)));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: Math.max(rlKey.retryAfter || 0, rlIp.retryAfter || 0) });
      }
      const { phone, iqama } = body;
      if (iqama !== undefined && iqama !== '') {
        if (!iqamaValid(iqama)) {
          logEvent({ event: 'otp_request', iqama, ip: resolveIp(req), ok: false, reason: 'invalid_iqama_format' });
          return respond( 400, { error: 'invalid_iqama_format', hint: "Iqama must start with '2' and be 10 digits" });
        }
        const user = findUser({ iqama });
        if (!user) {
          logEvent({ event: 'otp_request', iqama, ip: resolveIp(req), ok: false, reason: 'unknown_iqama' });
          return respond( 404, { error: 'user_not_found' });
        }
        const otp = await requestOtp('iqama', user.iqama);
        logEvent({ event: 'otp_request', userId: user.id, ip: resolveIp(req), ok: true, reason: 'iqama' });
        return respond( 200, { ...otp, kind: 'iqama', iqama: user.iqama, phoneMasked: maskPhone(user.phone) });
      }
      if (phone) {
        const user = findUser({ phone: String(phone).trim() });
        if (!user) {
          logEvent({ event: 'otp_request', phone, ip: resolveIp(req), ok: false, reason: 'unknown_phone' });
          return respond( 404, { error: 'user_not_found' });
        }
        const otp = await requestOtp('phone', user.phone);
        logEvent({ event: 'otp_request', userId: user.id, ip: resolveIp(req), ok: true, reason: 'phone' });
        return respond( 200, { ...otp, kind: 'phone', phoneMasked: maskPhone(user.phone) });
      }
      return respond( 400, { error: 'phone_or_iqama_required' });
    }

    // ── OTP: verify (login; rate limited 15/IP/10min) ──
    if (req.method === 'POST' && path === '/auth/otp/verify') {
      const rlV = rateLimit(`otpver:${resolveIp(req)}`, 15, 10 * 60 * 1000);
      if (!rlV.ok) {
        res.setHeader('retry-after', String(rlV.retryAfter));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: rlV.retryAfter });
      }
      const body = await readBody(req);
      const user = body.iqama ? findUser({ iqama: body.iqama }) : findUser({ phone: String(body.phone || '').trim() });
      if (!user) {return respond( 404, { error: 'user_not_found' });}
      const kind = body.iqama ? 'iqama' : 'phone';
      const key = body.iqama ? user.iqama : user.phone;
      const check = consumeOtp(kind, key, body.code);
      if (!check.ok) {
        logEvent({ event: 'otp_verify', userId: user.id, ip: resolveIp(req), ok: false, reason: check.reason });
        return respond( 401, { error: check.reason });
      }
      return loginFor(res, user, req, { event: 'login_otp' });
    }

    // ── Iqama login (validates format, then OTP challenge) ──
    if (req.method === 'POST' && path === '/auth/iqama/login') {
      const ip0 = resolveIp(req);
      const rlIp = rateLimit(`iqama-ip:${ip0}`, 10, 10 * 60 * 1000);
      if (!rlIp.ok) {
        res.setHeader('retry-after', String(rlIp.retryAfter));
        return respond(429, { error: 'too_many_requests', retryAfterSeconds: rlIp.retryAfter });
      }
      const body = await readBody(req);
      if (!iqamaValid(body.iqama)) {
        logEvent({ event: 'iqama_login', iqama: body.iqama, ip: ip0, ok: false, reason: 'invalid_iqama_format' });
        return respond(400, { error: 'invalid_iqama_format', hint: "Iqama must start with '2' and be 10 digits" });
      }
      const rlIqama = rateLimit(`iqama:${body.iqama}`, 5, 10 * 60 * 1000);
      if (!rlIqama.ok) {
        res.setHeader('retry-after', String(rlIqama.retryAfter));
        return respond(429, { error: 'too_many_requests', retryAfterSeconds: rlIqama.retryAfter });
      }
      const user = findUser({ iqama: body.iqama });
      if (!user) {
        logEvent({ event: 'iqama_login', iqama: body.iqama, ip: ip0, ok: false, reason: 'unknown_iqama' });
        return respond(404, { error: 'user_not_found' });
      }
      const otp = await requestOtp('iqama', user.iqama);
      logEvent({ event: 'iqama_login', userId: user.id, ip: ip0, ok: true, reason: 'otp_challenge_sent' });
      return respond(200, { ok: true, iqama: user.iqama, phoneMasked: maskPhone(user.phone), ...otp });
    }

    // ── Google OAuth 2.0 (PKCE) ──
    if (path === '/auth/google/start') {
      if (!googleConfigured()) {
        if (IS_PROD) {
          return respond( 501, { error: 'google_not_configured', hint: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (PKCE flow is implemented; credentials are environment config).' });
        }
        // dev convenience: mock consent screen so the full OAuth round-trip
        // (state → finish-code exchange) is testable without credentials.
        // ?intent=signup rides the state so the finish lands on activation.
        const redirect = googleStart(origin);
        const state = new URL(redirect).searchParams.get('state');
        if (url.searchParams.get('intent') === 'signup') {
          db().googlePending[state].intent = 'signup';
          saveDb();
        }
        res.writeHead(302, { location: `/auth/google/mock?state=${state}` });
        return res.end();
      }
      const redirect = googleStart(origin);
      res.writeHead(302, { location: redirect });
      return res.end();
    }
    if (path === '/auth/google/mock') {
      if (IS_PROD) {return respond( 404, { error: 'not_found' });}
      const state = String(url.searchParams.get('state') || '');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google sign-in (dev mock)</title></head>
<body style="font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;background:#f3f5f8">
<div style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:28px 34px;text-align:center">
<div style="font-size:13px;color:#666;margin-bottom:14px">Sign in with Google <b>(dev mock)</b> — choose an account</div>
${['admin', 'manager', 'employee'].map(r => `<a href="/auth/google/mock/finish?state=${state}&role=${r}" style="display:block;margin:8px 0;padding:10px 18px;border:1px solid #ddd;border-radius:8px;text-decoration:none;color:#1f2937">${r}@gohr.test</a>`).join('')}
</div></body></html>`);
    }
    if (path === '/auth/google/mock/finish') {
      if (IS_PROD) {return respond( 404, { error: 'not_found' });}
      const state = url.searchParams.get('state') || '';
      const role = (url.searchParams.get('role') || 'employee').toLowerCase();
      if (!db().googlePending[state]) {return respond( 401, { error: 'invalid_state' });}
      const emails = { admin: 'admin@gohr.test', manager: 'manager@gohr.test', employee: 'employee@gohr.test', vendor: 'vendor@gohr.test' };
      const profile = { sub: `mock-${role}-${Date.now()}`, email: emails[role] || emails.employee, name: `${role} user` };
      const user = upsertGoogleUser(profile);
      const intent = (db().googlePending[state] || {}).intent || '';
      const code = issueOauthCode(user.id, intent === 'signup' ? `signup:${state}` : '');
      delete db().googlePending[state];
      saveDb();
      logEvent({ event: 'google_mock', userId: user.id, ip: resolveIp(req), ok: true, reason: role });
      res.writeHead(302, { location: `/src/pages/auth-test.html?oauth=${code}` });
      return res.end();
    }
    if (path === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const out = await googleExchange(code, state, origin);
      if (out.error) {
        logEvent({ event: 'google_callback', ip: resolveIp(req), ok: false, reason: out.error });
        return respond( 401, { error: out.error });
      }
      const user = upsertGoogleUser(out.profile);
      const ok = await loginFor(res, user, req, { event: 'login_google' });
      return ok;
    }
    if (req.method === 'POST' && path === '/auth/oauth/finish') {
      const body = await readBody(req);
      const out = consumeOauthCode(body.code);
      if (!out) {return respond( 401, { error: 'invalid_or_expired_code' });}
      // Sign-up hand-off: the mock consent screen carries the state through
      // the finish-code so the login page can show the activation step.
      return loginFor(res, out.user, req, { event: 'login_google', state: out.state });
    }

    // ── session lifecycle ──
    if (req.method === 'POST' && path === '/auth/refresh') {
      const body = await readBody(req);
      const tokens = rotateRefresh(body.refreshToken, resolveIp(req));
      if (!tokens) {
        logEvent({ event: 'refresh', ip: resolveIp(req), ok: false, reason: 'invalid_revoked_or_expired_refresh' });
        return respond( 401, { error: 'invalid_refresh_token' });
      }
      return respond( 200, tokens);
    }
    if (req.method === 'POST' && path === '/auth/logout') {
      const body = await readBody(req);
      const ok = revokeRefresh(body.refreshToken);
      logEvent({ event: 'logout', ip: resolveIp(req), ok, reason: ok ? 'refresh_revoked' : 'unknown_refresh' });
      return respond( 200, { ok });
    }

    // ── session management ──
    if (path === '/auth/sessions') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { sessions: listSessions(auth.user.id) });
    }
    if (req.method === 'POST' && path === '/auth/logout-all') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const n = revokeAllFor(auth.user.id);
      logEvent({ event: 'logout_all', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: `${n} revoked` });
      return respond( 200, { ok: true, revoked: n });
    }

    // ── current identity ──
    if (path === '/auth/me') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { user: publicUser(auth.user), session: { exp: auth.payload.exp, role: auth.user.role } });
    }

    // ── dev-only test login (bypasses geofence; disabled in production) ──
    if (path === '/auth/test') {
      if (IS_PROD || process.env.AUTH_DISABLE_TEST === '1') {
        return respond( 403, { error: 'test_endpoint_disabled_in_production' });
      }
      const role = (url.searchParams.get('role') || 'employee').toLowerCase();
      if (!['admin', 'manager', 'employee', 'vendor'].includes(role)) {return respond( 400, { error: 'unknown_role' });}
      const user = db().users.find(u => u.role === role);
      if (!user) {return respond( 500, { error: 'seed_user_missing' });}
      return loginFor(res, user, req, { bypass: true, event: 'test_login' });
    }

    // ── protected: audit log (admin) ──
    if (path === '/auth/logs') {
      const auth = requirePerm(req, 'audit.read');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { logs: db().logs.slice(-100).reverse() });
    }

    // ── protected demo: geofence settings (admin) ──
    if (path === '/api/geofence' && req.method === 'GET') {
      const auth = requirePerm(req, 'geofence.read');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, db().geofence);
    }
    if (path === '/api/geofence' && req.method === 'PUT') {
      const auth = requirePerm(req, 'geofence.write');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const body = await readBody(req);
      const d = db();
      if (Array.isArray(body.allowedCountries)) {
        d.geofence.allowedCountries = body.allowedCountries.map(c => String(c).toUpperCase().slice(0, 2)).filter(c => /^[A-Z]{2}$/.test(c));
      }
      if (body.failMode === 'open' || body.failMode === 'closed') {d.geofence.failMode = body.failMode;}
      logEvent({ event: 'geofence_update', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: JSON.stringify(d.geofence) });
      return respond( 200, d.geofence);
    }

    // ── protected demo: attendance ──
    if (path === '/api/attendance' && req.method === 'GET') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const { roleCan } = await import('./auth-core.mjs');
      const seeAll = roleCan(auth.user.role, 'attendance.read');
      if (!seeAll && !roleCan(auth.user.role, 'attendance.read.self')) {return respond( 403, { error: 'forbidden' });}
      const rows = SEEDED_ATTENDANCE.filter(r => (seeAll ? true : r.emp === auth.user.id));
      return respond( 200, { scope: seeAll ? 'all' : 'self', rows });
    }
    if (path === '/api/attendance' && req.method === 'POST') {
      const body = await readBody(req);
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const { roleCan } = await import('./auth-core.mjs');
      const target = body.emp || auth.user.id;
      const selfWrite = target === auth.user.id && roleCan(auth.user.role, 'attendance.write.self');
      const anyWrite = roleCan(auth.user.role, 'attendance.write');
      if (!selfWrite && !anyWrite) {return respond( 403, { error: 'forbidden' });}
      const row = { emp: target, date: body.date || new Date().toISOString().slice(0, 10), status: body.status === 'absent' ? 'absent' : 'present', by: auth.user.id };
      SEEDED_ATTENDANCE.push(row);
      logEvent({ event: 'attendance_write', userId: auth.user.id, ok: true, reason: JSON.stringify(row) });
      return respond( 201, { row });
    }

    // ── protected demo: employees ──
    if (path === '/api/employees') {
      const auth = requirePerm(req, 'employees.read');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { rows: db().users.map(publicUser) });
    }

    // ── self sign-up (admin-gated) ──
    if (req.method === 'POST' && path === '/auth/signup') {
      if (!getPolicy().selfSignup) {return respond( 403, { error: 'signup_disabled' });}
      const rl = rateLimit(`signup:${resolveIp(req)}`, 5, 60 * 60 * 1000);
      if (!rl.ok) {
        res.setHeader('retry-after', String(rl.retryAfter));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: rl.retryAfter });
      }
      const b = await readBody(req);
      const loginId = String(b.loginId || '').trim().toUpperCase();
      if (!/^(EMP|VND)-\d{3,6}$/.test(loginId)) {
        return respond( 400, { error: 'invalid_login_id', hint: 'Only EMP-### / VND-### IDs can self-register' });
      }
      if (userByLoginId(loginId)) {return respond( 409, { error: 'login_id_taken' });}
      if (!b.password || String(b.password).length < getPolicy().passwordMinLength) {
        return respond( 400, { error: 'password_too_short', minLength: getPolicy().passwordMinLength });
      }
      const user = createUser({
        loginId,
        nameEn: b.nameEn || loginId,
        nameAr: b.nameAr || '',
        role: loginId.startsWith('VND') ? 'vendor' : 'employee',
        phone: b.phone || '',
        email: b.email || '',
        password: b.password
      });
      logEvent({ event: 'user_self_signup', userId: user.id, ip: resolveIp(req), ok: true, reason: loginId });
      return loginFor(res, user, req, { event: 'signup' });
    }

    // ── forgot / reset password (OTP to the phone on file) ──
    if (req.method === 'POST' && path === '/auth/password/forgot') {
      const rl = rateLimit(`forgot:${resolveIp(req)}`, 5, 10 * 60 * 1000);
      if (!rl.ok) {
        res.setHeader('retry-after', String(rl.retryAfter));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: rl.retryAfter });
      }
      const b = await readBody(req);
      const out = await requestReset(b.loginId);
      return respond( 200, out);
    }
    if (req.method === 'POST' && path === '/auth/password/reset') {
      const rl = rateLimit(`pwreset:${resolveIp(req)}`, 10, 10 * 60 * 1000);
      if (!rl.ok) {
        res.setHeader('retry-after', String(rl.retryAfter));
        return respond( 429, { error: 'too_many_requests', retryAfterSeconds: rl.retryAfter });
      }
      const b = await readBody(req);
      const out = resetPassword(b.loginId, b.code, b.newPassword);
      if (out.error === 'password_too_short') {
        return respond( 400, { error: out.error, minLength: getPolicy().passwordMinLength });
      }
      if (out.error) {return respond( 401, { error: out.error });}
      return respond( 200, out);
    }

    // ── change my own password ──
    if (req.method === 'POST' && path === '/auth/change-password') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const b = await readBody(req);
      const out = changePassword(auth.user.id, b.currentPassword, b.newPassword);
      if (out.error === 'wrong_current_password') {return respond( 401, { error: out.error });}
      if (out.error === 'password_too_short') {return respond( 400, { error: out.error, minLength: getPolicy().passwordMinLength });}
      if (out.error) {return respond( 400, { error: out.error });}
      return respond( 200, out);
    }

    // ── security policy (admin) ──
    if (path === '/api/security/policy' && req.method === 'GET') {
      // public subset for the login page (self-signup gate), full policy for admins
      if (!req.headers.authorization) {
        const p = getPolicy();
        return respond( 200, { selfSignup: p.selfSignup, passwordMinLength: p.passwordMinLength });
      }
      const auth = requirePerm(req, 'security.read');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, getPolicy());
    }
    if (path === '/api/security/policy' && req.method === 'PUT') {
      const auth = requirePerm(req, 'security.write');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const b = await readBody(req);
      const patch = {};
      if (b.passwordMinLength !== undefined) {
        const n = Number(b.passwordMinLength);
        if (!Number.isInteger(n) || n < 6 || n > 32) {return respond( 400, { error: 'invalid_policy' });}
        patch.passwordMinLength = n;
      }
      if (b.selfSignup !== undefined) {patch.selfSignup = !!b.selfSignup;}
      logEvent({ event: 'policy_update', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: JSON.stringify(patch) });
      return respond( 200, setPolicy(patch));
    }

    // ── admin: database connection status ──
    if (req.method === 'GET' && path === '/api/system/db') {
      const auth = requireAuth(req);
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      if (auth.user.role !== 'admin') {return respond( 403, { error: 'forbidden' });}
      return respond( 200, dbStatus());
    }

    // ── user management (admin writes, manager reads) ──
    if (path === '/api/admin/users' && req.method === 'GET') {
      const auth = requirePerm(req, 'users.read');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { rows: db().users.map(publicUser) });
    }
    if (path === '/api/admin/users' && req.method === 'POST') {
      const auth = requirePerm(req, 'users.write');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const b = await readBody(req);
      const loginId = String(b.loginId || '').trim();
      if (!/^[A-Za-z]{3}-\d{3,6}$/.test(loginId)) {
        return respond( 400, { error: 'invalid_login_id', hint: 'Format: PREFIX-### (e.g. EMP-014). The prefix decides the account type: ADM/MGR/EMP/VND.' });
      }
      if (userByLoginId(loginId)) {return respond( 409, { error: 'login_id_taken' });}
      if (!ROLES.includes(b.role)) {return respond( 400, { error: 'invalid_role' });}
      if (!b.password || String(b.password).length < getPolicy().passwordMinLength) {return respond( 400, { error: 'password_too_short', minLength: getPolicy().passwordMinLength });}
      if (b.iqama && !iqamaValid(b.iqama)) {return respond( 400, { error: 'invalid_iqama_format' });}
      const user = createUser(b);
      logEvent({ event: 'user_created', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: `${loginId}:${user.role}` });
      return respond( 201, { user: publicUser(user) });
    }
    if (path.startsWith('/api/admin/users/') && req.method === 'PUT') {
      const auth = requirePerm(req, 'users.write');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const id = path.slice('/api/admin/users/'.length);
      const b = await readBody(req);
      if (b.iqama && !iqamaValid(b.iqama)) {return respond( 400, { error: 'invalid_iqama_format' });}
      const out = updateUser(id, b, auth.user.id);
      if (!out) {return respond( 404, { error: 'not_found' });}
      if (out.error) {return respond( 400, { error: out.error });}
      logEvent({ event: 'user_updated', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: out.loginId });
      return respond( 200, { user: publicUser(out) });
    }
    if (path.startsWith('/api/admin/users/') && req.method === 'DELETE') {
      const auth = requirePerm(req, 'users.write');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      const id = path.slice('/api/admin/users/'.length);
      const out = deleteUser(id, auth.user.id);
      if (!out || out.error) {return respond( out && out.error === 'not_found' ? 404 : 400, { error: (out && out.error) || 'error' });}
      logEvent({ event: 'user_deleted', userId: auth.user.id, ip: resolveIp(req), ok: true, reason: id });
      return respond( 200, { ok: true });
    }

    // ── protected demo: admin-only ──
    if (path === '/api/admin/ping') {
      const auth = requirePerm(req, 'admin.ping');
      if (auth.error) {return respond( auth.error[0], { error: auth.error[1] });}
      return respond( 200, { pong: true, as: auth.user.role, permissions: permissionsOf(auth.user.role) });
    }

    return respond( 404, { error: 'not_found', path });
  } catch (e) {
    return respond( 500, { error: 'internal_error', detail: String(e && e.message || e).slice(0, 200) });
  } finally {
    _req = null;
  }
}

// Demo data for the RBAC playground (module scope, resets on restart).
// NOTE: This data is intentionally in-memory only — it resets whenever
// the auth server process restarts. Do not rely on it for persistence.
export const SEEDED_ATTENDANCE = [
  { emp: 'u-admin', date: '2026-09-18', status: 'present' },
  { emp: 'u-manager', date: '2026-09-18', status: 'present' },
  { emp: 'u-employee', date: '2026-09-18', status: 'present' },
  { emp: 'u-employee', date: '2026-09-17', status: 'absent' }
];
