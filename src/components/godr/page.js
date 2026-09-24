// Go Dr. — system monitoring dashboard (Settings → Diagnostics → Go Dr.).
// Visual layout: KPI cards → alert bar → speedometer gauge + RTT trend +
// severity donut → page-load bar chart → per-page table → detected problems.
// Auto-refreshes every 30 s while the tab is visible; catches up on return.
// Charts mount via chart-helper (lazy echarts, theme tokens, RTL bars,
// a11y summaries — falls back to text-only where canvas is unavailable).

import { t, currentLang, applyI18n, LANG_EVENT } from '../i18n.js';
import { getSession, destFor } from '../session.js';
import { escapeHtml as esc } from '../markup.js';
import { renderPageMeta } from '../hr-locale.js';
import { renderEchart } from '../chart-helper.js';
import { store } from './store.js';
import { CATALOG, diagnose, issueParams, connIssueFor, overallOf, scoreOf, tf, pageLabel } from './rules.js';
import { runCycle } from './probe.js';

const REFRESH_MS = 30_000;
const STALE_MS = REFRESH_MS / 2;

const OK = '#10b981';
const WARN = '#f59e0b';
const ERR = '#f43f5e';
const INFO = '#3b82f6';
const GRAY = '#94a3b8';

function guard() {
  const s = getSession();
  const role = s && s.user && s.user.role;
  if (!s || !s.refreshToken) {
    window.location.replace('login.html');
    return false;
  }
  if (role !== 'admin' && role !== 'manager') {
    window.location.replace(destFor(s.user));
    return false;
  }
  return true;
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

function fmtTime(ts) {
  if (!ts) return '—';
  const tag = currentLang() === 'ar' ? 'ar-SA' : 'en-GB';
  try {
    return new Date(ts).toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (_e) { return new Date(ts).toISOString().slice(11, 19); }
}

const SIGNAL_KEY = { strong: 'godr.sig.strong', weak: 'godr.sig.weak', lost: 'godr.sig.lost', cut: 'godr.sig.cut' };
const NET_KEY = { wifi: 'godr.net.wifi', ethernet: 'godr.net.ethernet', cellular: 'godr.net.cellular', wimax: 'godr.net.cellular', none: 'godr.net.none' };

function netLabel(conn) {
  if (!conn) return '—';
  if (conn.online === false) return t('godr.net.none');
  if (conn.type && NET_KEY[conn.type]) return t(NET_KEY[conn.type]);
  const eff = conn.effectiveType || '';
  return `${t('godr.net.unknown')}${eff ? ` · ${eff}` : ''}`;
}

function sevBadgeClass(sev) {
  return sev === 'critical' ? 'err' : sev === 'warning' ? 'warn' : 'info';
}

function issueTexts(issue) {
  const d = diagnose(issue);
  const p = issueParams(issue);
  return { d, prob: tf(d.prob, p), fix: tf(d.fix, p) };
}

function probeIssue(key, probe, visit) {
  if (!probe) return null;
  if (probe.status === 'error') return { code: 'page.error', page: key, status: probe.http };
  if (probe.status === 'timeout') return { code: 'page.timeout', page: key, slowMs: probe.loadMs };
  if (probe.status === 'lost') return { code: 'page.lost', page: key };
  if (probe.status === 'weak') return { code: 'page.weak', page: key, slowMs: probe.loadMs };
  if (visit && visit.jsErrors > 0) return { code: 'js.error', page: key };
  return null;
}

// Collect every current severity — issues feed + connection + page table.
function collectSeverities(st) {
  const sevs = [];
  st.issues.slice(0, 40).forEach((i) => { const d = diagnose(i); if (d) sevs.push(d.sev); });
  const ci = connIssueFor(st.conn);
  if (ci) sevs.push(diagnose(ci).sev);
  const rowIssues = [];
  CATALOG.forEach((e) => {
    const pi = probeIssue(e.key, st.probes[e.key], st.visits[e.key]);
    if (pi) { sevs.push(diagnose(pi).sev); rowIssues.push(pi); }
  });
  return { sevs, rowIssues };
}

// ── KPI cards ───────────────────────────────────────────────────────────
function renderKpis(st, overall, score, rowIssues) {
  const scoreEl = document.getElementById('godr-kpi-score');
  if (scoreEl) {
    scoreEl.textContent = String(score);
    const card = scoreEl.closest('.godr-kpi');
    card.classList.toggle('is-bad', score < 60);
    card.classList.toggle('is-mid', score >= 60 && score < 85);
  }
  const statusEl = document.getElementById('godr-kpi-status');
  if (statusEl) {
    statusEl.textContent = t(overall === 'critical' ? 'godr.status.critical' : overall === 'degraded' ? 'godr.status.degraded' : 'godr.status.ok');
    statusEl.className = `godr-kpi-sub ${overall === 'critical' ? 't-err' : overall === 'degraded' ? 't-warn' : 't-ok'}`;
  }

  let okN = 0, weakN = 0, errN = 0;
  CATALOG.forEach((e) => {
    const p = st.probes[e.key];
    if (!p) return;
    if (p.status === 'ok') okN += 1;
    else if (p.status === 'weak') { weakN += 1; okN += 1; }
    else errN += 1;
  });
  const pagesEl = document.getElementById('godr-kpi-pages');
  if (pagesEl) pagesEl.textContent = `${okN}/${CATALOG.length}`;
  const pagesSub = document.getElementById('godr-kpi-pages-sub');
  if (pagesSub) {
    pagesSub.textContent = errN || weakN
      ? tf('godr.kpi.pagesSub', { e: errN, w: weakN })
      : t('godr.kpi.allGood');
  }

  const loads = CATALOG.map((e) => st.probes[e.key]).filter((p) => p && p.loadMs > 0);
  const avgEl = document.getElementById('godr-kpi-avg');
  if (avgEl) {
    avgEl.textContent = loads.length
      ? `${Math.round(loads.reduce((a, p) => a + p.loadMs, 0) / loads.length)} ms`
      : '—';
  }
  const avgSub = document.getElementById('godr-kpi-avg-sub');
  if (avgSub) {
    let slowest = null;
    CATALOG.forEach((e) => {
      const p = st.probes[e.key];
      if (p && p.loadMs > 0 && (!slowest || p.loadMs > slowest.ms)) slowest = { ms: p.loadMs, key: e.key };
    });
    avgSub.textContent = slowest ? tf('godr.kpi.slowest', { p: pageLabel(slowest.key) }) : '—';
  }

  const rttEl = document.getElementById('godr-kpi-rtt');
  if (rttEl) rttEl.textContent = st.conn && st.conn.rtt != null ? `${st.conn.rtt} ms` : '—';
  const rttSub = document.getElementById('godr-kpi-rtt-sub');
  if (rttSub) {
    rttSub.textContent = st.conn
      ? `${netLabel(st.conn)} · ${t(SIGNAL_KEY[st.conn.signal] || 'godr.sig.weak')}`
      : '—';
    rttSub.className = `godr-kpi-sub ${st.conn && st.conn.signal !== 'strong' ? (st.conn.signal === 'weak' ? 't-warn' : 't-err') : 't-ok'}`;
  }

  const issEl = document.getElementById('godr-kpi-issues');
  if (issEl) issEl.textContent = String(st.issues.length);
  const issSub = document.getElementById('godr-kpi-issues-sub');
  if (issSub) {
    let c = 0, w = 0;
    st.issues.slice(0, 40).forEach((i) => {
      const d = diagnose(i);
      if (d && d.sev === 'critical') c += 1;
      else if (d && d.sev === 'warning') w += 1;
    });
    issSub.textContent = st.issues.length ? tf('godr.kpi.issuesSub', { c, w }) : t('godr.kpi.allGood');
  }

  // meta line under the gauge: uptime · last check · auto-refresh · SW
  const meta = document.getElementById('godr-meta');
  if (meta) {
    meta.innerHTML =
      `<span><span class="godr-kv-label">${esc(t('godr.uptime'))}</span> ${esc(fmtDuration(Date.now() - st.startedAt))}</span>` +
      `<span><span class="godr-kv-label">${esc(t('godr.lastCheck'))}</span> ${esc(st.lastCheck ? fmtTime(st.lastCheck) : '—')}</span>` +
      `<span><span class="godr-kv-label">${esc(t('godr.auto'))}</span> 30s</span>` +
      `<span><span class="godr-kv-label">${esc(t('godr.sw'))}</span> ${esc(st.sw === 'active' ? t('godr.sw.active') : t('godr.sw.off'))}</span>`;
  }
}

// ── Connection alert bar (reason + fix when degraded) ───────────────────
function renderConnAlert(st) {
  const bar = document.getElementById('godr-alert');
  if (!bar) return;
  const ci = connIssueFor(st.conn);
  if (st.conn && st.conn.signal !== 'strong' && ci) {
    const { d, prob, fix } = issueTexts(ci);
    bar.hidden = false;
    bar.className = `godr-alert ${d.sev === 'critical' ? 'crit' : 'warn'}`;
    bar.innerHTML =
      `<div class="godr-alert-row"><span class="godr-badge ${d.sev === 'critical' ? 'err' : 'warn'}">${esc(t('godr.conn.signal'))}</span>` +
      `<span class="godr-alert-prob">${esc(prob)}</span></div>` +
      `<div class="godr-alert-row"><span class="godr-kv-label">${esc(t('godr.conn.fix'))}</span><span>${esc(fix)}</span></div>`;
  } else {
    bar.hidden = true;
    bar.innerHTML = '';
  }
}

// ── Charts ──────────────────────────────────────────────────────────────
function renderCharts(st, score) {
  const hist = st.history.slice(-30);
  const times = hist.map((h) => fmtTime(h.t));

  // Speedometer — system health score.
  renderEchart(
    document.getElementById('godr-gauge'),
    (tk) => ({
      series: [{
        type: 'gauge', min: 0, max: 100, startAngle: 210, endAngle: -30,
        radius: '92%', center: ['50%', '60%'],
        axisLine: { lineStyle: { width: 13, color: [[0.6, ERR], [0.85, WARN], [1, OK]] } },
        pointer: { length: '58%', width: 4, itemStyle: { color: tk.text } },
        anchor: { show: true, size: 8, itemStyle: { color: tk.text } },
        axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: false, offsetCenter: [0, '34%'], formatter: '{value}',
          fontSize: 28, fontWeight: 600, color: score >= 85 ? OK : score >= 60 ? WARN : ERR
        },
        data: [{ value: Math.round(score) }]
      }]
    }),
    `${t('godr.chart.health')}: ${Math.round(score)}/100`
  );

  // RTT trend — one point per monitoring cycle.
  renderEchart(
    document.getElementById('godr-line'),
    (tk) => ({
      grid: { left: 44, right: 16, top: 16, bottom: 26 },
      tooltip: { trigger: 'axis', textStyle: { color: tk.text, fontSize: 11 }, backgroundColor: tk.bgSurface, borderColor: tk.borderLight },
      xAxis: {
        type: 'category', boundaryGap: false, data: times,
        axisLine: { lineStyle: { color: tk.borderLight } }, axisTick: { show: false },
        axisLabel: { color: tk.textMuted, fontSize: 9, interval: Math.max(0, Math.ceil(times.length / 6) - 1) }
      },
      yAxis: {
        type: 'value', splitLine: { lineStyle: { color: tk.borderLight, type: [4, 3] } },
        axisLabel: { color: tk.textMuted, fontSize: 9, formatter: '{value}' }
      },
      series: [{
        type: 'line', data: hist.map((h) => h.rtt), smooth: true,
        connectNulls: false, symbol: 'circle', symbolSize: 5,
        lineStyle: { color: tk.azure, width: 2 }, itemStyle: { color: tk.azure },
        areaStyle: { color: tk.azure, opacity: 0.12 }
      }]
    }),
    `${t('godr.chart.rtt')}: ${hist.filter((h) => h.rtt != null).map((h) => h.rtt).join(', ') || '—'} ms`
  );

  // Issues by severity — donut with total in the middle.
  const sevCounts = { critical: 0, warning: 0, info: 0 };
  st.issues.slice(0, 40).forEach((i) => {
    const d = diagnose(i);
    if (d) sevCounts[d.sev] += 1;
  });
  const total = st.issues.slice(0, 40).length;
  renderEchart(
    document.getElementById('godr-donut'),
    (tk) => ({
      title: {
        text: String(total), subtext: t('godr.kpi.issues'),
        left: 'center', top: '34%',
        textStyle: { fontSize: 24, fontWeight: 600, color: tk.text },
        subtextStyle: { fontSize: 10, color: tk.textMuted }
      },
      tooltip: { trigger: 'item', textStyle: { color: tk.text, fontSize: 11 }, backgroundColor: tk.bgSurface, borderColor: tk.borderLight },
      legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: tk.textMuted, fontSize: 10.5 } },
      series: [{
        type: 'pie', radius: ['50%', '74%'], center: ['50%', '46%'],
        itemStyle: { borderRadius: 4, borderWidth: 2, borderColor: tk.bgSurface },
        label: { show: false },
        emphasis: { scale: false },
        data: total === 0
          ? [{ name: t('godr.status.ok'), value: 1, itemStyle: { color: OK } }]
          : [
              { name: t('godr.sev.critical'), value: sevCounts.critical, itemStyle: { color: ERR } },
              { name: t('godr.sev.warning'), value: sevCounts.warning, itemStyle: { color: WARN } },
              { name: t('godr.sev.info'), value: sevCounts.info, itemStyle: { color: INFO } }
            ].filter((d) => d.value > 0)
      }]
    }),
    `${t('godr.chart.sev')}: ${t('godr.sev.critical')} ${sevCounts.critical} · ${t('godr.sev.warning')} ${sevCounts.warning} · ${t('godr.sev.info')} ${sevCounts.info}`
  );

  // Page load times — horizontal bars, slowest on top, color = status.
  const rows = CATALOG
    .map((e) => ({ key: e.key, label: pageLabel(e.key), probe: st.probes[e.key] }))
    .filter((r) => r.probe)
    .sort((a, b) => b.probe.loadMs - a.probe.loadMs);
  const colorOf = (p) => p.status === 'ok' ? OK : p.status === 'weak' ? WARN
    : (p.status === 'error' || p.status === 'timeout') ? ERR : p.status === 'lost' ? GRAY : OK;
  renderEchart(
    document.getElementById('godr-bars'),
    (tk) => ({
      grid: { left: 118, right: 52, top: 8, bottom: 24 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        textStyle: { color: tk.text, fontSize: 11 }, backgroundColor: tk.bgSurface, borderColor: tk.borderLight,
        formatter: (ps) => {
          const p = ps && ps[0];
          if (!p) return '';
          const row = rows[p.dataIndex];
          return `${esc(row.label)}<br><b>${p.value} ms</b> · ${esc(t(row.probe.status === 'ok' ? 'godr.st.ok' : row.probe.status === 'weak' ? 'godr.st.weak' : (row.probe.status === 'error' || row.probe.status === 'timeout') ? 'godr.st.error' : 'godr.st.lost'))}`;
        }
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: tk.borderLight, type: [4, 3] } },
        axisLabel: { color: tk.textMuted, fontSize: 9, formatter: '{value}' }
      },
      yAxis: {
        type: 'category', data: rows.map((r) => r.label),
        axisLine: { lineStyle: { color: tk.borderLight } }, axisTick: { show: false },
        axisLabel: { color: tk.textMuted, fontSize: 10 }
      },
      series: [{
        type: 'bar',
        data: rows.map((r) => ({ value: r.probe.loadMs, itemStyle: { color: colorOf(r.probe), borderRadius: [0, 4, 4, 0] } })),
        barCategoryGap: '32%',
        label: { show: true, position: 'right', formatter: '{c}', fontSize: 9, color: tk.textMuted }
      }]
    }),
    `${t('godr.chart.loads')}: ${rows.map((r) => `${r.label} ${r.probe.loadMs}ms`).join(', ')}`,
    { rtl: 'hbar' }
  );
}

