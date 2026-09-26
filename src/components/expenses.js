// goHR — expense management (expenses.html). Every company cost in one
// register: government fees, medical insurance, camp/housing rent, office
// rent, utilities, fuel, maintenance and PPE — with an approve → pay flow,
// monthly spend and category analytics, CSV import/export, and soft delete.
// Amounts are totals incl. VAT; `vat` carries the tax portion.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, fmtSAR, L, setText } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { exportCSV } from './import-export.js';
import { openImportModal } from './import-modal.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { renderEchart } from './chart-helper.js';
import { getSettings } from './hr-statutory.js';
import { escapeHtml as esc } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);

const CATS = ['gov', 'medical', 'camp', 'office', 'utilities', 'fuel', 'maintenance', 'ppe', 'other'];
const CAT_KEY = Object.fromEntries(CATS.map(c => [c, `xp.cat.${c}`]));
// chart token (chart-helper theme key) per category
const CAT_TK = {
  gov: 'purple',
  medical: 'blue',
  camp: 'azure',
  office: 'yellow',
  utilities: 'green',
  fuel: 'primary',
  maintenance: 'red',
  ppe: 'primaryDk',
  other: 'textMuted'
};
const METHODS = ['transfer', 'mada', 'cash', 'cheque'];
const STATUSES = ['pending', 'approved', 'paid'];
const ST_KEY = { pending: 'xp.st.pending', approved: 'xp.st.approved', paid: 'xp.st.paid' };
const ST_CLS = { pending: 'yellow', approved: 'blue', paid: 'green' };

const XP_SCHEMA = [
  { key: 'date', en: 'Date (YYYY-MM-DD)', ar: 'التاريخ (YYYY-MM-DD)', type: 'date', required: true },
  { key: 'cat', en: 'Category (gov / medical / camp / office / utilities / fuel / maintenance / ppe / other)', ar: 'الفئة (gov / medical / camp / office / utilities / fuel / maintenance / ppe / other)', required: true },
  { key: 'payee', en: 'Payee', ar: 'المستفيد', required: true },
  { key: 'amount', en: 'Amount (SAR, incl. VAT)', ar: 'المبلغ (ر.س، شامل الضريبة)', type: 'number', required: true },
  { key: 'vat', en: 'VAT amount (SAR)', ar: 'قيمة الضريبة (ر.س)', type: 'number' },
  { key: 'method', en: 'Method (transfer / mada / cash / cheque)', ar: 'طريقة الدفع (transfer / mada / cash / cheque)' },
  { key: 'status', en: 'Status (pending / approved / paid)', ar: 'الحالة (pending / approved / paid)' }
];

let booted = false;
let dataTable = null;
let dataTableMounting = null;
let filters = { cat: '', status: '', month: '' };

// ── Data ──

function rows() {
  return getSeed('expenses').filter(r => !r.deleted);
}
function months() {
  return [...new Set(rows().map(r => String(r.at).slice(0, 7)))].sort().reverse();
}
function total(list) {
  return list.reduce((a, r) => a + (Number(r.amount) || 0), 0);
}

// ── Stats ──

function renderStats() {
  const all = rows();
  const cur = isoToday().slice(0, 7);
  const year = isoToday().slice(0, 4);
  const inMonth = all.filter(r => String(r.at).slice(0, 7) === cur);
  const spent = total(inMonth);
  setText('xp-stat-month', fmtSAR(spent));
  const budget = Number(getSettings().prefs && getSettings().prefs.expenses ? getSettings().prefs.expenses.monthlyBudget : NaN);
  const monthEl = document.getElementById('xp-stat-month');
  if (Number.isFinite(budget) && budget > 0) {
    const pct = Math.round((spent / budget) * 100);
    setText('xp-stat-month-sub', t('xp.budgetSub').replace('{pct}', fmtInt(pct)).replace('{budget}', fmtSAR(budget)));
    if (monthEl) {
      monthEl.style.color = spent > budget ? 'var(--red)' : '';
    }
  } else {
    setText('xp-stat-month-sub', t('xp.thisMonthSub').replace('{n}', fmtInt(inMonth.length)));
    if (monthEl) {
      monthEl.style.color = '';
    }
  }
  setText('xp-stat-pending', fmtSAR(total(all.filter(r => r.status === 'pending'))));
  setText('xp-stat-approved', fmtSAR(total(all.filter(r => r.status === 'approved'))));
  setText('xp-stat-year', fmtSAR(total(all.filter(r => r.status === 'paid' && String(r.at).startsWith(year)))));
  }

