// EOSB (Art. 84/85) — automated suite for calcEOSB in src/components/hr-statutory.js.
// Runner: Node built-in (`npm test` -> `node --test tests/`). Zero dependencies.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcEOSB, yearsBetween } from '../src/components/hr-statutory.js';

const closeTo = (actual, expected, delta, msg) => {
  assert.ok(
    Math.abs(actual - expected) <= delta,
    `${msg || 'closeTo'}: expected ${actual} within ±${delta} of ${expected}`
  );
};

describe('calcEOSB guards', () => {
  it('returns zeros when basic is missing', () => {
    assert.deepEqual(
      calcEOSB({ joinDate: '2020-01-01', endDate: '2023-01-01' }),
      { net: 0, gross: 0, haircut: 0, years: 0, factor: 0, reason: 'termination' }
    );
  });

  it('returns zeros when basic is 0', () => {
    const r = calcEOSB({ basic: 0, joinDate: '2020-01-01', endDate: '2023-01-01' });
    assert.equal(r.net, 0);
    assert.equal(r.gross, 0);
    assert.equal(r.factor, 0);
  });

  it('returns zeros when joinDate is missing', () => {
    const r = calcEOSB({ basic: 10000, endDate: '2023-01-01' });
    assert.equal(r.net, 0);
    assert.equal(r.years, 0);
  });

  it('forfeits the award on Art. 80 dismissal', () => {
    assert.deepEqual(
      calcEOSB({ basic: 10000, joinDate: '2020-01-01', endDate: '2023-01-01', endReason: 'art80' }),
      { net: 0, gross: 0, haircut: 0, years: 0, factor: 0, reason: 'art80' }
    );
  });
});

describe('calcEOSB full-award reasons (Art. 84)', () => {
  it('termination: first 5 years at half wage (3y @ 10000 -> ~15000)', () => {
    const r = calcEOSB({ basic: 10000, joinDate: '2020-01-01', endDate: '2023-01-01' });
    assert.equal(r.factor, 1);
    assert.equal(r.net, r.gross);
    assert.equal(r.haircut, 0);
    assert.equal(r.years, 3);
    closeTo(r.gross, 15000, 10, 'gross');
  });

  it('termination: beyond 5 years accrues full wage (6y @ 10000 -> ~35000)', () => {
    const r = calcEOSB({ basic: 10000, joinDate: '2020-01-01', endDate: '2026-01-01' });
    assert.equal(r.factor, 1);
    assert.equal(r.years, 6);
    closeTo(r.gross, 35000, 25, 'gross');
    assert.equal(r.net, r.gross);
  });

  it('indefinite resignation keeps the full award (2026 nuance)', () => {
    const r = calcEOSB({ basic: 10000, joinDate: '2020-01-01', endDate: '2023-01-01', endReason: 'resignation' });
    assert.equal(r.factor, 1);
    assert.equal(r.net, r.gross);
    assert.equal(r.haircut, 0);
  });

  it('Art. 81 exit keeps the full award', () => {
    const r = calcEOSB({ basic: 10000, joinDate: '2020-01-01', endDate: '2023-01-01', endReason: 'art81' });
    assert.equal(r.factor, 1);
    assert.equal(r.net, r.gross);
  });

  it('12y termination accrues 5y half + 7y full (10000 -> 95000)', () => {
    const r = calcEOSB({ basic: 10000, joinDate: '2012-01-01', endDate: '2024-01-01' });
    assert.equal(r.years, 12);
    assert.equal(r.gross, 95000);
    assert.equal(r.net, 95000);
  });
});

describe('calcEOSB resignation-fixed haircut (Art. 85)', () => {
  it('< 2y forfeits (factor 0)', () => {
    const r = calcEOSB({ basic: 12000, joinDate: '2022-01-01', endDate: '2023-01-01', endReason: 'resignation-fixed' });
    assert.equal(r.factor, 0);
    assert.equal(r.net, 0);
    assert.equal(r.haircut, r.gross);
  });

  it('2-5y pays one third', () => {
    const r = calcEOSB({ basic: 12000, joinDate: '2020-01-01', endDate: '2023-01-01', endReason: 'resignation-fixed' });
    assert.equal(r.factor, 1 / 3);
    closeTo(r.net, r.gross / 3, 0.02, 'net');
  });

  it('5-10y pays two thirds', () => {
    const r = calcEOSB({ basic: 12000, joinDate: '2018-01-01', endDate: '2025-01-01', endReason: 'resignation-fixed' });
    assert.equal(r.factor, 2 / 3);
    closeTo(r.net, (r.gross * 2) / 3, 0.02, 'net');
  });

  it('>= 10y pays in full', () => {
    const r = calcEOSB({ basic: 12000, joinDate: '2012-01-01', endDate: '2024-01-01', endReason: 'resignation-fixed' });
    assert.equal(r.factor, 1);
    assert.equal(r.net, r.gross);
    assert.equal(r.haircut, 0);
  });

  it('net/haircut stay consistent (gross - net)', () => {
    const r = calcEOSB({ basic: 12000, joinDate: '2020-01-01', endDate: '2023-01-01', endReason: 'resignation-fixed' });
    closeTo(r.haircut, r.gross - r.net, 0.02, 'haircut');
  });
});

describe('calcEOSB shape', () => {
  it('defaults to termination and passes reason through', () => {
    const r = calcEOSB({ basic: 5000, joinDate: '2021-06-01', endDate: '2022-06-01' });
    assert.equal(r.reason, 'termination');
    const custom = calcEOSB({ basic: 5000, joinDate: '2021-06-01', endDate: '2022-06-01', endReason: 'art81' });
    assert.equal(custom.reason, 'art81');
  });

  it('rounds years to 2dp', () => {
    const r = calcEOSB({ basic: 8000, joinDate: '2019-06-15', endDate: '2025-06-15' });
    assert.equal(r.years, 6);
  });
});

describe('yearsBetween (EOSB tenure basis)', () => {
  it('clamps negative spans to 0', () => {
    assert.equal(yearsBetween('2024-01-01', '2020-01-01'), 0);
  });

  it('measures a ~1y span', () => {
    closeTo(yearsBetween('2022-01-01', '2023-01-01'), 1, 0.01, 'years');
  });
});
