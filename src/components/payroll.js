// goHR — payroll (payroll.html). Monthly run over the statutory engine:
// calcPayLine (GOSI/OT/deduction math) + unpaid-leave days from the leave
// log, printable bilingual payslips, CSV run export and a WPS SIF download.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, fmtSAR, initialsOf, maskIban, setText } from './hr-locale.js';
import { getSeed } from './hr-api.js';
import { exportData } from './import-export.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DEPARTMENTS } from './hr-seed.js';
import { calcPayLine, gosiPensionRate, sifBuild, wpsDeadline, daysBetween, otRate, legalSeller } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

const PR_EXPORT_COLS = [
  { key: 'emp', label: 'Code / الرمز' },
  { key: 'name', label: 'Name / الاسم' },
  { key: 'dept', label: 'Department / القسم' },
  { key: 'basic', label: 'Basic / الأساسي' },
  { key: 'housing', label: 'Housing / السكن' },
  { key: 'transport', label: 'Transport / النقل' },
  { key: 'unpaidDays', label: 'Unpaid days / أيام بدون أجر' },
  { key: 'unpaidAmt', label: 'Unpaid deduction / خصم بدون أجر' },
  { key: 'gosiEmp', label: 'GOSI employee / تأمينات الموظف' },
  { key: 'gosiEr', label: 'GOSI employer / تأمينات صاحب العمل' },
  { key: 'net', label: 'Net / الصافي' },
  { key: 'iban', label: 'IBAN' }
];

let period = ''; // 'YYYY-MM'
let booted = false;
let dataTable = null;
let dataTableMounting = null;

// ── Stage 2 state: line adjustments (OT/extras) + run history ──
// Both persist locally per period — same overlay philosophy as imported rows.
const ADJ_KEY = 'hr:payroll-adj:v1';
const RUNS_KEY = 'hr:payroll-runs:v1';

function loadMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch (_e) {
    return {};
  }
}
function saveMap(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (_e) {
    /* quota */
  }
}
function adjustmentsFor(month) {
  return loadMap(ADJ_KEY)[month] || {};
}
function setAdjustment(month, code, patch) {
  const all = loadMap(ADJ_KEY);
  all[month] = { ...(all[month] || {}) };
  all[month][code] = { ...all[month][code], ...patch };
  saveMap(ADJ_KEY, all);
}
function isClosed(month) {
  return loadMap(RUNS_KEY)[month]?.status === 'closed';
}
function closedRun(month) {
  return loadMap(RUNS_KEY)[month] || null;
}
function setRun(month, snapshot) {
  const all = loadMap(RUNS_KEY);
  if (snapshot) {
    all[month] = snapshot;
  } else {
    delete all[month];
  }
  saveMap(RUNS_KEY, all);
}

// ── Period helpers ──

function months() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}
function monthLabel(key) {
  try {
    return new Intl.DateTimeFormat(currentLang() === 'ar' ? 'ar-SA' : 'en-GB', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(`${key}-01T00:00:00`));
  } catch (_e) {
    return key;
  }
}
function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  const end = new Date(y, m, 0); // day 0 of next month = last day of `m`
  const p = n => String(n).padStart(2, '0');
  return { start: `${key}-01`, end: `${y}-${p(m)}-${p(end.getDate())}` };
}
const daysInclusive = (a, b) => Math.max(0, daysBetween(a, b));
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}

// Approved unpaid leave overlapping the period, counted in calendar days.
function unpaidDaysInPeriod(code, start, end) {
  return getSeed('leaves')
    .filter(r => r.emp === code && r.st === 'approved' && r.type === 'unpaid' && r.from <= end && start <= r.to)
    .reduce((sum, r) => sum + daysInclusive(r.from > start ? r.from : start, r.to < end ? r.to : end), 0);
}

// ── The run ──

