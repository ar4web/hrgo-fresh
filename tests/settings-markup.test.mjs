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

describe('settings panel workspace toggle', () => {
  const js = readFileSync(new URL('../src/components/settings.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/styles/_hr.scss', import.meta.url), 'utf8');

  it('renders a restore control in the page header, outside the rail', () => {
    assert.ok(html.includes('id="set-rail-restore"'), 'missing restore control');
    // It must live in the header (before .set-layout) so hiding the rail
    // never hides the way back.
    const restoreAt = html.indexOf('id="set-rail-restore"');
    const railAt = html.indexOf('class="set-rail"');
    assert.ok(restoreAt > -1 && restoreAt < railAt, 'restore control must precede the rail');
  });

  it('starts with the restore control hidden', () => {
    assert.match(html, /id="set-rail-restore"[^>]*hidden/);
  });

  it('uses one collapse class name in both the script and the stylesheet', () => {
    // No DOM in the test runner: a class added in JS but missing from the
    // stylesheet would be a silent no-op, so pin the shared name.
    const CLS = 'set-rail-collapsed';
    assert.ok(js.includes(`'${CLS}'`), `settings.js must toggle ${CLS}`);
    assert.ok(css.includes(`.${CLS}`), `_hr.scss must style .${CLS}`);
  });

  it('keeps the active-state highlight logic intact', () => {
    assert.ok(js.includes("classList.toggle('active'"), 'rail active highlight must survive');
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

  it('renders the settings tree in the exact specified order', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    const block = sidebar.slice(sidebar.indexOf('nav-group-settings'));
    // Sub-head labels are bare text nodes; link labels sit in .nav-text.
    const labels = [...block.matchAll(/>([^<>]+)</g)]
      .map((m) => m[1].trim())
      .filter((s) => s && !s.startsWith('/') && s !== 'sidebar');
    assert.deepEqual(labels, [
      'Company Setup',
      'Brand Kits',
      'Documents',
      'Assets',
      'Personalization',
      'App Settings',
      'Theme Center',
      'Troubleshoot',
      'About',
      'Settings'
    ]);
  });

  it('keeps each settings row pointing at its own hash target', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    const hrefs = [...sidebar.matchAll(/class="nav-page[^"]*"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, [
      'settings.html#brand-kits',
      'settings.html#documents',
      'settings.html#assets',
      'settings.html#app-settings',
      'settings.html#theme-center',
      'settings.html#troubleshoot',
      'settings.html#about'
    ]);
  });
});
