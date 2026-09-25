// Accounts aggregations — pure helpers behind accounts.html (AR aging,
// expense rollup, per-client margin). Null-safe on missing seed input.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arAging, expenseRollup, clientMargin } from '../src/components/accounts-helpers.js';
import { INVOICES, EXPENSES, CLIENTS, SECONDMENTS, EMPLOYEES } from '../src/components/hr-seed.js';

const INV = [
  { id: 'A', client: 'CL-001', status: 'sent', total: 100, due: '2026-01-10' },
  { id: 'B', client: 'CL-001', status: 'sent', total: 200, due: '2026-09-30' },
  { id: 'C', client: 'CL-002', status: 'paid', total: 999, due: '2026-09-01' },
  { id: 'D', client: 'CL-002', status: 'draft', total: 50, due: '2026-09-01' }
];

describe('arAging', () => {
  it('buckets unpaid invoices and ignores paid/draft', () => {
    const r = arAging(INV, '2026-09-26');
    assert.equal(r.current, 200);
    assert.equal(r.overdue, 100);
    assert.equal(r.total, 300);
  });

  it('returns zeros on missing input', () => {
    assert.deepEqual(arAging(null, '2026-09-26'), { current: 0, overdue: 0, total: 0, rows: [] });
    assert.equal(arAging([], '2026-09-26').total, 0);
  });

  it('treats an invoice due exactly today as current', () => {
    assert.equal(arAging([{ id: 'E', client: 'C', status: 'sent', total: 5, due: '2026-09-26' }], '2026-09-26').current, 5);
  });
});

describe('expenseRollup', () => {
  it('sums by category with vat', () => {
    const r = expenseRollup([
      { id: '1', cat: 'gov', amount: 100, vat: 15, status: 'paid' },
      { id: '2', cat: 'gov', amount: 50, vat: 0, status: 'paid' },
      { id: '3', cat: 'fuel', amount: 20, vat: 3, status: 'paid' }
    ]);
    assert.equal(r.paid, 170);
    assert.equal(r.vat, 18);
    assert.deepEqual(r.byCategory, [
      { cat: 'gov', amount: 150, vat: 15 },
      { cat: 'fuel', amount: 20, vat: 3 }
    ]);
  });

  it('counts only settled spend in the headline and splits the rest', () => {
    const r = expenseRollup([
      { id: '1', cat: 'gov', amount: 100, vat: 15, status: 'paid' },
      { id: '2', cat: 'camp', amount: 40, vat: 0, status: 'pending' },
      { id: '3', cat: 'fuel', amount: 10, vat: 2, status: 'approved' }
    ]);
    assert.equal(r.paid, 100);
    assert.equal(r.committed, 50);
    assert.equal(r.vat, 17);
    assert.deepEqual(r.byStatus, { paid: 100, approved: 10, pending: 40 });
  });

  it('returns zeros on missing input', () => {
    assert.deepEqual(expenseRollup(undefined), { total: 0, paid: 0, committed: 0, vat: 0, byCategory: [], byStatus: {} });
  });
});

describe('clientMargin', () => {
  it('nets issued invoice revenue against wage + employer GOSI cost', () => {
    const clients = [{ id: 'CL-001', nameEn: 'Alpha' }];
    const invoices = [
      { client: 'CL-001', status: 'sent', sub: 1000 },
      { client: 'CL-001', status: 'paid', sub: 500 },
      { client: 'CL-001', status: 'draft', sub: 9999 }
    ];
    const secondments = [{ client: 'CL-001', emp: 'E1' }];
    const employees = [{ code: 'E1', basic: 100, housing: 20, transport: 0, nat: 'Expat' }];
    const r = clientMargin(clients, secondments, employees, invoices);
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'CL-001');
    assert.equal(r[0].name, 'Alpha');
    assert.equal(r[0].revenue, 1500);
    // wage 120 + employer GOSI 2% of 120 = 2.4 -> 122.4
    assert.equal(r[0].cost, 122.4);
    assert.equal(r[0].margin, 1377.6);
  });

  it('prefers the Arabic name when asked', () => {
    const clients = [{ id: 'CL-001', nameEn: 'Alpha', nameAr: 'ألفا' }];
    const r = clientMargin(clients, [], [], [], 'ar');
    assert.equal(r[0].name, 'ألفا');
  });

  it('returns an empty list on missing input', () => {
    assert.deepEqual(clientMargin(null, null, null), []);
  });

  // The regression guard: real seed rows, so an invented fixture shape can
  // never pass again. CLIENTS key is `id` (not `code`) and SECONDMENTS.rate
  // is a monthly rate with no `days` field.
  it('produces non-zero margins against the real seed', () => {
    const r = clientMargin(CLIENTS, SECONDMENTS, EMPLOYEES, INVOICES);
    assert.ok(r.length > 0, 'expected at least one client row');
    assert.ok(r.every(x => x.id), 'every row must carry the client id');
    assert.ok(r.some(x => x.revenue > 0), 'issued invoices must produce revenue');
    assert.ok(r.some(x => x.cost > 0), 'deployed employees must produce cost');
  });
});
