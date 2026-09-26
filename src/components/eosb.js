// goHR — end of service (eosb.html). Statutory EOSB calculator over the
// shared engine (calcEOSB, Art. 84/85): what-if hero calculator, workforce
// accrual table, liability chart and printable bilingual statements.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, fmtSAR, initialsOf, setText } from './hr-locale.js';
import { getSeed } from './hr-api.js';
import { showModal } from './modal.js';
import { DEPARTMENTS, SEED_EOSB } from './hr-seed.js';
import { calcEOSB } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const round1 = n => Math.round((Number(n) || 0) * 10) / 10;

const REASONS = ['termination', 'resignation', 'resignation-fixed', 'art80', 'art81'];
const REASON_KEY = {
  termination: 'eosb.rTermination',
  resignation: 'eosb.rResign',
  'resignation-fixed': 'eosb.rResignFixed',
  art80: 'eosb.rArt80',
  art81: 'eosb.rArt81'
};

let booted = false;
let dataTable = null;
let dataTableMounting = null;

// ── Helpers ──

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function activeEmployees() {
  return getSeed('employees')
    .filter(e => e.st !== 'exited' && e.join)
    .slice()
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}
function nameOf(e) {
  return e ? (currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn) : '—';
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}
function accFor(e, asOf, reason) {
  const r = calcEOSB({ basic: Number(e.basic) || 0, joinDate: e.join, endDate: asOf, endReason: reason || 'termination' });
  return { ...r, code: e.code, dept: e.dept, av: e.av, join: e.join, name: nameOf(e), nameEn: e.nameEn };
}

// ── Render: stats ──

function renderStats() {
  const today = isoToday();
  const emps = activeEmployees();
  const accs = emps.map(e => accFor(e, today, 'termination'));
  const liability = accs.reduce((a, r) => a + r.net, 0);
  const avgYears = emps.length ? accs.reduce((a, r) => a + r.years, 0) / emps.length : 0;
  const veterans = accs.filter(r => r.years >= 5).length;
  let longest = null;
  for (const r of accs) {
    if (!longest || r.years > longest.years) {
      longest = r;
    }
  }
  setText('eo-stat-liab', fmtSAR(Math.round(liability * 100) / 100));
  setText('eo-stat-avg', round1(avgYears));
  setText('eo-stat-vet', fmtInt(veterans));
  setText('eo-stat-long', longest ? longest.name.split(' ')[0] : '—');
  setText('eo-stat-long-sub', longest ? `${round1(longest.years)} ${t('eosb.yearsH')}` : '—');
  }

// ── Render: chart ──

function renderChart() {
  const today = isoToday();
  const accs = activeEmployees().map(e => accFor(e, today, 'termination'));
  const rows = DEPARTMENTS.map(d => ({
    name: currentLang() === 'ar' ? d.ar : d.en,
    cost: Math.round(accs.filter(r => r.dept === d.code).reduce((a, r) => a + r.net, 0) * 100) / 100
  })).filter(r => r.cost > 0).sort((a, b) => a.cost - b.cost);
  const total = rows.reduce((a, r) => a + r.cost, 0);
  const list = document.getElementById('eo-dept-list');
  if (list) {
    const empsOf = (code) => accs.filter(r => r.dept === code).length;
    list.innerHTML = rows.slice().reverse().map((r) => {
      const d = DEPARTMENTS.find(x => (currentLang() === 'ar' ? x.ar : x.en) === r.name) || {};
      const pct = total > 0 ? Math.round((r.cost / total) * 100) : 0;
      return `
      <div class="eosb-dept-row">
        <span class="eosb-dept-name">${esc(r.name)}<span class="caption-muted" style="font-size:11px"> · ${fmtInt(empsOf(d.code))} ${esc(t('eosb.empsShort'))}</span></span>
        <span class="eosb-dept-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="cell-mono">${esc(fmtSAR(r.cost))}</span>
        <span class="caption-muted" style="width:38px;text-align:end">${pct}%</span>
      </div>`;
    }).join('') + `
      <div class="eosb-dept-total">
        <span data-i18n="eosb.totalLiab">${esc(t('eosb.totalLiab'))}</span>
        <strong class="cell-mono">${esc(fmtSAR(total))}</strong>
      </div>`;
  }
  renderEchart(
    document.getElementById('chart-eo-dept'),
    tk => ({
      tooltip: { trigger: 'item' },
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: tk.textMuted, fontSize: 10, formatter: v => fmtInt(v / 1000) + 'k' },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      yAxis: {
        type: 'category',
        data: rows.map(r => r.name),
        axisLabel: { color: tk.textMuted, fontSize: 11 },
        axisLine: { lineStyle: { color: tk.borderLight } },
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { color: tk.primary, borderRadius: [0, 3, 3, 0] },
          data: rows.map(r => r.cost)
        }
      ]
    }),
    t('eosb.deptSummary')
  );
}

