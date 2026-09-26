// goHR — renewals (renewals.html). Document expiry tower over the shared
// statutory prims (daysUntil, expiryBand, renewalChecklist): per-band stats,
// clickable status tower, filterable worklist and a renew action that
// patches the employee record through the local overlay.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, setText } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { exportData } from './import-export.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DEPARTMENTS } from './hr-seed.js';
import { daysUntil, expiryBand, renewalChecklist } from './hr-statutory.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);

const BANDS = ['expired', 'critical', 'urgent', 'soon', 'ok'];
const BAND_KEY = {
  expired: 'rx.bExpired',
  critical: 'rx.bCritical',
  urgent: 'rx.bUrgent',
  soon: 'rx.bSoon',
  ok: 'rx.bValid'
};
const BAND_CLS = {
  expired: 'red',
  critical: 'red',
  urgent: 'yellow',
  soon: 'blue',
  ok: 'green'
};
const BAND_COLOR = {
  expired: 'var(--red)',
  critical: 'var(--orange)',
  urgent: 'var(--yellow)',
  soon: 'var(--blue)',
  ok: 'var(--green)'
};

const DOCS = [
  { type: 'iqama', key: 'rx.docIqama', exp: 'iqamaExp', no: 'iqama', expatOnly: true },
  { type: 'passport', key: 'rx.docPassport', exp: 'passportExp', no: 'passport', expatOnly: false },
  { type: 'insurance', key: 'rx.docInsurance', exp: 'insExp', no: null, expatOnly: true }
];
const DOC_KEY = { iqama: 'rx.docIqama', passport: 'rx.docPassport', insurance: 'rx.docInsurance' };
const TOAST_KEY = { iqama: 'rx.renewedIqama', passport: 'rx.renewedPassport', insurance: 'rx.renewedInsurance' };

let booted = false;
let dataTable = null;
let dataTableMounting = null;
let filters = { type: '', band: '', dept: '' };

// ── Data ──

function inScope() {
  return getSeed('employees').filter(e => e.st !== 'exited' && e.st !== 'huroob');
}
function nameOf(e) {
  return e ? (currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn) : '—';
}
function docRows() {
  const today = isoToday();
  const rows = [];
  for (const e of inScope()) {
    const expat = e.nat !== 'Saudi';
    for (const d of DOCS) {
      if (d.expatOnly && !expat) {
        continue;
      }
      const exp = e[d.exp];
      if (!exp) {
        continue;
      }
      const days = daysUntil(exp, today);
      rows.push({
        code: e.code,
        emp: e,
        name: nameOf(e),
        nameEn: e.nameEn,
        av: e.av,
        dept: e.dept,
        type: d.type,
        no: d.no ? e[d.no] || '' : '',
        exp,
        days,
        band: expiryBand(days)
      });
    }
  }
  return rows;
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}

// ── Stats ──

function renderStats(rows) {
  const count = band => rows.filter(r => r.band === band).length;
  setText('rx-stat-expired', fmtInt(count('expired')));
  setText('rx-stat-critical', fmtInt(count('critical')));
  setText('rx-stat-urgent', fmtInt(count('urgent')));
  setText('rx-stat-soon', fmtInt(count('soon')));
  }

// ── Tower ──

function renderTower(rows) {
  const tower = document.getElementById('rx-tower');
  if (!tower) {
    return;
  }
  tower.innerHTML = DOCS.map(d => {
    const sub = rows.filter(r => r.type === d.type);
    const total = sub.length;
    const segs = BANDS
      .map(b => ({ b, n: sub.filter(r => r.band === b).length }))
      .filter(s => s.n > 0)
      .map(s => `<button type="button" class="rx-seg" data-rx-seg="${s.b}" data-rx-type="${d.type}" title="${esc(t(BAND_KEY[s.b]))} · ${fmtInt(s.n)}" style="flex:${s.n};background:${BAND_COLOR[s.b]}"></button>`)
      .join('');
    const chips = BANDS.map(b => {
      const n = sub.filter(r => r.band === b).length;
      return n ? `<span class="status status-${BAND_CLS[b]}">${fmtInt(n)}</span>` : '';
    }).join('');
    return `
      <div class="rx-row">
        <div class="rx-row-label">${esc(t(d.key))}</div>
        <div class="rx-row-bar">${segs || '<span class="rx-seg-empty"></span>'}</div>
        <div class="rx-row-chips">${chips}</div>
        <div class="rx-row-total">${fmtInt(total)}</div>
      </div>`;
  }).join('');
}