function runPayroll(month) {
  const { start, end } = monthRange(month);
  const emps = getSeed('employees')
    .filter(e => e.st !== 'exited')
    .slice()
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const adj = adjustmentsFor(month);
  return emps.map(e => {
    const a = adj[e.code] || {};
    const line = calcPayLine(e, { otH: Number(a.ot) || 0, extras: Number(a.extras) || 0, at: `${month}-15` });
    const ud = unpaidDaysInPeriod(e.code, start, end);
    const unpaidAmt = round2(line.daily * ud);
    const net = round2(line.net - unpaidAmt);
    return {
      ...line,
      emp: e.code,
      name: currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn,
      nameEn: e.nameEn,
      saudi: !!e.saudi,
      dept: e.dept,
      av: e.av,
      basic: Number(e.basic) || 0,
      housing: Number(e.housing) || 0,
      transport: Number(e.transport) || 0,
      bank: e.bank || '',
      iban: e.iban || '',
      nid: e.nid || '',
      iqama: e.iqama || '',
      unpaidDays: ud,
      unpaidAmt,
      net
    };
  });
}

// ── Render: stats ──

function renderStats(lines) {
  const gross = lines.reduce((a, l) => a + l.gross, 0);
  const deds = lines.reduce((a, l) => a + l.gosiEmp + l.unpaidAmt, 0);
  const net = lines.reduce((a, l) => a + l.net, 0);
  const er = lines.reduce((a, l) => a + l.gosiEr, 0);
  setText('pr-stat-head', fmtInt(lines.length));
  setText('pr-stat-gross', fmtSAR(round2(gross)));
  setText('pr-stat-ded', fmtSAR(round2(deds)));
  setText('pr-stat-net', fmtSAR(round2(net)));
  setText('pr-stat-er', fmtSAR(round2(er)));
}

// ── Render: chart ──

function renderChart(lines) {
  const costByDept = DEPARTMENTS.map(d => ({
    name: currentLang() === 'ar' ? d.ar : d.en,
    cost: round2(lines.filter(l => l.dept === d.code).reduce((a, l) => a + l.net + l.gosiEr, 0))
  })).filter(r => r.cost > 0).sort((a, b) => a.cost - b.cost);
  renderEchart(
    document.getElementById('chart-pr-dept'),
    tk => ({
      tooltip: { trigger: 'item' },
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: tk.textMuted,
          fontSize: 10,
          formatter: v => fmtInt(v / 1000) + 'k'
        },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      yAxis: {
        type: 'category',
        data: costByDept.map(r => r.name),
        axisLabel: { color: tk.textMuted, fontSize: 11 },
        axisLine: { lineStyle: { color: tk.borderLight } },
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { color: tk.primary, borderRadius: [0, 3, 3, 0] },
          data: costByDept.map(r => r.cost)
        }
      ]
    }),
    t('pay.costSummary')
  );
}

// ── Render: rows ──

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

