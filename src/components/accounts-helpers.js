// goHR — Accounts aggregations (pure, no DOM). Reused by accounts.js and
// pinned by tests/accounts.test.mjs. Null-safe on missing seed input.
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
  let total = 0;
  let vat = 0;
  for (const e of expenses || []) {
    if (!e) {continue;}
    const amount = Number(e.amount) || 0;
    const v = Number(e.vat) || 0;
    total += amount;
    vat += v;
    const cur = map.get(e.cat) || { cat: e.cat, amount: 0, vat: 0 };
    cur.amount += amount;
    cur.vat += v;
    map.set(e.cat, cur);
  }
  const byCategory = [...map.values()]
    .map(c => ({ cat: c.cat, amount: r2(c.amount), vat: r2(c.vat) }))
    .sort((a, b) => b.amount - a.amount);
  return { total: r2(total), vat: r2(vat), byCategory };
}

export function clientMargin(clients, secondments, employees) {
  const empByCode = new Map((employees || []).map(e => [e.code, e]));
  return (clients || []).map(c => {
    let revenue = 0;
    let cost = 0;
    for (const s of secondments || []) {
      if (!s || s.client !== c.code) {continue;}
      revenue += (Number(s.rate) || 0) * (Number(s.days) || 0);
      const e = empByCode.get(s.emp);
      if (e) {cost += (Number(e.basic) || 0) + (Number(e.housing) || 0) + (Number(e.transport) || 0);}
    }
    return { code: c.code, name: c.name || c.code, revenue: r2(revenue), cost: r2(cost), margin: r2(revenue - cost) };
  });
}
