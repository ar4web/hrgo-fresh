// goHR — file manager (files.html). Document vault: per-employee and
// category filing with expiry tracking, letter snapshots from the document
// generator, text/image previews, downloads, rename/delete, multi-file
// upload (data URLs capped at 2 MB, stored in this browser) and a storage
// meter. Expiry chips reuse the statutory expiryBand engine.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, setText, renderPageMeta } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DOCUMENTS, EMPLOYEES } from './hr-seed.js';
import { daysUntil, expiryBand, getSettings } from './hr-statutory.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);
const MAX_FILE = 2 * 1024 * 1024; // 2 MB per file (localStorage-backed)

const CATS = ['letters', 'contracts', 'government', 'insurance', 'certificates', 'payroll', 'misc'];
const CAT_KEY = {
  letters: 'fm.catLetters',
  contracts: 'fm.catContracts',
  government: 'fm.catGovernment',
  insurance: 'fm.catInsurance',
  certificates: 'fm.catCertificates',
  payroll: 'fm.catPayroll',
  misc: 'fm.catMisc'
};
const BAND_CLS = { expired: 'red', critical: 'red', urgent: 'yellow', soon: 'blue', ok: 'green', missing: 'blue' };
const BAND_KEY = { expired: 'rx.bExpired', critical: 'rx.bCritical', urgent: 'rx.bUrgent', soon: 'rx.bSoon', ok: 'rx.bValid' };

let booted = false;
let dataTable = null;
let dataTableMounting = null;
let filters = { q: '', emp: '', cat: '', expOnly: false };
let cwd = null; // current folder id (null = root)

// ── Folders ──

function folders() {
  return getSeed('filefolders').filter(f => !f.deleted);
}
function childFolders(pid) {
  return folders().filter(f => (f.parentId || null) === pid).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function filesIn(pid) {
  return entries().filter(r => (r.folderId || null) === pid);
}
function descendantIds(id) {
  const out = [];
  const walk = (p) => {
    for (const f of folders().filter(x => (x.parentId || null) === p)) {
      out.push(f.id);
      walk(f.id);
    }
  };
  walk(id);
  return out;
}
function pathOf(id) {
  const chain = [];
  let cur = folders().find(f => f.id === id);
  while (cur) {
    chain.unshift(cur);
    cur = folders().find(f => f.id === (cur.parentId || null));
  }
  return chain;
}
function hasFilter() {
  return !!(filters.q || filters.emp || filters.cat || filters.expOnly);
}
/** Indented <option> tree of folders for move / upload pickers. */
function folderOptions(excludeIds = [], selected = null) {
  const opts = [`<option value="" ${!selected ? 'selected' : ''}>${esc(t('fm.rootOpt'))}</option>`];
  const walk = (pid, depth) => {
    for (const f of childFolders(pid)) {
      if (excludeIds.includes(f.id)) {continue;}
      opts.push(`<option value="${esc(f.id)}" ${selected === f.id ? 'selected' : ''}>${'— '.repeat(depth)}${esc(f.name)}</option>`);
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return opts.join('');
}

// ── Data ──

function entries() {
  return getSeed('fileentries').filter(r => !r.deleted);
}
function empOf(code) {
  return EMPLOYEES.find(e => e.code === code);
}
function empName(code) {
  const e = empOf(code);
  if (!e) {
    return code || '—';
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}
function entryName(r) {
  return currentLang() === 'ar' ? r.nameAr || r.name : r.name;
}
function fmtBytes(n) {
  const b = Number(n) || 0;
  if (b >= 1048576) {
    return `${(b / 1048576).toFixed(1)} MB`;
  }
  if (b >= 1024) {
    return `${Math.round(b / 1024)} KB`;
  }
  return `${fmtInt(b)} B`;
}
function letterOf(r) {
  return r.letterRef ? DOCUMENTS.find(d => d.id === r.letterRef) : null;
}
function sizeOf(r) {
  if (r.kind === 'letter') {
    const l = letterOf(r);
    return l ? (l.renderedEn.length + l.renderedAr.length) : 0;
  }
  if (r.dataUrl) {
    return Math.round((r.dataUrl.length * 3) / 4);
  }
  return Number(r.size) || 0;
}
function storageUsed() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('hr:import:fileentries')) {
        bytes += (localStorage.getItem(k) || '').length;
      }
    }
  } catch (_e) {
    /* private mode */
  }
  return bytes;
}

// ── Stats ──