// ── Worklist table ──

function filtered(rows) {
  return rows
    .filter(r => (!filters.type || r.type === filters.type) && (!filters.band || r.band === filters.band) && (!filters.dept || r.dept === filters.dept))
    .sort((a, b) => a.days - b.days);
}

function renderCount(rows) {
  const shown = filtered(rows).length;
  const el = document.getElementById('rx-count');
  if (el) {
    el.textContent = t('rx.count').replace('{n}', fmtInt(shown)).replace('{total}', fmtInt(rows.length));
  }
  const badge = document.getElementById('rx-filter-count');
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

function renderRows(rows) {
  const tbody = document.getElementById('rx-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  const items = filtered(rows);
  tbody.innerHTML =
    items
      .map(r => `
    <tr data-code="${esc(r.code)}" data-type="${r.type}">
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
      <td style="font-size:12.5px">${esc(t(DOC_KEY[r.type]))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(r.no || '—')}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.exp))}</td>
      <td class="cell-mono" style="font-size:12.5px;${r.days < 0 ? 'color:var(--red);font-weight:600' : ''}">${fmtInt(r.days)}</td>
      <td><span class="status status-${BAND_CLS[r.band]}">${esc(t(BAND_KEY[r.band]))}</span></td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-rx-renew aria-label="${esc(`${t('rx.renew')} · ${t(DOC_KEY[r.type])}`)}" data-tooltip="${esc(t('rx.renew'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
      </td>
    </tr>`)
      .join('');
  void mountDataTable();
}

function renderAll() {
  const rows = docRows();
  renderStats(rows);
  renderTower(rows);
  renderCount(rows);
  renderRows(rows);
}

// ── Filters ──

function buildDeptOptions() {
  const sel = document.getElementById('rx-dept');
  if (!sel) {
    return;
  }
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">${esc(t('common.all'))}</option>` +
    DEPARTMENTS.map(d => `<option value="${esc(d.code)}">${esc(currentLang() === 'ar' ? d.ar : d.en)}</option>`).join('');
  sel.value = cur;
}

function syncFilters() {
  filters = {
    type: document.getElementById('rx-type')?.value || '',
    band: document.getElementById('rx-band')?.value || '',
    dept: document.getElementById('rx-dept')?.value || ''
  };
}

function clearFilters() {
  ['rx-type', 'rx-band', 'rx-dept'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = '';
    }
  });
  syncFilters();
  renderAll();
}

// ── Renew modal ──

