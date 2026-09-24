// goHR — global page action handlers.
//
// Wires up common button intents that show up across pages so the template
// has real interactivity instead of generic toast feedback. All handlers
// guard against pages that already have specific wiring (the global handler
// only fires when no other handler called preventDefault).
//
// Handled by button text or aria-label:
//   • Print           → window.print()
//   • Export*         → CSV/JSON download (or invokes data-export on a table)
//   • Compose / New … → opens a contextual modal
//   • Refresh         → flashes a "refreshed" pulse on nearby card; re-init charts
//   • Share           → copies current URL to clipboard
//   • Cancel / Reset  → resets form / closes modal (already native)

import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { t } from './i18n.js';

// Map known i18n keys directly so translated buttons keep their actions
// even though matching below is label-text based.
const KEY_ACTIONS = {
  'common.print': 'print',
  'common.export': 'export',
  'common.refresh': 'refresh',
  'an.exportCsv': 'export'
};

const RX = {
  print:    /^(print|طباعة)$/i,
  export:   /^(export|download|تصدير|تنزيل)( pdf| csv)?$/i,
  refresh:  /^(refresh|تحديث)$/i,
  share:    /^(share|مشاركة)$/i,
  compose:  /^(compose|new chat|new message|new email|رسالة جديدة|بريد جديد)$/i,
  newDeal:  /^(new deal|new project|new event|new task|\+ ?new|صفقة جديدة|مشروع جديد|حدث جديد|مهمة جديدة|\+ ?جديد)$/i,
  add:      /^(\+ ?invite|\+ ?invite user|\+ ?invite member|invite|add (member|user|customer|contact)|دعوة|دعوة عضو|إضافة (عضو|مستخدم|عميل|جهة اتصال))$/i
};

function matchAction(label) {
  for (const [name, rx] of Object.entries(RX)) {
    if (rx.test(label)) {return name;}
  }
  return null;
}

function getLabel(btn) {
  return (btn.getAttribute('aria-label') || btn.textContent || '').trim().replace(/\s+/g, ' ');
}

function actionFor(btn) {
  const key = btn.getAttribute('data-i18n');
  if (key && KEY_ACTIONS[key]) {return KEY_ACTIONS[key];}
  return matchAction(getLabel(btn));
}

// ── Action implementations ──

function doPrint() { window.print(); }

function doRefresh(btn) {
  const card = btn.closest('.card');
  if (card) {
    card.classList.add('is-refreshing');
    setTimeout(() => card.classList.remove('is-refreshing'), 700);
  }
  // Force charts to repaint by dispatching themechange on this card's chart
  // hosts (charts.js listens globally; restricted dispatch keeps it scoped).
  document.documentElement.dispatchEvent(new CustomEvent('themechange'));
  showToast(t('act.refreshed'), { variant: 'success' });
}

async function doShare() {
  try {
    if (navigator.share) {
      await navigator.share({ title: document.title, url: location.href });
    } else {
      await navigator.clipboard.writeText(location.href);
      showToast(t('act.linkCopied'), { variant: 'success' });
    }
  } catch (_e) { /* user cancelled */ }
}

