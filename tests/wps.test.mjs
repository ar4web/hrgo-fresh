// WPS / SIF — automated suite for wpsDeadline / sifBuild in src/components/hr-statutory.js.
// Pay within the first 10 days of the following month; SIF working format v1.1.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wpsDeadline, sifBuild } from '../src/components/hr-statutory.js';

describe('wpsDeadline', () => {
  it('lands on the 10th of the following month', () => {
    assert.equal(wpsDeadline('2025-01'), '2025-02-10');
    assert.equal(wpsDeadline('2025-06'), '2025-07-10');
  });

  it('rolls over the year boundary', () => {
    assert.equal(wpsDeadline('2024-12'), '2025-01-10');
  });
});

describe('sifBuild', () => {
  it('emits header + pipe-delimited rows with fils padding', () => {
    const r = sifBuild('2025-01', [{ emp: 'E1', iban: 'SA123', net: 10000 }]);
    assert.deepEqual(r.errors, []);
    assert.equal(r.total, 10000);
    assert.equal(r.count, 1);
    assert.equal(
      r.text,
      'SIF|V1|2025-01|1|1000000\nSAL|202501|SA123|000001000000|E1\n'
    );
  });

  it('collects missing-IBAN and non-positive-net errors', () => {
    const r = sifBuild('2025-01', [
      { emp: 'E1', iban: 'SA123', net: 10000 },
      { emp: 'E2', net: 0 }
    ]);
    assert.deepEqual(r.errors, ['E2: missing IBAN', 'E2: non-positive net payable']);
    assert.equal(r.total, 10000);
    assert.equal(r.count, 2);
  });

  it('appends optional ID fields when provided', () => {
    const r = sifBuild('2025-01', [
      { emp: 'E3', iban: 'SA999', net: 50.5, idType: 2, idNum: '2123456789' }
    ]);
    assert.deepEqual(r.errors, []);
    assert.ok(r.text.includes('SAL|202501|SA999|000000005050|E3|2|2123456789'));
  });

  it('handles an empty pay run', () => {
    const r = sifBuild('2025-01', []);
    assert.equal(r.text, 'SIF|V1|2025-01|0|0\n');
    assert.equal(r.total, 0);
    assert.equal(r.count, 0);
    assert.deepEqual(r.errors, []);
  });
});
