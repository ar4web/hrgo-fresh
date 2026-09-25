// goHR — shell render (pure)
// String-only renderers. No DOM, no window/document access.
// Imported by:
//   1. The Vite plugin (vite.config.js) to inject shell HTML at build/dev time.
//   2. src/components/shell.js as a runtime fallback for pages that bypass the plugin.

// Shell chrome is sidebar + slim topbar. Sidebar holds the single global
// search (section filter); topbar holds notifications, theme, language,
// apps launcher and the user avatar. Exactly one search bar by design —
// sub-pages must not embed their own (see AGENTS.md).

// NAV items are either flat — { key, href, text, icon, badge? } —
// or a section parent with `children: [{ key, href, text, badge? }]`. The
// sidebar renders one flat link per parent (to its first child — the
// section's main screen) plus every section's pages as plain inline links
// (expand-all by default). No dropdowns anywhere. The parent reads active
// when any child matches.
// HR parents carry `i18n: 'hr.navgroup.x'` so applyShellI18n translates them.
export const NAV = [
  {
    label: '',
    items: [
      { key: 'dashboard', href: 'dashboard.html', text: 'Dashboard', icon: 'dashboard' },
      { key: 'analytics', href: 'analytics.html', text: 'Analytics', icon: 'barChart' }
    ]
  },
  {
    items: [
      { key: 'employees', href: 'employees.html', text: 'Employees', icon: 'users' },
      { key: 'recruitment', href: 'recruitment.html', text: 'Recruitment', icon: 'userPlus' },
      { key: 'attendance', href: 'attendance.html', text: 'Attendance', icon: 'clock' },
      { key: 'leave', href: 'leave.html', text: 'Leave', icon: 'palm' }
    ]
  },
  {
    items: [
      { key: 'payroll', href: 'payroll.html', text: 'Payroll', icon: 'wallet' },
      { key: 'eosb', href: 'eosb.html', text: 'End of Service', icon: 'award' },
      { key: 'renewals', href: 'renewals.html', text: 'Renewals', icon: 'refresh' }
    ]
  },
  {
    items: [
      { key: 'accounts', href: 'accounts.html', text: 'Accounts', icon: 'receipt' },
      { key: 'email', href: 'email.html', text: 'Email', icon: 'globe' },
      { key: 'files', href: 'files.html', text: 'Files', icon: 'folder' }
    ]
  },
  {
    items: [
      {
        key: 'settings',
        text: 'Settings',
        icon: 'settings',
        i18n: 'hr.navgroup.settings',
        href: 'settings.html',
        children: [
          { header: 'Company Setup', headerKey: 'nav.set.companySetup', key: 'set-brand-kits', href: 'settings.html#brand-kits', text: 'Brand Kits' },
          { key: 'set-documents', href: 'settings.html#documents', text: 'Documents' },
          { key: 'set-assets', href: 'settings.html#assets', text: 'Assets' },
          { header: 'Personalization', headerKey: 'nav.set.personalization', key: 'set-app-settings', href: 'settings.html#app-settings', text: 'App Settings' },
          { key: 'set-theme-center', href: 'settings.html#theme-center', text: 'Theme Center' },
          { key: 'set-troubleshoot', href: 'settings.html#troubleshoot', text: 'Troubleshoot' },
          { key: 'set-about', href: 'settings.html#about', text: 'About' }
        ]
      }
    ]
  }
];

// Sidebar: brand → section groups (Accounts/Email/Files in group 4) plus
// the Settings section parent with its anchor tree. No footer, no dropdowns.
// Invoicing/Expenses/Profitability/Documents are reachable via Accounts deep
// links, the command palette and direct URLs — not from the rail.
// NAV_KEY_ALIAS maps tree child keys (data-navkey) to i18n strings for
// applyShellI18n, which otherwise looks up `nav.<key>`.
export const NAV_KEY_ALIAS = {
  'set-brand-kits': 'nav.set.brandKits',
  'set-documents': 'nav.set.documents',
  'set-assets': 'nav.set.assets',
  'set-app-settings': 'nav.set.appSettings',
  'set-theme-center': 'nav.set.themeCenter',
  'set-troubleshoot': 'nav.set.troubleshoot',
  'set-about': 'nav.set.about'
};

export const ICONS = {
  stethoscope:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
  dashboard:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="10" width="7" height="11" rx="1.5"/></svg>',
  grid:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  barChart:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>',
  users:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>',
  clock:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  palm: '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21v-9"/><path d="M12 12C8 12 5 10 4 6c4 0 7 2 8 4 1-2 4-4 8-4-1 4-4 6-8 6z"/><path d="M12 12c0-3 1-5 4-6"/></svg>',
  wallet:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>',
  receipt:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  creditCard:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  trendingUp:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  userPlus:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  folder:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
  fileText:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  refresh:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  award:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5.5"/><path d="M8.5 12.5L7 21l5-2.5L17 21l-1.5-8.5"/></svg>',
  globe:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  settings:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',
  // ── Topbar actions (same family/dimensions as the nav icons above) ──
  bell:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6c0 6-3 7-3 7h18s-3-1-3-7a6 6 0 0 0-6-6z"/><path d="M10.5 21a1.5 1.5 0 0 0 3 0"/></svg>',
  moon:
    '<svg class="icon theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  sun:
    '<svg class="icon theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  language:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>',
  menu:
    '<svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
};

