// goHR — entry
// Self-contained dashboard skin. Loads the core design system.

// Self-hosted webfonts (Fontsource woff2, bundled by Vite) — no external
// CDN at runtime, so Arabic (IBM Plex Sans Arabic) renders even where
// fonts.googleapis.com is blocked. Only the latin/arabic subsets and the
// weights the UI uses are emitted.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';

import './styles/main.scss';
import { mountShell } from './components/shell.js';
import { initCharts } from './components/charts.js';
import { initTables } from './components/tables.js';
import { openMenu, DEFAULT_CARD_MENU } from './components/menus.js';
import { initCommandPalette } from './components/command-palette.js';
import { initPageActions } from './components/page-actions.js';
import { initI18n, t } from './components/i18n.js';
import { initCustomize } from './components/customize.js';
import { initTheme } from './components/theme.js';
import { initShellChrome } from './components/shell-chrome.js';
import { initSession, isDemoMode } from './components/session.js';
import { installGoDrMonitor } from './components/godr/monitor.js';

mountShell();
initTheme();
initShellChrome();
initI18n();
// Session guard + identity paint for admin-shell pages (login page opts out:
// it has no data-shell and boots its own flow via login.js).
if (document.body.dataset.shell === 'admin') {
  initSession();
  // Mark body with demo-mode class for CSS targeting
  if (isDemoMode()) {
    document.body.classList.add('demo-mode');
  }
}
initCustomize();
// Go Dr. — passive monitoring instrumentation on every page (JS errors,
// failed fetches, offline events, per-page load times). Lightweight; the
// dashboard itself stays lazy via the PAGES registry below.
installGoDrMonitor();
// Heavy last: charts (echarts) + grids (datatables) mount after first paint
// so shell, text and LCP settle first. Skeletons cover the wait; idle fires
// ASAP when the main thread is free, setTimeout covers jsdom/no-idle.
const whenIdle = (fn) => {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 1500 });
  } else {
    setTimeout(fn, 0);
  }
};
whenIdle(initCharts);
whenIdle(initTables);
initCommandPalette();
initPageActions();

// Service worker — only in production builds (skip on dev so HMR isn't fought
// by the cache). Path uses Vite's BASE_URL so subpath deploys (e.g.
// example.com/dash/) register the SW at the right scope.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath).catch(() => { /* ignore */ });
  });
}

// DEV self-heal: an older build may have registered a service worker on this
// origin. A stale SW (or its pre-cached assets) can make the dev server look
// like it is "not loading" even though the server responds fine. Remove any
// registered SW and stale caches whenever we run in development.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    }).catch(() => { /* ignore */ });
    if (window.caches && window.caches.keys) {
      window.caches.keys().then(keys => keys.forEach(k => window.caches.delete(k))).catch(() => {});
    }
  });
}

// goHR main dashboard (index.html)
if (document.querySelector('[data-page="dashboard"]')) {
  import('./components/index-dashboard.js').then(m => m.initIndexDashboard()).catch(() => { /* dashboard init failed */ });
}

// Page registry: data-page key -> lazy importer. Only the kept areas boot
// here: the dashboard via the guard above, plus employees and their supporting
// views. `analytics` has no entry — its page markup is not wired to a module,
// so opening analytics.html renders its static shell and nothing populates it.
const PAGES = {
  'employees': () => import('./components/employees.js').then((m) => m.initEmployees()),
  'employee-file': () => import('./components/employee-detail.js').then((m) => m.initEmployeeDetail()),
  'attendance': () => import('./components/attendance.js').then((m) => m.initAttendance()),
  'leave': () => import('./components/leave.js').then((m) => m.initLeave()),
  'payroll': () => import('./components/payroll.js').then((m) => m.initPayroll()),
  'invoices': () => import('./components/invoices.js').then((m) => m.initInvoices()),
  'eosb': () => import('./components/eosb.js').then((m) => m.initEosb()),
  'renewals': () => import('./components/renewals.js').then((m) => m.initRenewals()),
  'documents': () => import('./components/docs.js').then((m) => m.initDocs()),
  'files': () => import('./components/files.js').then((m) => m.initFiles()),
  'recruitment': () => import('./components/recruit.js').then((m) => m.initRecruit()),
  'profitability': () => import('./components/profitability.js').then((m) => m.initProfit()),
  'expenses': () => import('./components/expenses.js').then((m) => m.initExpenses()),
  'settings': () => import('./components/settings.js').then((m) => m.initSettings()),
  'apps': () => import('./components/apps.js').then((m) => m.initApps()),
  'users': () => import('./components/users.js').then((m) => m.initUsers()),
  'go-dr': () => import('./components/godr/page.js').then((m) => m.initGoDr()),
  'email': () => import('./components/email.js').then((m) => m.initEmail()),
  'accounts': () => import('./components/accounts.js').then((m) => m.initAccounts())
};
const normalizePage = (key) => (key || '').replace(/^hr_/, '').replace(/_/g, '-');
const pageKey = normalizePage(document.body?.dataset.page);
if (pageKey && PAGES[pageKey]) {
  PAGES[pageKey]().catch(() => { /* page init failed */ });
}

