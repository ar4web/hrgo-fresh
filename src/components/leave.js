// goHR — leave & vacations (leave.html). Statutory leave board:
// workforce balances, approval queue, 12-month log, request intake,
// approve/reject actions, import and export.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, initialsOf, setText, renderPageMeta } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { exportData } from './import-export.js';
import { openImportModal } from './import-modal.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DEPARTMENTS, LEAVE_TYPES } from './hr-seed.js';
import { yearsBetween, daysBetween, getSettings } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { openMenu } from './menus.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const LV_EXPORT_COLS = [
  { key: 'emp', label: 'Code / الرمز' },
  { key: 'dept', label: 'Department / القسم' },
  { key: 'type', label: 'Type / النوع' },
  { key: 'from', label: 'From / من' },
  { key: 'to', label: 'To / إلى' },
  { key: 'days', label: 'Days / الأيام' },
  { key: 'st', label: 'Status / الحالة' }
];

const LV_SCHEMA = [
  { key: 'emp', en: 'Code', ar: 'الرمز', required: true },
  { key: 'type', en: 'Type (annual / sick / …)', ar: 'النوع (annual / sick / …)', required: true },
  { key: 'from', en: 'From (YYYY-MM-DD)', ar: 'من (YYYY-MM-DD)', type: 'date', required: true },
  { key: 'to', en: 'To (YYYY-MM-DD)', ar: 'إلى (YYYY-MM-DD)', type: 'date', required: true },
  { key: 'st', en: 'Status (pending / approved / rejected / cancelled)', ar: 'الحالة (pending / approved / rejected / cancelled)' }
];

const ST_CLS = { pending: 'yellow', approved: 'green', rejected: 'red', cancelled: 'blue' };

let filter = { st: '', type: '', dept: '', sort: 'date' };
let booted = false;
let dataTable = null;
let dataTableMounting = null;
let filterOptionsSignature = '';

