// HR + Operations — shared file-import modal (Excel / CSV).
// One helper for every list page: template download + validated parse + save.
// `onImport(rows)` saves, re-renders and returns the saved count
// (or false to abort with its own message).

import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { t, currentLang } from './i18n.js';
import { importFile, templateCSV, templateXLSX } from './import-export.js';
import { escapeHtml as esc } from './markup.js';

export function openImportModal({ titleEn, titleAr, filename, schema, example, onImport }) {
  const lang = currentLang();
  showModal({
    title: lang === 'ar' ? titleAr : titleEn,
    size: 'lg',
    body: `
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button type="button" class="btn btn-outline btn-sm" data-tpl="csv">${t('common.template')} CSV</button>
        <button type="button" class="btn btn-outline btn-sm" data-tpl="xlsx">${t('common.template')} Excel</button>
      </div>
      <label class="btn btn-outline" style="cursor:pointer">${t('common.chooseFile')} (.xlsx, .csv)
        <input type="file" data-imp-file accept=".xlsx,.xls,.csv" hidden>
      </label>
      <div data-imp-result style="margin-top:12px;font-size:12.5px"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.import'),
        variant: 'primary',
        action: ({ body, close }) => {
          const pending = body._pending;
          if (!pending || !pending.rows.length) {
            showToast(t('imp.chooseValid'), {
              variant: 'warning'
            });
            return false;
          }
          if (pending.errors.length) {
            showToast(t('imp.fixErrors'), {
              variant: 'warning'
            });
            return false;
          }
          const n = onImport(pending.rows);
          if (n === false) {
            return false;
          }
          showToast(t('imp.importedRows').replace('{n}', n), {
            variant: 'success'
          });
          close();
          return true;
        }
      }
    ]
  });
  const dlg = document.querySelector('.modal-backdrop:last-child') || document;
  dlg.addEventListener('click', ev => {
    const tpl = ev.target.closest('[data-tpl]');
    if (!tpl) {
      return;
    }
    const cols = schema.map(f => ({ key: f.key, label: lang === 'ar' ? f.ar : f.en }));
    if (tpl.dataset.tpl === 'xlsx') {
      templateXLSX(filename, cols, example);
    } else {
      templateCSV(filename, cols, example);
    }
  });
  dlg.addEventListener('change', async ev => {
    const input = ev.target.closest('[data-imp-file]');
    if (!input || !input.files[0]) {
      return;
    }
    const box = dlg.querySelector('[data-imp-result]');
    box.textContent = '…';
    try {
      const res = await importFile(input.files[0], schema);
      const bodyEl = dlg.querySelector('.modal-body');
      if (bodyEl) {
        bodyEl._pending = res;
      }
      if (!res.rows.length) {
        box.innerHTML = `<span class="status status-red">${t('imp.zeroRows')}</span>`;
        return;
      }
      const errHtml = res.errors
        .slice(0, 10)
        .map(e => `<div>${t('imp.rowDetail')
            .replace('{row}', esc(e.row))
            .replace('{field}', esc(e.field))
            .replace('{message}', esc(e.message))}</div>`)
        .join('');
      box.innerHTML = `<span class="status status-${res.errors.length ? 'red' : 'green'}">${t('imp.rowsErrors')
        .replace('{rows}', res.rows.length)
        .replace('{errors}', res.errors.length)}</span><div style="margin-top:8px;color:var(--text-muted)">${errHtml}</div>`;
    } catch (_err) {
      box.innerHTML = `<span class="status status-red">${t('imp.parseError')}</span>`;
    }
  });
}