function renderRows(lines) {
  const tbody = document.getElementById('pr-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  tbody.innerHTML =
    lines
      .map(l => {
        const gosiCell = l.gosiEmp > 0
          ? `<div class="cell-strong">${esc(fmtSAR(l.gosiEmp))}</div>`
          : '<span style="color:var(--text-muted)">—</span>';
        return `
    <tr data-code="${esc(l.emp)}">
      <td class="cell-mono">${esc(l.emp)}</td>
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[l.av] || 'var(--avatar-teal)'};color:white">${esc(initialsOf(l.nameEn || l.emp))}</div>
          <div>
            <div class="cell-strong"><button type="button" class="emp-name-btn" style="white-space:nowrap" data-pr-slip="${esc(l.emp)}">${esc(l.name)}</button></div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${esc(deptName(l.dept))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(l.gross))}</td>
      <td class="cell-mono" style="font-size:12.5px">${l.otH ? `<div class="cell-strong">${fmtInt(l.otH)}h</div><div style="font-size:11px;color:var(--text-muted)">${esc(fmtSAR(l.otPay))}</div>` : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${l.unpaidDays ? fmtInt(l.unpaidDays) : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${l.unpaidAmt ? esc(fmtSAR(l.unpaidAmt)) : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${gosiCell}</td>
      <td class="cell-mono" style="font-size:13px;font-weight:600">${esc(fmtSAR(l.net))}</td>
      <td style="font-size:12px"><div class="cell-strong">${esc(l.bank || '—')}</div><div style="font-size:11px;color:var(--text-muted)" dir="ltr">${esc(maskIban(l.iban))}</div></td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-pr-adjust="${esc(l.emp)}" aria-label="${esc(`${t('pay.adjust')} · ${l.emp}`)}" data-tooltip="${t('pay.adjust')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>
        <button class="card-opt-btn" data-pr-slip="${esc(l.emp)}" aria-label="${esc(`${t('pay.payslip')} · ${l.emp}`)}" data-tooltip="${t('pay.payslip')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg></button>
      </td>
    </tr>`;
      })
      .join('');
  void mountDataTable();
}

function renderAll() {
  const lines = runPayroll(period);
  renderStats(lines);
  renderChart(lines);
  renderRows(lines);
  renderPeriodBar(lines);
    return lines;
}

// ── Payslip (printable modal) ──

function openPayslip(empCode) {
  const lines = runPayroll(period);
  const l = lines.find(x => x.emp === empCode);
  if (!l) {
    return;
  }
  const gosiDetail = l.saudi
    ? t('pay.gosiDetail').replace('{p}', String(l.gosiSystem === 'old' ? 9 : Math.round(gosiPensionRate(`${period}-15`) * 1000) / 10))
    : '';
  showModal({
    title: t('pay.payslipFor').replace('{name}', l.name).replace('{month}', monthLabel(period)),
    size: 'lg',
    body: `
      <div class="payslip" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
        <div class="payslip-head">
          <div class="payslip-brand">${esc(currentLang() === 'ar' ? legalSeller().nameAr : legalSeller().nameEn)}</div>
          <div class="payslip-title">${esc(t('pay.payslip'))} · ${esc(monthLabel(period))}</div>
        </div>
        <div class="payslip-emp">
          <div><span>${esc(t('dash.employee'))}</span><strong>${esc(l.name)}</strong></div>
          <div><span>${esc(t('ro.empId'))}</span><strong>${esc(l.emp)}</strong></div>
          <div><span>${esc(t('file.department'))}</span><strong>${esc(deptName(l.dept))}</strong></div>
          <div><span>${esc(t('emp.bank'))}</span><strong>${esc(l.bank || '—')}</strong> · <span dir="ltr">${esc(maskIban(l.iban))}</span></div>
        </div>
        <table class="payslip-table">
          <thead><tr><th>${esc(t('pay.earnings'))}</th><th></th></tr></thead>
          <tbody>
            <tr><td>${esc(t('pay.basic'))}</td><td>${esc(fmtSAR(l.basic))}</td></tr>
            <tr><td>${esc(t('pay.housing'))}</td><td>${esc(fmtSAR(l.housing))}</td></tr>
            <tr><td>${esc(t('pay.transport'))}</td><td>${esc(fmtSAR(l.transport))}</td></tr>
            ${l.otH ? `<tr><td>${esc(t('pay.otPay'))} · ${fmtInt(l.otH)}h</td><td>${esc(fmtSAR(l.otPay))}</td></tr>` : ''}
            ${l.extras ? `<tr><td>${esc(t('pay.extrasLine'))}</td><td>${esc(fmtSAR(l.extras))}</td></tr>` : ''}
            <tr class="payslip-sub"><td>${esc(t('pay.gross'))}</td><td>${esc(fmtSAR(l.gross))}</td></tr>
          </tbody>
        </table>
        <table class="payslip-table">
          <thead><tr><th>${esc(t('pay.deductionsLine'))}</th><th></th></tr></thead>
          <tbody>
            ${l.saudi
              ? `<tr><td>${esc(t('pay.gosiEmp'))} <span style="color:var(--text-muted)">· ${esc(gosiDetail)}</span></td><td>${esc(fmtSAR(l.gosiEmp))}</td></tr>`
              : `<tr><td style="color:var(--text-muted)">${esc(t('pay.gosiExpat'))}</td><td>—</td></tr>`}
            ${l.unpaidDays
              ? `<tr><td>${esc(t('pay.unpaidDed'))} · ${fmtInt(l.unpaidDays)} ${esc(t('lv.days'))}</td><td>${esc(fmtSAR(l.unpaidAmt))}</td></tr>`
              : ''}
            <tr class="payslip-sub"><td>${esc(t('pay.deductionsLine'))}</td><td>${esc(fmtSAR(round2(l.gosiEmp + l.unpaidAmt)))}</td></tr>
          </tbody>
        </table>
        <div class="payslip-net"><span>${esc(t('pay.net'))}</span><strong>${esc(fmtSAR(l.net))}</strong></div>
        <div class="payslip-foot">
          <div>${esc(t('pay.wpsNote'))}</div>
          <div>${esc(t('pay.generated').replace('{date}', fmtDate(new Date().toISOString().slice(0, 10))))}</div>
        </div>
      </div>`,
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      {
        label: t('pay.print'),
        variant: 'primary',
        action: () => {
          document.body.dataset.print = 'payslip';
          window.print();
          return false; // keep the dialog open
        }
      }
    ]
  });
}