// ── Charts ──

function renderCharts() {
  const last6 = months().slice(0, 6).reverse();
  const labels = last6.map(m => `${m.slice(5)}/${m.slice(2, 4)}`);
  const byMonth = last6.map(m => total(rows().filter(r => String(r.at).slice(0, 7) === m)));
  renderEchart(
    document.getElementById('chart-xp-month'),
    tk => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 20, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { color: tk.textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: tk.borderLight } } },
      yAxis: { type: 'value', axisLabel: { color: tk.textMuted, fontSize: 10, formatter: v => `${Math.round(v / 1000)}k` }, splitLine: { lineStyle: { color: tk.borderLight } } },
      series: [
        { type: 'bar', barMaxWidth: 20, itemStyle: { color: tk.primary, borderRadius: [3, 3, 0, 0] }, data: byMonth }
      ]
    }),
    t('xp.chartMonthSub'),
    { rtl: 'time' }
  );
  const byCat = CATS
    .map(c => ({ cat: c, value: total(rows().filter(r => r.cat === c)) }))
    .filter(x => x.value > 0);
  renderEchart(
    document.getElementById('chart-xp-cat'),
    tk => ({
      tooltip: { trigger: 'item', formatter: p => `${p.name}: ${fmtSAR(p.value)}` },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 10 }, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '44%'],
          label: { show: false },
          data: byCat.map(x => ({ name: t(CAT_KEY[x.cat]), value: x.value, itemStyle: { color: tk[CAT_TK[x.cat]] || tk.primary } }))
        }
      ]
    }),
    t('xp.chartCatSub'),
    { rtl: null }
  );
}

// ── Table ──

function filtered() {
  return rows()
    .filter(r => (!filters.cat || r.cat === filters.cat) && (!filters.status || r.status === filters.status) && (!filters.month || String(r.at).slice(0, 7) === filters.month))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)) || String(b.id).localeCompare(String(a.id)));
}

function renderCount() {
  const el = document.getElementById('xp-count');
  if (el) {
    el.textContent = t('xp.count').replace('{n}', fmtInt(filtered().length)).replace('{total}', fmtInt(rows().length));
  }
  const badge = document.getElementById('xp-filter-count');
  if (badge) {
    const n = Object.values(filters).filter(Boolean).length;
    badge.hidden = n === 0;
    badge.textContent = fmtInt(n);
  }
}

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
  const tbody = document.getElementById('xp-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  tbody.innerHTML = filtered()
    .map(r => {
      const actions = [
        r.status === 'pending'
          ? `<button class="card-opt-btn" data-xp-approve="${esc(r.id)}" aria-label="${esc(t('xp.approve'))}" data-tooltip="${esc(t('xp.approve'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg></button>`
          : '',
        r.status !== 'paid'
          ? `<button class="card-opt-btn" data-xp-pay="${esc(r.id)}" aria-label="${esc(t('xp.pay'))}" data-tooltip="${esc(t('xp.pay'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 1.6 2.6 5 3.2 5 1.6 5 3.8-2.2 3-5 3-5-1.1-5-3"/></svg></button>`
          : '',
        `<button class="card-opt-btn" data-xp-del="${esc(r.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>`
      ].join('');
      const payee = L(r.payee, r.payeeAr || r.payee);
      const note = L(r.note, r.noteAr || r.note);
      return `
    <tr data-id="${esc(r.id)}">
      <td class="cell-mono">${esc(r.id)}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.at))}</td>
      <td style="font-size:12.5px">${esc(t(CAT_KEY[r.cat] || 'xp.cat.other'))}</td>
      <td style="min-width:150px">
        <div class="cell-strong" style="font-size:12.5px;white-space:nowrap">${esc(payee)}</div>
        ${note ? `<div class="caption-muted" style="font-size:11px">${esc(note)}</div>` : ''}
      </td>
      <td style="font-size:12.5px">${esc(t(`xp.m.${METHODS.includes(r.method) ? r.method : 'transfer'}`))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(r.amount))}${r.vat ? `<div class="caption-muted" style="font-size:10.5px">${esc(t('xp.vatShort').replace('{v}', fmtSAR(r.vat)))}</div>` : ''}</td>
      <td><span class="status status-${ST_CLS[r.status] || 'blue'}">${esc(t(ST_KEY[r.status] || 'xp.st.approved'))}</span></td>
      <td class="emp-actions-cell">${actions}</td>
    </tr>`;
    })
    .join('');
  void mountDataTable();
}

