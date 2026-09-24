// HR + Operations — CEO Command Center (dashboard.html). Header strip +
// Zone A business health + §1 workforce dynamics + legacy stat cards, alerts,
// deployment mix and expiries (later zones subsume the legacy cards). Idempotent.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtSAR, fmtDate, fmtHijri, L, renderPageMeta} from './hr-locale.js';
import {
  daysUntil,
  nitaqatEstimate,
  getSettings,
  headcountByStatus,
  tenureBuckets,
  separationSeries,
  iqamaBuckets
} from './hr-statutory.js';
import { getSeed } from './hr-api.js';
import { CLIENTS, SITES, SKILLS, SPONSORS, PROFESSIONS } from './hr-seed.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc } from './markup.js';
import { showToast } from './toast.js';

let booted = false;
let analyticsRange = '6M';
let analyticsSegment = 'all';
let selectedCity = null;

// ── Scoping: the range buttons + segment dropdown reshape the workforce &
// geography zones and the KPI strip. The compliance shield intentionally
// stays company-wide (it reports legal risk, not an analytical slice).
function rangeMonths() {
  if (analyticsRange === '12M') {return 12;}
  if (analyticsRange === 'YTD') {return Math.max(1, new Date().getMonth() + 1);}
  return 6;
}
function scopeEmps() {
  const emps = getSeed('employees') || [];
  if (analyticsSegment === 'saudi') {return emps.filter(e => e.saudi);}
  if (analyticsSegment === 'expat') {return emps.filter(e => !e.saudi);}
  if (analyticsSegment === 'ops') {return emps.filter(e => e.dept === 'OPS');}
  if (analyticsSegment === 'hr') {return emps.filter(e => e.dept === 'HR');}
  return emps;
}
const segmentLabelKey = {
  all: 'an.segAll',
  saudi: 'an.segSaudi',
  expat: 'an.segExpat',
  ops: 'an.segOps',
  hr: 'an.segHr'
};
function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyAnalyticsFilters() {
  const meta = document.getElementById('analytics-meta');
  if (meta) {
    const n = scopeEmps().length;
    meta.textContent = `${analyticsRange} · ${n} ${t('hr.dashboard.heads')} · ${t(segmentLabelKey[analyticsSegment] || 'an.segAll')}`;
  }
}

// Full re-render of every analytics widget (charts repaint with animation).
function refreshAnalytics() {
  renderAll();
  applyAnalyticsFilters();
}

function bindAnalyticsBar() {
  document.querySelectorAll('[data-range]').forEach(b => {
    if (b.dataset.bound) {return;}
    b.dataset.bound = '1';
    b.addEventListener('click', () => {
      analyticsRange = b.dataset.range;
      document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      refreshAnalytics();
    });
  });
  const sel = document.getElementById('analytics-segment');
  if (sel && !sel.dataset.bound) {
    sel.dataset.bound = '1';
    sel.addEventListener('change', () => {
      analyticsSegment = sel.value;
      selectedCity = null;
      refreshAnalytics();
    });
  }
  const exp = document.getElementById('analytics-export');
  if (exp && !exp.dataset.bound) {
    exp.dataset.bound = '1';
    exp.addEventListener('click', () => {
      import('./import-export.js').then(m => {
        const emps = scopeEmps();
        const cols = [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'nat', label: 'Nationality' }, { key: 'status', label: 'Status' }, { key: 'join', label: 'Join' }];
        const rows = emps.map(e => ({ code: e.code, name: e.nameEn, nat: e.nat, status: e.st, join: e.join }));
        m.exportData('csv', 'analytics', cols, rows);
      });
    });
  }
  const ref = document.getElementById('analytics-refresh');
  if (ref && !ref.dataset.bound) {
    ref.dataset.bound = '1';
    ref.addEventListener('click', () => {
      const icon = ref.querySelector('.an-refresh-icon');
      if (icon) {
        icon.classList.remove('spinning');
        // restart the spin animation on repeated clicks
        void icon.offsetWidth;
        icon.classList.add('spinning');
      }
      setTimeout(() => {
        refreshAnalytics();
        if (icon) {icon.classList.remove('spinning');}
        showToast(t('an.refreshed'));
      }, 650);
    });
  }
  applyAnalyticsFilters();
}

