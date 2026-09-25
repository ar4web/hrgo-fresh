// Payroll line — automated suite for calcPayLine in src/components/hr-statutory.js.
// Wage = basic + housing + transport; OT at 1.5x the hourly slice; Art. 40
// employer-borne deduction categories are flagged, never silently applied.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcPayLine } from '../src/components/hr-statutory.js';

const expat = { code: 'E1', basic: 8000, housing: 2000, transport: 1000, saudi: false };

describe('calcPayLine math', () => {
  it('computes daily / OT / gross / net', () => {
    const r = calcPayLine(expat, { otH: 2, extras: 500, deductions: [{ cat: 'advance', amount: 300 }] });
    assert.equal(r.emp, 'E1');
    assert.equal(r.daily, 366.67);
    assert.equal(r.otPay, 137.5);
    assert.equal(r.extras, 500);
    assert.equal(r.gross, 11637.5);
    assert.equal(r.dedTotal, 300);
    assert.equal(r.net, 11337.5);
  });

  it('defaults to no OT, extras, or deductions', () => {
    const r = calcPayLine(expat);
    assert.equal(r.otPay, 0);
    assert.equal(r.gross, 11000);
    assert.equal(r.dedTotal, 0);
    assert.deepEqual(r.blocked, []);
    assert.equal(r.net, 11000);
  });
});

describe('calcPayLine GOSI wiring', () => {
  it('carries expat GOSI (2% hazards, 0 employee)', () => {
    const r = calcPayLine(expat);
    assert.equal(r.gosiBase, 10000);
    assert.equal(r.gosiEmp, 0);
    assert.equal(r.gosiEr, 200);
    assert.equal(r.gosiSystem, 'expat');
  });

  it('deducts the Saudi employee share from net', () => {
    const r = calcPayLine(
      { code: 'E2', basic: 8000, housing: 2000, transport: 0, saudi: true, gosiOn: '2024-08-01' },
      { at: '2025-01-01' }
    );
    assert.equal(r.gosiSystem, 'new');
    assert.equal(r.gosiEmp, 975);
    assert.equal(r.gosiEr, 1175);
    assert.equal(r.gross, 10000);
    assert.equal(r.net, 9025);
  });
});

describe('calcPayLine Art. 40 guards', () => {
  it('flags employer-borne categories but still totals them', () => {
    const r = calcPayLine(expat, {
      deductions: [{ cat: 'advance', amount: 300 }, { cat: 'iqama', amount: 100 }]
    });
    assert.deepEqual(r.blocked, [{ cat: 'iqama', amount: 100 }]);
    assert.equal(r.dedTotal, 400);
  });

  it('matches blocked categories case-insensitively', () => {
    const r = calcPayLine(expat, { deductions: [{ cat: 'IQAMA', amount: 50 }] });
    assert.equal(r.blocked.length, 1);
  });
});
