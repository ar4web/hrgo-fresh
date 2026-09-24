// goHR — desktop-style app window manager. Floating, draggable, minimizable
// windows that carry workspace apps (meetings, mail, chat, assistant) over
// any page — so apps "feel like apps" instead of page navigations.
// Layering: windows sit above the page/topbar (700+) but below toasts (1000)
// and modals (1200). Changing Customize settings resets open windows to
// their default geometry so font/radius changes never leave them squished.

const WINS = new Map(); // id → { id, el, minimized, geom, defWidth, defHeight, onClose }
let zTop = 700;
let seq = 0;

function syncTopbar() {
  const btn = document.getElementById('topbar-apps');
  if (!btn) {
    return;
  }
  const anyVisible = [...WINS.values()].some(w => !w.minimized);
  btn.classList.toggle('active', WINS.size > 0 && anyVisible);
}

function dockHost() {
  let dock = document.querySelector('.appwin-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'appwin-dock';
    document.body.appendChild(dock);
  }
  return dock;
}

function refreshDock() {
  const dock = dockHost();
  dock.innerHTML = '';
  for (const w of WINS.values()) {
    if (!w.minimized) {
      continue;
    }
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'appwin-dock-chip';
    chip.title = w.title;
    chip.innerHTML = `${w.iconSvg || ''}<span></span>`;
    chip.querySelector('span').textContent = w.title;
    chip.addEventListener('click', () => restore(w.id));
    dock.appendChild(chip);
  }
  if (!WINS.size) {
    dock.remove();
  }
}

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

// Default geometry for the n-th window: centered with a small cascade.
function defaultGeom(index, width, height, vw, vh) {
  const w = Math.min(width, vw - 32);
  const left = clamp(Math.round((vw - w) / 2) + (index % 4) * 26, 12, Math.max(12, vw - w - 12));
  const top = clamp(72 + (index % 4) * 26, 60, vh - 240);
  return { width: w, height: height ? Math.min(height, vh - 120) : null, left, top };
}

function applyGeom(w, g) {
  w.el.classList.remove('maximized');
  w.geom = null;
  w.el.style.width = `${g.width}px`;
  if (g.height) {
    w.el.style.height = `${g.height}px`;
  } else {
    w.el.style.height = '';
  }
  w.el.style.left = `${g.left}px`;
  w.el.style.top = `${g.top}px`;
}

