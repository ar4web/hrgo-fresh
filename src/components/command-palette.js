// Command palette — global ⌘K / Ctrl+K modal with fuzzy search.
// Pulls search targets from the same NAV array the sidebar uses, plus a
// curated list of inline actions (theme toggle, sign out, etc.). No external
// fuzzy-search library; the matcher is a small subsequence + word-boundary
// scorer that's good enough for ~50 items.

import { NAV } from './shell-render.js';
import { showToast } from './toast.js';
import { escapeHtml } from './markup.js';
import { showModal } from './modal.js';
import { t, currentLang, LANG_EVENT } from './i18n.js';

let host = null;
let inputEl = null;
let listEl = null;
let items = [];
let filtered = [];
let activeIndex = 0;

function collectLeaves(items, out) {
  for (const it of items || []) {
    if (it.href) {
      out.push(it);
    }
    if (it.children) {collectLeaves(it.children, out);}
  }
  return out;
}

function buildItems() {
  const out = [];
  // Every navigable leaf from the sidebar groups.
  NAV.forEach((group) => {
    for (const leaf of collectLeaves(group.items, [])) {
      out.push({
        kind: 'page',
        label: leaf.text,
        section: group.label,
        href: leaf.href,
        keywords: `${leaf.text} ${group.label} ${leaf.key || ''}`.toLowerCase()
      });
    }
  });
  // Settings-hosted pages (not in the sidebar NAV).
  out.push({
    kind: 'page',
    label: t('nav.users'),
    section: t('set.title'),
    href: 'users.html',
    keywords: ('users user management accounts ' + t('nav.users') + ' ' + t('set.title')).toLowerCase()
  });
  out.push({
    kind: 'page',
    label: t('godr.title'),
    section: t('set.title'),
    href: 'go-dr.html',
    keywords: ('go dr godr diagnostics monitoring health status system check ' +
      t('godr.title') + ' ' + t('godr.group') + ' ' + t('set.title')).toLowerCase()
  });
  // Inline actions
  const actions = [
    {
      label: t('common.signOut'),
      keywords: currentLang() === 'ar'
        ? 'تسجيل الخروج خروج إغلاق sign out logout exit'
        : 'sign out logout exit',
      action: () => showModal({
        title: t('act.signOutQ'),
        size: 'sm',
        body: `<p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0">${escapeHtml(t('act.signOutBody'))}</p>`,
        actions: [
          { label: t('common.cancel'), variant: 'ghost' },
          { label: t('common.signOut'), variant: 'primary', action: () => {
            showToast(t('act.signedOut'), { variant: 'success' });
            setTimeout(() => { window.location.href = 'login.html'; }, 600);
          } }
        ]
      })
    }
  ];
  actions.forEach((a) => out.push({ kind: 'action', ...a }));
  return out;
}

// Score = lower is better. Subsequence match wins; consecutive characters get
// a bonus; word-boundary starts get a bigger bonus.
function score(query, target) {
  if (!query) {return 0;}
  const t = target;
  const q = query;
  let ti = 0;
  let qi = 0;
  let s = 0;
  let lastMatchedAt = -2;
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      // Bonus for word boundary
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') {s -= 6;}
      // Bonus for consecutive
      if (lastMatchedAt === ti - 1) {s -= 4;}
      lastMatchedAt = ti;
      qi += 1;
    } else {
      s += 1;
    }
    ti += 1;
  }
  if (qi < q.length) {return Infinity;}
  // Penalize length difference (prefer shorter targets that match)
  s += (t.length - q.length) * 0.1;
  return s;
}

function applyFilter() {
  const q = inputEl.value.trim().toLowerCase();
  if (!q) {
    filtered = items.slice();
  } else {
    filtered = items
      .map((it) => ({ it, s: score(q, it.keywords) }))
      .filter((x) => x.s !== Infinity)
      .sort((a, b) => a.s - b.s)
      .map((x) => x.it);
  }
  activeIndex = 0;
  renderList();
}

