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
