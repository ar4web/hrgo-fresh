// Lazy Leaflet site map (T2 §3). CircleMarkers only (no image assets, so no
// bundler icon-URL pitfalls); markers + popups render even when tiles can't
// load (offline-tolerant). jsdom-safe: marker DATA is exposed synchronously
// via data attributes + a text summary, the Leaflet canvas is best-effort.
//
//   renderSiteMap(el, { sites, clients, headcountOf, labels, onSelect })
//
// headcountOf(siteId) -> number. labels(ar?) -> { sites, clients, workers }.

import 'leaflet/dist/leaflet.css';

let leafletPromise = null;

function loadLeaflet() {
  if (!leafletPromise) {
    leafletPromise = import('leaflet');
  }
  return leafletPromise;
}

function radiusFor(n) {
  return 9 + Math.min(14, Math.round(Math.sqrt(Math.max(0, n)) * 4));
}

export function renderSiteMap(el, cfg = {}) {
  if (!el) {
    return null;
  }
  const sites = (cfg.sites || []).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const clients = (cfg.clients || []).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  const headcountOf = cfg.headcountOf || (() => 0);
  const ar = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
  const L2 = cfg.labels || { sites: 'Sites', clients: 'Clients', workers: 'workers' };

  // Synchronous, testable, screen-reader honest — always rendered.
  const total = sites.reduce((s, x) => s + headcountOf(x.id), 0);
  el.setAttribute('data-marker-count', String(sites.length));
  el.setAttribute('data-client-pins', String(clients.length));
  el.setAttribute('role', 'img');
  const summary = `${L2.sites}: ${sites.length} · ${total} ${L2.workers}`;
  el.setAttribute('aria-label', summary);
  let sr = el.querySelector(':scope > .sr-only');
  if (!sr) {
    sr = document.createElement('span');
    sr.className = 'sr-only';
    el.prepend(sr);
  }
  sr.textContent = summary;

  loadLeaflet()
    .then(mod => {
      try {
        const leaflet = mod.default || mod;
        if (el._leafletMap) {
          el._leafletMap.remove();
        }
        const map = leaflet.map(el, { scrollWheelZoom: false }).setView([24.0, 45.0], 5);
        el._leafletMap = map;
        leaflet
          .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
          })
          .addTo(map);
        const css = getComputedStyle(document.documentElement);
        const siteLayer = leaflet.layerGroup().addTo(map);
        sites.forEach(s2 => {
          const n = headcountOf(s2.id);
          const nm = ar ? s2.nameAr || s2.nameEn : s2.nameEn;
          leaflet
            .circleMarker([s2.lat, s2.lng], {
              radius: radiusFor(n),
              color: css.getPropertyValue('--primary').trim() || '#f97316',
              weight: 2,
              fillOpacity: 0.25
            })
            .bindTooltip(`${nm} · ${n}`, { direction: 'top' })
            .on('click', () => cfg.onSelect && cfg.onSelect(s2.id))
            .addTo(siteLayer);
        });
        const clientLayer = leaflet.layerGroup().addTo(map);
        clients.forEach(c => {
          const nm = ar ? c.nameAr || c.nameEn : c.nameEn;
          leaflet
            .circleMarker([c.lat, c.lng], {
              radius: 6,
              color: css.getPropertyValue('--purple').trim() || '#9B59B6',
              weight: 2,
              fillOpacity: 0.5,
              dashArray: '3 3'
            })
            .bindTooltip(nm, { direction: 'top' })
            .addTo(clientLayer);
        });
        leaflet.control
          .layers(null, { [L2.sites]: siteLayer, [L2.clients]: clientLayer })
          .addTo(map);
        el.removeAttribute('data-map-fallback');
      } catch (_e) {
        el.setAttribute('data-map-fallback', '1');
      }
    })
    .catch(() => {
      el.setAttribute('data-map-fallback', '1');
    });
  return el;
}