// ── Render: hero calculator ──

function renderCalc() {
  const emps = activeEmployees();
  const empSel = document.getElementById('eo-emp');
  if (empSel && !empSel.options.length) {
    empSel.innerHTML = emps
      .map(e => `<option value="${esc(e.code)}">${esc(nameOf(e))} · ${esc(e.code)}</option>`)
      .join('');
  }
  const asOfEl = document.getElementById('eo-asof');
  if (asOfEl && !asOfEl.value) {
    asOfEl.value = isoToday();
  }
  const e = emps.find(x => x.code === (empSel?.value || '')) || emps[0];
  if (!e) {
    return;
  }
  const reason = document.getElementById('eo-reason')?.value || 'termination';
  const asOf = asOfEl?.value || isoToday();
  const r = accFor(e, asOf, reason);
  setText('eo-years', round1(r.years));
  setText('eo-gross', fmtSAR(r.gross));
  const cutRow = document.getElementById('eo-cut-row');
  const factorRow = document.getElementById('eo-factor-row');
  if (cutRow) {
    cutRow.hidden = !(r.haircut > 0);
  }
  if (factorRow) {
    factorRow.hidden = !(r.factor < 1);
  }
  if (r.haircut > 0) {
    setText('eo-cut', `− ${fmtSAR(r.haircut)}`);
  }
  if (r.factor < 1) {
    setText('eo-factor', `${Math.round(r.factor * 100)}%`);
  }
  setText('eo-net', r.net > 0 ? fmtSAR(r.net) : t('eosb.zero'));
  const rules = document.getElementById('eo-rules');
  if (rules) {
    rules.textContent = reason === 'art80'
      ? t('eosb.ruleNone')
      : [t('eosb.ruleT'), reason === 'resignation-fixed' ? t('eosb.ruleCut') : ''].filter(Boolean).join(' ');
  }
  const payterm = document.getElementById('eo-payterm');
  if (payterm) {
    const days = reason === 'termination' || reason === 'art81' ? SEED_EOSB.payDaysEmployer : SEED_EOSB.payDaysResign;
    payterm.textContent = t('eosb.payT').replace('{d}', fmtInt(days));
  }
}

// ── Render: table ──

function destroyDataTable() {
  if (!dataTable) {
    return;
  }
  dataTable.destroy();
  dataTable = null;
}

async function mountDataTable() {
  const table = document.querySelector('table.emp-table');
  if (!table || dataTable || table.classList.contains('dataTable')) {
    return;
  }
  if (dataTableMounting) {
    await dataTableMounting;
    if (dataTable || table.classList.contains('dataTable')) {
      return;
    }
  }
  dataTableMounting = (async () => {
    const { default: DataTable } = await import('datatables.net');
    dataTable = new DataTable(table, {
      pageLength: parseInt(table.dataset.pageLength || '10', 10),
      lengthChange: false,
      searching: false,
      ordering: false,
      order: [],
      language: {
        emptyTable: t('common.noData'),
        info: t('dt.info'),
        infoEmpty: t('dt.infoEmpty'),
        infoFiltered: t('dt.infoFiltered'),
        zeroRecords: t('dt.zero'),
        paginate: { previous: t('dt.previous'), next: t('dt.next') }
      }
    });
  })();
  await dataTableMounting;
  dataTableMounting = null;
}

