// goHR — topbar + sidebar chrome wiring.
//
// Topbar (right cluster, far-right → left as built LTR):
//   user profile · messages · language · notifications · theme · search bar
// Sidebar:
//   settings gear pinned to the bottom-left corner.
//
// Panels reuse the generic popover system in menus.js (openPanel). Notifications
// are derived live from the roster (huroob, iqama expiry, Qiwa drafts); the
// message inbox is lightweight demo data. All visible strings pass through t()
// so the language toggle translates the chrome at open time.

import { openPanel, closeMenu } from './menus.js';
import { currentLang, t, LANG_EVENT } from './i18n.js';
import { getSeed } from './hr-api.js';
import { daysUntil, getSettings } from './hr-statutory.js';
import { showToast } from './toast.js';
import { openCustomizeSettings } from './customize.js';
import { getSession, signOut } from './session.js';
import { escapeHtml as esc } from './markup.js';

// ── Inline icon set (16–18px, currentColor) ───────────────────────────────
const ICON = {
  alert:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16.2h.01"/></svg>',
  warn:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  ok:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>'
};

// Session read-state (kept light deliberately; no backend inbox).
const state = { notifsRead: false };

function nameOf(e) {
  const ar = currentLang() === 'ar';
  return ar ? e.nameAr || e.nameEn : e.nameEn;
}

