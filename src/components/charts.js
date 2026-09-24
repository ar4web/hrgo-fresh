// goHR — ECharts integration
// Dynamic-imports ECharts only when a [data-chart] element is present on the
// page, keeping pages without charts free of the ~400kB cost.

import { getSeed } from './hr-api.js';

const tokens = () => {
  const cs = getComputedStyle(document.documentElement);
  return {
    primary: cs.getPropertyValue('--primary').trim(),
    primaryDk: cs.getPropertyValue('--primary-dk').trim(),
    azure: cs.getPropertyValue('--azure').trim(),
    blue: cs.getPropertyValue('--blue').trim(),
    yellow: cs.getPropertyValue('--yellow').trim(),
    green: cs.getPropertyValue('--green').trim(),
    red: cs.getPropertyValue('--red').trim(),
    purple: cs.getPropertyValue('--purple').trim(),
    text: cs.getPropertyValue('--text').trim(),
    textMuted: cs.getPropertyValue('--text-muted').trim(),
    borderLight: cs.getPropertyValue('--border-color-light').trim(),
    bgSurface: cs.getPropertyValue('--bg-surface').trim()
  };
};

const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

function baseOption(t) {
  return {
    textStyle: { fontFamily, fontSize: 11, color: t.textMuted },
    grid: { left: 48, right: 12, top: 12, bottom: 28 },
    tooltip: {
      backgroundColor: t.bgSurface,
      borderColor: t.borderLight,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: t.text, fontSize: 12, fontFamily },
      extraCssText: 'box-shadow: 0 2px 8px rgba(30,38,51,0.08); border-radius: 6px;'
    }
  };
}

function dashboardNetwork(echarts, el, t) {
  // Workforce Trend — 6 months Hired vs Exited vs Net (real seed data)
  const emps = getSeed('employees') || [];
  const now = new Date();
  const months = [];
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2,'0')}`;
    months.push(key);
    labels.push(d.toLocaleString('en', { month: 'short' }));
  }
  const hired = months.map(k => emps.filter(e => (e.join||'').slice(0,7) === k).length);
  const exited = months.map(k => emps.filter(e => (e.exitDate||'').slice(0,7) === k).length);
  const net = hired.map((h,i) => h - exited[i]);
  // cumulative headcount for tooltip context
  let cum = emps.filter(e => (e.join||'').slice(0,7) < months[0]).length - emps.filter(e => (e.exitDate||'') && (e.exitDate||'').slice(0,7) < months[0]).length;
  const cumSeries = months.map((_,i) => { cum += net[i]; return cum; });

  const chart = echarts.init(el);
  chart.setOption({
    ...baseOption(t),
    tooltip: { ...baseOption(t).tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.borderLight } } },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: t.borderLight } },
      axisTick: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: t.borderLight, type: [4, 3] } },
      axisLabel: { color: t.textMuted, fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        name: 'Hired',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        data: hired,
        lineStyle: { color: t.green, width: 2 },
        itemStyle: { color: t.green, borderColor: t.bgSurface, borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: t.green + '22' },
            { offset: 1, color: t.green + '00' }
          ])
        }
      },
      {
        name: 'Exited',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: exited,
        lineStyle: { color: t.red, width: 1.5, type: 'dashed' },
        itemStyle: { color: t.red }
      },
      {
        name: 'Net',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: net,
        lineStyle: { color: t.primary, width: 1.5 },
        itemStyle: { color: t.primary }
      }
    ]
  });
  // store cum for tooltip debugging if needed
  chart._hrMeta = { months, hired, exited, net, cumSeries };
  return chart;
}

function donut(echarts, el, t, segments, _totalLabel) {
  const chart = echarts.init(el);
  chart.setOption({
    textStyle: { fontFamily, color: t.textMuted },
    tooltip: {
      ...baseOption(t).tooltip,
      trigger: 'item',
      formatter: '{b}: {d}%'
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['62%', '88%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      data: segments.map(([name, value, color]) => ({
        name,
        value,
        itemStyle: { color: t[color] || color, borderColor: t.bgSurface, borderWidth: 2 }
      }))
    }]
  });
  return chart;
}

const deviceUsage = (echarts, el, t) => donut(echarts, el, t, [
  ['iOS',     30, 'primary'],
  ['Android', 25, 'azure'],
  ['Desktop', 20, 'yellow'],
  ['Tablet',  15, 'purple'],
  ['Other',   10, 'red']
]);

const charts = {
  'dashboard-network': dashboardNetwork,
  'device-usage':      deviceUsage
};

export async function initCharts() {
  const elements = document.querySelectorAll('[data-chart]');
  if (!elements.length) {return;}
  // Show skeleton placeholders while ECharts loads. Removed once each chart
  // mounts. Skipped if the page already pre-renders content inside the host.
  elements.forEach((el) => {
    if (!el.children.length && !el.classList.contains('skeleton')) {
      el.classList.add('skeleton', 'chart-skeleton');
    }
  });

  // Modular import keeps the bundle smaller than the full echarts barrel.
  const [
    echartsCore,
    {
      LineChart, BarChart, PieChart,
      RadarChart, GaugeChart, ScatterChart,
      HeatmapChart, FunnelChart, CandlestickChart,
      TreemapChart, SankeyChart, CustomChart
    },
    {
      GridComponent, TooltipComponent, LegendComponent,
      VisualMapComponent, PolarComponent, CalendarComponent
    },
    { CanvasRenderer }
  ] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers')
  ]);
  echartsCore.use([
    LineChart, BarChart, PieChart,
    GridComponent, TooltipComponent, LegendComponent,
    CanvasRenderer
  ]);

  const mounted = []; // { el, factory, instance }

  // Same progressive-enhancement policy as chart-helper.js: without a real
  // canvas 2D context (jsdom, print, restricted environments) skip painting
  // instead of crashing inside ECharts. Elements keep their markup.
  const canvasOk = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext && c.getContext('2d'));
    } catch (_e) {
      return false;
    }
  })();

  const buildAll = () => {
    if (!canvasOk) {
      return;
    }
    const t = tokens();
    elements.forEach((el) => {
      const factory = charts[el.dataset.chart];
      if (!factory) {return;}
      el.classList.remove('skeleton', 'chart-skeleton');
      mounted.push({ el, factory, instance: factory(echartsCore, el, t) });
    });
  };

  buildAll();

  // Resize all charts on viewport changes.
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => mounted.forEach((m) => m.instance.resize()), 120);
  });

  // Rebuild all charts when the theme changes — tokens come from CSS custom
  // properties, so a fresh setOption isn't enough; dispose + re-init picks up
  // new colors cleanly. Listens for both data-theme attribute changes (light/
  // dark toggle) and a 'themechange' custom event (theme generator page).
  const rebuild = () => {
    const t = tokens();
    mounted.forEach((m) => {
      m.instance.dispose();
      m.instance = m.factory(echartsCore, m.el, t);
    });
  };
  const themeObserver = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-theme')) {rebuild();}
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.documentElement.addEventListener('themechange', rebuild);
}