function renderStats(rows) {
  const expiring = rows.filter(r => r.expiry && expiryBand(daysUntil(r.expiry, isoToday())) !== 'ok').length;
  const emps = new Set(rows.filter(r => r.emp).map(r => r.emp)).size;
  const used = storageUsed();
  const pct = Math.min(100, Math.round((used / (4.5 * 1024 * 1024)) * 100));
  setText('fm-stat-total', fmtInt(rows.length));
  setText('fm-stat-expiring', fmtInt(expiring));
  setText('fm-stat-emps', fmtInt(emps));
  setText('fm-stat-storage', `${pct}%`);
  renderPageMeta([
    `${fmtInt(rows.length)} ${t('fm.total')}`,
    `${fmtInt(expiring)} ${t('fm.expiring')}`,
    `${fmtInt(emps)} ${t('fm.employees')}`
  ]);
}

// ── Table ──

function filtered(rows) {
  const q = filters.q.toLowerCase();
  return rows
    .filter(r => {
      if (q && !entryName(r).toLowerCase().includes(q)) {
        return false;
      }
      if (filters.emp && r.emp !== filters.emp) {
        return false;
      }
      if (filters.cat && r.cat !== filters.cat) {
        return false;
      }
      if (filters.expOnly) {
        if (!r.expiry || expiryBand(daysUntil(r.expiry, isoToday())) === 'ok') {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
  const tbody = document.getElementById('fm-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  const all = entries();
  const rows = hasFilter() ? filtered(all) : filtered(filesIn(cwd));
  const count = document.getElementById('fm-count');
  if (count) {
    count.textContent = hasFilter()
      ? `${fmtInt(rows.length)} ${t('fm.searchAll')}`
      : t('rx.count').replace('{n}', fmtInt(rows.length)).replace('{total}', fmtInt(all.length));
  }
  const IC = {
    letter: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
    file: '<path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/>'
  };
  tbody.innerHTML =
    rows
      .map(r => {
        const e = r.emp ? empOf(r.emp) : null;
        const band = r.expiry ? expiryBand(daysUntil(r.expiry, isoToday())) : 'missing';
        const isPdf = (r.mime || '').includes('pdf');
        const typeTag = r.kind === 'letter' ? 'TXT' : isPdf ? 'PDF' : (r.mime || '').includes('image') ? 'IMG' : 'FILE';
        const expCell = r.expiry
          ? `<span class="status status-${BAND_CLS[band]}">${esc(fmtDate(r.expiry))}${band !== 'ok' ? ` · ${esc(t(BAND_KEY[band]))}` : ''}</span>`
          : `<span style="color:var(--text-muted)">${esc(t('fm.noExpiry'))}</span>`;
        const actions =
          `<button class="card-opt-btn" data-fm-view="${esc(r.id)}" aria-label="${esc(t('fm.view'))}" data-tooltip="${esc(t('fm.view'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>` +
          `<button class="card-opt-btn" data-fm-move="${esc(r.id)}" aria-label="${esc(t('fm.move'))}" data-tooltip="${esc(t('fm.move'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><path d="M12 11v6M9 14l3 3 3-3"/></svg></button>` +
          `<button class="card-opt-btn" data-fm-dl="${esc(r.id)}" aria-label="${esc(t('fm.download'))}" data-tooltip="${esc(t('fm.download'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg></button>` +
          (r.kind === 'record' && !r.dataUrl
            ? `<button class="card-opt-btn" data-fm-replace="${esc(r.id)}" aria-label="${esc(t('fm.replace'))}" data-tooltip="${esc(t('fm.replace'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg></button>`
            : '') +
          `<button class="card-opt-btn" data-fm-ren="${esc(r.id)}" aria-label="${esc(t('fm.rename'))}" data-tooltip="${esc(t('fm.rename'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>` +
          `<button class="card-opt-btn" data-fm-del="${esc(r.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>`;
        return `
    <tr data-id="${esc(r.id)}">
      <td style="min-width:220px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[e?.av] || 'var(--avatar-azure)'};color:white;width:34px;height:34px;font-size:10px">${esc(typeTag)}</div>
          <div>
            <div class="cell-strong" style="white-space:normal;line-height:1.4">${esc(entryName(r))}</div>
            ${r.kind === 'letter' ? `<div class="caption-muted" style="font-size:11px">${esc(t('fm.letterRef'))}${r.letterRef ? ` · ${esc(r.letterRef)}` : ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${r.emp ? esc(empName(r.emp)) : r.client ? `<span class="cell-mono">${esc(r.client)}</span>` : '—'}</td>
      <td style="font-size:12.5px">${esc(t(CAT_KEY[r.cat] || 'fm.catMisc'))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtBytes(sizeOf(r)))}</td>
      <td style="font-size:12.5px">${expCell}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.createdAt))}</td>
      <td class="emp-actions-cell">${actions}</td>
    </tr>`;
      })
      .join('');
  void mountDataTable();
}

function renderAll() {
  renderStats(entries());
  renderCrumbs();
  renderFolders();
  renderRows();
}

// ── Filters ──

function buildFilterOptions() {
  const empSel = document.getElementById('fm-emp');
  if (empSel) {
    const cur = empSel.value;
    const withFiles = [...new Set(entries().filter(r => r.emp).map(r => r.emp))].sort();
    empSel.innerHTML =
      `<option value="">${esc(t('common.all'))}</option>` +
      withFiles.map(c => `<option value="${esc(c)}">${esc(empName(c))}</option>`).join('');
    empSel.value = cur;
    if (empSel.value !== cur) {
      empSel.value = '';
      filters.emp = '';
    }
  }
  const catSel = document.getElementById('fm-cat');
  if (catSel) {
    const cur = catSel.value;
    catSel.innerHTML =
      `<option value="">${esc(t('common.all'))}</option>` +
      CATS.map(c => `<option value="${c}">${esc(t(CAT_KEY[c]))}</option>`).join('');
    catSel.value = cur;
  }
}

function syncFilters() {
  filters = {
    q: document.getElementById('fm-q')?.value?.trim() || '',
    emp: document.getElementById('fm-emp')?.value || '',
    cat: document.getElementById('fm-cat')?.value || '',
    expOnly: !!document.getElementById('fm-exp-only')?.checked
  };
}

// ── Preview / download ──

function letterText(r) {
  const l = letterOf(r);
  if (!l) {
    return { en: '', ar: '' };
  }
  const strip = html => html.replace(/<span class="tok-missing">|<\/span>/g, m => (m.startsWith('<span') ? '{{' : ''));
  return { en: strip(l.renderedEn), ar: strip(l.renderedAr) };
}

function openView(r) {
  const letter = letterOf(r);
  let body;
  if (r.kind === 'letter' && letter) {
    const txt = letterText(r);
    body = `
      <div class="fm-preview-note">${esc(t('fm.letterRef'))} · ${esc(r.letterRef || '')}</div>
      <div class="doc-paper" dir="ltr"><div class="doc-body doc-body--en">${esc(txt.en)}</div></div>
      <div class="doc-paper" dir="rtl" style="margin-top:var(--space-3)"><div class="doc-body doc-body--ar">${esc(txt.ar)}</div></div>`;
  } else if (r.dataUrl && (r.mime || '').startsWith('image/')) {
    body = `<div style="text-align:center"><img src="${r.dataUrl}" alt="${esc(entryName(r))}" style="max-width:100%;max-height:60vh;border-radius:8px"></div>`;
  } else if (r.dataUrl) {
    body = `<div class="fm-preview-note">${esc(t('fm.download'))} → ${esc(fmtBytes(sizeOf(r)))}</div>`;
  } else {
    body = `
      <div class="fm-preview-note">${esc(t('fm.replaceHint'))}</div>
      <div class="doc-meta">
        <div><span>${esc(t('fm.category'))}</span><strong>${esc(t(CAT_KEY[r.cat] || 'fm.catMisc'))}</strong></div>
        <div><span>${esc(t('fm.expiryH'))}</span><strong>${r.expiry ? esc(fmtDate(r.expiry)) : esc(t('fm.noExpiry'))}</strong></div>
        ${r.emp ? `<div><span>${esc(t('fm.employee'))}</span><strong>${esc(empName(r.emp))}</strong></div>` : ''}
      </div>`;
  }
  showModal({
    title: entryName(r),
    size: 'lg',
    body,
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      ...(r.kind === 'letter'
        ? [{ label: t('fm.openInDocs'), variant: 'ghost', action: () => { window.location.href = 'documents.html'; return false; } }]
        : []),
      {
        label: t('fm.download'),
        variant: 'primary',
        action: () => {
          download(r);
          return false;
        }
      }
    ]
  });
}

function download(r) {
  try {
    let href = r.dataUrl;
    let name = `${entryName(r).replace(/[\\/:*?"<>|]/g, '_')}`;
    if (r.kind === 'letter') {
      const txt = letterText(r);
      const current = currentLang() === 'ar' ? txt.ar : txt.en;
      const blob = new window.Blob([current], { type: 'text/plain;charset=utf-8' });
      href = window.URL.createObjectURL(blob);
      name += '.txt';
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(href), 500);
      showToast(t('fm.toastDownloaded'), { variant: 'success' });
      return;
    }
    if (!href) {
      showToast(t('fm.replaceHint'), { variant: 'info' });
      return;
    }
    const ext = (r.mime || '').includes('pdf') ? '.pdf' : (r.mime || '').includes('image') ? '.jpg' : '';
    name += ext || '';
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(t('fm.toastDownloaded'), { variant: 'success' });
  } catch (_e) {
    /* no download host (sandboxed iframe) */
  }
}

// ── Rename / delete ──

function openRename(r) {
  showModal({
    title: t('fm.rename'),
    body: `<label class="modal-form-row"><span>${esc(t('fm.nameH'))}</span><input type="text" class="form-control" id="fm-ren-input" value="${esc(entryName(r))}"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: () => {
          const v = document.getElementById('fm-ren-input')?.value?.trim();
          if (!v) {
            return false;
          }
          const patch = currentLang() === 'ar' ? { nameAr: v } : { name: v };
          saveImportedRows('fileentries', [{ ...r, ...patch }]);
          showToast(t('fm.toastRenamed'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

// ── Upload ──

function openUpload(replaceRow) {
  const empOpts =
    `<option value="">${esc(t('doc.none'))}</option>` +
    EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob')
      .map(e => `<option value="${esc(e.code)}" ${replaceRow?.emp === e.code ? 'selected' : ''}>${esc(currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn)} · ${esc(e.code)}</option>`)
      .join('');
  showModal({
    title: replaceRow ? t('fm.replace') : t('fm.uploadTitle'),
    body: `
      ${replaceRow ? `<div class="fm-preview-note">${esc(entryName(replaceRow))} · ${esc(t('fm.replaceHint'))}</div>` : ''}
      <label class="modal-form-row"><span>${esc(t('fm.pickFiles'))}</span><input type="file" class="form-control" id="fm-file-input" multiple></label>
      <label class="modal-form-row"><span>${esc(t('fm.nameH'))}</span><input type="text" class="form-control" id="fm-file-name" placeholder="${esc(t('fm.searchPh'))}"></label>
      <label class="modal-form-row"><span>${esc(t('fm.employee'))}</span><select class="form-control" id="fm-file-emp">${empOpts}</select></label>
      ${replaceRow ? '' : `<label class="modal-form-row"><span>${esc(t('fm.moveTo'))}</span><select class="form-control" id="fm-file-folder">${folderOptions([], cwd)}</select></label>`}
      <div class="dc-form-2col">
        <label class="modal-form-row"><span>${esc(t('fm.category'))}</span><select class="form-control" id="fm-file-cat">${CATS.map(c => `<option value="${c}" ${(replaceRow?.cat || 'misc') === c ? 'selected' : ''}>${esc(t(CAT_KEY[c]))}</option>`).join('')}</select></label>
        <label class="modal-form-row"><span>${esc(t('fm.expiryH'))}</span><input type="date" class="form-control" id="fm-file-exp" value="${replaceRow?.expiry || ''}"></label>
      </div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('fm.upload'),
        variant: 'primary',
        action: () => {
          const input = document.getElementById('fm-file-input');
          const files = [...(input?.files || [])];
          const nameOverride = document.getElementById('fm-file-name')?.value?.trim();
          const emp = document.getElementById('fm-file-emp')?.value || replaceRow?.emp || '';
          const cat = document.getElementById('fm-file-cat')?.value || 'misc';
          const expiry = document.getElementById('fm-file-exp')?.value || '';
          const folder = replaceRow ? (replaceRow.folderId || null) : (document.getElementById('fm-file-folder')?.value || null);
          if (!files.length) {
            return false;
          }
          let nextNo = entries().reduce((mx, r) => Math.max(mx, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
          let saved = 0;
          let pending = files.length;
          for (const file of files) {
            const maxMB = Number(getSettings().prefs && getSettings().prefs.files ? getSettings().prefs.files.maxMB : NaN);
            if (file.size > (Number.isFinite(maxMB) && maxMB > 0 ? maxMB : 2) * 1024 * 1024) {
              showToast(t('fm.tooBig').replace('{name}', file.name), { variant: 'warning' });
              pending -= 1;
              continue;
            }
            const reader = new FileReader();
            reader.onload = () => {
              nextNo += 1;
              const id = `F-${String(nextNo).padStart(4, '0')}`;
              const base = {
                id,
                kind: 'file',
                name: nameOverride || file.name,
                emp,
                cat,
                expiry: expiry || null,
                folderId: folder,
                mime: file.type || 'application/octet-stream',
                dataUrl: String(reader.result || ''),
                createdAt: isoToday()
              };
              if (replaceRow) {
                saveImportedRows('fileentries', [{ ...replaceRow, ...base, id: replaceRow.id, nameAr: replaceRow.nameAr }]);
              } else {
                saveImportedRows('fileentries', [base]);
              }
              saved += 1;
              if (saved === pending) {
                showToast(t('fm.toastUploaded').replace('{n}', fmtInt(saved)), { variant: 'success' });
                buildFilterOptions();
                renderAll();
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    ]
  });
}

// ── Folders: crumbs, grid, modals ──

function renderCrumbs() {
  const nav = document.getElementById('fm-crumbs');
  if (!nav) {return;}
  const chain = pathOf(cwd);
  const crumb = (label, id, isLast) =>
    `<button class="fm-crumb${isLast ? ' current' : ''}" type="button" data-fm-cwd="${id || ''}">${esc(label)}</button>`;
  nav.innerHTML = crumb(t('fm.root'), null, !chain.length)
    + chain.map((f, i) => `<span class="fm-crumb-sep">/</span>` + crumb(f.name, f.id, i === chain.length - 1)).join('');
}

function renderFolders() {
  const grid = document.getElementById('fm-folders');
  if (!grid) {return;}
  const wrap = document.getElementById('fm-nav');
  if (wrap) {wrap.hidden = hasFilter();}
  if (hasFilter()) {
    grid.innerHTML = '';
    return;
  }
  const kids = childFolders(cwd);
  if (!kids.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = kids.map((f) => {
    const n = filesIn(f.id).length + childFolders(f.id).length;
    return `
    <div class="fm-folder-tile" data-fm-open="${esc(f.id)}" role="button" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
      <div class="fm-folder-meta">
        <div class="fm-folder-name">${esc(f.name)}</div>
        <div class="caption-muted" style="font-size:11px">${fmtInt(n)} ${esc(t('fm.items'))}</div>
      </div>
      <div class="fm-folder-actions">
        <button class="card-opt-btn" data-fm-fmove="${esc(f.id)}" aria-label="${esc(t('fm.move'))}" data-tooltip="${esc(t('fm.move'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 19V7M6 11l6-6 6 6"/><path d="M5 21h14"/></svg></button>
        <button class="card-opt-btn" data-fm-fren="${esc(f.id)}" aria-label="${esc(t('fm.rename'))}" data-tooltip="${esc(t('fm.rename'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
        <button class="card-opt-btn" data-fm-fdel="${esc(f.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </div>
    </div>`;
  }).join('');
}

function nextFolderId() {
  let mx = 0;
  for (const f of getSeed('filefolders')) {
    mx = Math.max(mx, Number(String(f.id).replace(/\D/g, '')) || 0);
  }
  return `FD-${String(mx + 1).padStart(3, '0')}`;
}

function openNewFolder() {
  showModal({
    title: t('fm.newFolder'),
    body: `<label class="modal-form-row"><span>${esc(t('fm.folderName'))}</span><input type="text" class="form-control" id="fm-folder-name"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: () => {
          const v = document.getElementById('fm-folder-name')?.value?.trim();
          if (!v) {
            return false;
          }
          saveImportedRows('filefolders', [{ id: nextFolderId(), name: v, parentId: cwd, createdAt: isoToday() }]);
          showToast(t('fm.toastFolderCreated'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

function openRenameFolder(f) {
  showModal({
    title: t('fm.rename'),
    body: `<label class="modal-form-row"><span>${esc(t('fm.folderName'))}</span><input type="text" class="form-control" id="fm-folder-name" value="${esc(f.name)}"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: () => {
          const v = document.getElementById('fm-folder-name')?.value?.trim();
          if (!v) {
            return false;
          }
          saveImportedRows('filefolders', [{ ...f, name: v }]);
          showToast(t('fm.toastRenamed'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

function openDeleteFolder(f) {
  if (filesIn(f.id).length || childFolders(f.id).length) {
    showToast(t('fm.toastNotEmpty'), { variant: 'warning' });
    return;
  }
  if (!window.confirm(t('doc.confirmDelete'))) {
    return;
  }
  saveImportedRows('filefolders', [{ ...f, deleted: true }]);
  if (cwd === f.id) {
    cwd = f.parentId || null;
  }
  showToast(t('fm.toastFolderDeleted'), { variant: 'success' });
  renderAll();
}

/** Move a file or a folder into another folder (never into itself/descendants). */
function openMove(kind, row) {
  const isFolder = kind === 'folder';
  const exclude = isFolder ? [row.id, ...descendantIds(row.id)] : [];
  const current = isFolder ? (row.parentId || null) : (row.folderId || null);
  showModal({
    title: `${t('fm.moveTo')} · ${isFolder ? row.name : entryName(row)}`,
    body: `<label class="modal-form-row"><span>${esc(t('fm.moveTo'))}</span><select class="form-control" id="fm-move-target">${folderOptions(exclude, current)}</select></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('fm.move'),
        variant: 'primary',
        action: () => {
          const v = document.getElementById('fm-move-target')?.value || null;
          if (isFolder) {
            saveImportedRows('filefolders', [{ ...row, parentId: v }]);
          } else {
            saveImportedRows('fileentries', [{ ...row, folderId: v }]);
          }
          showToast(t('fm.toastMoved'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

// ── Boot ──

export function initFiles() {
  const root = document.querySelector('[data-hr-files]');
  if (!root) {
    return;
  }
  buildFilterOptions();
  syncFilters();
  renderAll();
  ['fm-q', 'fm-emp', 'fm-cat'].forEach(id => {
    const ev = id === 'fm-q' ? 'input' : 'change';
    document.getElementById(id)?.addEventListener(ev, () => {
      syncFilters();
      renderAll();
    });
  });
  document.getElementById('fm-exp-only')?.addEventListener('change', () => {
    syncFilters();
    renderAll();
  });
  document.getElementById('fm-upload')?.addEventListener('click', () => openUpload(null));
  document.getElementById('fm-newfolder')?.addEventListener('click', () => openNewFolder());
  root.addEventListener('click', e => {
    const fdel = e.target.closest('[data-fm-fdel]');
    if (fdel) {
      const f = folders().find(x => x.id === fdel.dataset.fmFdel);
      if (f) {
        openDeleteFolder(f);
      }
      return;
    }
    const fren = e.target.closest('[data-fm-fren]');
    if (fren) {
      const f = folders().find(x => x.id === fren.dataset.fmFren);
      if (f) {
        openRenameFolder(f);
      }
      return;
    }
    const fmove = e.target.closest('[data-fm-fmove]');
    if (fmove) {
      const f = folders().find(x => x.id === fmove.dataset.fmFmove);
      if (f) {
        openMove('folder', f);
      }
      return;
    }
    const fopen = e.target.closest('[data-fm-open]');
    if (fopen) {
      cwd = fopen.dataset.fmOpen || null;
      renderAll();
      return;
    }
    const cwdBtn = e.target.closest('[data-fm-cwd]');
    if (cwdBtn) {
      cwd = cwdBtn.dataset.fmCwd || null;
      renderAll();
      return;
    }
    const mv = e.target.closest('[data-fm-move]');
    if (mv) {
      const r = entries().find(x => x.id === mv.dataset.fmMove);
      if (r) {
        openMove('file', r);
      }
      return;
    }
    const view = e.target.closest('[data-fm-view]');
    if (view) {
      const r = entries().find(x => x.id === view.dataset.fmView);
      if (r) {
        openView(r);
      }
      return;
    }
    const dl = e.target.closest('[data-fm-dl]');
    if (dl) {
      const r = entries().find(x => x.id === dl.dataset.fmDl);
      if (r) {
        download(r);
      }
      return;
    }
    const ren = e.target.closest('[data-fm-ren]');
    if (ren) {
      const r = entries().find(x => x.id === ren.dataset.fmRen);
      if (r) {
        openRename(r);
      }
      return;
    }
    const repl = e.target.closest('[data-fm-replace]');
    if (repl) {
      const r = entries().find(x => x.id === repl.dataset.fmReplace);
      if (r) {
        openUpload(r);
      }
      return;
    }
    const del = e.target.closest('[data-fm-del]');
    if (del) {
      const r = entries().find(x => x.id === del.dataset.fmDel);
      if (r && window.confirm(t('doc.confirmDelete'))) {
        saveImportedRows('fileentries', [{ ...r, deleted: true }]);
        showToast(t('fm.toastDeleted'), { variant: 'success' });
        buildFilterOptions();
        renderAll();
      }
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    buildFilterOptions();
    renderAll();
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