function alerts() {
  const out = [];
  const emps = getSeed('employees');
  emps
    .filter(e => !e.saudi && e.st === 'active')
    .forEach(e => {
      if (!e.iqamaExp) {
        out.push({
          sev: 'red',
          text: `${L('Missing Iqama expiry', 'تاريخ انتهاء الإقامة مفقود')} · ${currentLang() === 'ar' ? e.nameAr : e.nameEn}`,
          href: `employee-file.html?code=${encodeURIComponent(e.code)}`
        });
        return;
      }
      const d = daysUntil(e.iqamaExp);
      if (d <= 90) {
        out.push({
          sev: d <= 30 ? 'red' : 'yellow',
          text: `${L('Iqama', 'الإقامة')} ${fmtDate(e.iqamaExp)} (${d}${L('d', 'ي')}) · ${currentLang() === 'ar' ? e.nameAr : e.nameEn}`,
          href: `employee-file.html?code=${encodeURIComponent(e.code)}`
        });
      }
    });
  const rank = { red: 0, yellow: 1 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
function renderAlerts() {
  const el = document.getElementById('hr-alerts');
  if (!el) {
    return;
  }
  const items = alerts().slice(0, 8);
  el.innerHTML = items.length
    ? items
      .map(
        a => `
    <a class="hr-alert hr-alert-${a.sev}" href="${a.href}">
      <span class="status status-${a.sev}">${a.sev === 'red' ? t('common.urgent') : t('common.attention')}</span>
      <span>${a.text}</span>
    </a>`
      )
      .join('')
    : `<div class="hr-empty">${t('common.noData')}</div>`;
}

function tableOpen(label, headers = []) {
  const head = headers.length
    ? `<thead class="sr-only"><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead>`
    : '';
  return `<div class="table-responsive"><table class="table hr-table" aria-label="${esc(label)}">${head}<tbody>`;
}

function renderExpiries() {
  const el = document.getElementById('hr-expiries');
  if (!el) {
    return;
  }
  const rows = getSeed('employees')
    .filter(e => !e.saudi && e.iqamaExp)
    .map(e => ({ e, d: daysUntil(e.iqamaExp) }))
    .filter(r => r.d <= 120)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  el.innerHTML = rows.length
    ? tableOpen(t('hr.dashboard.expiries'), [L('Worker', 'الموظف'), L('Expiry', 'الانتهاء'), t('common.status')]) +
      rows
        .map(
          ({ e, d }) => `<tr>
      <td data-label="${L('Worker', 'الموظف')}"><a href="employee-file.html?code=${encodeURIComponent(e.code)}">${currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn}</a></td>
      <td data-label="${L('Expiry', 'الانتهاء')}">${fmtDate(e.iqamaExp)}</td>
      <td data-label="${t('common.status')}"><span class="status status-${d <= 30 ? 'red' : 'yellow'}">${d}${L('d', 'ي')}</span></td>
    </tr>`
        )
        .join('') +
      '</tbody></table></div>'
    : `<div class="hr-empty">${t('common.noData')}</div>`;
}

function renderMix() {
  const el = document.getElementById('hr-deploy');
  if (!el) {
    return;
  }
  const emps = scopeEmps();
  const active = emps.filter(e => e.st === 'active');
  const rows = CLIENTS.map((c, i) => ({
    label: currentLang() === 'ar' ? c.nameAr : c.nameEn,
    n: active.filter(e => e.client === c.id).length,
    color: ['var(--primary)', 'var(--blue)', 'var(--purple)'][i % 3]
  }));
  rows.push({ label: L('Bench', 'احتياطي'), n: active.filter(e => !e.client).length, color: 'var(--yellow)' });
  const max = Math.max(1, ...rows.map(r => r.n));
  el.innerHTML = rows
    .map(
      r => `
    <div class="hr-bar-row">
      <div class="hr-bar-top"><span>${r.label}</span><strong>${r.n}</strong></div>
      <div class="hr-bar-track"><div class="hr-bar-fill" style="width:${Math.round((r.n / max) * 100)}%;background:${r.color}"></div></div>
    </div>`
    )
    .join('');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function setupSteps() {
  const s = getSettings();
  return [
    { done: !!(s.company.cr && !String(s.company.cr).includes('XXX')) },
    { done: !!(s.nitaqat.activity && s.nitaqat.target > 0) },
    { done: s.licence.confirmed === true }
  ];
}

function renderHead() {
  const el = document.getElementById('dash-head');
  if (!el) {
    return;
  }
  const today = todayIso();
  const s = getSettings();
  const n = nitaqatEstimate(getSeed('employees'), s.nitaqat.target || 0);
  const steps = setupSteps();
  const left = steps.filter(x => !x.done).length;
  const tone = s.nitaqat.target > 0 ? (n.pct >= s.nitaqat.target ? 'green' : 'yellow') : 'blue';
  el.innerHTML = `
    <div class="dash-dates">
      <strong>${esc(fmtHijri(today))}</strong>
      <span>${esc(fmtDate(today))}</span>
    </div>
    <div class="dash-chips">
      <span class="status status-${tone}">${esc(t('hr.dashboard.nitaqat'))} ${esc(String(n.pct))}%${s.nitaqat.target > 0 ? ` / ${esc(String(s.nitaqat.target))}%` : ''}</span>
      ${
  left
    ? `<span class="status status-yellow">${left} ${esc(t('hr.dashboard.setupSteps'))}</span>`
    : `<span class="status status-green">${esc(L('All set', 'تم الإعداد'))}</span>`
}
    </div>`;
}

// ── KPI hero strip ────────────────────────────────────────────────────────
const KPI_ICONS = {
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8v8M14 8v8"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15l4-4"/><path d="M3.4 18a10 10 0 1 1 17.2 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>'
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Lightweight inline-SVG area sparkline (no extra chart instances on a page
// that already renders eight ECharts).
function sparklineSvg(values, colorVar) {
  const color = cssVar(colorVar) || cssVar('--primary') || '#f97316';
  const w = 120; const h = 34; const pad = 3;
  const v = values.length ? values : [0, 0];
  const max = Math.max(1, ...v);
  const min = Math.min(0, ...v);
  const span = max - min || 1;
  const x = i => pad + (i * (w - pad * 2)) / Math.max(1, v.length - 1);
  const y = val => h - pad - ((val - min) / span) * (h - pad * 2);
  const line = v.map((val, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join(' ');
  const area = `${line} L${x(v.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const gid = `sg-${colorVar.replace(/[^a-z0-9]/gi, '')}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})" stroke="none"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function countUp(el, target, { decimals = 0, suffix = '' } = {}) {
  const fmt = n => `${(Math.round(n * 10) / 10).toFixed(decimals)}${suffix}`;
  if (prefersReducedMotion()) {
    el.textContent = fmt(target);
    return;
  }
  const dur = 750;
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) {requestAnimationFrame(tick);}
  };
  requestAnimationFrame(tick);
}

function kpiCard(card) {
  const spark = card.spark
    ? `<div class="kpi-spark">${sparklineSvg(card.spark.values, card.spark.color)}</div>`
    : '';
  return `<div class="kpi-card kpi-tone-${card.tone}">
    <div class="kpi-top">
      <span class="kpi-icon">${KPI_ICONS[card.icon]}</span>
      ${card.delta ? `<span class="kpi-delta ${card.delta.dir}">${card.delta.html}</span>` : ''}
    </div>
    <div class="kpi-label">${esc(card.label)}</div>
    <div class="kpi-value" data-kpi-value data-target="${card.value}" data-decimals="${card.decimals || 0}" data-suffix="${esc(card.suffix || '')}">0${card.suffix || ''}</div>
    <div class="kpi-sub">${card.sub}</div>
    ${spark}
  </div>`;
}

function renderKpis() {
  const box = document.getElementById('analytics-kpis');
  if (!box) {return;}
  const emps = scopeEmps();
  const payable = emps.filter(e => e.st !== 'exited' && e.st !== 'huroob');
  const hc = headcountByStatus(emps);
  const settings = getSettings();
  const n = nitaqatEstimate(emps, settings.nitaqat.target || 0);
  const bk = iqamaBuckets(emps, todayIso());
  const risk = bk.le30 + bk.le60 + bk.le90;
  const months = rangeMonths();
  const sep = separationSeries(emps, [], todayIso(), months);
  const hires = sep.hired.reduce((a, b) => a + b, 0);
  const exits = sep.exited.reduce((a, b) => a + b, 0);
  const net = hires - exits;
  // cumulative net line for the net-hiring spark
  const cumNet = [];
  sep.hired.forEach((v, i) => cumNet.push((cumNet[i - 1] || 0) + v - sep.exited[i]));

  const cards = [
    {
      tone: 'primary', icon: 'people', value: payable.length,
      label: t('an.kpiWorkforce'),
      sub: `<strong>${hc.active}</strong> ${esc(t('an.subActive'))} · <strong>${hc['on-leave']}</strong> ${esc(t('an.subLeave'))}`,
      spark: { values: sep.hired, color: '--primary' }
    },
    {
      tone: 'green', icon: 'check', value: hc.active,
      label: t('an.kpiActive'),
      sub: `${hc.probation} ${esc(t('an.subProbation'))}`,
      delta: { dir: 'flat', html: esc(t('hr.dashboard.heads')) }
    },
    {
      tone: 'yellow', icon: 'pause', value: hc['on-leave'],
      label: t('an.kpiOnleave'),
      sub: `${hc.probation} ${esc(t('an.subProbation'))}`
    },
    {
      tone: 'blue', icon: 'gauge', value: n.pct, decimals: 1, suffix: '%',
      label: t('an.kpiSaudization'),
      sub: settings.nitaqat.target > 0
        ? `${esc(t('an.subTarget'))} <strong>${settings.nitaqat.target}%</strong> · ${esc(t('an.subGap'))} ${n.gap}%`
        : esc(t('an.subNotset')),
      delta: settings.nitaqat.target > 0
        ? { dir: n.pct >= settings.nitaqat.target ? 'up' : 'down', html: n.pct >= settings.nitaqat.target ? esc(t('an.subMet')) : `${n.gap}% ${esc(t('an.subGap'))}` }
        : null
    },
    {
      tone: risk ? 'red' : 'green', icon: 'shield', value: risk,
      label: t('an.kpiRisk'),
      sub: `${bk.le30} ${esc(t('an.subDue30'))}`,
      delta: { dir: risk ? 'down' : 'up', html: risk ? String(bk.le30) : `✓ ${esc(t('an.subClear'))}` }
    },
    {
      tone: 'purple', icon: 'trend', value: net,
      label: t('an.kpiNethire'),
      sub: `<strong>${hires}</strong> ${esc(t('an.subHired'))} · <strong>${exits}</strong> ${esc(t('an.subExited'))}`,
      spark: { values: cumNet, color: '--purple' },
      delta: { dir: net > 0 ? 'up' : net < 0 ? 'down' : 'flat', html: `${net > 0 ? '+' : ''}${net}` }
    }
  ];
  box.innerHTML = cards.map(kpiCard).join('');
  box.querySelectorAll('[data-kpi-value]').forEach((el) => {
    countUp(el, parseFloat(el.dataset.target), {
      decimals: parseInt(el.dataset.decimals || '0', 10),
      suffix: el.dataset.suffix || ''
    });
  });
  renderPageMeta([
    `${payable.length} ${t('an.kpiWorkforce')}`,
    `${hc.active} ${t('an.kpiActive')}`,
    `${hc['on-leave']} ${t('an.kpiOnleave')}`,
    `${risk} ${t('an.kpiRisk')}`
  ]);
}

function renderS1() {
  if (!document.getElementById('chart-headcount')) {
    return;
  }
  const emps = scopeEmps();
  const hc = headcountByStatus(emps);
  const meta = document.getElementById('zone-workforce-meta');
  if (meta) {
    meta.textContent = `${emps.length} ${t('hr.dashboard.heads')}`;
  }

  // Huroob alert card (red, links the case file + compliance).
  const hc2 = document.getElementById('huroob-card');
  if (hc2) {
    const flagged = emps.filter(e => e.st === 'huroob');
    hc2.innerHTML = flagged.length
      ? `<a class="hr-alert hr-alert-red" href="employee-file.html?code=${encodeURIComponent(flagged[0].code)}" style="margin-bottom:12px">
          <span class="status status-red">${flagged.length} × ${esc(t('status.huroob'))}</span>
          <span><strong>${esc(t('hr.dashboard.huroobTitle'))}</strong> — ${flagged.map(e => esc(currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn)).join(currentLang() === 'ar' ? '، ' : ', ')} · ${esc(flagged[0].reportedAt || '')}</span>
        </a>`
      : '';
  }

  // Headcount ring (huroob tracked separately in the card above).
  const ring = [
    { k: 'active', v: hc.active, c: t => t.green },
    { k: 'on-leave', v: hc['on-leave'], c: t => t.yellow },
    { k: 'probation', v: hc.probation, c: t => t.blue },
    { k: 'exited', v: hc.exited, c: t => t.textMuted }
  ];
  const counted = ring.reduce((s, r) => s + r.v, 0);
  renderEchart(
    document.getElementById('chart-headcount'),
    tk => ({
      tooltip: { trigger: 'item' },
      title: {
        text: String(counted),
        subtext: t('hr.dashboard.heads'),
        left: 'center',
        top: '32%',
        textStyle: { color: tk.text, fontSize: 26, fontWeight: 700 },
        subtextStyle: { color: tk.textMuted, fontSize: 11 }
      },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['50%', '44%'],
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4, label: { show: true, fontSize: 13, fontWeight: 600 } },
          data: ring.map(r => ({
            name: t(`status.${r.k}`),
            value: r.v,
            itemStyle: { color: r.c(tk) }
          }))
        }
      ]
    }),
    L(
      `Headcount ${counted}: ${hc.active} active, ${hc['on-leave']} on leave, ${hc.probation} in probation, ${hc.exited} exited. ${hc.huroob} huroob case tracked separately.`,
      `القوى العاملة ${counted}: ${hc.active} نشط، ${hc['on-leave']} في إجازة، ${hc.probation} تحت التجربة، ${hc.exited} منتهية خدماتهم. ${hc.huroob} بلاغ هروب يُتابع بشكل منفصل.`
    )
  );

  // Tenure bars (horizontal → mirrored in RTL).
  const tb = tenureBuckets(emps, todayIso());
  const bands = [
    { k: 'tBand1', v: tb.lt1 },
    { k: 'tBand2', v: tb.y1_3 },
    { k: 'tBand3', v: tb.y3_5 },
    { k: 'tBand4', v: tb.gte5 }
  ];
  renderEchart(
    document.getElementById('chart-tenure'),
    tk => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 8, top: 8, bottom: 8 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: tk.borderLight, type: [4, 3] } } },
      yAxis: {
        type: 'category',
        data: bands.map(b => t(`hr.dashboard.${b.k}`)),
        axisLabel: { color: tk.textMuted, fontSize: 11 }
      },
      series: [
        {
          type: 'bar',
          data: bands.map(b => b.v),
          itemStyle: { color: tk.blue, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: tk.textMuted, fontSize: 11 }
        }
      ]
    }),
    L(
      `Tenure: ${bands.map(b => `${t(`hr.dashboard.${b.k}`)} ${b.v}`).join(', ')}.`,
      `مدد الخدمة: ${bands.map(b => `${t(`hr.dashboard.${b.k}`)} ${b.v}`).join('، ')}.`
    ),
    { rtl: 'hbar' }
  );

  // Separation: hired / exited bars per month (range-driven) + cumulative
  // headcount line so the bars also tell the net direction story.
  const months = rangeMonths();
  const sep = separationSeries(emps, [], todayIso(), months);
  const { labels, hired, exited } = sep;
  const flowRange = document.getElementById('flow-range');
  if (flowRange) {flowRange.textContent = t('an.flowRange').replace('{n}', String(months));}
  // Cumulative net hiring over the window — starts at 0 so it shares the
  // bars' per-month count scale instead of dwarfing them with an absolute
  // headcount level.
  let run = 0;
  const cumulative = hired.map((v, i) => {
    run += v - exited[i];
    return run;
  });
  renderEchart(
    document.getElementById('chart-separation'),
    tk => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
      grid: { left: 10, right: 14, top: 20, bottom: 46 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: tk.textMuted, fontSize: 10 }
      },
      yAxis: [
        { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: tk.borderLight, type: [4, 3] } } }
      ],
      series: [
        {
          name: t('hr.dashboard.hired'),
          type: 'bar',
          barMaxWidth: 22,
          data: hired,
          itemStyle: { color: tk.green, borderRadius: [4, 4, 0, 0] }
        },
        {
          name: t('hr.dashboard.exitedW'),
          type: 'bar',
          barMaxWidth: 22,
          data: exited,
          itemStyle: { color: tk.red, borderRadius: [4, 4, 0, 0] }
        },
        {
          name: t('an.kpiWorkforce'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: cumulative,
          lineStyle: { width: 2.5, color: tk.primary },
          itemStyle: { color: tk.primary },
          areaStyle: { color: tk.primary, opacity: 0.08 }
        }
      ]
    }),
    L(
      `Last 6 months: hired ${hired.reduce((a, b) => a + b, 0)}, exited ${exited.reduce((a, b) => a + b, 0)}.`,
      `آخر ٦ أشهر: المعينون ${hired.reduce((a, b) => a + b, 0)}، الخارجون ${exited.reduce((a, b) => a + b, 0)}.`
    ),
    { rtl: 'time' }
  );
}

