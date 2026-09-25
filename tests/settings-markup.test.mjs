// Settings page markup contract: unique element ids, the functional language
// select keeps its id, and the Settings rail group is last so it can be
// pinned to the sidebar's bottom-left corner.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAV, renderShell } from '../src/components/shell-render.js';

const html = readFileSync(new URL('../src/pages/settings.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

describe('settings.html element ids', () => {
  it('has no duplicate ids', () => {
    const seen = new Map();
    for (const id of ids) {
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
    assert.deepEqual(dupes, [], `duplicate ids: ${dupes.join(', ')}`);
  });

  it('keeps id="set-language" on exactly one element', () => {
    assert.equal(ids.filter((i) => i === 'set-language').length, 1);
  });

  it('gives the language panel its own default-language control', () => {
    // The Language panel's select must be uniquely identifiable and carry a
    // descriptive class, since it is no longer the id="set-language" control.
    assert.ok(/id="set-lang-default"[^>]*class="[^"]*cz-lang-default/.test(html)
      || /class="[^"]*cz-lang-default[^"]*"[^>]*id="set-lang-default"/.test(html),
    'language panel select needs id="set-lang-default" + class="cz-lang-default"');
  });
});

describe('settings rail group placement', () => {
  it('is the last nav group', () => {
    const last = NAV[NAV.length - 1];
    assert.ok(last.items.some((i) => i.key === 'settings'), 'settings must be the final group');
  });

  it('renders the settings group with a pinning hook class', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    assert.ok(sidebar.includes('nav-group-settings'), 'settings group needs a hook class to pin');
  });

  it('puts the settings parent row last so its icon sits in the corner', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    const parent = sidebar.lastIndexOf('nav-parent');
    const lastPage = sidebar.lastIndexOf('nav-page');
    assert.ok(parent > 0 && lastPage > 0, 'expected both a parent row and tree rows');
    assert.ok(parent > lastPage, 'the settings parent must render after its sub-tree');
  });

  it('keeps the full 9-row settings tree', () => {
    const settings = NAV.flatMap((g) => g.items).find((i) => i.key === 'settings');
    const rows = settings.children.length + settings.children.filter((c) => c.header).length;
    assert.equal(rows, 9, 'Company Setup, Brand Kits, Documents, Assets, Personalization, App Settings, Theme Center, Troubleshoot, About');
  });
});
