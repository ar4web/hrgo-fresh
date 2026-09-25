// GOSI engine — automated suite for calcGosi / gosiPensionRate in src/components/hr-statutory.js.
// Rates: SANED 0.75%/side, hazards 2% employer, 45k cap, 2024-07-03 old/new cutoff.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcGosi, gosiPensionRate } from '../src/components/hr-statutory.js';

describe('gosiPensionRate (versioned)', () => {
  it('returns 9% at the 2024-07-03 floor', () => {
    assert.equal(gosiPensionRate('2024-07-03'), 0.09);
  });

  it('steps to 9.5% from 2025-07-03', () => {
    assert.equal(gosiPensionRate('2025-01-01'), 0.09);
    assert.equal(gosiPensionRate('2025-08-01'), 0.095);
  });

  it('steps to 10% from 2026-07-03', () => {
    assert.equal(gosiPensionRate('2026-07-03'), 0.1);
  });

  it('defaults to today and returns a known version rate', () => {
    assert.ok([0.09, 0.095, 0.1, 0.105, 0.11].includes(gosiPensionRate()));
  });
});

describe('calcGosi expats', () => {
  it('charges hazards-only (2% employer, 0 employee)', () => {
    assert.deepEqual(
      calcGosi({ basic: 8000, housing: 2000 }),
      { base: 10000, employee: 0, employer: 200, pension: 0, saned: 0, hazards: 200, system: 'expat' }
    );
  });
});

describe('calcGosi Saudis', () => {
  it('new system: pension + saned + hazards', () => {
    assert.deepEqual(
      calcGosi({ basic: 8000, housing: 2000, isSaudi: true, enrolledOn: '2024-08-01', at: '2025-01-01' }),
      {
        base: 10000, employee: 975, employer: 1175,
        pension: 900, saned: 75, hazards: 200,
        system: 'new', pensionRate: 0.09
      }
    );
  });

  it('old system (enrolled before 2024-07-03): fixed 9% pension', () => {
    const r = calcGosi({ basic: 8000, housing: 2000, isSaudi: true, enrolledOn: '2020-01-01' });
    assert.equal(r.system, 'old');
    assert.equal(r.pensionRate, 0.09);
    assert.equal(r.employee, 975);
    assert.equal(r.employer, 1175);
  });

  it('picks up the 9.5% version for new-system Saudis', () => {
    const r = calcGosi({ basic: 8000, housing: 2000, isSaudi: true, enrolledOn: '2024-08-01', at: '2025-08-01' });
    assert.equal(r.pensionRate, 0.095);
    assert.equal(r.pension, 950);
    assert.equal(r.employee, 1025);
    assert.equal(r.employer, 1225);
  });
});

describe('calcGosi base limits', () => {
  it('caps the base at 45000 (basic+housing)', () => {
    const r = calcGosi({ basic: 50000, housing: 10000 });
    assert.equal(r.base, 45000);
    assert.equal(r.employer, 900);
  });

  it('caps Saudi math too', () => {
    const r = calcGosi({ basic: 50000, housing: 10000, isSaudi: true, enrolledOn: '2024-08-01', at: '2025-01-01' });
    assert.equal(r.base, 45000);
    assert.equal(r.pension, 4050);
    assert.equal(r.saned, 337.5);
    assert.equal(r.employee, 4387.5);
    assert.equal(r.employer, 5287.5);
  });

  it('clamps negative wages to a zero base', () => {
    const r = calcGosi({ basic: -5000 });
    assert.equal(r.base, 0);
    assert.equal(r.employee, 0);
    assert.equal(r.employer, 0);
  });

  it('defaults to a zero base', () => {
    assert.equal(calcGosi().base, 0);
  });
});