function empName(code) {
  const e = getSeed('employees').find(x => x.code === code);
  if (!e) {
    return code;
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}

function profName(code) {
  const p = PROFESSIONS.find(x => x.code === code);
  if (!p) {
    return code;
  }
  return currentLang() === 'ar' ? p.ar : p.en;
}

function skillName(code) {
  const k = SKILLS.find(x => x.code === code);
  if (!k) {
    return code;
  }
  return currentLang() === 'ar' ? k.ar : k.en;
}

function siteName(id) {
  const s2 = SITES.find(x => x.id === id);
  if (!s2) {
    return id;
  }
  return currentLang() === 'ar' ? s2.nameAr || s2.nameEn : s2.nameEn;
}

function payableEmps(listArg) {
  const list = listArg || getSeed('employees');
  return list.filter(e => e.st !== 'exited' && e.st !== 'huroob');
}

function rosterRow(e) {
  return `<tr>
      <td><a href="employee-file.html?code=${encodeURIComponent(e.code)}">${esc(empName(e.code))}</a><br><small style="color:var(--text-secondary)">${esc(profName(e.prof))}</small></td>
      <td dir="ltr" style="text-align:end;white-space:nowrap">${esc(fmtSAR(e.basic))}</td>
    </tr>`;
}

// siteId OR city (city mode groups all sites inside that city under headers).
function renderRoster(siteId, city) {
  const box = document.getElementById('site-roster');
  if (!box) {
    return;
  }
  const pool = payableEmps(scopeEmps());
  box.dataset.site = siteId || '';
  box.dataset.city = city || '';
  if (city) {
    const sitesInCity = SITES.filter(s2 => s2.city === city);
    const groups = sitesInCity
      .map(s2 => ({ site: s2, rows: pool.filter(e => e.site === s2.id) }))
      .filter(g => g.rows.length)
      .sort((a, b) => b.rows.length - a.rows.length);
    const total = groups.reduce((sum, g) => sum + g.rows.length, 0);
    box.innerHTML =
      `<div class="vac-group-head"><strong>${esc(city)}</strong><span class="status status-blue">${total}</span></div>` +
      (groups.length
        ? groups.map(g =>
          `<div class="vac-group">
            <div class="vac-group-head"><strong style="font-weight:600;font-size:12px;color:var(--text-secondary)">${esc(siteName(g.site.id))}</strong><span class="status status-blue">${g.rows.length}</span></div>` +
          tableOpen(t('hr.dashboard.rosterTitle'), [L('Worker', 'الموظف'), L('Basic', 'الأساسي')]) +
          g.rows.map(rosterRow).join('') +
          '</tbody></table></div></div>'
        ).join('')
        : `<div class="hr-empty">${esc(t('common.noData'))}</div>`);
    return;
  }
  const rows = pool.filter(e => !siteId || e.site === siteId);
  box.innerHTML =
    `<div class="vac-group-head"><strong>${esc(siteId ? siteName(siteId) : t('hr.dashboard.selectSite'))}</strong>` +
    (siteId ? `<span class="status status-blue">${rows.length}</span>` : '') +
    '</div>' +
    (siteId
      ? rows.length
        ? tableOpen(t('hr.dashboard.rosterTitle'), [L('Worker', 'الموظف'), L('Basic', 'الأساسي')]) +
          rows.map(rosterRow).join('') +
          '</tbody></table></div>'
        : `<div class="hr-empty">${esc(t('common.noData'))}</div>`
      : '');
}

function donutOption(tk, slices, centerText, centerSub) {
  return {
    tooltip: { trigger: 'item' },
    title: centerText === undefined ? undefined : {
      text: String(centerText),
      subtext: centerSub || '',
      left: 'center',
      top: '32%',
      textStyle: { color: tk.text, fontSize: 22, fontWeight: 700 },
      subtextStyle: { color: tk.textMuted, fontSize: 10.5 }
    },
    legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: ['55%', '78%'],
        center: ['50%', '44%'],
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4, label: { show: true, fontSize: 13, fontWeight: 600 } },
        data: slices.map(s2 => ({ name: s2.name, value: s2.v, itemStyle: { color: s2.c(tk) } }))
      }
    ]
  };
}

