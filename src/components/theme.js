// goHR — theme engine.
//
// Two built-in themes:
//   dark  — Dark Orange: charcoal surfaces with a vivid orange accent,
//           inspired by the supplied construction / operations console
//           references. (default — set via localStorage `hr:theme` to 'light')
//   light — light theme
//
// The choice is persisted (localStorage `hr:theme`) and applied pre-paint
// by the inline script injected from vite.config.js, so there is no flash.
// Charts observe the <html data-theme> attribute and repaint themselves.

const KEY = 'hr:theme';

export const THEMES = Object.freeze({ LIGHT: 'light', DARK: 'dark' });
const DEFAULT_THEME = THEMES.DARK;

// <html> background shown before the stylesheet lands (must match
// --body-bg in each theme; mirrored in the vite.config.js pre-paint script).
const PRE_PAINT_BG = Object.freeze({
  light: '#f3f5f8',
  dark: '#0B0D10'
});

// Browser chrome color (<meta name="theme-color">).
const META_COLOR = Object.freeze({
  light: '#f97316',
  dark: '#121417'
});

export function getTheme() {
  try {
    return localStorage.getItem(KEY) === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  } catch (_e) {
    return DEFAULT_THEME;
  }
}

function syncToggle(theme) {
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    const dark = theme === THEMES.DARK;
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  });
}

function syncMeta(theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    const media = meta.getAttribute('media') || '';
    if (media.includes('dark')) {
      meta.setAttribute('content', META_COLOR.dark);
    } else if (media.includes('light')) {
      meta.setAttribute('content', META_COLOR.light);
    } else {
      meta.setAttribute('content', META_COLOR[theme]);
    }
  });
}

// Apply a theme to the document without persisting it.
function applyTheme(theme) {
  const next = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  const root = document.documentElement;
  root.setAttribute('data-theme', next);
  root.style.background = PRE_PAINT_BG[next];
  syncMeta(next);
  syncToggle(next);
  // chart-helper/charts observe data-theme themselves; the event also lets
  // non-chart code (maps, canvases) repaint if needed.
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  return next;
}

export function setTheme(theme) {
  const next = applyTheme(theme);
  try {
    localStorage.setItem(KEY, next);
  } catch (_e) {
    /* private mode / blocked storage — theme lasts for this view only */
  }
  return next;
}

function toggleTheme() {
  return setTheme(getTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
}

// Apply the stored theme (called once on boot) and wire the topbar toggle.
// The click handler is delegated on document so it survives the shell being
// injected at build time or mounted at runtime.
export function initTheme() {
  applyTheme(getTheme());
  if (document.body.dataset.themeBound) {
    return;
  }
  document.body.dataset.themeBound = '1';
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (btn) {
      e.preventDefault();
      toggleTheme();
    }
  });
}
