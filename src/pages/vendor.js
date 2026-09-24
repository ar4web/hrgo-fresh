// Vendor portal — minimal landing for accounts whose login ID resolves to a
// vendor. Guarded like every page; sign-out revokes the refresh token.
import { t, currentLang, setLang, applyI18n } from '../components/i18n.js';
import { ensureSession, getSession, signOut } from '../components/session.js';
import { showToast } from '../components/toast.js';

ensureSession();
const s = getSession();
const u = s && s.user;
const ar = () => document.documentElement.getAttribute('dir') === 'rtl';
const name = u ? ((ar() && u.nameAr) ? u.nameAr : u.nameEn) : '';

const initials = String(name || 'V').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
document.getElementById('vendor-avatar').textContent = initials;
document.getElementById('vendor-name').textContent = name;
document.getElementById('vendor-perms').innerHTML = ((u && u.permissions) || []).map(p => `<span class="chip">${p}</span>`).join('');
document.getElementById('vendor-signout').addEventListener('click', () => signOut());
// change my password (revokes all other sessions)
document.getElementById('vp-chpw').addEventListener('click', async () => {
  const res = await fetch('/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${(getSession() || {}).accessToken || ''}` },
    body: JSON.stringify({ currentPassword: document.getElementById('vp-cur').value, newPassword: document.getElementById('vp-new').value })
  });
  const data = await res.json().catch(() => ({}));
  const key = { wrong_current_password: 'sec.errCurrent', password_too_short: 'um.errPw' }[data.error] || 'um.err';
  showToast(res.ok ? t('sec.pwChanged') : t(key), { variant: res.ok ? 'success' : 'error' });
  if (res.ok) {
    document.getElementById('vp-cur').value = '';
    document.getElementById('vp-new').value = '';
  }
});
document.getElementById('auth-lang').addEventListener('click', () => {
  setLang(currentLang() === 'ar' ? 'en' : 'ar');
  document.getElementById('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
  applyI18n();
  document.getElementById('vendor-name').textContent = u ? ((ar() && u.nameAr) ? u.nameAr : u.nameEn) : '';
});
document.getElementById('auth-lang').textContent = currentLang() === 'ar' ? 'English' : 'العربية';
applyI18n();
