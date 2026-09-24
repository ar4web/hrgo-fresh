// goHR — runtime shell mount (minimal: sidebar + toggle-only topbar)
// At build/dev time the Vite plugin (vite.config.js) injects sidebar/topbar
// directly into each production/*.html. mountShell() is the runtime
// fallback: if the shell isn't already in the DOM (e.g. opening a raw HTML
// file), render it from the same string templates. Either way, mountShell()
// always wires up runtime behavior (mobile drawer, desktop rail).

import { renderShell } from './shell-render.js';
import { LANG_EVENT } from './i18n.js';

function injectShellIfMissing() {
  const body = document.body;
  if (body.querySelector('.sidebar')) {
    return;
  }

  const activeKey = body.dataset.page || '';

  const { sidebar, topbar } = renderShell({ activeKey });

  const tpl = document.createElement('template');
  tpl.innerHTML = sidebar.trim();
  body.insertBefore(tpl.content.firstElementChild, body.firstChild);

  const mainEl = body.querySelector('main.main');
  tpl.innerHTML = topbar.trim();
  if (mainEl) {
    body.insertBefore(tpl.content.firstElementChild, mainEl);
  }
}

// One-time migration of pre-rebrand storage keys (gentelella:* -> dash:*).
// Storage access itself can throw (sandboxed iframe, blocked cookies) —
// resolve the store handle inside try so mountShell never dies.
function migrateStorageKeys() {
  let store;
  try {
    store = localStorage;
  } catch (_e) {
    return;
  }
  const moves = [[store, 'gentelella:sidebar-rail', RAIL_KEY]];
  for (const [store, oldK, newK] of moves) {
    try {
      if (store.getItem(newK) === null) {
        const v = store.getItem(oldK);
        if (v !== null) {
          store.setItem(newK, v);
        }
      }
      store.removeItem(oldK);
    } catch (_e) {
      /* private mode */
    }
  }
  try {
    sessionStorage.removeItem('gentelella:nav-open');
    sessionStorage.removeItem('dash:nav-open');
  } catch (_e) {
    /* private mode */
  }
}

// Link prefetch — sidebar clicks load separate documents (multi-page app),
// so warm them: on hover/focus immediately, plus idle-warm the sidebar once.
// Next click then serves from cache instead of a cold load with spinners.
function bindLinkPrefetch() {
  // One document, one binding — mountShell may re-run, but listeners on
  // document would pile up.
  if (document.body.dataset.prefetchBound) {
    return;
  }
  document.body.dataset.prefetchBound = '1';
  const seen = new Set();
  const warm = href => {
    if (!href || seen.has(href)) {
      return;
    }
    if (!/^[a-z0-9_-]+\.html([?#].*)?$/i.test(href)) {
      return;
    }
    if (typeof fetch !== 'function') {
      return;
    }
    seen.add(href);
    try {
      fetch(href, { credentials: 'same-origin' }).catch(() => {
        /* offline */
      });
    } catch (_e) {
      /* ignore */
    }
  };
  const fromEvent = e => {
    const a = e.target && e.target.closest && e.target.closest('a.nav-parent, a.nav-page');
    if (a) {
      warm(a.getAttribute('href'));
    }
  };
  document.addEventListener('mouseover', fromEvent);
  document.addEventListener('focusin', fromEvent);
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => {
    // Active section pages first, then every section main screen — after
    // this, any sidebar click is a cache hit.
    document
      .querySelectorAll('.sidebar-nav a.nav-page[href], .sidebar-nav a.nav-parent[href]')
      .forEach(a => warm(a.getAttribute('href')));
  });
  // Graceful exit: fade the outgoing document instead of an abrupt cut to
  // the next page's backdrop. Only when an unload really follows — downloads,
  // mail links, same-page anchors and new-tab clicks stay on the page, so a
  // veil there would strand it invisible (the white-screen bug).
  // Script-URL guard below matches the scheme loosely: browsers ignore
  // embedded whitespace/control chars, so `java\tscript:` still runs.
  const isScriptUrl = h => /^\s*j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i.test(h);
  window.addEventListener('pageshow', () => document.body.classList.remove('page-leave'));
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) {
      return;
    }
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || isScriptUrl(href)) {
      return;
    }
    if (a.target === '_blank' || a.hasAttribute('download')) {
      return;
    }
    if (/^(mailto|tel|sms|blob|data):/i.test(href)) {
      return;
    }
    document.body.classList.add('page-leave');
  });
}

