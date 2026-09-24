// goHR — service worker
// Strategy: cache-first for hashed assets (Vite emits content-hashed URLs),
// network-first for HTML so navigations always pull the freshest shell.
//
// Go Dr. monitor: the worker ALSO passively observes same-origin GETs (API,
// auth, page navigations, assets). Failed requests (HTTP error or network
// failure) are broadcast to open pages via postMessage so the Go Dr.
// dashboard (Settings → Diagnostics) can list them. It never alters
// responses — it only watches and reports.

// Bump the suffix on every release to bust users' caches when CSS/JS hashes change.
const CACHE = 'gohr-v3';
// Cache budget: prune to this many entries when exceeded (LRU eviction).
const MAX_CACHE_ENTRIES = 200;

const SCOPE = self.registration?.scope || self.location.origin + '/';

// Best-effort flood control: one message per code+path per 5 s (per SW life).
const lastSent = new Map();

function broadcast(msg) {
  const key = msg.code + (msg.url || '');
  const now = Date.now();
  if (now - (lastSent.get(key) || 0) < 5000) return;
  lastSent.set(key, now);
  msg.godr = 1;
  msg.ts = now;
  self.clients.matchAll({ includeUncontrolled: true })
    .then((cs) => cs.forEach((c) => { try { c.postMessage(msg); } catch (_e) {} }))
    .catch(() => {});
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(() => self.skipWaiting())
  );
});

async function pruneCache() {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) {return;}
  const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
  await Promise.all(toDelete.map(r => cache.delete(r)));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(pruneCache)
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; pass through cross-origin (Google Fonts, CDNs, etc.).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('sw.js')) return;

  // HTML — network first, fallback to cache.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) broadcast({ code: 'sw.http', url: url.pathname, status: res.status });
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async (err) => {
          broadcast({ code: 'sw.net', url: url.pathname, message: String((err && err.message) || err) });
          return (await caches.match(req)) || Response.error();
        })
    );
    return;
  }

  // Hashed assets (/js, /assets, /images, /fonts) — cache-first.
  if (/\/(js|assets|images|fonts)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (!res.ok) broadcast({ code: 'sw.http', url: url.pathname, status: res.status });
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch((err) => {
        broadcast({ code: 'sw.net', url: url.pathname, message: String((err && err.message) || err) });
        throw err;
      }))
    );
    return;
  }

  // Go Dr. monitor — observe (without changing) remaining same-origin GETs
  // (/api and /auth calls). Failures are reported to open pages.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (!res.ok && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/'))) {
          broadcast({ code: 'sw.http', url: url.pathname, status: res.status });
        }
        return res;
      })
      .catch((err) => {
        broadcast({ code: 'sw.net', url: url.pathname, message: String((err && err.message) || err) });
        throw err;
      })
  );
});