// ── Exports ──

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSif(lines) {
  // Employees without an IBAN can't be filed — skip them and say so; Mudad
  // accepts partial SIF batches and a single gap shouldn't block the run.
  const fileable = lines.filter(l => l.iban && l.net > 0 && (l.nid || l.iqama));
  const skipped = lines.length - fileable.length;
  if (!fileable.length) {
    const missing = lines.find(l => !l.iban || !(l.net > 0) || !(l.nid || l.iqama));
    showToast(t('pay.sifErrors').replace('{err}', missing ? `${missing.emp}: IBAN/ID` : '—'), { variant: 'warning' });
    return;
  }
  // idType: 1 = national ID (Saudis), 2 = Iqama (expats) — see sifBuild v1.1.
  const sif = sifBuild(period, fileable.map(l => ({
    emp: l.emp,
    iban: l.iban,
    net: l.net,
    idType: l.saudi ? '1' : '2',
    idNum: l.saudi ? l.nid : l.iqama
  })));
  downloadText(`SIF-${period.replace('-', '')}.sif`, sif.text);
  if (skipped) {
    showToast(t('pay.sifMissing').replace('{n}', fmtInt(skipped)).replace('{code}', lines.find(l => !l.iban || l.net <= 0).emp), { variant: 'warning' });
  }
  showToast(
    t('pay.sifReady').replace('{n}', fmtInt(sif.count)).replace('{total}', fmtSAR(sif.total)),
    { variant: 'success' }
  );
}

// ── Period selector ──

function populatePeriods() {
  const sel = document.getElementById('pr-month');
  if (!sel) {
    return;
  }
  const current = period;
  sel.innerHTML = months()
    .map(m => `<option value="${m}">${esc(monthLabel(m))}${isClosed(m) ? ' ✓' : ''}</option>`)
    .join('');
  sel.value = current;
  const dl = document.getElementById('pr-wps-deadline');
  if (dl) {
    dl.textContent = fmtDate(wpsDeadline(period));
  }
}

// ── Render: run-state bar (draft vs closed) ──