// Sidebar toggle — desktop collapses to a 64px rail; mobile opens a drawer.
// Same button, viewport-aware behavior. Rail state persists in localStorage.
const RAIL_KEY = 'dash:sidebar-rail';

function isDesktop() {
  return window.matchMedia('(min-width: 769px)').matches;
}

function applyRailLabels() {
  // Sets data-rail-label on every nav-link so the CSS tooltip has text to show.
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    const text = link.querySelector('.nav-text')?.textContent.trim();
    if (text) {
      link.setAttribute('data-rail-label', text);
    }
  });
}

// Sidebar width follows the longest label: CSS gives every .nav-link the
// same edge inset and icon↔label gap (both read --sb-edge), and this sizes
// --sidebar-w to the widest row so both insets stay symmetric.
// Skipped in rail mode (fixed 76px icon column) and on mobile (drawer).
function fitSidebarToLabels() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) {return;}
  if (!isDesktop() || document.body.classList.contains('sidebar-rail')) {return;}
  const prevTransition = sidebar.style.transition;
  const prevWidth = sidebar.style.width;
  // The search input's intrinsic width must not drive the rail — only the
  // longest nav label may. Collapse it for the measurement frame.
  const searchInput = sidebar.querySelector('#sidebar-search');
  const prevSearchDisplay = searchInput ? searchInput.style.display : '';
  sidebar.style.transition = 'none';
  if (searchInput) {searchInput.style.display = 'none';}
  // Let content declare its own width for one frame, then read it back.
  sidebar.style.width = 'max-content';
  const needed = Math.ceil(sidebar.getBoundingClientRect().width);
  sidebar.style.width = prevWidth;
  sidebar.style.transition = prevTransition;
  if (searchInput) {searchInput.style.display = prevSearchDisplay;}
  if (!Number.isFinite(needed) || needed <= 0) {return;}
  const clamped = Math.max(200, Math.min(340, needed));
  const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) || 0;
  if (Math.abs(current - clamped) < 1) {return;}
  document.documentElement.style.setProperty('--sidebar-w', `${clamped}px`);
}

let fitQueued = false;
function queueSidebarFit() {
  if (fitQueued) {return;}
  fitQueued = true;
  const run = () => { fitQueued = false; fitSidebarToLabels(); };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function bindSidebarToggle() {
  const sidebar = document.querySelector('.sidebar');
  // Rail toggle lives inside the dark sidebar brand row (desktop); the
  // topbar holds a mobile-only drawer opener. Either may be absent.
  const railToggle = document.querySelector('.sidebar .sidebar-toggle');
  const menuBtn = document.querySelector('.topbar-menu');
  if (!sidebar || (!railToggle && !menuBtn)) {
    return;
  }

  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
  }

  // ── Mobile drawer ──
  const setExpanded = open => {
    railToggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const drawerClose = () => {
    sidebar.classList.remove('open');
    backdrop.hidden = true;
    setExpanded(false);
    document.body.classList.remove('sidebar-open');
  };
  const drawerOpen = () => {
    sidebar.classList.add('open');
    backdrop.hidden = false;
    setExpanded(true);
    document.body.classList.add('sidebar-open');
  };

  // ── Desktop rail ──
  const syncToggleIcon = on => {
    if (!railToggle) {return;}
    const expanded = railToggle.querySelector('.toggle-icon-expanded');
    const collapsed = railToggle.querySelector('.toggle-icon-collapsed');
    if (expanded) {expanded.hidden = on;}
    if (collapsed) {collapsed.hidden = !on;}
  };
  const setRail = on => {
    document.body.classList.toggle('sidebar-rail', on);
    railToggle?.setAttribute('aria-pressed', on ? 'true' : 'false');
    railToggle?.setAttribute('aria-label', on ? 'Expand sidebar' : 'Collapse sidebar');
    syncToggleIcon(on);
    try {
      localStorage.setItem(RAIL_KEY, on ? '1' : '0');
    } catch (_e) {
      /* ignore */
    }
    if (on) {
      applyRailLabels();
    } else {
      queueSidebarFit();
    }
  };

  // Restore stored rail preference (desktop only). Mobile ignores it so the
  // drawer/sidebar isn't shown rail-style on small screens.
  let stored = '0';
  try {
    stored = localStorage.getItem(RAIL_KEY) || '0';
  } catch (_e) {
    /* ignore */
  }
  if (stored === '1' && isDesktop()) {
    setRail(true);
  }

  railToggle?.addEventListener('click', () => {
    if (isDesktop()) {
      setRail(!document.body.classList.contains('sidebar-rail'));
    } else {
      sidebar.classList.contains('open') ? drawerClose() : drawerOpen();
    }
  });
  menuBtn?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? drawerClose() : drawerOpen();
  });

  backdrop.addEventListener('click', drawerClose);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      drawerClose();
    }
  });

  // Viewport changes: desktop ↔ mobile. Reset state coherently.
  const mq = window.matchMedia('(min-width: 769px)');
  mq.addEventListener('change', e => {
    if (e.matches) {
      // Now desktop — close any drawer, restore rail state.
      drawerClose();
      let v = '0';
      try {
        v = localStorage.getItem(RAIL_KEY) || '0';
      } catch (_err) {
        /* ignore */
      }
      setRail(v === '1');
      queueSidebarFit();
    } else {
      // Now mobile — drop rail mode (drawer takes over).
      document.body.classList.remove('sidebar-rail');
    }
  });
}