function makeDraggable(w) {
  const bar = w.el.querySelector('.appwin-titlebar');
  if (!bar) {
    return;
  }
  const start = e => {
    if (w._dragging || e.target.closest('.appwin-ctl')) {
      return;
    }
    if (w.el.classList.contains('maximized')) {
      return;
    }
    e.preventDefault();
    w._dragging = true;
    const rect = w.el.getBoundingClientRect();
    const dx = (e.clientX || 0) - rect.left;
    const dy = (e.clientY || 0) - rect.top;
    const move = ev => {
      const vw = window.innerWidth || 1200;
      const vh = window.innerHeight || 800;
      const width = w.el.offsetWidth || rect.width;
      w.el.style.left = `${clamp((ev.clientX || 0) - dx, 16 - width, vw - 60)}px`;
      w.el.style.top = `${clamp((ev.clientY || 0) - dy, 52, vh - 60)}px`;
      w.el.style.right = 'auto';
    };
    const up = () => {
      w._dragging = false;
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  bar.addEventListener('mousedown', start);
  if (window.PointerEvent) {
    bar.addEventListener('pointerdown', start);
  }
}

function focusWin(w) {
  zTop += 1;
  w.el.style.zIndex = String(zTop);
  for (const other of WINS.values()) {
    other.el.classList.toggle('focused', other === w && !other.minimized);
  }
}

export function openAppWindow({ id, iconSvg = '', title = '', width = 720, height = null, onClose } = {}) {
  const existing = WINS.get(id);
  if (existing) {
    if (existing.minimized) {
      restore(id);
    } else {
      focusWin(existing);
    }
    return { el: existing.el, body: existing.el.querySelector('.appwin-body'), focused: true, fresh: false };
  }
  seq += 1;
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  const g = defaultGeom(seq - 1, width, height, vw, vh);

  const el = document.createElement('section');
  el.className = 'appwin';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', title);
  el.style.width = `${g.width}px`;
  if (g.height) {
    el.style.height = `${g.height}px`;
  }
  el.style.left = `${g.left}px`;
  el.style.top = `${g.top}px`;
  el.innerHTML = `
    <header class="appwin-titlebar">
      <span class="appwin-grip">${iconSvg}</span>
      <span class="appwin-title"></span>
      <span class="appwin-ctl">
        <button type="button" class="appwin-btn" data-win-min aria-label="—"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
        <button type="button" class="appwin-btn" data-win-max aria-label="□"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="5" width="14" height="14" rx="2"/></svg></button>
        <button type="button" class="appwin-btn" data-win-close aria-label="×"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </span>
    </header>
    <div class="appwin-body"></div>`;
  el.querySelector('.appwin-title').textContent = title;

  const rec = { id, el, minimized: false, geom: null, title, iconSvg, onClose, defWidth: width, defHeight: height };
  WINS.set(id, rec);

  el.querySelector('[data-win-min]').addEventListener('click', () => minimize(id));
  el.querySelector('[data-win-max]').addEventListener('click', () => toggleMaximize(id));
  el.querySelector('[data-win-close]').addEventListener('click', () => closeAppWindow(id));
  el.addEventListener('mousedown', () => focusWin(rec));
  makeDraggable(rec);
  focusWin(rec);

  document.body.appendChild(el);
  refreshDock();
  syncTopbar();
  return { el, body: el.querySelector('.appwin-body'), focused: true, fresh: true };
}

// Snap every open window back to its default size/position — used after
// Customize changes (font size, radius, density) so windows never stay in a
// geometry that no longer fits the new type scale.
export function resetAppWindows() {
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;
  let i = 0;
  for (const w of WINS.values()) {
    applyGeom(w, defaultGeom(i, w.defWidth || 720, w.defHeight, vw, vh));
    i += 1;
  }
}

function minimize(id) {
  const w = WINS.get(id);
  if (!w) {
    return;
  }
  w.minimized = true;
  w.el.classList.add('minimized');
  refreshDock();
  syncTopbar();
}

export function restore(id) {
  const w = WINS.get(id);
  if (!w) {
    return;
  }
  w.minimized = false;
  w.el.classList.remove('minimized');
  focusWin(w);
  refreshDock();
  syncTopbar();
}

function toggleMaximize(id) {
  const w = WINS.get(id);
  if (!w) {
    return;
  }
  if (w.el.classList.contains('maximized')) {
    if (w.geom) {
      w.el.style.left = w.geom.left;
      w.el.style.top = w.geom.top;
      w.el.style.width = w.geom.width;
      if (w.geom.height) {
        w.el.style.height = w.geom.height;
      } else {
        w.el.style.height = '';
      }
    }
    w.el.classList.remove('maximized');
    w.geom = null;
  } else {
    w.geom = {
      left: w.el.style.left,
      top: w.el.style.top,
      width: w.el.style.width,
      height: w.el.style.height
    };
    w.el.classList.add('maximized');
  }
}

export function closeAppWindow(id) {
  const w = WINS.get(id);
  if (!w) {
    return;
  }
  const el = w.el;
  WINS.delete(id);
  el.classList.add('closing');
  setTimeout(() => {
    el.remove();
  }, 170);
  if (typeof w.onClose === 'function') {
    w.onClose();
  }
  refreshDock();
  syncTopbar();
}

export function setWindowTitle(id, title) {
  const w = WINS.get(id);
  if (!w) {
    return;
  }
  w.title = title;
  const el = w.el.querySelector('.appwin-title');
  if (el) {
    el.textContent = title;
  }
  w.el.setAttribute('aria-label', title);
  refreshDock();
}

export function anyAppOpen() {
  return WINS.size > 0;
}

// Escape closes the focused window (modals handle their own Escape first).
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('.modal-backdrop')) {
    return;
  }
  const focused = [...WINS.values()].find(w => w.el.classList.contains('focused') && !w.minimized);
  if (focused) {
    closeAppWindow(focused.id);
  }
});