function doExport(_btn) {
  // If there's a data-export table on this page, trigger that instead.
  const exportable = document.querySelector('table[data-export]');
  if (exportable) {
    const exportBtn = exportable.closest('.card')?.querySelector('[data-export-btn]');
    if (exportBtn) { exportBtn.click(); return; }
  }
  // Otherwise download the current page title + URL as a tiny report.
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const slug = document.title.replace(/\s+\|.*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${slug || 'export'}-${stamp}.json`;
  const payload = JSON.stringify({
    page: document.title,
    url: location.href,
    exportedAt: new Date().toISOString(),
    note: 'Replace this stub with your real data exporter — the same download flow works.'
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(t('act.exportedFile').replace('{file}', filename), { variant: 'success' });
}

function composeModal() {
  showModal({
    title: t('act.newMessage'),
    size: 'lg',
    body: `
      <div class="form-group">
        <label class="form-label">${t('act.to')}</label>
        <input class="form-control" type="email" placeholder="name@example.com">
      </div>
      <div class="form-group">
        <label class="form-label">${t('act.subject')}</label>
        <input class="form-control" placeholder="${t('act.subject')}">
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">${t('act.message')}</label>
        <textarea class="form-control" rows="6"></textarea>
      </div>
    `,
    actions: [
      { label: t('act.discard'), variant: 'ghost' },
      { label: t('act.saveDraft'), variant: 'outline', action: () => showToast(t('act.draftSaved'), { variant: 'success' }) },
      { label: t('act.send'), variant: 'primary', action: () => showToast(t('act.messageSent'), { variant: 'success' }) }
    ]
  });
}

function newGenericModal(label) {
  // "New deal", "New project", "New event", "+ New" (or their Arabic
  // equivalents) — pick the tailored title/fields without a giant switch.
  const isEvent = /event|حدث/i.test(label);
  const isTask  = /task|مهمة/i.test(label);
  const isDeal  = /deal|صفقة/i.test(label);
  const isProject = /project|مشروع/i.test(label);

  const title = isEvent ? t('act.newEvent')
    : isTask ? t('act.newTask')
      : isDeal ? t('act.newDeal')
        : isProject ? t('act.newProject')
          : t('act.createNew');
  const fieldLabel = isEvent ? t('act.eventTitle')
    : isTask ? t('act.taskTitle')
      : isDeal ? t('act.dealName')
        : t('act.title');

  const body = `
    <div class="form-group">
      <label class="form-label">${fieldLabel}</label>
      <input class="form-control" autofocus>
    </div>
    ${isEvent ? `
      <div class="form-row">
        <div class="form-group"><label class="form-label">${t('act.start')}</label><input class="form-control" type="datetime-local"></div>
        <div class="form-group"><label class="form-label">${t('act.end')}</label><input class="form-control" type="datetime-local"></div>
      </div>
    ` : ''}
    <div class="form-group" style="margin-bottom:0">
      <label class="form-label">${isEvent ? t('act.notes') : t('act.description')}</label>
      <textarea class="form-control" rows="3"></textarea>
    </div>
  `;
  showModal({
    title, body, size: 'md',
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      { label: t('act.create'), variant: 'primary', action: () => showToast(t('act.saved').replace('{what}', title), { variant: 'success' }) }
    ]
  });
}

function inviteModal() {
  showModal({
    title: t('act.inviteMember'),
    body: `
      <div class="form-group">
        <label class="form-label">${t('act.emailAddress')}</label>
        <input class="form-control" type="email" placeholder="colleague@example.com" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">${t('act.role')}</label>
        <select class="form-control"><option>Member</option><option>Admin</option><option>Owner</option></select>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">${t('act.personalMsg')}</label>
        <textarea class="form-control" rows="3"></textarea>
      </div>
    `,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      { label: t('act.sendInvite'), variant: 'primary', action: () => showToast(t('act.inviteSent'), { variant: 'success' }) }
    ]
  });
}

// ── Wire-up ──

const handlers = {
  print:    doPrint,
  export:   (btn) => doExport(btn),
  refresh:  (btn) => doRefresh(btn),
  share:    () => doShare(),
  compose:  () => composeModal(),
  newDeal:  (btn) => newGenericModal(getLabel(btn)),
  add:      () => inviteModal()
};

/**
 * Wire up shared page-action behavior. Idempotent — safe to call multiple
 * times; subsequent calls are no-ops.
 */
export function initPageActions() {
  if (initPageActions._wired) {return;}
  initPageActions._wired = true;

  // Skip controls that already have their own click pipeline.
  const SKIP_SELECTOR = [
    '.toggle', '.todo-cb', '.chart-tab', '.card-opt-btn', '.chip', '.chip-close',
    '.menu-item', '.sidebar-toggle', '.more-btn', '.nav-link',
    '.inbox-folder', '.modal-close'
  ].join(', ');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) {return;}
    const btn = e.target.closest('button, a.btn');
    if (!btn) {return;}

    // Buttons inside floating UI / interactive lists handle themselves.
    if (btn.closest('.menu-popover, .toast-host, .calendar-grid, #inbox-list, #inbox-root, #fm-grid, .modal-backdrop, .appwin, [data-page="apps"], [data-own-actions]')) {return;}
    if (btn.matches(SKIP_SELECTOR)) {return;}
    if (!btn.matches('.btn')) {return;}

    // Buttons with onclick="" are wired in HTML — let those run.
    if (btn.hasAttribute('onclick')) {return;}
    // Submit buttons → form submit handler in main.js
    if (btn.type === 'submit') {return;}

    const action = actionFor(btn);
    if (!action) {return;}

    e.preventDefault();
    handlers[action]?.(btn);
  });
}