// Roster-derived alerts — same source of truth as the Employees ticker.
function collectAlerts() {
  const out = [];
  const prefs = (getSettings().prefs && getSettings().prefs.notif) || {};
  const docWindow = Number.isFinite(prefs.docDays) && prefs.docDays > 0 ? prefs.docDays : 30;
  const emps = getSeed('employees') || [];
  const push = (tone, icon, e, line, time) =>
    out.push({ tone, icon, name: nameOf(e), line, time, goto: 'analytics.html' });

  emps.forEach(e => {
    if (prefs.huroob !== false && e.st === 'huroob') {
      push('alert', 'alert', e, t('notif.huroob'), t('notif.today'));
    }
    if (prefs.docs !== false && !e.saudi && e.iqamaExp) {
      const d = daysUntil(e.iqamaExp);
      if (d < 0) {
        push('alert', 'alert', e, t('notif.iqamaExpired'), `${-d}${t('notif.dayShort')}`);
      } else if (d <= docWindow) {
        push('warn', 'warn', e, t('notif.iqamaExpiring'), `${d}${t('notif.dayShort')}`);
      }
    }
    if (prefs.qiwa !== false && e.q === 'draft') {
      push('info', 'info', e, t('notif.qiwaDraft'), t('notif.today'));
    }
  });
  const rank = { alert: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

function buildPanelRow(al) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'panel-row unread';
  row.innerHTML = `
    <span class="panel-icon panel-icon-${al.tone}">${ICON[al.icon] || ICON.info}</span>
    <span class="panel-body">
      <span class="panel-from">${esc(al.name)}</span>
      <span class="panel-text">${esc(al.line)}</span>
    </span>
    <span class="panel-time">${esc(al.time || '')}</span>`;
  if (al.goto) {
    row.addEventListener('click', () => {
      closeMenu();
      window.location.href = al.goto;
    });
  }
  return row;
}

// ── Notifications panel ───────────────────────────────────────────────────
function buildNotificationsPanel() {
  const alerts = collectAlerts();
  const shown = alerts.slice(0, 6);
  const root = document.createElement('div');
  root.className = 'panel-content';
  root.innerHTML = `
    <div class="panel-header">
      <span class="panel-title">${esc(t('nav.notifications'))}</span>
      ${alerts.length && !state.notifsRead ? `<span class="panel-badge">${alerts.length}</span>` : ''}
      <button class="panel-action" type="button" data-mark-read>${esc(t('common.markAllRead'))}</button>
    </div>
    <div class="panel-list"></div>
    <div class="panel-footer"><a class="panel-link" href="analytics.html">${esc(t('common.viewAllNotif'))}</a></div>`;
  const list = root.querySelector('.panel-list');
  if (state.notifsRead || !shown.length) {
    list.innerHTML = `<div class="panel-empty">${esc(t('common.emptyInbox'))}</div>`;
  } else {
    shown.forEach(a => list.appendChild(buildPanelRow(a)));
  }
  root.querySelector('[data-mark-read]').addEventListener('click', e => {
    e.stopPropagation();
    state.notifsRead = true;
    updateBadges();
    list.innerHTML = `<div class="panel-empty">${esc(t('common.emptyInbox'))}</div>`;
    const badge = root.querySelector('.panel-badge');
    if (badge) {badge.remove();}
  });
  root.querySelector('.panel-link')?.addEventListener('click', () => closeMenu());
  return root;
}

// ── User profile panel ────────────────────────────────────────────────────
function buildUserPanel() {
  // Auth integration: the panel carries the live session identity; sign-out
  // revokes the refresh token server-side (session.signOut) then redirects
  // to the login page.
  const s = getSession();
  const u = s && s.user;
  const ar = document.documentElement.getAttribute('dir') === 'rtl';
  const name = u ? ((ar && u.nameAr) ? u.nameAr : u.nameEn) : 'HR Admin';
  const initials = String(name).split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const root = document.createElement('div');
  root.className = 'panel-content user-panel';
  root.innerHTML = `
    <div class="user-panel-head">
      <span class="user-panel-avatar">${esc(initials)}</span>
      <span class="user-panel-id">
        <strong>${esc(name)}</strong>
        <span>${esc(u ? (u.email || '') : 'admin@gohr.app')}</span>
        <span class="user-panel-role">${esc(u ? u.role : t('profile.role'))}</span>
      </span>
    </div>
    <button class="menu-item" type="button" data-pref>${esc(t('common.preferences'))}</button>
    <a class="menu-item" href="employees.html">${esc(t('common.employeeDirectory'))}</a>
    ${u && u.role === 'admin' ? `<a class="menu-item" href="users.html">${esc(t('nav.users'))}</a>` : ''}
    <div class="menu-separator"></div>
    <button class="menu-item menu-item-danger" type="button" data-signout>${esc(t('common.signOut'))}</button>`;
  root.querySelector('[data-pref]').addEventListener('click', () => {
    closeMenu();
    openCustomizeSettings();
  });
  root.querySelector('a.menu-item').addEventListener('click', () => closeMenu());
  root.querySelector('[data-signout]').addEventListener('click', () => {
    closeMenu();
    signOut();
  });
  return root;
}

// ── Sidebar settings panel (bottom-left gear) ─────────────────────────────
function setDot(dotId, n) {
  const dot = document.getElementById(dotId);
  if (!dot) {return;}
  dot.hidden = !(n > 0);
  const label = dot.querySelector('span');
  if (label) {label.textContent = n > 9 ? '9+' : String(n);}
}

function updateBadges() {
  const notifN = state.notifsRead ? 0 : collectAlerts().length;
  setDot('topbar-notif-badge', notifN);
}

function updateChromeStrings() {
  const setLabel = (id, key) => {
    const el = document.getElementById(id);
    if (el) {el.setAttribute('aria-label', t(key));}
  };
  setLabel('topbar-notifications', 'nav.notifications');
  setLabel('topbar-apps', 'nav.apps');
  const appsBtn = document.getElementById('topbar-apps');
  if (appsBtn) {
    appsBtn.setAttribute('title', t('nav.apps'));
  }
  setLabel('lang-toggle', 'common.language');
  setLabel('topbar-user', 'nav.profile');
  setLabel('sidebar-settings', 'nav.settings');
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.setAttribute('title', t('common.language'));
    langBtn.setAttribute('aria-label', currentLang() === 'ar' ? t('lang.toggleAr') : t('lang.toggleEn'));
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────
export function initShellChrome() {
  if (document.body.dataset.shellChromeBound) {return;}
  document.body.dataset.shellChromeBound = '1';

  // Note: no topbar search button by design — the sidebar holds the single
  // global search; the command palette stays reachable via Ctrl/⌘+K.
  document.getElementById('topbar-notifications')?.addEventListener('click', e => {
    e.stopPropagation();
    openPanel(e.currentTarget, buildNotificationsPanel(), { width: 360 });
  });
  document.getElementById('topbar-apps')?.addEventListener('click', e => {
    e.stopPropagation();
    import('./apps.js').then(m => m.openAppsLauncher()).catch(() => {});
  });
  document.getElementById('topbar-user')?.addEventListener('click', e => {
    e.stopPropagation();
    openPanel(e.currentTarget, buildUserPanel(), { width: 280 });
  });
  document.getElementById('sidebar-settings')?.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });

  updateBadges();
  updateChromeStrings();
  window.addEventListener(LANG_EVENT, updateChromeStrings);
  window.addEventListener('hr:prefs-changed', updateBadges);
}