// Flat sidebar, zero dropdowns: every parent links to its section's main
// screen (its first child). Every section lists its pages inline beneath
// it — plain links, always visible, no toggles. A parent reads active
// whenever any of its pages is current.
function sectionKeys(item) {
  return (item.children || []).map(c => c.key).filter(Boolean);
}

function renderNavItem(item, activeKey) {
  if (item.children) {
    const first = item.children[0];
    const parentHref = item.href || first.href;
    const active = item.key === activeKey || sectionKeys(item).includes(activeKey);
    // Expand-all: every section lists its pages inline by default. The
    // rail toggle still collapses the whole sidebar; active highlighting
    // marks the current section + page. Children may carry `header` for a
    // non-link sub-head row (Settings tree).
    let lastHeader = null;
    const pages = `<div class="nav-pages">${item.children
      .map(c => {
        const head = c.header && c.header !== lastHeader ? `<div class="nav-subhead"${c.headerKey ? ` data-headerkey="${c.headerKey}"` : ''}>${c.header}</div>` : '';
        lastHeader = c.header || lastHeader;
        const a = c.key === activeKey;
        return `${head}<a class="nav-page${a ? ' active' : ''}" href="${c.href}"${c.key ? ` data-navkey="${c.key}"` : ''}${a ? ' aria-current="page"' : ''}><span class="nav-text">${c.text}</span>${c.badge ? `<span class="badge ${c.badge.cls}">${c.badge.text}</span>` : ''}</a>`;
      })
      .join('')}</div>`;
    return `
    <a class="nav-link nav-parent${active ? ' active' : ''}" href="${parentHref}"${active ? ' aria-current="page"' : ''}>
      <span class="nav-ico">${ICONS[item.icon] || ''}</span>
      <span class="nav-text">${item.text}</span>
    </a>${pages}
  `;
  }
  const a = item.key === activeKey;
  return `
    <a class="nav-link${a ? ' active' : ''}" href="${item.href}"${a ? ' aria-current="page"' : ''}>
      <span class="nav-ico">${ICONS[item.icon] || ''}</span>
      <span class="nav-text">${item.text}</span>
      ${item.badge ? `<span class="badge ${item.badge.cls}">${item.badge.text}</span>` : ''}
    </a>
  `;
}

// Detail pages carry their own data-page key but highlight their section
// parent in the sidebar (they share the parent's screen, not its key).
const DETAIL_PARENT = {
  'employee-file': 'employees',
  'users': 'settings',
  'go-dr': 'settings'
};

const TOGGLE_ICONS = `
  <span class="toggle-icon toggle-icon-expanded" aria-hidden="true"><svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></span>
  <span class="toggle-icon toggle-icon-collapsed" aria-hidden="true" hidden><svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg></span>
`;

function renderSidebar(activeKey) {
  const key = DETAIL_PARENT[activeKey] || activeKey;
  const groups = NAV.map(
    group => `
    <div class="nav-group">
      ${''}
      ${group.items.map(item => renderNavItem(item, key)).join('')}
    </div>
  `
  ).join('');

  return `
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar-brand-row">
        <a class="sidebar-brand" href="dashboard.html" aria-label="Go to Dashboard">
          <div class="brand-icon">H</div>
          <div class="brand-name">goHR</div>
        </a>
      </div>
        <div class="sidebar-search">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="sidebar-search" type="search" autocomplete="off" data-i18n-placeholder="nav.search" placeholder="Search sections…" aria-label="Filter sections">
        <button class="sidebar-toggle" type="button" aria-label="Collapse sidebar" aria-controls="sidebar" aria-expanded="false" aria-pressed="false">${TOGGLE_ICONS}</button>
      </div>
      <nav class="sidebar-nav" aria-label="HR sections">${groups}</nav>
    </aside>
  `;
}

function renderTopbar(activeKey = '') {
  return `
    <header class="topbar">
      <div class="topbar-left">
        <button class="topbar-menu" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${ICONS.menu}</button>
      </div>
      <div class="topbar-right">
        <button class="topbar-icon-btn topbar-alert-btn" id="topbar-notifications" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Notifications">
          ${ICONS.bell}
          <span class="topbar-btn-dot" id="topbar-notif-badge" hidden><span id="topbar-notif-count"></span></span>
        </button>
        <button class="topbar-icon-btn" id="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark theme" title="Switch to dark theme">
          ${ICONS.moon}${ICONS.sun}
        </button>
        <button class="topbar-icon-btn" id="lang-toggle" type="button" aria-label="Language" title="Language">
          ${ICONS.language}
        </button>
        <button class="topbar-icon-btn${activeKey === 'apps' ? ' active' : ''}" id="topbar-apps" type="button" aria-label="Apps" title="Apps">
          ${ICONS.grid}
        </button>
        <button class="topbar-user" id="topbar-user" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Your profile">
          <span class="topbar-user-avatar">HA</span>
        </button>
      </div>
    </header>
  `;
}

export function renderShell({ activeKey = '' } = {}) {
  return {
    sidebar: renderSidebar(activeKey),
    topbar: renderTopbar(activeKey)
  };
}

export function parseShellAttrs(attrs) {
  const shell = /data-shell\s*=\s*["']([^"']*)["']/.exec(attrs);
  if (!shell || shell[1] !== 'admin') {
    return null;
  }
  const page = /data-page\s*=\s*["']([^"']*)["']/.exec(attrs);
  return {
    activeKey: page ? page[1] : ''
  };
}