function renderS3() {
  const emps = payableEmps(scopeEmps());
  const hcOf = id => emps.filter(e => e.site === id).length;

  const cities = {};
  SITES.forEach(s2 => {
    cities[s2.city] = (cities[s2.city] || 0) + hcOf(s2.id);
  });
  const chipsBox = document.getElementById('city-chips');
  if (chipsBox) {
    const cityRows = Object.entries(cities)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    chipsBox.innerHTML = cityRows
      .map(([c, n]) => `<button type="button" class="status status-blue an-city${selectedCity === c ? ' an-city-active' : ''}" data-city="${esc(c)}">${esc(c)} · ${n}</button>`)
      .join('');
    chipsBox.querySelectorAll('[data-city]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const city = btn.dataset.city;
        selectedCity = selectedCity === city ? null : city;
        renderS3();
      });
    });
  }

  const meta = document.getElementById('zone-geo-meta');
  if (meta) {
    meta.innerHTML = `<span class="status status-blue">${SITES.length} ${esc(t('hr.dashboard.mapSites'))} · ${Object.keys(cities).length} ${esc(L('cities', 'مدن'))}</span>`;
  }

  // Workforce map card archived — mount only if a #site-map host exists
  // (none on the dashboard anymore); roster/chips/meta below still fill.
  // This also keeps the 1.1MB dev / 148KB prod vendor-maps chunk off the page.
  const mapEl = document.getElementById('site-map');
  if (mapEl) {
    import('./map-helper.js').then(({ renderSiteMap }) => renderSiteMap(mapEl, {
      sites: SITES,
      clients: CLIENTS,
      headcountOf: hcOf,
      labels: {
        sites: t('hr.dashboard.mapSites'),
        clients: t('hr.dashboard.mapClients'),
        workers: t('hr.dashboard.mapWorkers')
      },
      onSelect: renderRoster
    }));
  }
  const roster = document.getElementById('site-roster');
  const current = roster && roster.dataset.site;
  const fallback = [...SITES].sort((a, b) => hcOf(b.id) - hcOf(a.id))[0];
  if (selectedCity && cities[selectedCity] > 0) {
    renderRoster(null, selectedCity);
  } else {
    selectedCity = null;
    const currentSite = current && SITES.some(s2 => s2.id === current) ? current : fallback.id;
    renderRoster(currentSite);
  }

  const nats = {};
  emps.forEach(e => {
    nats[e.nat] = (nats[e.nat] || 0) + 1;
  });
  const palette = [tk => tk.primary, tk => tk.blue, tk => tk.purple, tk => tk.yellow, tk => tk.green, tk => tk.red, tk => tk.azure];
  const natSlices = Object.entries(nats)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v], i) => ({ name, v, c: palette[i % palette.length] }));
  renderEchart(
    document.getElementById('chart-nationality'),
    tk => donutOption(tk, natSlices, emps.length, t('hr.dashboard.heads')),
    L(
      `Nationalities (${emps.length}): ${natSlices.map(s2 => `${s2.name} ${s2.v}`).join(', ')}.`,
      `الجنسيات (${emps.length}): ${natSlices.map(s2 => `${s2.name} ${s2.v}`).join('، ')}.`
    )
  );

  const saudis = emps.filter(e => e.saudi).length;
  renderEchart(
    document.getElementById('chart-saudiexp'),
    tk =>
      donutOption(tk, [
        { name: t('hr.employees.saudi'), v: saudis, c: x => x.green },
        { name: t('hr.employees.expat'), v: emps.length - saudis, c: x => x.blue }
      ], emps.length, t('hr.dashboard.heads')),
    L(
      `Saudi ${saudis}, expat ${emps.length - saudis}.`,
      `سعودي ${saudis}، أجنبي ${emps.length - saudis}.`
    )
  );

  const females = emps.filter(e => e.gender === 'F').length;
  renderEchart(
    document.getElementById('chart-gender'),
    tk =>
      donutOption(tk, [
        { name: t('hr.dashboard.male'), v: emps.length - females, c: x => x.blue },
        { name: t('hr.dashboard.female'), v: females, c: x => x.purple }
      ], emps.length, t('hr.dashboard.heads')),
    L(
      `Gender: male ${emps.length - females}, female ${females}.`,
      `الجنس: ذكر ${emps.length - females}، أنثى ${females}.`
    )
  );

  const profs = {};
  emps.forEach(e => {
    profs[e.prof] = (profs[e.prof] || 0) + 1;
  });
  const profRows = Object.entries(profs).sort((a, b) => b[1] - a[1]);
  renderEchart(
    document.getElementById('chart-profession'),
    tk => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 8, top: 8, bottom: 8 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: tk.borderLight, type: [4, 3] } } },
      yAxis: {
        type: 'category',
        data: profRows.map(([p]) => profName(p)),
        axisLabel: { color: tk.textMuted, fontSize: 11 }
      },
      series: [
        {
          type: 'bar',
          data: profRows.map(([, v]) => v),
          itemStyle: { color: tk.purple, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: tk.textMuted, fontSize: 11 }
        }
      ]
    }),
    L(
      `Professions: ${profRows.map(([p, v]) => `${profName(p)} ${v}`).join(', ')}.`,
      `المهن: ${profRows.map(([p, v]) => `${profName(p)} ${v}`).join('، ')}.`
    ),
    { rtl: 'hbar' }
  );

  const mx = document.getElementById('sponsor-matrix');
  if (mx) {
    mx.innerHTML =
      tableOpen(t('hr.dashboard.sponsorMatrix'), [L('Sponsor', 'الكفيل'), t('hr.dashboard.heads')]) +
      SPONSORS.map(p => {
        const n = emps.filter(e => e.sponsor === p.id).length;
        const nm = currentLang() === 'ar' ? p.nameAr : p.nameEn;
        return `<tr>
    <td><strong>${esc(nm)}</strong><br><small style="color:var(--text-secondary)" dir="ltr">CR ${esc(p.cr)} · ${esc(p.city)}</small></td>
    <td dir="ltr" style="text-align:end"><span class="status status-blue">${n} ${esc(t('hr.dashboard.heads'))}</span></td>
  </tr>`;
      }).join('') +
      '</tbody></table></div>';
  }

  const counts = {};
  emps.forEach(e => {
    (e.skills || []).forEach(k => {
      counts[k] = (counts[k] || 0) + 1;
    });
  });
  const max = Math.max(1, ...Object.values(counts));
  const cloud = document.getElementById('skills-cloud');
  if (cloud) {
    cloud.innerHTML = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([k, v]) =>
          `<span class="skill-tag" title="${v}" style="font-size:${11 + Math.round((v / max) * 7)}px">${esc(skillName(k))} <small>${v}</small></span>`
      )
      .join('');
  }
}

