// goHR — system customization studio.
//
// One modal (gear at the bottom of the sidebar → "Customize…", or user menu
// → Preferences) controls the whole shell: company identity (name + logo),
// light/dark theme, accent color, typography, shape/spacing, densities and
// table alignment. Every control repaints the app instantly by writing CSS
// custom properties onto <html>; values persist in localStorage so all pages
// boot already-customized.
//
// Persistence
//   hr:customization:v1 — studio preferences (this file)
//   hr:settings:v1      — company profile (shared with settings.html /
//                         applyBranding() in i18n.js, which paints the name,
//                         logo and accent on every page)
//
// See docs/customization-blueprint.md for the token map.

import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { t, currentLang, LANG_EVENT, applyBranding } from './i18n.js';
import { getTheme, setTheme, THEMES } from './theme.js';
import { getSettings, saveSettings } from './hr-statutory.js';
import { anyAppOpen, resetAppWindows } from './app-windows.js';

const THEME_EVENT = 'themechange';

const STORE_KEY = 'hr:customization:v1';

const DEFAULTS = Object.freeze({
  theme: 'light',
  accent: '#f97316',       // empty string would mean "follow the CSS theme"
  fontFactor: 1,           // 0.85 – 1.25 (body tier)
  headFactor: 1,           // 0.8 – 1.4  (heading tier multiplier)
  subFactor: 1,            // 0.8 – 1.4  (sub-heading tier multiplier)
  fontFamily: 'inter',     // inter | system | plex
  iconScale: 1,            // 0.8 – 1.3
  radius: 8,               // px 0 – 16
  spacingFactor: 1,        // 0.8 – 1.4
  controlH: 34,            // px 28 – 44 (matches --control-h in _tokens.scss)
  topbarH: 56,             // px 48 – 72
  sidebarW: 290,           // px 220 – 320
  tableAlign: 'start'      // start | center | end
});

// Brand swatches offered under the color picker.
const SWATCHES = [
  '#f97316', // construction orange (default)
  '#ea580c', // deep orange
  '#dc2626', // red
  '#d97706', // amber
  '#16a34a', // green
  '#0d9488', // teal
  '#2563eb', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#334155'  // slate
];

// Latin + Arabic stacks per family choice. Only Inter and IBM Plex Sans
// Arabic are webfont-loaded; "system" uses the OS stack with Plex for Arabic.
const FONT_STACKS = {
  inter: {
    en: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ar: "'IBM Plex Sans Arabic', 'Inter', 'Segoe UI', Tahoma, sans-serif"
  },
  system: {
    en: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    ar: "'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif"
  },
  plex: {
    en: "'IBM Plex Sans Arabic', 'IBM Plex Sans', 'Inter', sans-serif",
    ar: "'IBM Plex Sans Arabic', 'Inter', 'Segoe UI', Tahoma, sans-serif"
  }
};

// Active company object from the persisted settings document (mutating this
// object then calling saveSettings(settings) persists it — .company on the
// settings document is a derived view into this same array entry).
function activeCompany(settings) {
  return settings.companies.find((c) => c.id === settings.activeCompanyId)
    || settings.companies[0];
}

// ── tiny DOM helper ───────────────────────────────────────────────────────
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') {el.className = v;}
    else if (k === 'html') {el.innerHTML = v;}
    else if (k.startsWith('on') && typeof v === 'function') {el.addEventListener(k.slice(2), v);}
    else if (v !== null && v !== undefined) {el.setAttribute(k, v);}
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) {return;}
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

