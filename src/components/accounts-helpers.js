// goHR — Accounts aggregations (pure, no DOM). Reused by accounts.js and
// pinned by tests/accounts.test.mjs. Null-safe on missing seed input.
//
// Margin mirrors the authoritative model in profitability.js: issued
// invoice revenue (sent + paid, VAT excluded) against deployed secondment
// cost (wages + employer GOSI), so Accounts and Profitability agree.
import { calcGosi } from './hr-statutory.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function arAging(invoices, todayIso) {
  const rows = [];
  let current = 0;
  let overdue = 0;
  for (const inv of invoices || []) {
    if (!inv || inv.status === 'paid' || inv.status === 'draft') {continue;}
    const amt = Number(inv.total) || 0;
    const late = !!(inv.due && todayIso && inv.due < todayIso);
    if (late) {overdue += amt;} else {current += amt;}
    rows.push({ id: inv.id, client: inv.client, due: inv.due || '', total: r2(amt), overdue: late });
  }
  return { current: r2(current), overdue: r2(overdue), total: r2(current + overdue), rows };
}

export function expenseRollup(expenses) {
  const map = new Map();
  const byStatus = {};
  let paid = 0;
  let committed = 0;
  let vat = 0;
  for (const e of expenses || []) {
    if (!e) {continue;}
    const amount = Number(e.amount) || 0;
    const v = Number(e.vat) || 0;
    // Only settled spend counts as spend; approved/pending are commitments.
    if (e.status === 'paid') {paid += amount;} else {committed += amount;}
    vat += v;
    byStatus[e.status || 'unknown'] = r2((byStatus[e.status || 'unknown'] || 0) + amount);
    const cur = map.get(e.cat) || { cat: e.cat, amount: 0, vat: 0 };
    cur.amount += amount;
    cur.vat += v;
    map.set(e.cat, cur);
  }
  const byCategory = [...map.values()]
    .map(c => ({ cat: c.cat, amount: r2(c.amount), vat: r2(c.vat) }))
    .sort((a, b) => b.amount - a.amount);
  return {
    total: r2(paid),
    paid: r2(paid),
    committed: r2(committed),
    vat: r2(vat),
    byCategory,
    byStatus
  };
}

function headCost(emp) {
  const wage = (Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0);
  const g = calcGosi({
    basic: Number(emp.basic) || 0,
    housing: Number(emp.housing) || 0,
    isSaudi: emp.nat === 'Saudi'
  });
  return r2(wage + g.employer);
}

export function clientMargin(clients, secondments, employees, invoices, lang = 'en') {
  const empByCode = new Map((employees || []).map(e => [e.code, e]));
  return (clients || []).map(c => {
    const emps = (secondments || [])
      .filter(s => s && s.client === c.id)
      .map(s => empByCode.get(s.emp))
      .filter(Boolean);
    const cost = r2(emps.reduce((a, e) => a + headCost(e), 0));
    const revenue = r2((invoices || [])
      .filter(r => r && r.client === c.id && (r.status === 'sent' || r.status === 'paid'))
      .reduce((a, r) => a + (Number(r.sub) || 0), 0));
    const name = lang === 'ar' ? c.nameAr || c.nameEn : c.nameEn;
    return { id: c.id, name: name || c.id, revenue, cost, margin: r2(revenue - cost) };
  });
}
