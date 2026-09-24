// Reusable ECharts helper (T2). Lazy-loads ECharts à la carte only when a
// chart mounts, applies theme tokens from CSS vars, mirrors horizontal bars
// in RTL, and ALWAYS leaves a plain-text summary for screen readers (and for
// jsdom, where canvas doesn't exist). Pages without charts pay nothing.
//
//   renderEchart(el, buildOption, summaryText, { rtl: 'hbar' | 'time' | null })
//
// buildOption(tokens) returns a full ECharts option. tokens mirror charts.js.

import { currentLang } from './i18n.js';

let echartsPromise = null;
const mounted = [];

function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const g = k => cs.getPropertyValue(k).trim();
  return {
    primary: g('--primary'),
    primaryDk: g('--primary-dk'),
    azure: g('--azure'),
    blue: g('--blue'),
    yellow: g('--yellow'),
    green: g('--green'),
    red: g('--red'),
    purple: g('--purple'),
    text: g('--text'),
    // Small chart text (10-12px legends/axes) needs secondary to hold AA.
    textMuted: g('--text-secondary'),
    borderLight: g('--border-color-light'),
    bgSurface: g('--bg-surface')
  };
}

// Pure + node-safe: RTL mirroring policy for cartesian charts.
//  - 'hbar' (horizontal bars, values on x): mirror so bars grow right-to-left.
//  - 'time' (chronological x): NEVER mirrored — time flows left-to-right in
//    both locales; flipping it would lie about trends.
//  - null/other: untouched (pies, donuts, rings have no reading direction).
function applyRtl(option, dir, mode) {
  if (dir !== 'ar' || mode !== 'hbar') {
    return option;
  }
  const x = option.xAxis;
  if (Array.isArray(x)) {
    x.forEach(ax => {
      ax.inverse = true;
    });
  } else if (x && typeof x === 'object') {
    x.inverse = true;
  }
  // Rounded value-ends point at the axis after inversion — mirror them back.
  for (const s of Array.isArray(option.series) ? option.series : []) {
    const r = s && s.itemStyle && s.itemStyle.borderRadius;
    if (Array.isArray(r) && r.length === 4) {
      s.itemStyle.borderRadius = [r[1], r[0], r[3], r[2]];
    }
  }
  return option;
}

async function loadEcharts() {
  if (!echartsPromise) {
    echartsPromise = (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers')
      ]);
      core.use([
        charts.PieChart,
        charts.BarChart,
        charts.LineChart,
        charts.GaugeChart,
        components.TitleComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.GridComponent,
        renderers.CanvasRenderer
      ]);
      return core;
    })();
  }
  return echartsPromise;
}

function canvas2d() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext && c.getContext('2d'));
  } catch (_e) {
    return false;
  }
}

function paint(entry) {
  const { el, build, mode } = entry;
  const t = tokens();
  const option = applyRtl(build(t) || {}, currentLang() === 'ar' ? 'ar' : 'en', mode);
  const mq = typeof globalThis !== 'undefined' && globalThis.matchMedia;
  if (mq && mq('(prefers-reduced-motion: reduce)').matches) {
    option.animation = false;
  }
  entry.option = option;
  if (typeof document === 'undefined' || !canvas2d()) {
    el.setAttribute('data-chart-fallback', '1');
    return;
  }
  loadEcharts()
    .then(echarts => {
      try {
        if (entry.instance) {
          entry.instance.dispose();
        }
        const chart = echarts.init(el);
        chart.setOption(option);
        entry.instance = chart;
        el.removeAttribute('data-chart-fallback');
      } catch (_e) {
        el.setAttribute('data-chart-fallback', '1');
      }
    })
    .catch(() => {
      el.setAttribute('data-chart-fallback', '1');
    });
}

let listenersBound = false;

function bindListeners() {
  if (listenersBound) {
    return;
  }
  listenersBound = true;
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      mounted.forEach(m => {
        try {
          m.instance && m.instance.resize();
        } catch (_e) {
          /* disposed */
        }
      });
    }, 120);
  });
  const rebuild = () => mounted.forEach(paint);
  new MutationObserver(records => {
    if (records.some(r => r.attributeName === 'data-theme')) {
      rebuild();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.documentElement.addEventListener('themechange', rebuild);
}

// Mount (or re-mount) a chart. Idempotent per element: re-calling with the
// same el repaints instead of stacking instances.
export function renderEchart(el, build, summary, opts = {}) {
  if (!el) {
    return null;
  }
  const mode = opts.rtl || null;
  el.setAttribute('role', 'img');
  if (summary) {
    el.setAttribute('aria-label', summary);
    let sr = el.querySelector(':scope > .sr-only');
    if (!sr) {
      sr = document.createElement('span');
      sr.className = 'sr-only';
      el.prepend(sr);
    }
    sr.textContent = summary;
  }
  let entry = mounted.find(m => m.el === el);
  if (!entry) {
    entry = { el, build, mode, instance: null, option: null };
    mounted.push(entry);
  } else {
    entry.build = build;
    entry.mode = mode;
  }
  bindListeners();
  paint(entry);
  return entry;
}

