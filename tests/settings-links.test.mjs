// Settings deep links — markup contract for the sidebar Settings tree.
// The hash router (settings.js) resolves settings.html#<hash> to a rail item;
// this pins that every hash has exactly one unique target in the shipped
// settings.html, and that rail items and panels agree on their section key.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HASH_PANEL } from '../src/components/settings-hash.js';

const html = readFileSync(new URL('../src/pages/settings.html', import.meta.url), 'utf8');

const attr = (name) => [...html.matchAll(new RegExp(`${name}="([^"]+)"`, 'g'))].map((m) => m[1]);
const railSecs = attr('data-set-sec');
const panels = attr('data-set-panel');
const targets = attr('data-set-target');

describe('settings tree bindings', () => {
  it('gives every sidebar hash exactly one unique rail target', () => {
    for (const hash of Object.keys(HASH_PANEL)) {
      const hits = targets.filter((t) => t === hash);
      assert.equal(hits.length, 1, `expected 1 data-set-target="${hash}", got ${hits.length}`);
    }
  });

  it('binds no target that the router does not know', () => {
    for (const t of targets) {
      assert.ok(HASH_PANEL[t], `data-set-target="${t}" has no HASH_PANEL entry`);
    }
  });

  it('has a rail item for every section the router can activate', () => {
    for (const sec of Object.values(HASH_PANEL)) {
      assert.ok(railSecs.includes(sec), `no rail item with data-set-sec="${sec}"`);
      assert.ok(panels.includes(sec), `no panel with data-set-panel="${sec}"`);
    }
  });

  it('has no rail item pointing at a section with no panel', () => {
    for (const sec of railSecs) {
      assert.ok(panels.includes(sec), `rail item data-set-sec="${sec}" has no panel`);
    }
  });

  it('keeps the Go Dr. rail item and its panel on the same key', () => {
    // Was data-set-sec="godr" against data-set-panel="diag" — clicking Go Dr.
    // hid every panel.
    assert.ok(!railSecs.includes('godr'), 'stale godr rail key still present');
  });
});