// ── Lookups ──

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoShift(iso, n) {
  const d = new Date(`${iso}T00:00:00`); // local midnight — pure calendar math
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const daysInclusive = (a, b) => Math.max(1, daysBetween(a, b));
function nameOf(code) {
  const e = getSeed('employees').find(x => x.code === code);
  if (!e) {
    return code || '—';
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}
function empOf(code) {
  return getSeed('employees').find(x => x.code === code);
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}
function typeName(code) {
  const tp = LEAVE_TYPES.find(x => x.code === code);
  if (!tp) {
    return code || '—';
  }
  return currentLang() === 'ar' ? tp.ar : tp.en;
}
function statusOf(st) {
  const key = ['pending', 'approved', 'rejected', 'cancelled'].includes(st) ? st : 'pending';
  return { key, label: t(`status.${key}`), cls: ST_CLS[key] };
}

// ── Balances (statutory annual entitlement: 21 days, 30 after 5 years) ──

function entitlementDays(e) {
  const annual = LEAVE_TYPES.find(x => x.code === 'annual') || {};
  const prefs = (getSettings().prefs && getSettings().prefs.leave) || {};
  const y = e.join ? Math.floor(yearsBetween(e.join)) : 0;
  return y >= 5
    ? (Number.isFinite(prefs.annualAfter5) && prefs.annualAfter5 > 0 ? prefs.annualAfter5 : annual.after5 || 30)
    : (Number.isFinite(prefs.annualBase) && prefs.annualBase > 0 ? prefs.annualBase : annual.base || 21);
}
function annualRemaining(e) {
  return Math.max(0, entitlementDays(e) - (e.annualUsed || 0));
}

// ── Data helpers ──

function visible() {
  let rows = getSeed('leaves').slice();
  if (filter.st) {
    rows = rows.filter(r => r.st === filter.st);
  }
  if (filter.type) {
    rows = rows.filter(r => r.type === filter.type);
  }
  if (filter.dept) {
    rows = rows.filter(r => r.dept === filter.dept);
  }
  const byName = (a, b) => nameOf(a.emp).localeCompare(nameOf(b.emp), currentLang() === 'ar' ? 'ar' : 'en');
  if (filter.sort === 'name') {
    rows.sort(byName);
  } else if (filter.sort === 'days') {
    rows.sort((a, b) => (b.days || 0) - (a.days || 0) || b.from.localeCompare(a.from));
  } else if (filter.sort === 'code') {
    rows.sort((a, b) => String(a.emp).localeCompare(String(b.emp)) || b.from.localeCompare(a.from));
  } else {
    rows.sort((a, b) => b.from.localeCompare(a.from) || byName(a, b));
  }
  return rows;
}

function activeEmployees() {
  return getSeed('employees').filter(e => e.st !== 'exited');
}

// ── Render: stats ──

function renderStats() {
  const today = isoToday();
  const year = today.slice(0, 4);
  const all = getSeed('leaves');
  const approved = all.filter(r => r.st === 'approved');
  const outNow = approved.filter(r => r.from <= today && r.to >= today);
  const pending = all.filter(r => r.st === 'pending');
  const inYear = approved.filter(r => (r.from || '').slice(0, 4) === year);
  const sickDays = inYear.filter(r => r.type === 'sick').reduce((a, r) => a + (r.days || 0), 0);
  const balance = activeEmployees().reduce((a, e) => a + annualRemaining(e), 0);
  const returning = approved.filter(r => r.to >= today && r.to <= isoShift(today, 7));
  setText('lv-stat-out', fmtInt(outNow.length));
  setText('lv-stat-pending', fmtInt(pending.length));
  setText('lv-stat-approved', fmtInt(inYear.reduce((a, r) => a + (r.days || 0), 0)));
  setText('lv-stat-balance', fmtInt(balance));
  setText('lv-stat-sick', fmtInt(sickDays));
  setText('lv-stat-returns', fmtInt(returning.length));
  renderPageMeta([
    `${fmtInt(outNow.length)} ${t('lv.onLeaveToday')}`,
    `${fmtInt(pending.length)} ${t('lv.pendingReqs')}`,
    `${fmtInt(balance)} ${t('lv.remainingBalance')}`
  ]);
}

// ── Render: charts ──

function renderCharts() {
  const all = getSeed('leaves').filter(r => r.st === 'approved');
  const today = new Date();
  const months = [];
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  for (let i = 11; i >= 0; i -= 1) {
    months.push(monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)));
  }
  const monthLabel = key => {
    try {
      return new Intl.DateTimeFormat(currentLang() === 'ar' ? 'ar-SA' : 'en-GB', { month: 'short' })
        .format(new Date(`${key}-01T00:00:00`));
    } catch (_e) {
      return key;
    }
  };
  const perMonth = (type, key) =>
    all.filter(r => (r.from || '').slice(0, 7) === key && (type === 'other' || r.type === type))
      .reduce((a, r) => a + (r.days || 0), 0);
  const perMonthOther = key =>
    all.filter(r => (r.from || '').slice(0, 7) === key && r.type !== 'annual' && r.type !== 'sick')
      .reduce((a, r) => a + (r.days || 0), 0);
  const totals = {
    a: months.reduce((a, k) => a + perMonth('annual', k), 0),
    s: months.reduce((a, k) => a + perMonth('sick', k), 0),
    o: months.reduce((a, k) => a + perMonthOther(k), 0)
  };
  renderEchart(
    document.getElementById('chart-lv-trend'),
    tk => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
      grid: { left: 40, right: 12, top: 16, bottom: 44 },
      xAxis: {
        type: 'category',
        data: months.map(monthLabel),
        axisLabel: { color: tk.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: tk.borderLight } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tk.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      series: [
        {
          name: typeName('annual'),
          type: 'bar',
          stack: 'm',
          barMaxWidth: 16,
          itemStyle: { color: tk.primary },
          data: months.map(k => perMonth('annual', k))
        },
        {
          name: typeName('sick'),
          type: 'bar',
          stack: 'm',
          barMaxWidth: 16,
          itemStyle: { color: tk.red },
          data: months.map(k => perMonth('sick', k))
        },
        {
          name: t('lv.other'),
          type: 'bar',
          stack: 'm',
          barMaxWidth: 16,
          itemStyle: { color: tk.azure, borderRadius: [3, 3, 0, 0] },
          data: months.map(k => perMonthOther(k))
        }
      ]
    }),
    t('lv.trendSummary')
      .replace('{d}', fmtInt(totals.a + totals.s + totals.o))
      .replace('{a}', fmtInt(totals.a))
      .replace('{s}', fmtInt(totals.s))
      .replace('{o}', fmtInt(totals.o))
  );
  // Average remaining annual balance per department (horizontal → mirrors in RTL).
  const deptRows = DEPARTMENTS.map(d => {
    const emps = activeEmployees().filter(e => e.dept === d.code);
    const avg = emps.length ? emps.reduce((a, e) => a + annualRemaining(e), 0) / emps.length : 0;
    return { name: currentLang() === 'ar' ? d.ar : d.en, avg: Math.round(avg * 10) / 10 };
  }).sort((a, b) => a.avg - b.avg);
  renderEchart(
    document.getElementById('chart-lv-dept'),
    tk => ({
      tooltip: { trigger: 'item' },
      grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: tk.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      yAxis: {
        type: 'category',
        data: deptRows.map(r => r.name),
        axisLabel: { color: tk.textMuted, fontSize: 11 },
        axisLine: { lineStyle: { color: tk.borderLight } },
        axisTick: { show: false }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { color: tk.primary, borderRadius: [0, 3, 3, 0] },
          data: deptRows.map(r => r.avg)
        }
      ]
    }),
    t('lv.balanceSummary')
  );
}

