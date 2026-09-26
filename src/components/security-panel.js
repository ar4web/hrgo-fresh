// goHR — security settings panel (password policy, geofence, self sign-up,
// change-my-password). Rendered on both users.html and settings.html, so the
// wiring lives here once instead of being duplicated per page.
import { t } from './i18n.js';
import { api } from './session.js';
import { showToast } from './toast.js';

const el = (id) => document.getElementById(id);

// Policy + geofence are admin-only; change-my-password is available to everyone,
// so it is wired outside the canWrite branch.
export function wireSecurity(ctx) {
  const canWrite = ctx && ctx.canWrite;

  if (canWrite) {
    api('GET', '/api/security/policy').then((r) => {
      if (!r.ok) {return;}
      if (el('sec-pwmin')) {el('sec-pwmin').value = r.data.passwordMinLength || 6;}
      const tg = el('sec-signup');
      if (tg) {
        tg.classList.toggle('on', !!r.data.selfSignup);
        tg.setAttribute('aria-checked', r.data.selfSignup ? 'true' : 'false');
      }
    });
    api('GET', '/api/geofence').then((r) => {
      if (!r.ok) {return;}
      if (el('sec-countries')) {el('sec-countries').value = (r.data.allowedCountries || []).join(', ');}
      if (el('sec-failmode')) {el('sec-failmode').value = r.data.failMode || 'open';}
    });
    el('sec-pw-save')?.addEventListener('click', async () => {
      const r = await api('PUT', '/api/security/policy', { passwordMinLength: Number(el('sec-pwmin').value) });
      showToast(r.ok ? t('sec.saved') : t('um.err'), { variant: r.ok ? 'success' : 'error' });
    });
    el('sec-signup')?.addEventListener('click', async () => {
      const next = !el('sec-signup').classList.contains('on');
      const r = await api('PUT', '/api/security/policy', { selfSignup: next });
      if (r.ok) {
        el('sec-signup').classList.toggle('on', next);
        el('sec-signup').setAttribute('aria-checked', next ? 'true' : 'false');
        showToast(t('sec.saved'), { variant: 'success' });
      } else {
        showToast(t('um.err'), { variant: 'error' });
      }
    });
    el('sec-geo-save')?.addEventListener('click', async () => {
      const list = el('sec-countries').value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
      const r = await api('PUT', '/api/geofence', { allowedCountries: list, failMode: el('sec-failmode').value });
      showToast(r.ok ? t('sec.saved') : t('um.err'), { variant: r.ok ? 'success' : 'error' });
    });
  } else {
    el('sec-admin')?.remove();
  }

  el('sec-chpw')?.addEventListener('click', async () => {
    const r = await api('POST', '/auth/change-password', { currentPassword: el('sec-cur').value, newPassword: el('sec-new').value });
    if (!r.ok) {
      const key = { wrong_current_password: 'sec.errCurrent', password_too_short: 'um.errPw' }[r.data.error] || 'um.err';
      return showToast(t(key), { variant: 'error' });
    }
    el('sec-cur').value = '';
    el('sec-new').value = '';
    showToast(t('sec.pwChanged'), { variant: 'success' });
  });
}