function renderRows() {
  const tbody = document.getElementById('eo-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  const today = isoToday();
  const items = activeEmployees()
    .map(e => accFor(e, today, 'termination'))
    .sort((a, b) => b.net - a.net);
  tbody.innerHTML =
    items
      .map(r => `
    <tr data-code="${esc(r.code)}">
      <td class="cell-mono">${esc(r.code)}</td>
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[r.av] || 'var(--avatar-teal)'};color:white">${esc((r.nameEn || r.code).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
          <div>
            <div class="cell-strong"><button type="button" class="emp-name-btn" style="white-space:nowrap" data-emp-view="${esc(r.code)}">${esc(r.name)}</button></div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${esc(deptName(r.dept))}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.join))}</td>
      <td class="cell-mono" style="font-size:12.5px">${round1(r.years)}</td>
      <td class="cell-mono" style="font-size:13px;font-weight:600">${esc(fmtSAR(r.net))}</td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-eo-view="${esc(r.code)}" aria-label="${esc(`${t('eosb.statement')} · ${r.code}`)}" data-tooltip="${t('eosb.statement')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg></button>
      </td>
    </tr>`)
      .join('');
  void mountDataTable();
}

function renderAll() {
  renderStats();
  renderCalc();
  renderChart();
  renderRows();
}

// ── Statement modal (printable) ──

function openStatement(code, asOf, reason) {
  const e = activeEmployees().find(x => x.code === code);
  if (!e) {
    return;
  }
  const r = accFor(e, asOf || isoToday(), reason || 'termination');
  const reasonLabel = t(REASON_KEY[r.reason] || 'eosb.rTermination');
  const body = document.querySelector('#eo-asof')?.value;
  showModal({
    title: t('eosb.statementFor').replace('{name}', r.name),
    size: 'lg',
    body: `
      <div class="payslip" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
        <div class="payslip-head">
          <div class="payslip-brand">goHR</div>
          <div class="payslip-title">${esc(t('eosb.statement'))}</div>
        </div>
        <div class="payslip-emp">
          <div><span>${esc(t('dash.employee'))}</span><strong>${esc(r.name)}</strong></div>
          <div><span>${esc(t('ro.empId'))}</span><strong>${esc(r.code)}</strong></div>
          <div><span>${esc(t('file.department'))}</span><strong>${esc(deptName(r.dept))}</strong></div>
          <div><span>${esc(t('emp.joinDate'))}</span><strong>${esc(fmtDate(e.join))}</strong></div>
          <div><span>${esc(t('eosb.onDate'))}</span><strong>${esc(fmtDate(asOf || isoToday()))}</strong></div>
          <div><span>${esc(t('eosb.reason'))}</span><strong>${esc(reasonLabel)}</strong></div>
          <div><span>${esc(t('eosb.wageBasis'))}</span><strong>${esc(t('eosb.basicOnly'))}</strong></div>
        </div>
        <table class="payslip-table">
          <tbody>
            <tr><td>${esc(t('eosb.service'))}</td><td>${round1(r.years)}</td></tr>
            <tr><td>${esc(t('eosb.gross'))}</td><td>${esc(fmtSAR(r.gross))}</td></tr>
            ${r.haircut > 0 ? `<tr><td>${esc(t('eosb.haircut'))} (${Math.round((1 - r.factor) * 100)}%)</td><td>− ${esc(fmtSAR(r.haircut))}</td></tr>` : ''}
          </tbody>
        </table>
        <div class="payslip-net"><span>${esc(t('eosb.net'))}</span><strong>${r.net > 0 ? esc(fmtSAR(r.net)) : esc(t('eosb.zero'))}</strong></div>
        <div class="payslip-foot">
          <div>${esc(t('eosb.ruleT'))}${r.reason === 'resignation-fixed' ? ' ' + esc(t('eosb.ruleCut')) : ''}${r.reason === 'art80' ? ' ' + esc(t('eosb.ruleNone')) : ''}</div>
          <div>${esc(t('eosb.payT').replace('{d}', fmtInt(r.reason === 'termination' || r.reason === 'art81' ? SEED_EOSB.payDaysEmployer : SEED_EOSB.payDaysResign)))}</div>
          <div>${esc(t('eosb.generated').replace('{date}', fmtDate(isoToday())))}</div>
        </div>
      </div>`,
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      {
        label: t('pay.print'),
        variant: 'primary',
        action: () => {
          document.body.dataset.print = 'eosb';
          window.print();
          return false;
        }
      }
    ]
  });
}

// ── Boot ──

export function initEosb() {
  const root = document.querySelector('[data-hr-eosb]');
  if (!root) {
    return;
  }
  renderAll();
  window.addEventListener('afterprint', () => {
    delete document.body.dataset.print;
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
  ['eo-emp', 'eo-asof', 'eo-reason'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => renderCalc());
  });
  root.querySelectorAll('thead th').forEach(th => {
    if (th.dataset.polished) {
      return;
    }
    th.dataset.polished = '1';
    th.title = th.textContent.trim().replace(/\s+/g, ' ');
  });
  document.getElementById('eo-rows')?.addEventListener('click', e => {
    const view = e.target.closest('[data-emp-view]');
    if (view) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = `employee-file.html?code=${encodeURIComponent(view.dataset.empView)}`;
      return;
    }
    const st = e.target.closest('[data-eo-view]');
    if (st) {
      e.stopPropagation();
      e.preventDefault();
      const reason = document.getElementById('eo-reason')?.value || 'termination';
      openStatement(st.dataset.eoView, document.getElementById('eo-asof')?.value, reason);
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    // hero select keeps its value; labels re-render on the next render pass
    document.getElementById('eo-emp').innerHTML = '';
    renderAll();
  });
}
