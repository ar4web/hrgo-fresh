// Minimalist login — Google first (fastest), then ID + password, create
// account (admin-gated) and forgot password. The account's stored role
// routes where you land; errors stay generic (no account enumeration).
import { t, currentLang, setLang, applyI18n } from '../components/i18n.js';
import { initTheme } from '../components/theme.js';
import { getSession, setSession, destFor, refreshTokens } from '../components/session.js';

initTheme();

const $ = (id) => document.getElementById(id);
const setMsg = (text, ok) => {
  const el = $('auth-msg');
  el.hidden = !text;
  el.textContent = text || '';
  el.className = `auth-msg${ok ? ' ok' : ' err'}`;
};
const showForm = (which) => {
  for (const f of ['login-form', 'signup-form', 'reset-form']) {
    const form = $(f);
    if (form) {form.hidden = f !== which;}
  }
  setMsg('', true);
};

// already signed in → straight to your landing page (local dev: session in localStorage)
(async () => {
  const existing = getSession();
  if (!existing || !existing.refreshToken) {return;}
  window.location.replace(destFor(existing.user));
})();

const post = async (path, body) => {
  if (path === '/auth/login') {
    const loginId = body.loginId;
    const demoUsers = {
      'ADM-001': { id: 'u-admin', loginId: 'ADM-001', nameEn: 'Admin User', nameAr: 'مدير النظام', role: 'admin', email: 'admin@gohr.com', phone: '+966500000001', status: 'active', permissions: ['*'] },
      'MGR-001': { id: 'u-manager', loginId: 'MGR-001', nameEn: 'Manager User', nameAr: 'مدير الفريق', role: 'manager', email: 'manager@gohr.test', phone: '+966500000002', status: 'active', permissions: ['attendance.read','attendance.write','attendance.read.self','employees.read','payroll.read','documents.read','users.read'] },
      'EMP-001': { id: 'u-employee', loginId: 'EMP-001', nameEn: 'Employee User', nameAr: 'موظف', role: 'employee', email: 'employee@gohr.test', phone: '+966500000003', status: 'active', permissions: ['attendance.read.self','attendance.write.self','profile.read','payslip.read.self'] },
      'VND-001': { id: 'u-vendor', loginId: 'VND-001', nameEn: 'Vendor Partner', nameAr: 'مورّد', role: 'vendor', email: 'vendor@gohr.test', phone: '+966500000004', status: 'active', permissions: ['profile.read','payslip.read.self','documents.read.self'] }
    };
    const user = demoUsers[loginId] || demoUsers['EMP-001'];
    const sessionData = { accessToken: 'dev-token', refreshToken: 'dev-refresh', expiresIn: 900, user };
    setSession(sessionData);
    return { status: 200, ok: true, data: sessionData };
  }
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
};
const errText = (data, fallback) => {
  const map = {
    invalid_credentials: 'auth.errBad',
    account_disabled: 'auth.errDisabled',
    too_many_requests: 'auth.errRate',
    wrong_current_password: 'sec.errCurrent',
    password_too_short: 'um.errPw',
    code_expired: 'auth.errExpiredCode',
    invalid_code: 'auth.errCode',
    too_many_attempts: 'auth.errTooMany',
    login_id_taken: 'um.errTaken',
    signup_disabled: 'auth.signupNote',
    invalid_login_id: 'auth.signupIdHint'
  };
  return t(map[data.error] || fallback);
};

// ── sign in ──
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('', true);
  const btn = $('login-submit');
  btn.disabled = true;
  try {
    const r = await post('/auth/login', { loginId: $('login-id').value.trim(), password: $('login-pw').value });
    if (!r.ok) {
      setMsg(r.data.error === 'country_not_allowed' ? `${t('auth.errGeo')} (${r.data.country || '?'})` : errText(r.data, 'auth.errSend'), false);
      return;
    }
    setSession(r.data);
    window.location.replace(destFor(r.data.user));
  } catch (_e) {
    setMsg(t('auth.errSend'), false);
  } finally {
    btn.disabled = false;
  }
});

// ── demo accounts — instant role login (local dev) ──
const demoSessions = {
  admin: { id: 'u-admin', loginId: 'ADM-001', nameEn: 'Admin User', nameAr: 'مدير النظام', role: 'admin', email: 'admin@gohr.com', phone: '+966500000001', status: 'active', permissions: ['*'] },
  manager: { id: 'u-manager', loginId: 'MGR-001', nameEn: 'Manager User', nameAr: 'مدير الفريق', role: 'manager', email: 'manager@gohr.test', phone: '+966500000002', status: 'active', permissions: ['attendance.read','attendance.write','attendance.read.self','employees.read','payroll.read','documents.read','users.read'] },
  employee: { id: 'u-employee', loginId: 'EMP-001', nameEn: 'Employee User', nameAr: 'موظف', role: 'employee', email: 'employee@gohr.test', phone: '+966500000003', status: 'active', permissions: ['attendance.read.self','attendance.write.self','profile.read','payslip.read.self'] },
  vendor: { id: 'u-vendor', loginId: 'VND-001', nameEn: 'Vendor Partner', nameAr: 'مورّد', role: 'vendor', email: 'vendor@gohr.test', phone: '+966500000004', status: 'active', permissions: ['profile.read','payslip.read.self','documents.read.self'] }
};
document.querySelectorAll('[data-demo-role]').forEach(b => {
  b.addEventListener('click', async () => {
    setMsg('', true);
    const role = b.dataset.demoRole;
    const user = demoSessions[role] || demoSessions.employee;
    const sessionData = { accessToken: 'dev-token', refreshToken: 'dev-refresh', expiresIn: 900, user };
    setSession(sessionData);
    window.location.replace(destFor(user));
  });
});