function renderAll() {
  renderStats();
  renderCharts();
  renderCount();
  renderRows();
}

// ── Filters ──

function buildMonthOptions() {
  const sel = document.getElementById('xp-f-month');
  if (!sel) {
    return;
  }
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">${esc(t('common.all'))}</option>` +
    months().map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  sel.value = cur;
  if (sel.value !== cur) {
    sel.value = '';
  }
}

function syncFilters() {
  filters = {
    cat: document.getElementById('xp-f-cat')?.value || '',
    status: document.getElementById('xp-f-status')?.value || '',
    month: document.getElementById('xp-f-month')?.value || ''
  };
}

function clearFilters() {
  ['xp-f-cat', 'xp-f-status', 'xp-f-month'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
    }
  });
  syncFilters();
  renderAll();
}

// ── Add expense ──

function nextId(list, prefix) {
  let max = 0;
  for (const r of list) {
    const m = String(r.id || '').match(/(\d+)$/);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

function openAdd() {
  const catOpts = CATS.map(c => `<option value="${c}">${esc(t(CAT_KEY[c]))}</option>`).join('');
  const mOpts = METHODS.map(m => `<option value="${m}">${esc(t(`xp.m.${m}`))}</option>`).join('');
  const sOpts = STATUSES.map(st => `<option value="${st}"${st === 'pending' ? ' selected' : ''}>${esc(t(ST_KEY[st]))}</option>`).join('');
  showModal({
    title: t('xp.add'),
    body: `
      <label class="modal-form-row"><span>${esc(t('xp.date'))}</span><input type="date" class="form-control" id="xp-add-date" value="${isoToday()}"></label>
      <label class="modal-form-row"><span>${esc(t('xp.category'))}</span><select class="form-control" id="xp-add-cat">${catOpts}</select></label>
      <label class="modal-form-row"><span>${esc(t('xp.payee'))}</span><input type="text" class="form-control" id="xp-add-payee"></label>
      <label class="modal-form-row"><span>${esc(t('xp.amount'))}</span><input type="number" min="0" step="0.01" class="form-control" id="xp-add-amount"></label>
      <label class="modal-form-row"><span>${esc(t('xp.vat'))}</span><input type="number" min="0" step="0.01" class="form-control" id="xp-add-vat" value="0"></label>
      <label class="modal-form-row"><span>${esc(t('xp.method'))}</span><select class="form-control" id="xp-add-method">${mOpts}</select></label>
      <label class="modal-form-row"><span>${esc(t('common.status'))}</span><select class="form-control" id="xp-add-status">${sOpts}</select></label>
      <label class="modal-form-row" style="margin-bottom:0"><span>${esc(t('xp.note'))}</span><input type="text" class="form-control" id="xp-add-note"></label>
      <div class="form-error" id="xp-add-err" hidden></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: () => {
          const err = document.getElementById('xp-add-err');
          const at = document.getElementById('xp-add-date')?.value;
          const cat = document.getElementById('xp-add-cat')?.value || 'other';
          const payee = document.getElementById('xp-add-payee')?.value?.trim();
          const amount = parseFloat(document.getElementById('xp-add-amount')?.value);
          const vat = parseFloat(document.getElementById('xp-add-vat')?.value) || 0;
          const method = document.getElementById('xp-add-method')?.value || 'transfer';
          const status = document.getElementById('xp-add-status')?.value || 'pending';
          const note = document.getElementById('xp-add-note')?.value?.trim() || '';
          if (err) {
            err.hidden = true;
          }
          if (!at || !payee || !Number.isFinite(amount) || amount <= 0) {
            if (err) {
              err.textContent = t('xp.errAmount');
              err.hidden = false;
            }
            return false;
          }
          saveImportedRows('expenses', [
            { id: nextId(rows(), 'EX'), at, cat, payee, payeeAr: payee, amount, vat, method, status, note, noteAr: note }
          ]);
          showToast(t('xp.toastAdd'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

// ── Import / Export ──

function openImport() {
  openImportModal({
    titleEn: t('xp.importTitleEn'),
    titleAr: t('xp.importTitleAr'),
    filename: 'expenses',
    schema: XP_SCHEMA,
    example: { date: '2026-09-19', cat: 'fuel', payee: 'Fuel station', amount: '500', vat: '65', method: 'mada', status: 'paid' },
    onImport: imported => {
      const seen = new Set();
      const fresh = [];
      let skipped = 0;
      (imported || []).forEach(r => {
        const at = String(r.date || '').trim();
        const cat = CATS.includes(String(r.cat || '').trim()) ? String(r.cat).trim() : '';
        const payee = String(r.payee || '').trim();
        const amount = parseFloat(r.amount);
        const key = `${at}@${payee}`.toLowerCase();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(at) || !cat || !payee || !Number.isFinite(amount) || amount <= 0 || seen.has(key)) {
          skipped += 1;
          return;
        }
        seen.add(key);
        fresh.push({
          id: nextId(rows().concat(fresh), 'EX'),
          at,
          cat,
          payee,
          payeeAr: payee,
          amount,
          vat: parseFloat(r.vat) || 0,
          method: METHODS.includes(String(r.method || '').trim()) ? String(r.method).trim() : 'transfer',
          status: STATUSES.includes(String(r.status || '').trim()) ? String(r.status).trim() : 'pending',
          note: '',
          noteAr: ''
        });
      });
      if (fresh.length) {
        saveImportedRows('expenses', fresh);
        renderAll();
      }
      return fresh.length;
    }
  });
}

function exportCsv() {
  const cols = [
    { key: 'id', label: L('Ref.', 'الرقم') },
    { key: 'at', label: L('Date', 'التاريخ') },
    { key: 'cat', label: L('Category', 'الفئة') },
    { key: 'payee', label: L('Payee', 'المستفيد') },
    { key: 'method', label: L('Method', 'طريقة الدفع') },
    { key: 'amount', label: L('Amount', 'المبلغ') },
    { key: 'vat', label: L('VAT', 'الضريبة') },
    { key: 'status', label: L('Status', 'الحالة') },
    { key: 'note', label: L('Note', 'ملاحظة') }
  ];
  const items = filtered().map(r => ({
    id: r.id,
    at: r.at,
    cat: t(CAT_KEY[r.cat] || 'xp.cat.other'),
    payee: L(r.payee, r.payeeAr || r.payee),
    method: t(`xp.m.${METHODS.includes(r.method) ? r.method : 'transfer'}`),
    amount: r.amount,
    vat: r.vat || 0,
    status: t(ST_KEY[r.status] || 'xp.st.approved'),
    note: L(r.note, r.noteAr || r.note) || ''
  }));
  exportCSV('expenses', cols, items);
}

// ── Boot ──

export function initExpenses() {
  const root = document.querySelector('[data-hr-expenses]');
  if (!root) {
    return;
  }
  buildMonthOptions();
  syncFilters();
  renderAll();

  const btn = document.getElementById('xp-filter-btn');
  const pop = document.getElementById('xp-filter-pop');
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
    if (e.target.closest('#xp-filter-pop, #xp-filter-btn')) {
      return;
    }
    togglePop(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop && !pop.hasAttribute('hidden')) {
      togglePop(false);
    }
  });
  document.getElementById('xp-filter-clear')?.addEventListener('click', () => {
    clearFilters();
    togglePop(false);
  });
  document.getElementById('xp-add')?.addEventListener('click', openAdd);
  document.getElementById('xp-import')?.addEventListener('click', openImport);
  document.getElementById('xp-export')?.addEventListener('click', exportCsv);
  ['xp-f-cat', 'xp-f-status', 'xp-f-month'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      syncFilters();
      renderAll();
    });
  });

  root.addEventListener('click', e => {
    const approve = e.target.closest('[data-xp-approve]');
    if (approve) {
      const r = rows().find(x => x.id === approve.dataset.xpApprove);
      if (r) {
        saveImportedRows('expenses', [{ ...r, status: 'approved' }]);
        showToast(t('xp.toastApproved'), { variant: 'success' });
        renderAll();
      }
      return;
    }
    const pay = e.target.closest('[data-xp-pay]');
    if (pay) {
      const r = rows().find(x => x.id === pay.dataset.xpPay);
      if (r) {
        saveImportedRows('expenses', [{ ...r, status: 'paid' }]);
        showToast(t('xp.toastPaid'), { variant: 'success' });
        renderAll();
      }
      return;
    }
    const del = e.target.closest('[data-xp-del]');
    if (del) {
      const r = rows().find(x => x.id === del.dataset.xpDel);
      if (r) {
        saveImportedRows('expenses', [{ ...r, deleted: true }]);
        showToast(t('xp.toastDeleted'), { variant: 'success' });
        renderAll();
      }
    }
  });

  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    buildMonthOptions();
    renderAll();
  });

  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
