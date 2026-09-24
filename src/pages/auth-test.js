// Auth API test tools — the previous developer playground lives here so the
// login page stays a simple ID + password form.
import { t, currentLang, setLang, applyI18n } from '../components/i18n.js';
import { getSession, setSession, clearSession, api } from '../components/session.js';

const $ = (id) => document.getElementById(id);
const setMsg = (text, ok) => {
  const el = $('auth-msg');
  if (!el) {return;}
  el.hidden = !text;
  el.textContent = text || '';
  el.className = `auth-msg${ok ? ' ok' : ' err'}`;
};
const tokens = () => getSession();

function paintSession() {
  const tk = tokens();
  const box = $('auth-session');
  if (!tk || !tk.user) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const u = tk.user;
  $('sess-name').textContent = currentLang() === 'ar' && u.nameAr ? u.nameAr : u.nameEn;
  $('sess-role').textContent = u.role;
  $('sess-exp').textContent = `⏱ access ${Math.max(0, Math.round(((tk.expAt || 0) - Date.now()) / 1000))}s · refresh ✓`;
  $('sess-perms').innerHTML = (u.permissions || []).map(p => `<span class="chip">${p}</span>`).join('');
}
async function refreshSession() {
  const tk = tokens();
  if (!tk || !tk.refreshToken) {return setMsg(t('auth.errNoSession'), false);}
  const res = await fetch('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tk.refreshToken }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearSession();
    paintSession();
    return setMsg(t('auth.errExpired'), false);
  }
  setSession(data);
  paintSession();
  setMsg(t('auth.toastRefreshed'), true);
}
async function logout() {
  const tk = tokens();
  if (tk && tk.refreshToken) {
    await fetch('/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: tk.refreshToken }) });
  }
  clearSession();
  paintSession();
  setMsg(t('auth.toastLogout'), true);
}
async function logoutAllDevices() {
  await api('POST', '/auth/logout-all');
  clearSession();
  paintSession();
  setMsg(t('auth.toastLogoutAll'), true);
}

// ── OTP / Iqama flows ──
async function sendCode(kind) {
  setMsg('', true);
  const isIqama = kind === 'iqama';
  const body = isIqama ? { iqama: $('iqama-no').value.trim() } : { phone: $('otp-phone').value.trim() };
  const res = await fetch('/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = data.error === 'invalid_iqama_format' ? t('auth.errIqamaFormat')
      : data.error === 'user_not_found' ? t('auth.errNotFound')
        : data.error === 'too_many_requests' ? t('auth.errRate')
          : t('auth.errSend');
    return setMsg(why, false);
  }
  $(isIqama ? 'iqama-challenge' : 'otp-challenge').hidden = false;
  const hint = isIqama ? $('iqama-hint') : $('otp-hint');
  hint.textContent = `${t('auth.codeSent')} ${data.phoneMasked || ''}${data.devCode ? ` — dev: ${data.devCode}` : ''}`;
  setMsg('', true);
}
async function verifyCode(kind) {
  const isIqama = kind === 'iqama';
  const body = isIqama
    ? { iqama: $('iqama-no').value.trim(), code: $('iqama-code').value.trim() }
    : { phone: $('otp-phone').value.trim(), code: $('otp-code').value.trim() };
  const res = await fetch('/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = data.error === 'too_many_attempts' ? t('auth.errTooMany')
      : data.error === 'code_expired' ? t('auth.errExpiredCode')
        : data.error === 'country_not_allowed' ? `${t('auth.errGeo')} (${data.country || '?'})`
          : t('auth.errCode');
    return setMsg(why, false);
  }
  setSession(data);
  setMsg(t('auth.toastWelcome').replace('{name}', data.user.nameEn), true);
  paintSession();
}

// ── RBAC playground ──
async function runApi(spec) {
  const out = spec.closest('tr').querySelector('.auth-api-out');
  const [method, path] = spec.dataset.api.split(' ');
  const loginId = `TST-${String(Date.now()).slice(-4)}`;
  const body = method === 'POST'
    ? (path.includes('users') ? { loginId, nameEn: 'Temp User', role: 'employee', password: 'temp123' } : { status: 'present' })
    : undefined;
  const r = await api(method, path, body);
  out.textContent = `${r.status} ${r.ok ? '✓' : '✗'} ${r.ok ? '' : (r.data.error || '')}`;
  out.className = `auth-api-out ${r.ok ? 'ok' : 'err'}`;
}
function paintCurl() {
  const tk = tokens();
  const tok = tk && tk.accessToken ? tk.accessToken : '<access-token>';
  $('curl-sheet').textContent = [
    `# simple login — the ID decides the account type`,
    `curl -X POST http://localhost:9173/auth/login -H 'content-type: application/json' -d '{"loginId":"ADM-001","password":"admin123"}'`,
    ``,
    `# instant role login (dev only)`,
    `curl "http://localhost:9173/auth/test?role=vendor"`,
    ``,
    `# OTP flow`,
    `curl -X POST http://localhost:9173/auth/otp/request -H 'content-type: application/json' -d '{"phone":"+966500000001"}'`,
    `curl -X POST http://localhost:9173/auth/otp/verify -H 'content-type: application/json' -d '{"phone":"+966500000001","code":<devCode>}'`,
    ``,
    `# Iqama flow (starts with 2, 10 digits)`,
    `curl -X POST http://localhost:9173/auth/iqama/login -H 'content-type: application/json' -d '{"iqama":"2000000001"}'`,
    ``,
    `# Google OAuth (PKCE; dev mock picker completes the round-trip)`,
    `curl -L http://localhost:9173/auth/google/start`,
    ``,
    `# who am I / sessions / refresh / logout`,
    `curl http://localhost:9173/auth/me -H "authorization: Bearer ${tok}"`,
    `curl http://localhost:9173/auth/sessions -H "authorization: Bearer ${tok}"`,
    `curl -X POST http://localhost:9173/auth/refresh -H 'content-type: application/json' -d '{"refreshToken":"<refresh-token>"}'`,
    `curl -X POST http://localhost:9173/auth/logout -H 'content-type: application/json' -d '{"refreshToken":"<refresh-token>"}'`,
    ``,
    `# user management (admin)`,
    `curl http://localhost:9173/api/admin/users -H "authorization: Bearer ${tok}"`,
    `curl -X POST http://localhost:9173/api/admin/users -H "authorization: Bearer ${tok}" -H 'content-type: application/json' -d '{"loginId":"VND-014","nameEn":"New Vendor","role":"vendor","password":"secret1"}'`
  ].join('\n');
}

// ── wiring ──
function wire() {
  document.querySelectorAll('[data-auth-tab]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-auth-tab]').forEach(x => {
        const on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-auth-pane]').forEach(p => {p.hidden = p.dataset.authPane !== b.dataset.authTab;});
    });
  });
  $('otp-send').addEventListener('click', () => sendCode('phone'));
  $('otp-verify').addEventListener('click', () => verifyCode('phone'));
  $('iqama-send').addEventListener('click', () => sendCode('iqama'));
  $('iqama-verify').addEventListener('click', () => verifyCode('iqama'));
  $('google-start').addEventListener('click', async () => {
    const res = await fetch('/auth/google/start');
    if (res.redirected || res.status === 302) {window.location.href = res.url; return;}
    const data = await res.json().catch(() => ({}));
    setMsg(data.error === 'google_not_configured' ? t('auth.errGoogleCfg') : t('auth.errGoogle'), false);
  });
  document.querySelectorAll('[data-test-role]').forEach(b => {
    b.addEventListener('click', async () => {
      const res = await fetch(`/auth/test?role=${b.dataset.testRole}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {return setMsg(data.error || t('auth.errSend'), false);}
      setSession(data);
      setMsg(t('auth.toastWelcome').replace('{name}', data.user.nameEn), true);
      paintSession();
      paintCurl();
    });
  });
  $('sess-refresh').addEventListener('click', refreshSession);
  $('sess-logout').addEventListener('click', logout);
  $('sess-logout-all').addEventListener('click', logoutAllDevices);
  document.querySelectorAll('[data-api]').forEach(b => b.addEventListener('click', () => runApi(b)));
  $('auth-lang').addEventListener('click', () => {
    setLang(currentLang() === 'ar' ? 'en' : 'ar');
    $('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
    applyI18n();
    paintSession();
    paintCurl();
  });
}

wire();
$('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
applyI18n();
paintSession();
paintCurl();
// OAuth finish: auth-test.html?oauth=<code> also completes the round-trip
(async () => {
  const code = new URLSearchParams(location.search).get('oauth');
  if (!code) {return;}
  try {history.replaceState(null, '', location.pathname);} catch (_e) { /* jsdom */ }
  const res = await fetch('/auth/oauth/finish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {return setMsg(t('auth.errGoogle'), false);}
  setSession(data);
  setMsg(t('auth.toastWelcome').replace('{name}', data.user.nameEn), true);
  paintSession();
  paintCurl();
})();
// restore a live session via refresh if the access token died
(async () => {
  const tk = tokens();
  if (tk && tk.refreshToken) {
    const me = await api('GET', '/auth/me');
    if (!me.ok) {await refreshSession();}
    else {paintSession();}
  }
})();