// ── Render: filters ──

function populateFilters() {
  const signature = JSON.stringify({
    lang: currentLang(),
    types: LEAVE_TYPES.map(x => x.code),
    dept: DEPARTMENTS.map(d => d.code)
  });
  if (signature === filterOptionsSignature) {
    return;
  }
  filterOptionsSignature = signature;
  const typeSel = document.getElementById('lv-type');
  if (typeSel) {
    const current = typeSel.value;
    typeSel.innerHTML = `<option value="">${esc(t('common.all'))}</option>` +
      LEAVE_TYPES.map(x => `<option value="${esc(x.code)}">${esc(typeName(x.code))}</option>`).join('');
    typeSel.value = current;
  }
  const deptSel = document.getElementById('lv-dept');
  if (deptSel) {
    const current = deptSel.value;
    deptSel.innerHTML = `<option value="">${esc(t('common.all'))}</option>` +
      DEPARTMENTS.map(d => `<option value="${esc(d.code)}">${esc(deptName(d.code))}</option>`).join('');
    deptSel.value = current;
  }
}

function syncFilterControls() {
  [['lv-st', 'st'], ['lv-type', 'type'], ['lv-dept', 'dept'], ['lv-sort', 'sort']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = filter[key] || '';
    }
  });
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  ['st', 'type', 'dept', 'sort'].forEach(key => {
    const value = params.get(key);
    if (value !== null) {
      filter[key] = value;
    }
  });
  syncFilterControls();
}

