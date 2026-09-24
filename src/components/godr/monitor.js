// Go Dr. — always-on instrumentation, installed once from src/main.js on
// every page. Captures:
//   • JS errors        — window 'error' + 'unhandledrejection'
//   • failed fetches   — wrapped window.fetch (4xx/5xx + network failures)
//   • WebSocket drops  — wrapped window.WebSocket (abnormal close codes)
//   • offline/online   — browser events
//   • per-page visits  — load time from the Navigation Timing entry
//   • broken assets    — PerformanceObserver resource responseStatus ≥ 400
//   • service worker   — prod SW reports failed fetches via postMessage
// Facts go into the central store (godr/store.js); the Go Dr. dashboard only
// reads. Everything here is passive: it never alters requests or responses.

import { initStore, store } from './store.js';

let installed = false;

export function installGoDrMonitor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  try { initStore(); } catch (_e) { /* storage blocked */ }

  const pageKey = () => document.body?.dataset?.page ||
    (location.pathname.split('/').pop() || 'page').replace(/\.html$/, '');
  const rel = (url) => {
    try { const u = new URL(String(url), location.href); return u.pathname + u.search; }
    catch (_e) { return String(url || ''); }
  };

  // ── JS errors + unhandled rejections ────────────────────────────────
  // Capture phase catches resource errors (script/img/link) too; those carry
  // a target element and are recorded as missing assets instead.
  window.addEventListener('error', (e) => {
    try {
      const el = e.target;
      if (el && el !== window && (el.src || el.href)) {
        const assetUrl = String(el.src || el.href);
        if (assetUrl && !assetUrl.includes('sw.js')) {
          store.recordIssue({ code: 'asset.missing', page: pageKey(), url: rel(assetUrl) });
          store.recordPageError(pageKey());
        }
        return;
      }
      store.recordIssue({ code: 'js.error', page: pageKey(), message: e.message || 'Unknown error' });
      store.recordPageError(pageKey());
    } catch (_e) {}
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    try {
      const r = e.reason;
      store.recordIssue({
        code: 'promise.rejection', page: pageKey(),
        message: String((r && r.message) || r || 'promise rejected')
      });
      store.recordPageError(pageKey());
    } catch (_e) {}
  });

  // ── fetch observer (4xx/5xx + network failures) ─────────────────────
  // Skips page/asset probes (their module reports those) and our own ping.
  if (typeof window.fetch === 'function' && !window.fetch.__godr) {
    const orig = window.fetch.bind(window);
    const wrapped = (input, init) => {
      let url = '';
      try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_e) {}
      const skip = /\.(html|css|js|woff2?|png|svg|jpg|webp|ico)([?#]|$)/i.test(url) ||
        url.includes('/auth/health') || url.includes('sw.js') || url.includes('godr=');
      const t0 = performance.now();
      return orig(input, init).then(
        (res) => {
          try {
            if (!skip && res && !res.ok) {
              store.recordIssue({
                code: 'api.status', page: pageKey(), url: rel(url),
                status: res.status, slowMs: Math.round(performance.now() - t0)
              });
            }
          } catch (_e) {}
          return res;
        },
        (err) => {
          try {
            if (!skip && navigator.onLine !== false) {
              store.recordIssue({
                code: 'api.network', page: pageKey(), url: rel(url),
                message: String((err && err.message) || err)
              });
            }
          } catch (_e) {}
          throw err;
        }
      );
    };
    try { Object.defineProperty(wrapped, '__godr', { value: true }); } catch (_e) {}
    window.fetch = wrapped;
  }

  // ── WebSocket drops (abnormal close codes) ──────────────────────────
  if (typeof window.WebSocket === 'function' && !window.WebSocket.__godr) {
    const WS = window.WebSocket;
    const Patched = function (url, protocols) {
      const ws = protocols === undefined ? new WS(url) : new WS(url, protocols);
      try {
        ws.addEventListener('close', (ev) => {
          if (ev.code && ev.code !== 1000 && ev.code !== 1005) {
            store.recordIssue({ code: 'ws.drop', page: pageKey(), url: rel(String(url)), status: ev.code });
          }
        });
      } catch (_e) {}
      return ws;
    };
    try {
      Patched.prototype = WS.prototype;
      Patched.CONNECTING = WS.CONNECTING; Patched.OPEN = WS.OPEN;
      Patched.CLOSING = WS.CLOSING; Patched.CLOSED = WS.CLOSED;
      Object.defineProperty(Patched, '__godr', { value: true });
      window.WebSocket = Patched;
    } catch (_e) {}
  }

  // ── offline / online ────────────────────────────────────────────────
  window.addEventListener('offline', () => {
    try {
      store.setOnline(false);
      store.recordIssue({ code: 'conn.offline', page: pageKey() });
    } catch (_e) {}
  });
  window.addEventListener('online', () => { try { store.setOnline(true); } catch (_e) {} });

  // ── live Network Information API changes ────────────────────────────
  const conn = navigator.connection;
  if (conn && typeof conn.addEventListener === 'function') {
    conn.addEventListener('change', () => {
      try {
        const cur = store.getState().conn || {};
        store.setConn({
          ...cur,
          type: conn.type || cur.type || '',
          effectiveType: conn.effectiveType || cur.effectiveType || '',
          apiRtt: Number.isFinite(conn.rtt) ? conn.rtt : cur.apiRtt,
          downlink: Number.isFinite(conn.downlink) ? conn.downlink : cur.downlink,
          at: Date.now()
        });
      } catch (_e) {}
    });
  }

  // ── per-page visit registration (load time on mount) ────────────────
  const registerVisit = () => {
    try {
      const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
      const loadMs = nav ? Math.round(nav.domContentLoadedEventEnd || nav.loadEventEnd || 0) : 0;
      store.recordVisit(pageKey(), loadMs);
    } catch (_e) {}
  };
  if (document.readyState === 'complete') registerVisit();
  else window.addEventListener('load', () => setTimeout(registerVisit, 0));

  // ── failed sub-resources via PerformanceObserver ─────────────────────
  try {
    if (typeof PerformanceObserver === 'function') {
      const po = new PerformanceObserver((list) => {
        list.getEntries().forEach((en) => {
          const st = en.responseStatus;
          if (st && st >= 400 && !String(en.name).includes('sw.js')) {
            store.recordIssue({ code: 'asset.missing', page: pageKey(), url: rel(en.name), status: st });
          }
        });
      });
      po.observe({ type: 'resource', buffered: true });
    }
  } catch (_e) { /* unsupported */ }

  // ── service worker bridge (prod SW reports failed fetches) ──────────
  if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
    try {
      navigator.serviceWorker.addEventListener('message', (e) => {
        const d = e.data;
        if (!d || d.godr !== 1) return;
        if (d.code === 'sw.http') store.recordIssue({ code: 'sw.http', page: pageKey(), url: d.url, status: d.status });
        else if (d.code === 'sw.net') store.recordIssue({ code: 'sw.net', page: pageKey(), url: d.url });
      });
      navigator.serviceWorker.getRegistration()
        .then((reg) => store.setSw(reg ? 'active' : 'unavailable'))
        .catch(() => store.setSw('unavailable'));
    } catch (_e) { store.setSw('unavailable'); }
  } else {
    store.setSw('unavailable');
  }
}