// ────────────────────────
//  Delegated interactions
// ────────────────────────

// Toggle switches
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('.toggle');
  if (toggle) {toggle.classList.toggle('on');}
});

// Todo checkboxes — toggle .done on the cb + row, then refresh any
// `[data-todo-counter]` element inside the parent card so the "X of Y
// remaining" subtitle stays in sync with the actual checkboxes.
document.addEventListener('click', (e) => {
  const cb = e.target.closest('.todo-cb');
  if (!cb) {return;}
  cb.classList.toggle('done');
  const row = cb.closest('.todo-row');
  if (row) {row.classList.toggle('done');}
  // Update counter text within the same card.
  const card = cb.closest('.card');
  if (!card) {return;}
  const counter = card.querySelector('[data-todo-counter]');
  if (!counter) {return;}
  const all = card.querySelectorAll('.todo-row');
  const done = card.querySelectorAll('.todo-row.done');
  const remaining = all.length - done.length;
  // Format: "<remaining> of <total> remaining" — matches existing copy.
  counter.textContent = t('common.ofRemaining')
    .replace('{remaining}', remaining)
    .replace('{total}', all.length);
});

// Tab groups: works for any container of .chart-tab buttons (chart cards,
// calendar view switcher, generic tab strips). Adds .active to the clicked
// tab and removes it from siblings in the same parent.
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.chart-tab');
  if (!tab) {return;}
  tab.parentElement.querySelectorAll('.chart-tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
});

// Button groups with [data-group]: radio-style single-select. Click sets
// .active on the clicked button and clears its siblings in the same group.
// Opt-in via data-group so plain action button groups are unaffected.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-group[data-group] > .btn');
  if (!btn) {return;}
  btn.parentElement.querySelectorAll('.btn').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
});

// Card option buttons → popover menu.
// Calendar nav buttons (prev/next month) are also .card-opt-btn but live
// inside .calendar-toolbar; calendar.js stops propagation on those clicks
// so they never reach this handler.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.card-opt-btn');
  if (!btn) {return;}
  // Skip if the click was already handled (e.g. calendar prev/next).
  if (e.defaultPrevented) {return;}
  e.preventDefault();
  openMenu(btn, DEFAULT_CARD_MENU);
});

// Chip dismiss (× icon) and chip toggle.
document.addEventListener('click', (e) => {
  const closer = e.target.closest('.chip-close');
  if (closer) {
    const chip = closer.closest('.chip');
    if (chip) {
      chip.style.transition = 'opacity 150ms, transform 150ms';
      chip.style.opacity = '0';
      chip.style.transform = 'scale(0.85)';
      setTimeout(() => chip.remove(), 160);
    }
    return;
  }
  const chip = e.target.closest('.chip');
  if (chip) {chip.classList.toggle('active');}
});

// Form submit — let HTML5 validation run, then fake-submit on valid forms.
// Lazy-imports the toast helper so the dependency stays out of the entry chunk.
document.addEventListener('submit', (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) {return;}
  // Native :invalid forms still get the browser's validation UI before we
  // see the submit event, so reaching here means the form is already valid.
  
  // Block form submissions in demo mode
  if (isDemoMode()) {
    e.preventDefault();
    import('./components/toast.js').then(({ showToast }) => 
      showToast(t('act.demoDisabled') || 'This action is disabled in demo mode', { variant: 'warning' })
    );
    return;
  }
  
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
  const label = (submitBtn?.textContent || submitBtn?.value || t('act.savedShort')).trim();
  import('./components/toast.js').then(({ showToast }) => showToast(`${label} ✓`, { variant: 'success' }));
  if (form.dataset.resetOnSubmit !== 'false') {form.reset();}
});

// Command palette opens via ⌘K / Ctrl+K — wired by initCommandPalette.
// Page-actions (Print / Export / Compose / Add / etc.) wired via initPageActions.