function openRenew(row) {
  const e = row.emp;
  const ck = row.type === 'iqama'
    ? `
      <div class="rx-ck-title">${esc(t('rx.checklist'))}</div>
      ${renewalChecklist(e, { passportExp: e.passportExp, insExp: e.insExp })
        .map(c => `
          <div class="rx-ck-row">
            <span class="status status-${c.ok ? 'green' : 'red'}">${esc(t(c.ok ? 'rx.ck.ok' : 'rx.ck.fail'))}</span>
            <span class="rx-ck-label">${esc(t(`rx.ck.${c.key}`))}</span>
            <span class="rx-ck-detail">${['saudi', 'gosi'].includes(c.key) || c.detail === '0' ? '' : esc(c.detail === 'missing' ? t('rx.ck.missing') : c.detail)}</span>
          </div>`)
        .join('')}`
    : '';
  showModal({
    title: `${t('rx.renewTitle')} · ${t(DOC_KEY[row.type])}`,
    body: `
      <div class="rx-renew-emp">
        <strong>${esc(row.name)}</strong>
        <span class="caption-muted">${esc(row.code)} · ${esc(deptName(row.dept))}</span>
      </div>
      <div class="modal-form-row"><span>${esc(t('rx.currentExp'))}</span>
        <div class="rx-current">${esc(fmtDate(row.exp))} <span class="status status-${BAND_CLS[row.band]}">${esc(t(BAND_KEY[row.band]))}</span></div></div>
      ${ck}
      <label class="modal-form-row"><span>${esc(t('rx.newExp'))}</span>
        <input type="date" class="form-control" id="rx-new-exp" min="${isoToday()}"></label>
      <div class="form-error" id="rx-new-err" hidden></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('rx.renew'),
        variant: 'primary',
        action: () => {
          const err = document.getElementById('rx-new-err');
          const val = document.getElementById('rx-new-exp')?.value;
          if (err) {
            err.hidden = true;
          }
          if (!val) {
            if (err) {
              err.textContent = t('rx.errDate');
              err.hidden = false;
            }
            return false;
          }
          if (daysUntil(val, isoToday()) < 1) {
            if (err) {
              err.textContent = t('rx.errPast');
              err.hidden = false;
            }
            return false;
          }
          saveImportedRows('employees', [{ ...e, [DOCS.find(d => d.type === row.type).exp]: val }]);
          showToast(t(TOAST_KEY[row.type]), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

// ── Export ──

function exportCsv(rows) {
  const L = (en, ar) => (currentLang() === 'ar' ? ar : en);
  const cols = [
    { key: 'code', label: L('Employee ID', 'الرمز') },
    { key: 'name', label: L('Employee', 'الموظف') },
    { key: 'dept', label: L('Department', 'القسم') },
    { key: 'type', label: L('Document', 'الوثيقة') },
    { key: 'no', label: L('Document no.', 'رقم الوثيقة') },
    { key: 'exp', label: L('Expiry', 'تاريخ الانتهاء') },
    { key: 'days', label: L('Days left', 'الأيام المتبقية') },
    { key: 'band', label: L('Status', 'الحالة') }
  ];
  const items = filtered(rows).map(r => ({
    code: r.code,
    name: r.name,
    dept: deptName(r.dept),
    type: t(DOC_KEY[r.type]),
    no: r.no || '',
    exp: r.exp,
    days: r.days,
    band: t(BAND_KEY[r.band])
  }));
  exportData('csv', 'renewals.csv', cols, items);
}

// ── Boot ──

export function initRenewals() {
  const root = document.querySelector('[data-hr-renewals]');
  if (!root) {
    return;
  }
  buildDeptOptions();
  syncFilters();
  renderAll();

  const btn = document.getElementById('rx-filter-btn');
  const pop = document.getElementById('rx-filter-pop');
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
    if (e.target.closest('#rx-filter-pop, #rx-filter-btn')) {
      return;
    }
    togglePop(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop && !pop.hasAttribute('hidden')) {
      togglePop(false);
    }
  });
  document.getElementById('rx-filter-clear')?.addEventListener('click', () => {
    clearFilters();
    togglePop(false);
  });
  document.getElementById('rx-export')?.addEventListener('click', () => exportCsv(docRows()));
  ['rx-type', 'rx-band', 'rx-dept'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      syncFilters();
      renderAll();
    });
  });

  root.addEventListener('click', e => {
    const seg = e.target.closest('[data-rx-seg]');
    if (seg) {
      const typeSel = document.getElementById('rx-type');
      const bandSel = document.getElementById('rx-band');
      if (typeSel) {
        typeSel.value = seg.dataset.rxType;
      }
      if (bandSel) {
        bandSel.value = seg.dataset.rxSeg;
      }
      syncFilters();
      renderAll();
      return;
    }
    const empView = e.target.closest('[data-emp-view]');
    if (empView) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = `employee-file.html?code=${encodeURIComponent(empView.dataset.empView)}`;
      return;
    }
    const renewBtn = e.target.closest('[data-rx-renew]');
    if (renewBtn) {
      const tr = renewBtn.closest('tr');
      const rows = docRows();
      const row = rows.find(r => r.code === tr?.dataset.code && r.type === tr?.dataset.type);
      if (row) {
        openRenew(row);
      }
    }
  });

  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    buildDeptOptions();
    renderAll();
  });

  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