// ── color maths ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  let s = String(hex || '').trim().replace(/^#/, '');
  if (s.length === 3) {s = s.split('').map((c) => c + c).join('');}
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {return null;}
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(hex, target, amount) {
  const a = hexToRgb(hex); const b = hexToRgb(target);
  if (!a || !b) {return hex;}
  return rgbToHex(a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount);
}
function hexToHue(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {return 24;}
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) {return 24;}
  let hue;
  if (max === r) {hue = ((g - b) / d) % 6;}
  else if (max === g) {hue = (b - r) / d + 2;}
  else {hue = (r - g) / d + 4;}
  hue = Math.round(hue * 60);
  return hue < 0 ? hue + 360 : hue;
}
// HSL(h, fixed saturation/lightness) → hex; powers the hue slider.
function hslToHex(hue, sat = 0.82, light = 0.53) {
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (hue < 60) {[r, g, b] = [c, x, 0];}
  else if (hue < 120) {[r, g, b] = [x, c, 0];}
  else if (hue < 180) {[r, g, b] = [0, c, x];}
  else if (hue < 240) {[r, g, b] = [0, x, c];}
  else if (hue < 300) {[r, g, b] = [x, 0, c];}
  else {[r, g, b] = [c, 0, x];}
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) {return 0.3;}
  const [r, g, b] = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ── persistence ───────────────────────────────────────────────────────────
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const merged = { ...DEFAULTS, ...JSON.parse(raw) };
      // One-time migrations: users who never customized the width follow the
      // current default (280px breathable sidebar).
      if (merged.sidebarW === 252 || merged.sidebarW === 220) {merged.sidebarW = DEFAULTS.sidebarW;}
      // Same for the control height: 38px was the old default, not a deliberate
      // pick, and it contradicted --control-h (34px) in _tokens.scss.
      if (merged.controlH === 38) {merged.controlH = DEFAULTS.controlH;}
      return merged;
    }
  } catch (_e) { /* corrupt store — fall through */ }
  return { ...DEFAULTS };
}
export function savePrefs(prefs) {
  try {localStorage.setItem(STORE_KEY, JSON.stringify(prefs));} catch (_e) { /* private mode */ }
}

