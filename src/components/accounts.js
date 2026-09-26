// goHR — Accounts (accounts.html). One screen over the finance data the
// rail no longer links directly: AR aging (INVOICES), expense rollup
// (EXPENSES) and per-client margin (CLIENTS + SECONDMENTS + EMPLOYEES).
// Aggregation only — the statutory engines stay the source of the math,
// and the margin model mirrors profitability.js so the two agree.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { INVOICES, EXPENSES, CLIENTS, SECONDMENTS, EMPLOYEES } from './hr-seed.js';
import { arAging, expenseRollup, clientMargin } from './accounts-helpers.js';
import { fmtSAR } from './hr-locale.js';
import { escapeHtml as esc } from './markup.js';

let booted = false;

const isoToday = () => new Date().toISOString().slice(0, 10);

function tableOpen(label, headers) {
  return `<div class="table-responsive"><table class="table hr-table" aria-label="${esc(label)}"><thead><tr>${
    headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')
  }</tr></thead><tbody>`;
}
const tableClose = '</tbody></table></div>';

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="caption-muted">${esc(t('common.noData'))}</td></tr>`;
}

function agingTable(rows) {
  const html = rows.map(r => `
    <tr>
      <td>${esc(r.id)}</td>
      <td>${esc(r.client)}</td>
      <td>${esc(r.due || '—')}</td>
      <td class="cell-strong">${esc(fmtSAR(r.total))}</td>
      <td>${r.overdue ? `<span class="status status-red">${esc(t('acc.overdue'))}</span>` : esc(t('acc.current'))}</td>
    </tr>`).join('');
  return tableOpen(t('acc.aging'), [t('acc.colInvoice'), t('acc.colClient'), t('acc.colDue'), t('acc.colAmount'), t('acc.colStatus')])
    + (rows.length ? html : emptyRow(5)) + tableClose;
}

function categoryTable(byCategory) {
  const html = byCategory.map(c => `
    <tr>
      <td>${esc(c.cat)}</td>
      <td class="cell-strong">${esc(fmtSAR(c.amount))}</td>
      <td>${esc(fmtSAR(c.vat))}</td>
    </tr>`).join('');
  return tableOpen(t('acc.byCategory'), [t('acc.colCategory'), t('acc.colAmount'), t('acc.vat')])
    + (byCategory.length ? html : emptyRow(3)) + tableClose;
}

function clientTable(list) {
  const html = list.map(c => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${esc(fmtSAR(c.revenue))}</td>
      <td>${esc(fmtSAR(c.cost))}</td>
      <td class="cell-strong">${esc(fmtSAR(c.margin))}</td>
    </tr>`).join('');
  return tableOpen(t('acc.byClient'), [t('acc.colClient'), t('acc.revenue'), t('acc.cost'), t('acc.margin')])
    + (list.length ? html : emptyRow(4)) + tableClose;
}

function paint(root) {
  const ar = arAging(INVOICES, isoToday());
  const ex = expenseRollup(EXPENSES);
  const margin = clientMargin(CLIENTS, SECONDMENTS, EMPLOYEES, INVOICES, currentLang());
  const revenue = margin.reduce((s, c) => s + c.revenue, 0);
  const cost = margin.reduce((s, c) => s + c.cost, 0);
  const net = Math.round((revenue - cost) * 100) / 100;

  const set = (sel, v) => {
    const el = root.querySelector(sel);
    if (el) {el.textContent = v;}
  };
  set('#acc-stat-ar', fmtSAR(ar.total));
  set('#acc-stat-ar-sub', `${t('acc.current')} ${fmtSAR(ar.current)} · ${t('acc.overdue')} ${fmtSAR(ar.overdue)}`);
  set('#acc-stat-exp', fmtSAR(ex.paid));
  set('#acc-stat-exp-sub', `${t('acc.committed')} ${fmtSAR(ex.committed)} · ${t('acc.vat')} ${fmtSAR(ex.vat)}`);
  set('#acc-stat-margin', fmtSAR(net));
  set('#acc-stat-margin-sub', `${t('acc.revenue')} ${fmtSAR(revenue)} · ${t('acc.cost')} ${fmtSAR(cost)}`);

  const aging = root.querySelector('#acc-aging');
  if (aging) {aging.innerHTML = agingTable(ar.rows);}
  const expEl = root.querySelector('#acc-expenses');
  if (expEl) {expEl.innerHTML = categoryTable(ex.byCategory);}
  const cl = root.querySelector('#acc-clients');
  if (cl) {cl.innerHTML = clientTable(margin);}

  }

export function initAccounts() {
  if (booted) {
    return;
  }
  booted = true;
  const root = document.querySelector('[data-hr-accounts]');
  if (!root) {
    return;
  }
  applyI18n();
  paint(root);
  window.addEventListener(LANG_EVENT, () => paint(root));
}