function renderS4() {
  if (!document.getElementById('nitaqat-meter')) {
    return;
  }
  const today = todayIso();
  const s = getSettings();
  const emps = getSeed('employees');
  const n = nitaqatEstimate(emps, s.nitaqat.target || 0);
  const qiwaTone = n.qiwaPct >= 85 ? 'green' : n.qiwaPct >= 70 ? 'yellow' : 'red';
  document.getElementById('compliance-chips').innerHTML =
    `<span class="status status-${qiwaTone}">Qiwa ${n.qiwaPct}%</span>`;

  const met = s.nitaqat.target > 0 && n.pct >= s.nitaqat.target;
  document.getElementById('nitaqat-meter').innerHTML =
    `<div class="nitaqat-wrap">
      <div class="nitaqat-gauge" id="chart-nitaqat-gauge"></div>
      <div class="nitaqat-facts">
        <div class="nitaqat-fact-row"><span>${esc(t('an.subTarget'))}</span><strong>${s.nitaqat.target > 0 ? `${s.nitaqat.target}%` : '—'}</strong></div>
        <div class="nitaqat-fact-row"><span>${esc(t('an.subGap'))}</span><strong>${n.gap}%</strong></div>
        <div class="nitaqat-fact-row"><span>${esc(t('an.subUnits'))}</span><strong>${n.saudiUnits} / ${n.total}</strong></div>
        <div class="nitaqat-fact-row"><span>${esc(t('an.subQiwa'))}</span><strong>${n.qiwaPct}%</strong></div>
        <div class="meter"><div class="meter-fill" style="width:${Math.min(100, n.pct)}%;background:var(--${s.nitaqat.target > 0 ? (met ? 'green' : 'yellow') : 'blue'})"></div></div>
      </div>
    </div>`;
  renderEchart(
    document.getElementById('chart-nitaqat-gauge'),
    tk => {
      const colorName = s.nitaqat.target > 0 ? (met ? 'green' : 'yellow') : 'blue';
      const color = tk[colorName];
      return {
        series: [
          {
            type: 'gauge',
            startAngle: 210,
            endAngle: -30,
            min: 0,
            max: 100,
            radius: '97%',
            center: ['50%', '60%'],
            progress: { show: true, width: 13, roundCap: true, itemStyle: { color } },
            axisLine: { lineStyle: { width: 13, color: [[1, tk.borderLight]] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { show: false },
            anchor: { show: false },
            detail: {
              valueAnimation: !prefersReducedMotion(),
              fontSize: 24,
              fontWeight: 700,
              color: tk.text,
              offsetCenter: ['0%', '-10%'],
              formatter: '{value}%'
            },
            title: {
              offsetCenter: ['0%', '20%'],
              fontSize: 11,
              color: tk.textMuted
            },
            data: [{ value: n.pct, name: t('hr.dashboard.nitaqat') }]
          }
        ]
      };
    },
    L(
      `Saudization ${n.pct}% of ${s.nitaqat.target || 0}% target; gap ${n.gap}%; ${n.saudiUnits} Saudi units of ${n.total} heads; Qiwa authentication ${n.qiwaPct}%.`,
      `السعودة ${n.pct}% من مستهدف ${s.nitaqat.target || 0}%؛ الفجوة ${n.gap}%؛ ${n.saudiUnits} وحدة سعودة من ${n.total} موظف؛ توثيق قوى ${n.qiwaPct}%.`
    )
  );

  const bk = iqamaBuckets(emps, today);
  document.getElementById('iqama-buckets').innerHTML =
    `<span class="status status-red">≤30: ${bk.le30}</span>` +
    `<span class="status status-yellow">31–60: ${bk.le60}</span>` +
    `<span class="status status-blue">61–90: ${bk.le90}</span>`;

  const reds = bk.le30;
  const meta = document.getElementById('zone-compliance-meta');
  if (meta) {
    meta.innerHTML = reds
      ? `<span class="status status-red">${reds} ${esc(t('common.urgent'))}</span>`
      : '<span class="status status-green">✓</span>';
  }
}

function renderAll() {
  renderHead();
  renderKpis();
  renderS1();
  renderS3();
  renderS4();
  renderAlerts();
  renderExpiries();
  renderMix();
  bindZoneMemory();
  bindZoneBulk();
  initReveal();
  applyI18n(document.querySelector('[data-hr-dashboard]') || document);
}

// Subtle scroll-in reveal for the zone cards. Elements already seen keep
// their .in-view state across live re-renders (filters / refresh).
function initReveal() {
  const root = document.querySelector('[data-hr-dashboard]');
  if (!root) {return;}
  const items = [...root.querySelectorAll('.an-reveal')];
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' });
  items.forEach((el, i) => {
    if (!el.dataset.revealBound) {
      el.dataset.revealBound = '1';
      el.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
    }
    io.observe(el);
  });
}

// Collapse-all / Expand-all header buttons: set every zone at once and
// persist each one through the same keys the per-zone memory uses.
function bindZoneBulk() {
  const apply = (open) => {
    document.querySelectorAll('details.zone[data-zone]').forEach(d => {
      if (d.open === open) {return;}
      if (open) {d.setAttribute('open', '');}
      else {d.removeAttribute('open');}
      try {
        localStorage.setItem(`hr:ui:zone:${d.dataset.zone}`, open ? '1' : '0');
      } catch (_e) {
        /* private mode */
      }
    });
  };
  // Header buttons persist across re-renders — bind once.
  const c = document.getElementById('zones-collapse');
  if (c && !c.dataset.bound) {
    c.dataset.bound = '1';
    c.addEventListener('click', () => apply(false));
  }
  const x = document.getElementById('zones-expand');
  if (x && !x.dataset.bound) {
    x.dataset.bound = '1';
    x.addEventListener('click', () => apply(true));
  }
}

function bindZoneMemory() {
  document.querySelectorAll('details.zone[data-zone]').forEach(d => {
    const key = `hr:ui:zone:${d.dataset.zone}`;
    try {
      if (localStorage.getItem(key) === '0') {
        d.removeAttribute('open');
      }
    } catch (_e) {
      /* private mode */
    }
    if (d.dataset.zoneBound) {
      return;
    }
    d.dataset.zoneBound = '1';
    d.addEventListener('toggle', () => {
      try {
        localStorage.setItem(key, d.open ? '1' : '0');
      } catch (_e) {
        /* private mode */
      }
    });
  });
}

export function initHrDashboard() {
  const root = document.querySelector('[data-hr-dashboard]');
  if (!root) {
    return;
  }
  renderAll();
  bindAnalyticsBar();
  if (booted) {
    return;
  }
  booted = true;
  window.addEventListener(LANG_EVENT, renderAll);
}