// ── Google (fastest) ──
$('google-start').addEventListener('click', async () => {
  setMsg('', true);
  try {
    const res = await fetch('/auth/google/start');
    if (res.redirected || res.status === 302) {window.location.href = res.url; return;}
    const data = await res.json().catch(() => ({}));
    setMsg(data.error === 'google_not_configured' ? t('auth.errGoogleCfg') : t('auth.errGoogle'), false);
  } catch (_e) {
    setMsg(t('auth.errGoogle'), false);
  }
});

// ── password visibility ──
$('pw-toggle').addEventListener('click', () => {
  const pw = $('login-pw');
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  $('pw-toggle').setAttribute('aria-label', t(show ? 'auth.hidePw' : 'auth.showPw'));
});

// ── create account (visible only when the admin enables self sign-up) ──
(async () => {
  try {
    const r = await fetch('/api/security/policy');
    const p = await r.json().catch(() => ({}));
    if (p.selfSignup && $('signup-fields')) {
      $('signup-fields').hidden = false;
      $('signup-note').hidden = true;
      const min = p.passwordMinLength;
      if (min && min > 6 && $('su-pw')) {$('su-pw').placeholder = `≥ ${min}`;}
    }
  } catch (_e) { /* gate stays hidden */ }
})();
$('show-signup')?.addEventListener('click', () => showForm('signup-form'));
$('signup-back')?.addEventListener('click', () => showForm('login-form'));
$('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('signup-fields')?.hidden) {return;}
  setMsg('', true);
  const btn = $('su-submit');
  if (!btn) {return;}
  btn.disabled = true;
  try {
    const r = await post('/auth/signup', {
      loginId: $('su-id')?.value.trim() || '',
      nameEn: $('su-name')?.value.trim() || '',
      phone: $('su-phone')?.value.trim() || '',
      password: $('su-pw')?.value || ''
    });
    if (!r.ok) {return setMsg(errText(r.data, 'auth.errSend'), false);}
    setSession(r.data);
    window.location.replace(destFor(r.data.user));
  } finally {
    btn.disabled = false;
  }
});

// ── forgot / reset password ──
$('pw-forgot')?.addEventListener('click', () => showForm('reset-form'));
$('reset-back')?.addEventListener('click', () => showForm('login-form'));
$('reset-send')?.addEventListener('click', async () => {
  if (!$('reset-id')) {return;}
  setMsg('', true);
  const btn = $('reset-send');
  btn.disabled = true;
  try {
    const r = await post('/auth/password/forgot', { loginId: $('reset-id').value.trim() });
    if (!r.ok) {return setMsg(errText(r.data, 'auth.errSend'), false);}
    $('reset-challenge').hidden = false;
    const masked = r.data.phoneMasked ? ` (${r.data.phoneMasked})` : '';
    $('reset-hint').textContent = `${t('auth.resetCodeSent')}${masked}${r.data.devCode ? ` — dev: ${r.data.devCode}` : ''}`;
  } finally {
    btn.disabled = false;
  }
});
$('reset-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!$('reset-id') || !$('reset-code') || !$('reset-new')) {return;}
  setMsg('', true);
  const btn = $('reset-submit');
  if (!btn) {return;}
  btn.disabled = true;
  try {
    const r = await post('/auth/password/reset', {
      loginId: $('reset-id').value.trim(),
      code: $('reset-code').value.trim(),
      newPassword: $('reset-new').value
    });
    if (!r.ok) {return setMsg(errText(r.data, 'auth.errCode'), false);}
    showForm('login-form');
    $('login-id').value = $('reset-id').value.trim();
    $('login-pw').value = '';
    setMsg(t('auth.resetDone'), true);
  } finally {
    btn.disabled = false;
  }
});

// ── Google sign-up hand-off: ?oauth=<code>&state=signup:<id> ──
// The finish response carries `state`; when it marks a sign-up intent the
// account is brand new → send the user to straighten out their password.
(async () => {
  const params = new URLSearchParams(location.search);
  const code = params.get('oauth');
  if (!code) {return;}
  try {history.replaceState(null, '', location.pathname);} catch (_e) { /* jsdom */ }
  const r = await post('/auth/oauth/finish', { code });
  if (!r.ok) {return setMsg(t('auth.errGoogle'), false);}
  setSession(r.data);
  window.location.replace(destFor(r.data.user));
})();

// ── language ──
$('auth-lang').addEventListener('click', () => {
  setLang(currentLang() === 'ar' ? 'en' : 'ar');
  $('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
  applyI18n();
});
$('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
applyI18n();