function renderPeriodBar(lines) {
  const badge = document.getElementById('pr-status');
  const btn = document.getElementById('pr-close');
  const caption = document.getElementById('pr-closed-at');
  const closed = closedRun(period);
  if (badge) {
    if (closed) {
      badge.textContent = `✓ ${t('pay.statusClosed')}`;
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
  if (btn) {
    btn.textContent = closed ? t('pay.reopen') : t('pay.closeRun');
    btn.classList.toggle('btn-outline', !closed);
    btn.classList.toggle('btn-primary', !!closed);
  }
  if (caption) {
    if (closed) {
      caption.textContent = t('pay.closedAt')
        .replace('{date}', fmtDate(closed.at.slice(0, 10)))
        .replace('{net}', fmtSAR(closed.totals?.net || 0));
      caption.hidden = false;
    } else {
      caption.hidden = true;
    }
  }
}

function closeRun(lines) {
  setRun(period, {
    status: 'closed',
    at: new Date().toISOString(),
    totals: {
      head: lines.length,
      gross: round2(lines.reduce((a, l) => a + l.gross, 0)),
      net: round2(lines.reduce((a, l) => a + l.net, 0))
    }
  });
  populatePeriods();
  renderPeriodBar(lines);
  showToast(t('act.savedShort'), { variant: 'success' });
}

function reopenRun(lines) {
  setRun(period, null);
  populatePeriods();
  renderPeriodBar(lines);
  showToast(t('act.savedShort'), { variant: 'success' });
}

// ── Adjust line (OT hours + extras) ──

function openAdjustModal(empCode) {
  if (isClosed(period)) {
    showToast(t('pay.editLocked'), { variant: 'warning' });
    return;
  }
  const l = runPayroll(period).find(x => x.emp === empCode);
  if (!l) {
    return;
  }
  const a = adjustmentsFor(period)[empCode] || {};
  showModal({
    title: t('pay.adjustTitle').replace('{name}', l.name).replace('{month}', monthLabel(period)),
    body: `
      <div class="modal-form-row"><label>${t('pay.otHours')}</label>
        <input type="number" class="form-control" id="pa-ot" min="0" step="0.5" value="${Number(a.ot) || 0}"></div>
      <div class="modal-form-row" style="margin-bottom:0"><label>${t('pay.extras')}</label>
        <input type="number" class="form-control" id="pa-extras" min="0" step="1" value="${Number(a.extras) || 0}"></div>
      <div data-pa-err style="font-size:12px;color:var(--red);margin-top:8px"></div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">${esc(t('pay.wage'))}: ${esc(fmtSAR(l.basic + l.housing + l.transport))} · 1h = ${esc(fmtSAR(l.daily / 8 * otRate()))}</div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body, close }) => {
          const err = body.querySelector('[data-pa-err]');
          const ot = Number(body.querySelector('#pa-ot').value);
          const extras = Number(body.querySelector('#pa-extras').value);
          if (!Number.isFinite(ot) || ot < 0 || !Number.isFinite(extras) || extras < 0) {
            err.textContent = t('pay.badNumber');
            return false;
          }
          setAdjustment(period, empCode, { ot, extras });
          renderAll();
          close();
          showToast(t('act.savedShort'), { variant: 'success' });
        }
      }
    ]
  });
}

// ── Boot ──

export function initPayroll() {
  const root = document.querySelector('[data-hr-payroll]');
  if (!root) {
    return;
  }
  period = months()[0];
  populatePeriods();
  renderAll();
  window.addEventListener('afterprint', () => {
    delete document.body.dataset.print;
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
  document.getElementById('pr-month')?.addEventListener('change', e => {
    period = e.target.value;
    populatePeriods();
    renderAll();
  });
  document.getElementById('pr-sif')?.addEventListener('click', e => {
    e.stopPropagation();
    downloadSif(runPayroll(period));
  });
  document.getElementById('pr-close')?.addEventListener('click', e => {
    e.stopPropagation();
    const lines = runPayroll(period);
    if (isClosed(period)) {
      reopenRun(lines);
    } else {
      closeRun(lines);
    }
  });
  document.getElementById('pr-export')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    exportData('csv', `payroll-${period}`, PR_EXPORT_COLS, runPayroll(period));
  });
  document.getElementById('pr-rows')?.addEventListener('click', e => {
    const slip = e.target.closest('[data-pr-slip]');
    if (slip) {
      e.stopPropagation();
      e.preventDefault();
      openPayslip(slip.dataset.prSlip);
      return;
    }
    const adj = e.target.closest('[data-pr-adjust]');
    if (adj) {
      e.stopPropagation();
      e.preventDefault();
      openAdjustModal(adj.dataset.prAdjust);
    }
  });
  root.querySelectorAll('thead th').forEach(th => {
    if (th.dataset.polished) {
      return;
    }
    th.dataset.polished = '1';
    th.title = th.textContent.trim().replace(/\s+/g, ' ');
  });
  window.addEventListener(LANG_EVENT, () => {
    // Localize static chrome first; rebuild period labels, chart and rows.
    applyI18n(root);
    populatePeriods();
    renderAll();
  });
}
