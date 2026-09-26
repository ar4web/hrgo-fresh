// goHR — client profitability (profitability.html). The money story closed:
// billed revenue per client (issued invoices, excl. VAT) against the true
// secondment cost (wages + employer GOSI via calcGosi), with margins, a
// billing-gap flag per month, internal (unallocated) staff cost, and
// revenue-vs-cost / margin charts over the invoice history.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtSAR, setText } from './hr-locale.js';
import { getSeed } from './hr-api.js';
import { CLIENTS, EMPLOYEES, SECONDMENTS } from './hr-seed.js';
import { calcGosi } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const isoToday = () => new Date().toISOString().slice(0, 10);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const round1 = n => Math.round((Number(n) || 0) * 10) / 10;

let booted = false;
let month = ''; // '' = all months

const clientOf = id => CLIENTS.find(c => c.id === id);

function clientName(id) {
  const c = clientOf(id);
  if (!c) {
    return id;
  }
  return currentLang() === 'ar' ? c.nameAr || c.nameEn : c.nameEn;
}
function deployedIds(clientId) {
  return SECONDMENTS.filter(s => s.client === clientId).map(s => s.emp);
}
function headCost(emp) {
  const wage = (Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0);
  const g = calcGosi({ basic: Number(emp.basic) || 0, housing: Number(emp.housing) || 0, isSaudi: emp.nat === 'Saudi' });
  return { wage, gosi: g.employer, total: r2(wage + g.employer) };
}
// issued revenue per client per month (sent + paid; drafts are not revenue)
function issuedRevenue(clientId, m) {
  return getSeed('invoices')
    .filter(r => r.client === clientId && (m ? r.month === m : true) && (r.status === 'sent' || r.status === 'paid'))
    .reduce((a, r) => a + (Number(r.sub) || 0), 0);
}
function draftRevenue(clientId, m) {
  return getSeed('invoices')
    .filter(r => r.client === clientId && (m ? r.month === m : true) && r.status === 'draft')
    .reduce((a, r) => a + (Number(r.sub) || 0), 0);
}

function clientRows() {
  const ids = [...new Set(SECONDMENTS.map(s => s.client))].sort();
  return ids.map(id => {
    const emps = deployedIds(id).map(code => EMPLOYEES.find(e => e.code === code)).filter(Boolean);
    const cost = r2(emps.reduce((a, e) => a + headCost(e).total, 0));
    const revenue = r2(issuedRevenue(id, month));
    const draft = r2(draftRevenue(id, month));
    const margin = r2(revenue - cost);
    return {
      id,
      heads: emps.length,
      revenue,
      cost,
      margin,
      draft,
      rate: revenue > 0 ? round1((margin / revenue) * 100) : null
    };
  });
}

function months() {
  return [...new Set(getSeed('invoices').map(r => r.month))].sort();
}

// ── Render ──

function renderStats() {
  const rows = clientRows();
  const revenue = r2(rows.reduce((a, r) => a + r.revenue, 0));
  const cost = r2(rows.reduce((a, r) => a + r.cost, 0));
  const margin = r2(revenue - cost);
  const internal = r2(
    EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob' && !SECONDMENTS.some(s => s.emp === e.code)).reduce((a, e) => a + headCost(e).total, 0)
  );
  setText('pf-stat-rev', fmtSAR(revenue));
  setText('pf-stat-cost', fmtSAR(cost));
  setText('pf-stat-margin', fmtSAR(margin));
  setText('pf-stat-rate', revenue > 0 ? `${round1((margin / revenue) * 100)}%` : '—');
  setText('pf-stat-internal', fmtSAR(internal));
    const note = document.getElementById('pf-note');
  if (note) {
    note.textContent = month ? '' : t('pf.gosiNote');
  }
}