// ── Detected problems (LAST card) ───────────────────────────────────────
function renderProblems(st) {
  const list = document.getElementById('godr-problems');
  const count = document.getElementById('godr-problem-count');
  if (list) {
    if (!st.issues.length) {
      list.innerHTML = `<div class="godr-clear">${esc(t('godr.problems.none'))}</div>`;
    } else {
      list.innerHTML = st.issues.slice(0, 40).map((i) => {
        const { d, prob, fix } = issueTexts(i);
        const where = [i.page ? esc(i.page) : '', i.url ? esc(i.url) : '']
          .filter(Boolean).join(' · ');
        return `<div class="godr-issue">
          <span class="godr-badge ${sevBadgeClass(d.sev)}">${esc(t(d.sev === 'critical' ? 'godr.sev.critical' : d.sev === 'warning' ? 'godr.sev.warning' : 'godr.sev.info'))}</span>
          <div class="godr-issue-body">
            <div class="godr-issue-prob">${esc(prob)}${i.count > 1 ? ` <span class="godr-x">×${i.count}</span>` : ''}</div>
            ${where ? `<div class="godr-issue-where">${where} · ${esc(fmtTime(i.ts))}</div>` : ''}
            <div class="godr-issue-fix"><span>${esc(t('godr.conn.fix'))}:</span> ${esc(fix)}</div>
          </div>
        </div>`;
      }).join('');
    }
  }
  if (count) count.textContent = st.issues.length ? String(st.issues.length) : '';
}