/**
 * Mount the admin shell (sidebar + toggle-only topbar + interactivity).
 *
 * Reads two `<body>` data attributes:
 * - `data-shell="admin"` — opt-in. No-op if absent.
 * - `data-page="key"` — matches a {@link import('./shell-render.js').NAV} item to highlight.
 *
 * Idempotent: if the build-time Vite plugin already injected the shell HTML
 * (the common case), this only wires up runtime behavior — mobile drawer,
 * desktop rail, link prefetch.
 */
// Sidebar search — filters sections live; Esc clears. Hides non-matching
// links and any group left empty.
function bindSidebarSearch() {
  const input = document.getElementById('sidebar-search');
  const nav = document.querySelector('.sidebar-nav');
  if (!input || !nav) {
    return;
  }
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    nav.querySelectorAll('.nav-group').forEach(group => {
      let visible = 0;
      group.querySelectorAll('.nav-link, .nav-page').forEach(link => {
        const text = link.querySelector('.nav-text')?.textContent.toLowerCase() || '';
        const show = !q || text.includes(q);
        link.hidden = !show;
        if (show) {visible += 1;}
      });
      group.hidden = visible === 0;
    });
  };
  input.addEventListener('input', apply);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      input.value = '';
      apply();
    }
  });
}

export function mountShell() {
  const body = document.body;
  if (body.dataset.shell !== 'admin') {
    return;
  }

  injectShellIfMissing();
  migrateStorageKeys();
  bindLinkPrefetch();
  bindSidebarToggle();
  bindSidebarSearch();
  bindSidebarAutoFit();
}

let sidebarFitBound = false;
// Keep --sidebar-w glued to the longest label across font loads, language
// switches and studio density changes. Guarded so repeat mountShell() calls
// (one per page in this multi-page app) don't stack listeners.
function bindSidebarAutoFit() {
  queueSidebarFit();
  if (sidebarFitBound) {return;}
  sidebarFitBound = true;
  try {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => queueSidebarFit()).catch(() => {});
    }
  } catch (_e) { /* font API optional */ }
  window.addEventListener('load', queueSidebarFit);
  window.addEventListener(LANG_EVENT, queueSidebarFit);
  // Window resizes (zoom, DevTools, window drag) change label metrics —
  // refit, debounced. fitSidebarToLabels() no-ops on mobile / rail mode.
  let rsTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rsTimer);
    rsTimer = window.setTimeout(queueSidebarFit, 200);
  });
  // Studio sliders (spacing / font / icon scale) rewrite :root vars which
  // change label metrics — refit, debounced. The 1px guard inside
  // fitSidebarToLabels() stops the write→observe→write loop.
  let moTimer = 0;
  try {
    const mo = new MutationObserver(() => {
      window.clearTimeout(moTimer);
      moTimer = window.setTimeout(queueSidebarFit, 150);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  } catch (_e) { /* observer optional */ }
}