function renderTable() {
  const tbody = document.getElementById('pf-rows');
  if (!tbody) {
    return;
  }
  const rows = clientRows();
  const maxMargin = Math.max(...rows.map(r => Math.abs(r.margin)), 1);
  tbody.innerHTML = rows
    .map(r => {
      const c = clientOf(r.id);
      const barW = Math.max(2, Math.round((Math.abs(r.margin) / maxMargin) * 100));
      const barColor = r.margin >= 0 ? 'var(--primary)' : 'var(--avatar-red)';
      const rate = r.rate === null ? '—' : `${r.rate}%`;
      let gap = '';
      if (month && r.heads > 0 && r.revenue === 0) {
        gap = r.draft > 0
          ? ` <span class="status status-yellow" data-tooltip="${esc(t('pf.gapDraft'))}">◐</span>`
          : ` <span class="status status-red" data-tooltip="${esc(t('pf.gapNone'))}">●</span>`;
      }
      return `
    <tr data-id="${esc(r.id)}">
      <td style="min-width:150px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[c?.av] || 'var(--avatar-teal)'};color:white">${esc((c?.nameEn || r.id).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
          <div><div class="cell-strong" style="white-space:nowrap">${esc(clientName(r.id))}</div></div>
        </div>
      </td>
      <td class="cell-mono" style="font-size:12.5px">${r.heads}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(r.revenue))}${gap}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(r.cost))}</td>
      <td class="cell-mono" style="font-size:13px;font-weight:600;${r.margin >= 0 ? 'color:var(--ok-ink)' : 'color:var(--avatar-red)'}">${esc(fmtSAR(r.margin))}</td>
      <td class="cell-mono" style="font-size:12.5px">${rate}</td>
      <td>
        <div class="progress-thin"><div class="bar" style="width:${barW}%;background:${barColor}"></div></div>
      </td>
    </tr>`;
    })
    .join('');
}

function renderCharts() {
  const MONTHS = months();
  const labels = MONTHS.map(m => m.slice(5) + '/' + m.slice(2, 4));
  // revenue vs cost by month (grouped)
  const revByMonth = MONTHS.map(m => r2([...new Set(SECONDMENTS.map(s => s.client))].reduce((a, id) => a + issuedRevenue(id, m), 0)));
  const costByMonth = MONTHS.map(() => r2(clientRows().reduce((a, r) => a + r.cost, 0)));
  renderEchart(
    document.getElementById('chart-pf-month'),
    tk => ({
      tooltip: { trigger: 'axis' },
      legend: { data: [t('pf.revenueH'), t('pf.costH')], textStyle: { color: tk.textMuted, fontSize: 11 }, top: 0 },
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: tk.textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: tk.borderLight } } },
      yAxis: { type: 'value', axisLabel: { color: tk.textMuted, fontSize: 10, formatter: v => `${Math.round(v / 1000)}k` }, splitLine: { lineStyle: { color: tk.borderLight } } },
      series: [
        { name: t('pf.revenueH'), type: 'bar', barMaxWidth: 18, itemStyle: { color: tk.primary, borderRadius: [3, 3, 0, 0] }, data: revByMonth },
        { name: t('pf.costH'), type: 'bar', barMaxWidth: 18, itemStyle: { color: tk.azure, borderRadius: [3, 3, 0, 0] }, data: costByMonth }
      ]
    }),
    t('pf.chartRevCostSub'),
    { rtl: 'time' }
  );
  // margin by client (horizontal bars for the selected period)
  const rows = clientRows().slice().sort((a, b) => a.margin - b.margin);
  renderEchart(
    document.getElementById('chart-pf-client'),
    tk => ({
      tooltip: { trigger: 'item' },
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'value', axisLabel: { color: tk.textMuted, fontSize: 10, formatter: v => `${Math.round(v / 1000)}k` }, splitLine: { lineStyle: { color: tk.borderLight } } },
      yAxis: { type: 'category', data: rows.map(r => clientName(r.id)), axisLabel: { color: tk.textMuted, fontSize: 11 }, axisLine: { lineStyle: { color: tk.borderLight } }, axisTick: { show: false } },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { borderRadius: [0, 3, 3, 0] },
          data: rows.map(r => ({ value: r.margin, itemStyle: { color: r.margin >= 0 ? tk.primary : tk.red } }))
        }
      ]
    }),
    t('pf.chartMarginSub'),
    { rtl: 'hbar' }
  );
}

function renderAll() {
  renderStats();
  renderTable();
  renderCharts();
}

export function initProfit() {
  const root = document.querySelector('[data-hr-profit]');
  if (!root) {
    return;
  }
  const sel = document.getElementById('pf-month');
  if (sel) {
    sel.innerHTML =
      `<option value="">${esc(t('pf.allMonths'))}</option>` +
      months()
        .slice()
        .reverse()
        .map(m => `<option value="${esc(m)}">${esc(m)}</option>`)
        .join('');
    sel.value = month;
  }
  renderAll();
  sel?.addEventListener('change', () => {
    month = sel.value || '';
    renderAll();
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    if (sel) {
      sel.innerHTML =
        `<option value="">${esc(t('pf.allMonths'))}</option>` +
        months()
          .slice()
          .reverse()
          .map(m => `<option value="${esc(m)}">${esc(m)}</option>`)
          .join('');
      sel.value = month;
    }
    renderAll();
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
