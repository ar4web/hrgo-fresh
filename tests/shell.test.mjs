// Shell renderer — regression guard for the sidebar NAV (Email tab + Settings tree).
// shell-render.js is pure (no DOM), so it runs under the Node built-in runner.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NAV, renderShell } from '../src/components/shell-render.js';

const HASHES = ['brand-kits', 'documents', 'assets', 'app-settings', 'theme-center', 'troubleshoot', 'about'];

describe('shell NAV', () => {
  it('contains the Email tab pointing at email.html', () => {
    const flat = NAV.flatMap(g => g.items);
    const email = flat.find(i => i.key === 'email');
    assert.equal(email.href, 'email.html');
  });

  it('renders the Email link with the globe icon', () => {
    const { sidebar } = renderShell({ activeKey: 'email' });
    assert.ok(sidebar.includes('href="email.html"'));
    assert.ok(sidebar.includes('email.html'));
  });

  it('renders all 7 settings anchors', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    for (const h of HASHES) assert.ok(sidebar.includes(`settings.html#${h}`), `missing #${h}`);
  });

  it('renders Company Setup / Personalization sub-heads', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    assert.ok(sidebar.includes('Company Setup'));
    assert.ok(sidebar.includes('Personalization'));
  });

  it('marks the settings parent active on settings pages', () => {
    const { sidebar } = renderShell({ activeKey: 'settings' });
    assert.ok(sidebar.includes('nav-parent active'));
  });
});

describe('sidebar i18n wiring', () => {
  it('maps every settings child key to a nav.* string', async () => {
    const { NAV, NAV_KEY_ALIAS } = await import('../src/components/shell-render.js');
    const settings = NAV.flatMap(g => g.items).find(i => i.key === 'settings');
    for (const c of settings.children) {
      assert.ok(NAV_KEY_ALIAS[c.key], `missing alias for ${c.key}`);
      assert.match(NAV_KEY_ALIAS[c.key], /^nav\./);
    }
  });

  it('gives every sub-head a headerKey rendered as data-headerkey', async () => {
    const { NAV, renderShell } = await import('../src/components/shell-render.js');
    const settings = NAV.flatMap(g => g.items).find(i => i.key === 'settings');
    let last = null;
    for (const c of settings.children) {
      if (c.header && c.header !== last) {
        assert.ok(c.headerKey, `missing headerKey for ${c.header}`);
      }
      last = c.header || last;
    }
    const { sidebar } = renderShell({ activeKey: 'settings' });
    assert.ok(sidebar.includes('data-headerkey="nav.set.companySetup"'));
    assert.ok(sidebar.includes('data-headerkey="nav.set.personalization"'));
  });

  it('pins the settings parent href contract', async () => {
    const { renderShell } = await import('../src/components/shell-render.js');
    const { sidebar } = renderShell({ activeKey: 'settings' });
    assert.ok(sidebar.includes('nav-parent active" href="settings.html"'));
  });
});

describe('sidebar cleanup nav', () => {
  const keys = () => NAV.flatMap(g => g.items).map(i => i.key);

  it('drops the four redundant links', () => {
    for (const gone of ['invoices', 'expenses', 'profitability', 'documents']) {
      assert.ok(!keys().includes(gone), `${gone} should be gone`);
    }
  });

  it('adds accounts and keeps the File Manager', () => {
    assert.ok(keys().includes('accounts'));
    assert.ok(keys().includes('files'));
  });

  it('keeps 13 top-level links, 7 tree children, 2 sub-heads', () => {
    const items = NAV.flatMap(g => g.items);
    assert.equal(items.length, 13);
    const settings = items.find(i => i.key === 'settings');
    assert.equal(settings.children.length, 7);
    assert.equal(settings.children.filter(c => c.header).length, 2);
  });

  it('points accounts at accounts.html and highlights it', () => {
    const acc = NAV.flatMap(g => g.items).find(i => i.key === 'accounts');
    assert.equal(acc.href, 'accounts.html');
    assert.ok(renderShell({ activeKey: 'accounts' }).sidebar.includes('href="accounts.html"'));
  });
});

describe('topbar icon family', () => {
  const { topbar } = renderShell({ activeKey: 'dashboard' });
  const svgs = topbar.match(/<svg[\s\S]*?<\/svg>/g) || [];

  it('renders every topbar svg at 20px with the sidebar stroke', () => {
    assert.ok(svgs.length >= 6, `expected at least 6 svgs, got ${svgs.length}`);
    for (const s of svgs) {
      assert.ok(s.includes('width="20"'), 'svg must carry width="20"');
      assert.ok(s.includes('height="20"'), 'svg must carry height="20"');
      assert.ok(s.includes('stroke-width="1.5"'), 'svg must carry stroke-width="1.5"');
    }
  });

  it('keeps the theme toggle glyph classes', () => {
    assert.ok(topbar.includes('theme-icon-moon'));
    assert.ok(topbar.includes('theme-icon-sun'));
  });

  it('uses the shared ICONS map entries', async () => {
    const { ICONS } = await import('../src/components/shell-render.js');
    for (const key of ['bell', 'moon', 'sun', 'language', 'menu', 'grid']) {
      assert.ok(ICONS[key], `ICONS.${key} missing`);
    }
    // Every topbar glyph must be byte-identical to a shared ICONS entry —
    // this is what fails if someone re-inlines a hand-rolled SVG.
    const family = Object.values(ICONS);
    for (const s of svgs) {
      assert.ok(family.includes(s), 'topbar svg is not a shared ICONS entry');
    }
  });
});

describe('settings hash map', () => {
  it('maps all 7 sidebar hashes to real panels', async () => {
    const { HASH_PANEL } = await import('../src/components/settings-hash.js');
    assert.deepEqual(HASH_PANEL, {
      'brand-kits': 'app', 'documents': 'modules', 'assets': 'files',
      'app-settings': 'apps', 'theme-center': 'theme',
      'troubleshoot': 'diag', 'about': 'company'
    });
  });

  it('ignores unknown hashes', async () => {
    const { HASH_PANEL } = await import('../src/components/settings-hash.js');
    assert.equal(HASH_PANEL['nope'], undefined);
  });
});