function syncFilterCount() {
  const badge = document.getElementById('lv-filter-count');
  if (!badge) {
    return;
  }
  const n = [filter.st, filter.type, filter.dept].filter(Boolean).length;
  badge.hidden = n === 0;
  badge.textContent = n ? String(n) : '';
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
  // Serialize mounts: rapid successive renders must not construct two
  // instances around the dynamic import (same guard as attendance).
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
  const tbody = document.getElementById('lv-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  populateFilters();
  const items = visible();
  renderStats();
  const cnt = document.getElementById('lv-count');
  if (cnt) {
    cnt.textContent = `${fmtInt(items.length)} / ${fmtInt(getSeed('leaves').length)}`;
  }
  tbody.innerHTML =
    items
      .map(r => {
        const e = empOf(r.emp);
        const st = statusOf(r.st);
        return `
    <tr data-lv-id="${esc(r.id)}">
      <td class="cell-mono">${esc(r.emp)}</td>
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[e?.av] || 'var(--avatar-teal)'};color:white">${esc(initialsOf(e?.nameEn || r.emp))}</div>
          <div>
            <div class="cell-strong"><button type="button" class="emp-name-btn" style="white-space:nowrap" data-emp-view="${esc(r.emp)}">${esc(nameOf(r.emp))}</button></div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${esc(deptName(r.dept))}</td>
      <td style="font-size:12.5px">${esc(typeName(r.type))}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.from))}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.to))}</td>
      <td class="cell-mono" style="font-size:12.5px">${fmtInt(r.days || daysInclusive(r.from, r.to))}</td>
      <td><span class="status status-${st.cls}">${esc(st.label)}</span></td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-lv-menu="${esc(r.id)}" aria-label="${esc(`${t('common.actions')} · ${r.emp}`)}" data-tooltip="${t('common.actions')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>
      </td>
    </tr>`;
      })
      .join('');
  // On zero results tbody stays EMPTY: DataTables then renders its own
  // localized emptyTable row. A colspan placeholder written here would be
  // read as row data and trip the tn/4 unknown-parameter alert.
  void mountDataTable();
}

function renderAll() {
  renderRows();
  renderCharts();
}

// ── Row actions: approve / reject / cancel ──

function patchStatus(id, st, toastKey) {
  const row = getSeed('leaves').find(r => r.id === id);
  if (!row) {
    return;
  }
  saveImportedRows('leaves', [{ ...row, st }]);
  renderAll();
  showToast(t(toastKey), { variant: 'success' });
}

function openRowMenu(id) {
  // IDs are `[A-Za-z0-9@.-]` — safe inside a quoted attribute selector.
  const anchor = document.querySelector(`[data-lv-menu="${id}"]`);
  if (!anchor) {
    return;
  }
  const row = getSeed('leaves').find(r => r.id === id);
  if (!row) {
    return;
  }
  const items = [];
  if (row.st === 'pending') {
    items.push({ label: t('lv.approve'), action: () => patchStatus(id, 'approved', 'lv.approveDone') });
    items.push({ label: t('lv.reject'), action: () => patchStatus(id, 'rejected', 'lv.rejectDone') });
  } else if (row.st === 'approved') {
    items.push({ label: t('lv.cancelRequest'), action: () => patchStatus(id, 'cancelled', 'lv.cancelDone') });
  }
  items.push({
    label: t('emp.viewProfile'),
    action: () => {
      window.location.href = `employee-file.html?code=${encodeURIComponent(row.emp)}`;
    }
  });
  openMenu(anchor, items);
}

// ── Request leave (manual intake) ──

function openRequestModal() {
  const emps = activeEmployees()
    .slice()
    .sort((a, b) => nameOf(a.code).localeCompare(nameOf(b.code), currentLang() === 'ar' ? 'ar' : 'en'));
  const today = isoToday();
  showModal({
    title: t('lv.requestLeave'),
    body: `
      <div class="modal-form-row"><label>${t('dash.employee')} *</label>
        <select class="form-control" id="lr-emp"><option value="">${esc(t('att.pickEmployee'))}</option>${emps.map(e => `<option value="${esc(e.code)}">${esc(nameOf(e.code))} · ${esc(e.code)}</option>`).join('')}</select></div>
      <div class="modal-form-row"><label>${t('lv.type')}</label>
        <select class="form-control" id="lr-type">${LEAVE_TYPES.map(x => `<option value="${esc(x.code)}"${x.code === 'annual' ? ' selected' : ''}>${esc(typeName(x.code))}</option>`).join('')}</select></div>
      <div class="modal-form-row"><label>${t('lv.from')} *</label><input type="date" class="form-control" id="lr-from" value="${esc(isoShift(today, 1))}"></div>
      <div class="modal-form-row"><label>${t('lv.to')} *</label><input type="date" class="form-control" id="lr-to" value="${esc(isoShift(today, 8))}"></div>
      <div class="modal-form-row" style="margin-bottom:0"><label>${t('lv.note')}</label><input type="text" class="form-control" id="lr-note"></div>
      <div data-lr-err style="font-size:12px;color:var(--red);margin-top:8px"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body, close }) => {
          const err = body.querySelector('[data-lr-err]');
          const code = body.querySelector('#lr-emp').value;
          const type = body.querySelector('#lr-type').value;
          const from = body.querySelector('#lr-from').value;
          const to = body.querySelector('#lr-to').value;
          const note = body.querySelector('#lr-note').value.trim();
          if (!code) {
            err.textContent = t('lv.chooseEmp');
            return false;
          }
          if (!from || !to || to < from) {
            err.textContent = t('lv.badDates');
            return false;
          }
          const clash = getSeed('leaves').find(r =>
            r.emp === code &&
            (r.st === 'pending' || r.st === 'approved') &&
            r.from <= to && from <= r.to
          );
          if (clash) {
            err.textContent = t('lv.overlap').replace('{name}', nameOf(code));
            return false;
          }
          const e = empOf(code);
          saveImportedRows('leaves', [{
            id: `${code}@${from}`,
            emp: code,
            dept: e?.dept || '',
            type,
            from,
            to,
            days: daysInclusive(from, to),
            st: 'pending',
            note
          }]);
          filter.st = 'pending';
          syncFilterControls();
          renderAll();
          syncFilterCount();
          close();
          showToast(t('act.savedShort'), { variant: 'success' });
        }
      }
    ]
  });
}

// ── Import ──

function openLeaveImport() {
  openImportModal({
    titleEn: t('lv.importTitleEn'),
    titleAr: t('lv.importTitleAr'),
    filename: 'leaves',
    schema: LV_SCHEMA,
    example: { emp: 'EMP-0001', type: 'annual', from: isoShift(isoToday(), 7), to: isoShift(isoToday(), 14), st: 'pending' },
    onImport: rows => {
      const codes = new Set(getSeed('employees').map(e => String(e.code).toLowerCase()));
      const types = new Set(LEAVE_TYPES.map(x => x.code));
      const seen = new Set();
      const fresh = [];
      let skipped = 0;
      rows.forEach(r => {
        const code = String(r.emp || '').trim();
        const type = String(r.type || '').trim();
        const from = String(r.from || '').trim();
        const to = String(r.to || '').trim();
        const key = `${code}@${from}`.toLowerCase();
        if (!code || !codes.has(code.toLowerCase()) || !types.has(type) || !from || !to || to < from || seen.has(key)) {
          skipped += 1;
          return;
        }
        seen.add(key);
        const st = ['pending', 'approved', 'rejected', 'cancelled'].includes(r.st) ? r.st : 'pending';
        fresh.push({
          id: `${code}@${from}`,
          emp: code,
          dept: empOf(code)?.dept || '',
          type,
          from,
          to,
          days: daysInclusive(from, to),
          st,
          note: ''
        });
      });
      if (fresh.length) {
        saveImportedRows('leaves', fresh);
      }
      renderAll();
      showToast(
        t('act.importAdded').replace('{added}', fresh.length).replace('{skipped}', skipped),
        { variant: 'success' }
      );
      return fresh.length;
    }
  });
}

// ── Boot ──

export function initLeave() {
  const root = document.querySelector('[data-hr-leave]');
  if (!root) {
    return;
  }
  populateFilters();
  applyUrlFilters();
  renderAll();
  syncFilterCount();
  root.querySelectorAll('thead th').forEach(th => {
    if (th.dataset.polished) {
      return;
    }
    th.dataset.polished = '1';
    th.title = th.textContent.trim().replace(/\s+/g, ' ');
    if (th.dataset.sort) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        filter.sort = th.dataset.sort;
        const s = document.getElementById('lv-sort');
        if (s && [...s.options].some(o => o.value === filter.sort)) {
          s.value = filter.sort;
        }
        renderRows();
      });
    }
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
  const onChange = (id, key) =>
    document.getElementById(id)?.addEventListener('change', e => {
      filter[key] = e.target.value;
      renderRows();
      syncFilterCount();
    });
  onChange('lv-st', 'st');
  onChange('lv-type', 'type');
  onChange('lv-dept', 'dept');
  onChange('lv-sort', 'sort');
  // Filter popover — fixed panel opening under the button, edge to edge.
  const pop = document.getElementById('lv-filter-pop');
  const btn = document.getElementById('lv-filter-btn');
  const togglePop = open => {
    if (!pop || !btn) {
      return;
    }
    const show = open ?? pop.hasAttribute('hidden');
    if (show) {
      const r = btn.getBoundingClientRect();
      pop.style.top = `${r.bottom + 8}px`;
      pop.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      pop.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  };
  btn?.addEventListener('click', e => {
    e.stopPropagation();
    togglePop();
  });
  document.addEventListener('click', e => {
    if (!pop || pop.hasAttribute('hidden')) {
      return;
    }
    if (e.target.closest('#lv-filter-pop, #lv-filter-btn')) {
      return;
    }
    pop.setAttribute('hidden', '');
    btn?.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop && !pop.hasAttribute('hidden')) {
      togglePop(false);
    }
  });
  window.addEventListener('resize', () => togglePop(false));
  document.getElementById('lv-filter-clear')?.addEventListener('click', () => {
    filter = { st: '', type: '', dept: '', sort: 'date' };
    syncFilterControls();
    renderRows();
    syncFilterCount();
  });
  // Rail actions: request left, import/export right.
  document.getElementById('lv-request')?.addEventListener('click', e => {
    e.stopPropagation();
    openRequestModal();
  });
  document.getElementById('lv-export')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    exportData('csv', 'leaves', LV_EXPORT_COLS, visible());
  });
  document.getElementById('lv-import')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openLeaveImport();
  });
  document.getElementById('lv-rows')?.addEventListener('click', e => {
    const view = e.target.closest('[data-emp-view]');
    if (view) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = `employee-file.html?code=${encodeURIComponent(view.dataset.empView)}`;
      return;
    }
    const menu = e.target.closest('[data-lv-menu]');
    if (menu) {
      e.stopPropagation();
      openRowMenu(menu.dataset.lvMenu);
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    // Localize static chrome first so the rebuilt DataTable reads the
    // translated <th> labels, then rebuild options, charts and rows.
    applyI18n(root);
    filterOptionsSignature = '';
    renderAll();
  });
}