// ── Per-page table ──────────────────────────────────────────────────────
function renderTable(st) {
  const tbody = document.getElementById('godr-pages');
  if (tbody) {
    tbody.innerHTML = CATALOG.map((e) => {
      const probe = st.probes[e.key];
      const visit = st.visits[e.key];
      const pi = probeIssue(e.key, probe, visit);
      let badge = '<span class="godr-badge muted">' + esc(t('godr.st.pending')) + '</span>';
      let load = '—';
      let errs = visit ? visit.jsErrors : 0;
      let probCell = `<span class="godr-dim">${esc(t('godr.st.pending'))}</span>`;
      let fixCell = '';
      let rowCls = '';
      if (probe) {
        const map = { ok: ['ok', 'godr.st.ok'], weak: ['warn', 'godr.st.weak'], error: ['err', 'godr.st.error'], timeout: ['err', 'godr.st.error'], lost: ['lost', 'godr.st.lost'] };
        const [cls, key] = map[probe.status] || map.ok;
        badge = `<span class="godr-badge ${cls}">${esc(t(key))}</span>`;
        load = `${probe.loadMs} ms`;
        if (probe.status === 'error' || probe.status === 'timeout' || probe.status === 'lost') errs += 1;
        if (pi) {
          const { prob, fix } = issueTexts(pi);
          probCell = esc(prob);
          fixCell = esc(fix);
          rowCls = pi.code === 'page.weak' || pi.code === 'js.error' ? 'godr-row-weak' : 'godr-row-err';
        } else {
          probCell = '<span class="godr-dim">—</span>';
          fixCell = '<span class="godr-dim">—</span>';
        }
      }
      return `<tr class="${rowCls}">
        <td class="godr-page-name">${esc(t(e.labelKey))}</td>
        <td>${badge}</td>
        <td class="godr-num">${load}</td>
        <td class="godr-num${errs ? ' godr-err-num' : ''}">${errs || 0}</td>
        <td class="godr-prob-cell">${probCell}</td>
        <td class="godr-fix-cell">${fixCell}</td>
      </tr>`;
    }).join('');
  }
  const pagesCount = document.getElementById('godr-count');
  if (pagesCount) pagesCount.textContent = tf('godr.countPages', { n: CATALOG.length });
}

