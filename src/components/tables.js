// goHR — DataTables integration
// Dynamic-imports DataTables only when a [data-datatable] table is present.

import { showToast } from './toast.js';
import { download, csvCell } from './import-export.js';
import { t, LANG_EVENT } from './i18n.js';

const instances = [];
let DataTableCtor = null;

function tableLanguage() {
  return {
    search: '',
    searchPlaceholder: t('common.searchPh'),
    info: t('dt.info'),
    infoEmpty: t('dt.infoEmpty'),
    infoFiltered: t('dt.infoFiltered'),
    zeroRecords: t('dt.zero'),
    paginate: { previous: t('dt.previous'), next: t('dt.next') }
  };
}

function initOneTable(table) {
  if (table.dataset.dtInit === '1') {return null;}
  const columnDefs = [];
  table.querySelectorAll('thead th').forEach((th, i) => {
    if (th.dataset.orderable === 'false') {
      columnDefs.push({ targets: i, orderable: false });
    }
  });

  table.dataset.dtInit = '1';
  const dt = new DataTableCtor(table, {
    pageLength: parseInt(table.dataset.pageLength || '10', 10),
    lengthChange: false,
    searching: false,
    order: [],
    columnDefs,
    language: tableLanguage()
  });
  instances.push({ table, dt });

  if (table.hasAttribute('data-selectable') || hasRowCheckboxes(table)) {
    wireRowSelection(table);
  }
  if (table.hasAttribute('data-export')) {
    wireCsvExport(table, dt);
  }

  // DataTables emits its search input without an accessible name.
  const searchInput = table.closest('.dt-container')?.querySelector('.dt-search input');
  if (searchInput && !searchInput.hasAttribute('aria-label')) {
    searchInput.setAttribute('aria-label', t('dt.searchTable'));
  }
  return dt;
}

/**
 * Initialize DataTables on every `<table data-datatable>` on the page.
 * Reads `data-page-length` (default 10) on the table and `data-orderable="false"`
 * on individual `<th>` cells to disable sorting per column.
 *
 * Opt-in extras (just add the attribute to the `<table>`):
 * - `data-selectable` — wire row checkboxes (header checkbox = select all visible).
 * - `data-export="filename"` — show a CSV export button in the table card header.
 *
 * Lazily imports `datatables.net`; the import never fires on pages without a
 * matching table.
 * @returns {Promise<void>}
 */
export async function initTables() {
  let tables = document.querySelectorAll('table[data-datatable]:not([data-dt-init="1"])');
  if (!tables.length && !DataTableCtor) {return;}

  if (!DataTableCtor) {
    const mod = await import('datatables.net');
    DataTableCtor = mod.default;
    // Re-localize every table when the UI language flips (DataTables has no
    // runtime language setter — destroy and re-init, preserving no state).
    window.addEventListener(LANG_EVENT, () => {
      [...instances].forEach(({ table, dt }) => {
        if (!document.contains(table)) {return;}
        try { dt.destroy(false); } catch (_e) { /* already gone */ }
        delete table.dataset.dtInit;
      });
      for (let i = instances.length - 1; i >= 0; i--) {
        if (!document.contains(instances[i].table)) {instances.splice(i, 1);}
      }
      document.querySelectorAll('table[data-datatable]:not([data-dt-init="1"])').forEach(initOneTable);
    });
  }

  tables.forEach(initOneTable);
}

function hasRowCheckboxes(table) {
  return !!table.querySelector('thead input[type="checkbox"]');
}

function wireRowSelection(table) {
  const headerCb = table.querySelector('thead input[type="checkbox"]');

  const updateHeader = () => {
    if (!headerCb) {return;}
    const rowCbs = table.querySelectorAll('tbody input[type="checkbox"]');
    const checked = [...rowCbs].filter((c) => c.checked).length;
    headerCb.checked = checked > 0 && checked === rowCbs.length;
    headerCb.indeterminate = checked > 0 && checked < rowCbs.length;
    table.classList.toggle('has-selection', checked > 0);
    const counter = table.closest('.card')?.querySelector('.bulk-selection-count');
    if (counter) {counter.textContent = checked ? t('dt.selected').replace('{n}', String(checked)) : '';}
  };

  if (headerCb) {
    headerCb.addEventListener('change', () => {
      const rowCbs = table.querySelectorAll('tbody input[type="checkbox"]');
      rowCbs.forEach((c) => { c.checked = headerCb.checked; });
      updateHeader();
    });
  }
  table.addEventListener('change', (e) => {
    const cb = e.target.closest('tbody input[type="checkbox"]');
    if (!cb) {return;}
    updateHeader();
  });
}

function wireCsvExport(table, dt) {
  const filename = (table.dataset.export || 'export') + '.csv';
  // Find the export button. If a sibling already exists with [data-export-btn],
  // use it; otherwise inject a small button into the card header (next to the
  // existing actions, if any).
  let btn = table.closest('.card')?.querySelector('[data-export-btn]');
  if (!btn) {
    const header = table.closest('.card')?.querySelector('.card-header');
    if (!header) {return;}
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.setAttribute('data-export-btn', '');
    btn.textContent = t('an.exportCsv');
    let actions = header.querySelector('.card-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'card-actions';
      actions.style.setProperty('margin-inline-start', 'auto');
      header.appendChild(actions);
    }
    actions.appendChild(btn);
  }

  btn.addEventListener('click', () => {
    const rows = [];
    const headers = [];
    dt.columns().every(function () {
      const th = this.header();
      if (th && th.dataset.orderable === 'false' && !th.textContent.trim()) {
        headers.push(null); // skip checkbox/action columns
      } else {
        headers.push(th ? th.textContent.trim() : '');
      }
    });
    rows.push(headers.filter((h) => h !== null).map(csvCell).join(','));

    // Iterate filtered + sorted rows in display order. `indexes()` gives DT
    // indexes; `.row(i).node()` returns the underlying <tr>.
    const indexes = dt.rows({ search: 'applied', order: 'applied' }).indexes();
    for (let n = 0; n < indexes.length; n += 1) {
      const rowEl = dt.row(indexes[n]).node();
      if (!rowEl) {continue;}
      const cells = [];
      [...rowEl.cells].forEach((td, idx) => {
        if (headers[idx] === null) {return;}
        cells.push(csvCell(td.textContent.trim().replace(/\s+/g, ' ')));
      });
      rows.push(cells.join(','));
    }

    download(filename, rows.join('\n'), 'text/csv;charset=utf-8;');
    showToast(t('dt.exported').replace('{file}', filename), { variant: 'success' });
  });
}
