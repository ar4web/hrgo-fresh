// goHR client session — token store, auto-refresh, page guard, identity paint.
// The auth API (server/) is the source of truth; this module only keeps the
// SPA in sync: guard pages, refresh on 401 once, paint the profile panel.

const STORE = 'hr:auth';

export function getSession() {
  try {return JSON.parse(localStorage.getItem(STORE) || 'null');} catch (_e) {return null;}
}
export function setSession(data) {
  localStorage.setItem(STORE, JSON.stringify({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expAt: Date.now() + (data.expiresIn || 900) * 1000,
    user: data.user
  }));
}
export function clearSession() {
  localStorage.removeItem(STORE);
}

/** fetch with Bearer auth; on 401 refreshes once and retries. */
export async function api(method, path, body) {
  const send = async (tok) => fetch(path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(tok ? { authorization: `Bearer ${tok}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let s = getSession();
  let res = await send(s && s.accessToken);
  if (res.status === 401 && s && s.refreshToken) {
    if (await refreshTokens()) {
      s = getSession();
      res = await send(s.accessToken);
    }
  }
  let data = {};
  try {data = await res.json();} catch (_e) { /* non-JSON */ }
  return { status: res.status, ok: res.ok, data };
}

// Concurrent 401s must share ONE refresh call — the refresh token is
// single-use, so parallel refreshes race and the losers clear the session
// (the "automatic logout" bug). Single-flight: everyone awaits the same
// promise and re-reads the rotated tokens.
let _refreshInFlight = null;

export function refreshTokens() {
  if (_refreshInFlight) {return _refreshInFlight;}
  _refreshInFlight = (async () => {
    const s = getSession();
    if (!s || !s.refreshToken) {return false;}
    try {
      const res = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken })
      });
      if (res.status === 401) {
        clearSession(); // server says this refresh token is dead — believe it
        return false;
      }
      if (!res.ok) {
        return false; // 5xx / proxy hiccup: keep the session, retry later
      }
      setSession(await res.json());
      return true;
    } catch (_e) {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

/** Revoke the refresh token server-side, clear local state, go to login. */
export async function signOut() {
  const s = getSession();
  try {
    if (s && s.refreshToken) {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken })
      });
    }
  } catch (_e) { /* best-effort — clear locally regardless */ }
  clearSession();
  window.location.replace('login.html');
}

/** Bypass auth: always return a demo session for local dev. */
export function ensureDemoSession() {
  const s = getSession();
  if (s && s.user) {return s;}
  const demoUser = {
    id: 'u-admin',
    loginId: 'ADM-001',
    nameEn: 'Admin User',
    nameAr: 'مدير النظام',
    role: 'admin',
    email: 'admin@gohr.com',
    phone: '+966500000001',
    status: 'active',
    permissions: ['*']
  };
  setSession({
    accessToken: 'dev-token',
    refreshToken: 'dev-refresh',
    expiresIn: 900,
    user: demoUser
  });
  return getSession();
}

/** Ensure a session exists (dev/demo pages that paint identity without a
 * full login flow). Delegates to the demo seed so the page always has a
 * user to render; real sign-in overwrites this via setSession. */
export function ensureSession() {
  return ensureDemoSession();
}

/** Where each account type lands after sign-in. The login ID decides the
 * account type (ADM/MGR/EMP/VND prefixes); vendors get a minimal portal. */
export function destFor(user) {
  return user && user.role === 'vendor' ? 'vendor.html' : 'dashboard.html';
}

const initials = (name) => String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/** Paint the shell user panel with the real session + wire sign out. */
function paintIdentity() {
  const s = getSession();
  if (!s || !s.user) {return;}
  const u = s.user;
  const ar = document.documentElement.getAttribute('dir') === 'rtl';
  const name = (ar && u.nameAr) ? u.nameAr : u.nameEn;
  const avatar = document.querySelector('.topbar-user-avatar');
  if (avatar) {avatar.textContent = initials(name);}
  const panelAvatar = document.querySelector('.user-panel-avatar');
  if (panelAvatar) {panelAvatar.textContent = initials(name);}
  const panelId = document.querySelector('.user-panel-id');
  if (panelId) {
    const strong = panelId.querySelector('strong');
    const spans = panelId.querySelectorAll('span');
    if (strong) {strong.textContent = name;}
    if (spans[0]) {spans[0].textContent = u.email || '';}
    if (spans[1]) {spans[1].textContent = u.role;}
  }
  // Sign out menu item: bind real revocation (idempotent — replaces the
  // decorative handler bound by shell-chrome).
  const btn = document.querySelector('[data-signout]');
  if (btn) {
    const clone = btn.cloneNode(true);
    btn.replaceWith(clone);
    clone.addEventListener('click', () => signOut());
  }
}

/** Entry hook for admin-shell pages (called from main.js). Auto-login for dev. */
export async function initSession() {
  ensureDemoSession();
  paintIdentity();
}