// ── application ───────────────────────────────────────────────────────────
function applyAccent(hex, root) {
  const rgb = hexToRgb(hex);
  if (!rgb) {return;}
  const dark = getTheme() === THEMES.DARK;
  const [r, g, b] = rgb;
  const ink = luminance(hex) > 0.32 ? '#21130a' : '#ffffff';
  const vars = {
    '--primary': hex,
    '--primary-dk': dark ? mix(hex, '#ffffff', 0.12) : mix(hex, '#000000', 0.14),
    '--primary-rgb': `${r}, ${g}, ${b}`,
    '--primary-lt': `rgba(${r}, ${g}, ${b}, ${dark ? 0.14 : 0.1})`,
    '--sidebar-active': `rgba(${r}, ${g}, ${b}, 0.18)`,
    '--card-hover-border': `rgba(${r}, ${g}, ${b}, ${dark ? 0.4 : 0.22})`,
    '--on-primary': ink
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function applyFont(prefs, root) {
  const stacks = FONT_STACKS[prefs.fontFamily] || FONT_STACKS.inter;
  root.style.setProperty('--font-ar', stacks.ar);
  root.style.setProperty('--font', currentLang() === 'ar' ? stacks.ar : stacks.en);
}

// Mirror the chosen accent onto the active company profile so the legacy
// settings page, exported documents and applyBranding() all agree.
function mirrorAccent(hex) {
  try {
    const s = getSettings();
    const co = activeCompany(s);
    if (co && co.primary !== hex) {
      co.primary = hex;
      saveSettings(s);
    }
  } catch (_e) { /* settings module optional in standalone contexts */ }
}

export function applyPrefs(prefsArg) {
  const prefs = prefsArg || loadPrefs();
  const root = document.documentElement;
  root.style.setProperty('--font-factor', prefs.fontFactor);
  // Typography tiers: --fz-global is the body/base size; headings and
  // sub-headings re-scope --font-factor from it (see _components.scss) so
  // every button, label and element follows its tier without compounding.
  root.style.setProperty('--fz-global', prefs.fontFactor);
  root.style.setProperty('--head-factor', prefs.headFactor);
  root.style.setProperty('--sub-factor', prefs.subFactor);
  root.style.setProperty('--icon-scale', prefs.iconScale);
  root.style.setProperty('--spacing-factor', prefs.spacingFactor);
  root.style.setProperty('--radius-base', `${prefs.radius}px`);
  root.style.setProperty('--control-h', `${prefs.controlH}px`);
  root.style.setProperty('--btn-h', `${Math.max(24, prefs.controlH - 2)}px`);
  root.style.setProperty('--topbar-h', `${prefs.topbarH}px`);
  root.style.setProperty('--sidebar-w', `${prefs.sidebarW}px`);
  root.setAttribute('data-table-align', prefs.tableAlign);
  applyFont(prefs, root);
  applyAccent(prefs.accent, root);

  mirrorAccent(prefs.accent);

  if (getTheme() !== prefs.theme) {setTheme(prefs.theme);}
}

// ── studio modal ──────────────────────────────────────────────────────────
function sectionCard(title, desc, content) {
  return h('div', { class: 'cz-card' }, [
    h('div', { class: 'cz-card-head' }, [
      h('h3', { class: 'cz-card-title' }, title),
      desc ? h('p', { class: 'cz-card-desc' }, desc) : null
    ]),
    h('div', { class: 'cz-card-body' }, content)
  ]);
}

// Labeled range row; `fmt(value)` renders the readout, onChange receives the
// numeric value live.
function sliderRow(label, { min, max, step = 1, value, fmt, onChange }) {
  const out = h('output', { class: 'cz-value' }, fmt(value));
  const input = h('input', {
    class: 'cz-range',
    type: 'range',
    min: String(min), max: String(max), step: String(step), value: String(value),
    'aria-label': label,
    oninput: () => {
      const v = parseFloat(input.value);
      out.textContent = fmt(v);
      onChange(v);
    }
  });
  return h('div', { class: 'cz-row' }, [
    h('label', { class: 'cz-label' }, [label, out]),
    input
  ]);
}

function selectRow(label, value, options, onChange) {
  const sel = h('select', { class: 'form-control cz-select', 'aria-label': label },
    options.map(([val, txt]) => h('option', { value: val, ...(val === value ? { selected: 'selected' } : {}) }, txt)));
  sel.addEventListener('change', () => onChange(sel.value));
  return h('div', { class: 'cz-row' }, [h('label', { class: 'cz-label' }, label), sel]);
}

// ── company card (name EN/AR + logo) ──────────────────────────────────────
// Mutate the active company through this helper so every write reloads the
// persisted settings document first — a stale snapshot here would clobber
// accent changes made elsewhere in the studio moments earlier.
function updateCompany(mutate) {
  const s = getSettings();
  const co = activeCompany(s);
  mutate(co);
  saveSettings(s);
  applyBranding();
  return co;
}

function buildCompanyCard() {
  const initial = activeCompany(getSettings());

  const preview = h('div', { class: 'cz-logo-preview', 'aria-hidden': 'true' });
  const paintPreview = () => {
    const co = activeCompany(getSettings());
    preview.innerHTML = '';
    if (co.logo) {
      preview.appendChild(h('img', { src: co.logo, alt: '' }));
    } else {
      preview.appendChild(h('span', { class: 'cz-logo-initial' },
        (co.nameEn || 'G').trim().charAt(0).toUpperCase()));
    }
  };
  paintPreview();

  const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp', hidden: 'hidden' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {return;}
    if (!/^image\//.test(file.type)) {showToast(t('cz.logoErr')); return;}
    if (file.size > 512 * 1024) {showToast(t('cz.logoErr')); return;}
    const reader = new FileReader();
    reader.onload = () => {
      updateCompany((co) => { co.logo = String(reader.result); });
      paintPreview();
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  const removeBtn = h('button', {
    class: 'btn btn-outline btn-sm', type: 'button',
    onclick: () => {
      const co = updateCompany((c) => { c.logo = ''; });
      paintPreview();
      refreshBrandIcon(co);
    }
  }, t('cz.removeLogo'));

  const nameInput = (key, placeholder, label) => h('div', { class: 'cz-field' }, [
    h('label', { class: 'cz-field-label' }, label),
    h('input', {
      class: 'form-control', type: 'text', value: initial[key] || '', placeholder, maxlength: '60',
      oninput: (e) => updateCompany((co) => { co[key] = e.target.value; })
    })
  ]);

  return sectionCard(t('cz.company'), t('cz.companyHint'), [
    h('div', { class: 'cz-logo-row' }, [
      preview,
      h('div', { class: 'cz-logo-actions' }, [
        h('button', {
          class: 'btn btn-outline btn-sm', type: 'button',
          onclick: () => fileInput.click()
        }, t('cz.uploadLogo')),
        removeBtn
      ]),
      fileInput
    ]),
    h('p', { class: 'cz-field-hint' }, t('cz.logoHint')),
    h('div', { class: 'cz-grid-2' }, [
      nameInput('nameEn', 'goHR', t('st.coNameEn')),
      nameInput('nameAr', 'goHR', t('st.coNameAr'))
    ])
  ]);
}

// ── appearance card (theme + accent) ──────────────────────────────────────
function buildAppearanceCard(prefs, persist) {
  const segBtn = (theme, label, icon) => h('button', {
    class: `cz-seg-btn${getTheme() === theme ? ' active' : ''}`,
    type: 'button', 'data-theme': theme,
    onclick: () => {
      setTheme(theme);
      prefs.theme = theme; persist();
      segBox.querySelectorAll('.cz-seg-btn').forEach((b) =>
        b.classList.toggle('active', b.dataset.theme === getTheme()));
    }
  }, [h('span', { class: 'cz-seg-icon', html: icon }), label]);
  const segBox = h('div', { class: 'cz-seg', role: 'group' }, [
    segBtn(THEMES.LIGHT, t('st.themeLight'),
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'),
    segBtn(THEMES.DARK, t('st.themeDark'),
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>')
  ]);

  // Accent: swatches, hue slider, native color picker — all synced.
  const swatchBox = h('div', { class: 'cz-swatches' });
  const hue = h('input', { class: 'cz-range cz-hue', type: 'range', min: '0', max: '359', step: '1', value: String(hexToHue(prefs.accent)), 'aria-label': t('cz.hue') });
  const picker = h('input', { class: 'cz-color', type: 'color', value: prefs.accent.toLowerCase(), 'aria-label': t('cz.accent') });
  const hexOut = h('code', { class: 'cz-hex' }, prefs.accent);

  const syncAccent = (hex) => {
    prefs.accent = hex;
    hexOut.textContent = hex;
    picker.value = hex;
    hue.value = String(hexToHue(hex));
    applyAccent(hex, document.documentElement);
    mirrorAccent(hex);
    persist();
    swatchBox.querySelectorAll('.cz-swatch').forEach((b) =>
      b.classList.toggle('active', b.dataset.hex === hex));
  };
  SWATCHES.forEach((hex) => {
    const b = h('button', {
      class: `cz-swatch${prefs.accent === hex ? ' active' : ''}`, type: 'button',
      style: `background:${hex}`, 'data-hex': hex, title: hex,
      'aria-label': hex,
      onclick: () => syncAccent(hex)
    });
    swatchBox.appendChild(b);
  });
  hue.addEventListener('input', () => syncAccent(hslToHex(parseInt(hue.value, 10))));
  picker.addEventListener('input', () => syncAccent(picker.value));

  return sectionCard(t('cz.appearance'), null, [
    h('div', { class: 'cz-row' }, [h('label', { class: 'cz-label' }, t('st.theme')), segBox]),
    h('div', { class: 'cz-row cz-row-stack' }, [
      h('label', { class: 'cz-label' }, [t('cz.accent'), hexOut]),
      h('div', { class: 'cz-accent-row' }, [swatchBox, picker])
    ]),
    h('div', { class: 'cz-row' }, [
      h('label', { class: 'cz-label' }, t('cz.hue')),
      hue
    ])
  ]);
}

// ── typography card ───────────────────────────────────────────────────────
function buildTypographyCard(prefs, persist) {
  return sectionCard(t('cz.typography'), null, [
    selectRow(t('cz.fontFamily'), prefs.fontFamily, [
      ['inter', t('cz.ffInter')],
      ['system', t('cz.ffSystem')],
      ['plex', t('cz.ffPlex')]
    ], (v) => {
      prefs.fontFamily = v; persist();
      applyFont(prefs, document.documentElement);
    }),
    sliderRow(t('cz.fsHead'), {
      min: 0.8, max: 1.4, step: 0.05, value: prefs.headFactor,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => { prefs.headFactor = v; persist(); document.documentElement.style.setProperty('--head-factor', v); }
    }),
    sliderRow(t('cz.fsSub'), {
      min: 0.8, max: 1.4, step: 0.05, value: prefs.subFactor,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => { prefs.subFactor = v; persist(); document.documentElement.style.setProperty('--sub-factor', v); }
    }),
    sliderRow(t('cz.fsBody'), {
      min: 0.85, max: 1.25, step: 0.05, value: prefs.fontFactor,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => {
        prefs.fontFactor = v; persist();
        const root = document.documentElement;
        root.style.setProperty('--font-factor', v);
        root.style.setProperty('--fz-global', v);
      }
    })
  ]);
}

// ── shape / density card ──────────────────────────────────────────────────
function buildShapeCard(prefs, persist) {
  const root = document.documentElement;
  return sectionCard(t('cz.shape'), null, [
    sliderRow(t('cz.corner'), {
      min: 0, max: 16, value: prefs.radius, fmt: (v) => `${v}px`,
      onChange: (v) => { prefs.radius = v; persist(); root.style.setProperty('--radius-base', `${v}px`); }
    }),
    sliderRow(t('cz.spacing'), {
      min: 0.8, max: 1.4, step: 0.05, value: prefs.spacingFactor,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => { prefs.spacingFactor = v; persist(); root.style.setProperty('--spacing-factor', v); }
    }),
    sliderRow(t('cz.iconSize'), {
      min: 0.8, max: 1.3, step: 0.05, value: prefs.iconScale,
      fmt: (v) => `${Math.round(v * 100)}%`,
      onChange: (v) => { prefs.iconScale = v; persist(); root.style.setProperty('--icon-scale', v); }
    }),
    sliderRow(t('cz.controlHeight'), {
      min: 28, max: 44, value: prefs.controlH, fmt: (v) => `${v}px`,
      onChange: (v) => {
        prefs.controlH = v; persist();
        root.style.setProperty('--control-h', `${v}px`);
        root.style.setProperty('--btn-h', `${Math.max(24, v - 2)}px`);
      }
    }),
    sliderRow(t('cz.topbarHeight'), {
      min: 48, max: 72, value: prefs.topbarH, fmt: (v) => `${v}px`,
      onChange: (v) => { prefs.topbarH = v; persist(); root.style.setProperty('--topbar-h', `${v}px`); }
    }),
    sliderRow(t('cz.sidebarWidth'), {
      min: 220, max: 320, value: prefs.sidebarW, fmt: (v) => `${v}px`,
      onChange: (v) => { prefs.sidebarW = v; persist(); root.style.setProperty('--sidebar-w', `${v}px`); }
    })
  ]);
}

// ── tables card ───────────────────────────────────────────────────────────
function buildTablesCard(prefs, persist) {
  return sectionCard(t('cz.tables'), null, [
    selectRow(t('cz.tableAlign'), prefs.tableAlign, [
      ['start', t('cz.alignStart')],
      ['center', t('cz.alignCenter')],
      ['end', t('cz.alignEnd')]
    ], (v) => {
      prefs.tableAlign = v; persist();
      document.documentElement.setAttribute('data-table-align', v);
    })
  ]);
}

export function openCustomizeSettings() {
  const prefs = loadPrefs();
  const persist = () => {
    savePrefs(prefs);
    // Re-customizing changes the type scale/shapes — snap open app windows
    // back to their default geometry instead of leaving them squished.
    if (anyAppOpen()) {
      resetAppWindows();
    }
  };
  const renderBody = () => h('div', { class: 'cz-body' }, [
    buildAppearanceCard(prefs, persist),
    buildTypographyCard(prefs, persist),
    buildShapeCard(prefs, persist),
    buildTablesCard(prefs, persist)
  ]);

  return showModal({
    title: t('cz.title'),
    body: renderBody(),
    size: 'lg',
    actions: [
      {
        label: t('cz.reset'),
        variant: 'outline',
        // ctx.body is the live modal body — re-render it in place so the
        // open modal instantly reflects the restored defaults.
        action: (ctx) => {
          Object.assign(prefs, DEFAULTS);
          savePrefs(prefs);
          // Identity note: Customize reset only restores look & feel — the
          // company's legal identity (name/logo) lives in Settings, not here.
          setTheme(DEFAULTS.theme);
          applyPrefs(prefs);
          applyBranding();
          ctx.body.innerHTML = '';
          const fresh = renderBody();
          while (fresh.firstChild) {ctx.body.appendChild(fresh.firstChild);}
          return false; // keep the modal open
        }
      },
      { label: t('cz.done'), variant: 'primary', action: () => true }
    ]
  });
}

// ── boot ──────────────────────────────────────────────────────────────────
export function initCustomize() {
  if (window.__hrCustomizeInit) {return;}
  window.__hrCustomizeInit = true;

  const prefs = loadPrefs();
  // The saved theme is restored by the pre-paint script + initTheme(); mirror
  // it into the prefs object so they never disagree.
  prefs.theme = getTheme();
  applyPrefs(prefs);
  savePrefs(prefs);

  // Topbar theme toggle keeps the stored pref + custom accent in sync.
  document.addEventListener(THEME_EVENT, () => {
    const p = loadPrefs();
    p.theme = getTheme();
    savePrefs(p);
    applyAccent(p.accent, document.documentElement);
  });
  // Language switch swaps the active font stack for the chosen family.
  window.addEventListener(LANG_EVENT, () => {
    applyFont(loadPrefs(), document.documentElement);
  });
}
