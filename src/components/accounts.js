// goHR — Accounts (accounts.html). One screen over the finance data the
// rail no longer links directly: AR aging (INVOICES), expense rollup
// (EXPENSES) and per-client margin (CLIENTS + SECONDMENTS + EMPLOYEES).
// Aggregation only — the statutory engines stay the source of the math.

import { t, LANG_EVENT, applyI18n } from './i18n.js';
import { INVOICES, EXPENSES, CLIENTS, SECONDMENTS, EMPLOYEES } from './hr-seed.js';
import { arAging, expenseRollup, clientMargin } from './accounts-helpers.js';
import { escapeHtml as esc } from './markup.js';

let booted = false;

function isoToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function agingRows(rows) {
  if (!rows.length) {
    return `<div class="caption-muted">${esc(t('common.noData'))}</div>`;
  }
  return rows.map(r => `
    <div class="hr-kv">
      <div>${esc(r.id)}</div>
      <div>${esc(r.client)}</div>
      <div>${esc(r.due || '—')}</div>
      <div class="cell-strong">${esc(r.total)}${r.overdue ? ` · ${esc(t('acc.overdue'))}` : ''}</div>
    </div>`).join('');
}

function categoryRows(byCategory) {
  if (!byCategory.length) {
    return `<div class="caption-muted">${esc(t('common.noData'))}</div>`;
  }
  return byCategory.map(c => `
    <div class="hr-kv">
      <div>${esc(c.cat)}</div>
      <div class="cell-strong">${esc(c.amount)}</div>
      <div class="caption-muted">VAT ${esc(c.vat)}</div>
    </div>`).join('');
}

function clientRows(list) {
  if (!list.length) {
    return `<div class="caption-muted">${esc(t('common.noData'))}</div>`;
  }
  return list.map(c => `
    <div class="hr-kv">
      <div>${esc(c.name)}</div>
      <div>${esc(c.revenue)}</div>
      <div>${esc(c.cost)}</div>
      <div class="cell-strong">${esc(c.margin)}</div>
    </div>`).join('');
}

function paint(root) {
  const ar = arAging(INVOICES, isoToday());
  const ex = expenseRollup(EXPENSES);
  const margin = clientMargin(CLIENTS, SECONDMENTS, EMPLOYEES);
  const revenue = margin.reduce((s, c) => s + c.revenue, 0);
  const cost = margin.reduce((s, c) => s + c.cost, 0);

  const set = (id, v) => {
    const el = root.querySelector(id);
    if (el) {el.textContent = v;}
  };
  set('#acc-stat-ar', ar.total);
  set('#acc-stat-ar-sub', `${t('acc.current')} ${ar.current} · ${t('acc.overdue')} ${ar.overdue}`);
  set('#acc-stat-exp', ex.total);
  set('#acc-stat-exp-sub', `${t('acc.vat')} ${ex.vat}`);
  set('#acc-stat-margin', Math.round((revenue - cost) * 100) / 100);
  set('#acc-stat-margin-sub', `${t('acc.revenue')} ${revenue} · ${t('acc.cost')} ${cost}`);

  const aging = root.querySelector('#acc-aging');
  if (aging) {aging.innerHTML = agingRows(ar.rows);}
  const expEl = root.querySelector('#acc-expenses');
  if (expEl) {expEl.innerHTML = categoryRows(ex.byCategory);}
  const cl = root.querySelector('#acc-clients');
  if (cl) {cl.innerHTML = clientRows(margin);}
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
