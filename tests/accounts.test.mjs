// Accounts aggregations — pure helpers behind accounts.html (AR aging,
// expense rollup, per-client margin). Null-safe on missing seed input.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arAging, expenseRollup, clientMargin } from '../src/components/accounts-helpers.js';

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
      { id: '1', cat: 'gov', amount: 100, vat: 15 },
      { id: '2', cat: 'gov', amount: 50, vat: 0 },
      { id: '3', cat: 'fuel', amount: 20, vat: 3 }
    ]);
    assert.equal(r.total, 170);
    assert.equal(r.vat, 18);
    assert.deepEqual(r.byCategory, [
      { cat: 'gov', amount: 150, vat: 15 },
      { cat: 'fuel', amount: 20, vat: 3 }
    ]);
  });

  it('returns zeros on missing input', () => {
    assert.deepEqual(expenseRollup(undefined), { total: 0, vat: 0, byCategory: [] });
  });
});

describe('clientMargin', () => {
  it('nets revenue against secondment cost per client', () => {
    const r = clientMargin(
      [{ code: 'CL-001', name: 'A' }, { code: 'CL-002', name: 'B' }],
      [{ client: 'CL-001', emp: 'E1', rate: 100 }],
      [{ code: 'E1', basic: 40, housing: 10, transport: 0 }]
    );
    assert.equal(r.length, 2);
    assert.equal(r[0].code, 'CL-001');
    assert.equal(r[0].cost, 50);
  });

  it('returns an empty list on missing input', () => {
    assert.deepEqual(clientMargin(null, null, null), []);
  });
});