function render() {
  const st = store.getState();
  const { sevs } = collectSeverities(st);
  const overall = overallOf(sevs);
  const score = scoreOf(sevs);
  const dot = document.getElementById('godr-dot');
  if (dot) {
    dot.className = `godr-dot${overall === 'critical' ? ' crit' : overall === 'degraded' ? ' warn' : ''}`;
  }
  renderKpis(st, overall, score);
  renderConnAlert(st);
  renderCharts(st, score);
  renderTable(st);
  renderProblems(st);
  renderPageMeta([
    `${score}`,
    t(overall === 'critical' ? 'godr.status.critical' : overall === 'degraded' ? 'godr.status.degraded' : 'godr.status.ok'),
    `${st.issues.length} ${t('godr.kpi.issues')}`
  ]);
}

let cycling = false;
async function cycle() {
  if (cycling || document.hidden) return;
  cycling = true;
  let conn = null;
  try { conn = await runCycle(); } catch (_e) { /* cycle failures must never break the page */ }
  finally { cycling = false; }
  // Trend point for the charts (avg page load across probed pages).
  try {
    const st = store.getState();
    const loads = CATALOG.map((e) => st.probes[e.key]).filter((p) => p && p.loadMs > 0).map((p) => p.loadMs);
    store.setHistoryPoint({
      t: Date.now(),
      rtt: conn && conn.pingOk ? conn.rtt : null,
      avg: loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : null,
      issues: st.issues.length
    });
  } catch (_e) {}
  render();
}

export function initGoDr() {
  if (!guard()) return;
  applyI18n();
  document.getElementById('godr-check')?.addEventListener('click', () => cycle());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const st = store.getState();
      if (!st.lastCheck || Date.now() - st.lastCheck > STALE_MS) cycle();
    }
  });
  window.addEventListener('online', () => cycle());
  document.addEventListener(LANG_EVENT, render);
  store.subscribe(render);
  render();
  cycle();
  setInterval(cycle, REFRESH_MS);
}
