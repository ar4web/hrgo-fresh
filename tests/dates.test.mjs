// Regression tests for the KSA timezone date bug.
//
// `new Date().toISOString().slice(0, 10)` serialises to UTC. In Saudi Arabia
// (UTC+3) local midnight is 21:00 the previous day, so between 00:00 and 03:00
// local "today" read as YESTERDAY. Every downstream figure that compares an
// expiry date against today was then wrong by a day, and computed invoice /
// ESB / renewal dates printed a day early — on a tax document.
//
// These run with TZ pinned to Asia/Riyadh (UTC+3, no DST) so the failure is
// reproducible rather than depending on the machine's zone.

import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.TZ = 'Asia/Riyadh';
const { localIso, invoiceDue } = await import('../src/components/hr-statutory.js');

test('localIso returns the local calendar date, not the UTC one', () => {
  // Break: localIso delegating to toISOString(), which in UTC+3 yields the
  // previous day for every local time before 03:00.
  const d = new Date(2026, 8, 26, 0, 30, 0); // 26 Sep 2026, 00:30 local
  assert.equal(localIso(d), '2026-09-26', 'local midnight must report its own date');
  // the same instant in UTC is still the 25th, which is exactly the bug
  assert.equal(d.toISOString().slice(0, 10), '2026-09-25', 'precondition: UTC disagrees here');
});

test('localIso is stable across the whole local day', () => {
  // Break: a formatter that flips at some hour boundary.
  for (const h of [0, 1, 2, 3, 12, 23]) {
    const d = new Date(2026, 8, 26, h, 15, 0);
    assert.equal(localIso(d), '2026-09-26', `hour ${h} must report 2026-09-26`);
  }
});

test('localIso handles month and year boundaries', () => {
  assert.equal(localIso(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  assert.equal(localIso(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  // single-digit month/day must be zero-padded
  assert.equal(localIso(new Date(2026, 2, 5, 0, 0)), '2026-03-05');
});

test('localIso defaults to now', () => {
  assert.match(localIso(), /^\d{4}-\d{2}-\d{2}$/);
});

test('invoiceDue returns the contractual date, not one day early', () => {
  // Break: the UTC round-trip that made every generated invoice's due date and
  // ZATCA supply date a day early. This is a legally significant field.
  assert.equal(invoiceDue('2026-05', 5), '2026-06-05');
  assert.equal(invoiceDue('2026-05', 1), '2026-06-01');
  assert.equal(invoiceDue('2026-12', 28), '2027-01-28');
  // billing day is clamped at both ends. 0 is treated as "unset" and falls back
  // to the default day (5); a negative is clamped up to the 1st.
  assert.equal(invoiceDue('2026-05', 31), '2026-06-28');
  assert.equal(invoiceDue('2026-05', 0), '2026-06-05');
  assert.equal(invoiceDue('2026-05', -3), '2026-06-01');
  // payment terms push the date out
  assert.equal(invoiceDue('2026-05', 5, 30), '2026-07-05');
});

test('invoiceDue rolls the year over correctly', () => {
  assert.equal(invoiceDue('2026-12', 5), '2027-01-05');
  assert.equal(invoiceDue('2026-01', 15), '2026-02-15');
});