function renderList() {
  if (!filtered.length) {
    listEl.innerHTML = `<div class="cmdk-empty">${t('cmdk.noResults')}</div>`;
    return;
  }
  // Group results by section while preserving sort order.
  const seen = new Set();
  const html = filtered.map((it, i) => {
    const sectionLabel = it.kind === 'action' ? t('cmdk.actions') : it.section;
    let header = '';
    if (!seen.has(sectionLabel)) {
      seen.add(sectionLabel);
      header = `<div class="cmdk-section">${sectionLabel}</div>`;
    }
    const active = i === activeIndex ? ' active' : '';
    const icon = it.kind === 'action'
      ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M1 8h14"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M2 8h12M2 12h8"/></svg>';
    return `${header}<button type="button" class="cmdk-item${active}" data-i="${i}">
      <span class="cmdk-item-icon" aria-hidden="true">${icon}</span>
      <span class="cmdk-item-label">${escapeHtml(it.label)}</span>
      <span class="cmdk-item-kbd" aria-hidden="true">↵</span>
    </button>`;
  }).join('');
  listEl.innerHTML = html;
  // Scroll active into view if present
  const active = listEl.querySelector('.cmdk-item.active');
  if (active) {active.scrollIntoView({ block: 'nearest' });}
}

function move(delta) {
  if (!filtered.length) {return;}
  activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
  renderList();
}

function activate(index) {
  const it = filtered[index];
  if (!it) {return;}
  close();
  if (it.kind === 'action') {
    if (typeof it.action === 'function') {it.action();}
  } else if (it.href) {
    window.location.href = it.href;
  }
}

function open() {
  if (host) {return;}
  items = buildItems();
  filtered = items.slice();
  activeIndex = 0;

  host = document.createElement('div');
  host.className = 'cmdk-backdrop';
  host.innerHTML = `
    <div class="cmdk-dialog" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmdk-input-wrap">
        <svg class="cmdk-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>
        <input class="cmdk-input" type="text" placeholder="${escapeHtml(t('common.searchPh'))}" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(t('common.search'))}">
        <kbd class="cmdk-esc">esc</kbd>
      </div>
      <div class="cmdk-list" role="listbox"></div>
      <div class="cmdk-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> ${escapeHtml(t('cmdk.navigate'))}</span>
        <span><kbd>↵</kbd> ${escapeHtml(t('cmdk.select'))}</span>
        <span><kbd>esc</kbd> ${escapeHtml(t('common.close'))}</span>
      </div>
    </div>
  `;
  document.body.appendChild(host);
  document.body.classList.add('cmdk-open');

  inputEl = host.querySelector('.cmdk-input');
  listEl = host.querySelector('.cmdk-list');

  // Listeners scoped to the open palette.
  inputEl.addEventListener('input', applyFilter);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); activate(activeIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cmdk-item');
    if (!btn) {return;}
    activate(parseInt(btn.dataset.i, 10));
  });
  host.addEventListener('click', (e) => { if (e.target === host) {close();} });

  renderList();
  inputEl.focus();
}

// If the language is toggled while the palette is open, re-translate its
// visible chrome (placeholder + footer hints).
function localizeOpenPalette() {
  if (!host || !inputEl) {return;}
  inputEl.setAttribute('placeholder', t('common.searchPh'));
  inputEl.setAttribute('aria-label', t('common.search'));
  const footer = host.querySelector('.cmdk-footer');
  if (footer) {
    footer.innerHTML = `
      <span><kbd>↑</kbd><kbd>↓</kbd> ${escapeHtml(t('cmdk.navigate'))}</span>
      <span><kbd>↵</kbd> ${escapeHtml(t('cmdk.select'))}</span>
      <span><kbd>esc</kbd> ${escapeHtml(t('common.close'))}</span>`;
  }
}
document.addEventListener(LANG_EVENT, localizeOpenPalette);

function close() {
  if (!host) {return;}
  host.remove();
  host = null;
  inputEl = null;
  listEl = null;
  document.body.classList.remove('cmdk-open');
}

/**
 * Install the global ⌘K / Ctrl+K shortcut. Calling this is idempotent —
 * subsequent calls are no-ops. The palette is rendered on first open.
 */
export function initCommandPalette() {
  if (initCommandPalette._wired) {return;}
  initCommandPalette._wired = true;

  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    if (isK && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      host ? close() : open();
    }
  });
}

export { open as openCommandPalette, close as closeCommandPalette };
