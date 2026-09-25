// goHR — mailbox (email.html). Message list + reader + inline compose over
// SEED_MAILBOX; sent mail persists in the settings document outbox.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { SEED_MAILBOX } from './hr-seed.js';
import { getSettings, saveSettings } from './hr-statutory.js';
import { unreadCount, parseOutbox } from './email-helpers.js';
import { escapeHtml as esc } from './markup.js';

let booted = false;
let selected = null;
let composeOpen = false;

function outbox() {
  return parseOutbox(JSON.stringify((getSettings() || {}).outbox));
}

function nameOf(m) {
  if (m.mine) {
    return currentLang() === 'ar' ? 'أنت' : 'Me';
  }
  return currentLang() === 'ar' ? m.fromAr || m.from : m.from;
}

function subjectOf(m) {
  return currentLang() === 'ar' ? m.subjectAr || m.subject : m.subject;
}

function bodyOf(m) {
  return currentLang() === 'ar' ? m.bodyAr || m.body : m.body;
}

function all() {
  return [...outbox().map(o => ({ ...o, mine: true })), ...SEED_MAILBOX];
}

function renderList() {
  const items = all();
  if (!items.length) {
    return `<div class="caption-muted">${esc(t('mail.empty'))}</div>`;
  }
  return items.map(m => `
    <button class="mail-row${m.id === selected ? ' active' : ''}${m.read ? '' : ' unread'}" data-mail="${esc(m.id)}" type="button">
      <span class="mail-from">${esc(nameOf(m))}</span>
      <span class="mail-subject">${esc(subjectOf(m))}</span>
      <span class="mail-date">${esc(m.date || '')}</span>
    </button>`).join('');
}

function renderReader() {
  const m = all().find(x => x.id === selected);
  if (!m) {
    return `<div class="caption-muted">${esc(t('mail.empty'))}</div>`;
  }
  return `
    <div class="mail-reader-head">
      <div class="mail-reader-subject">${esc(subjectOf(m))}</div>
      <div class="caption-muted">${esc(nameOf(m))} · ${esc(m.date || '')}</div>
    </div>
    <div class="mail-reader-body">${esc(bodyOf(m))}</div>`;
}

function renderCompose() {
  if (!composeOpen) {
    return `<button class="btn btn-primary" id="mail-compose-btn" type="button">${esc(t('mail.compose'))}</button>`;
  }
  return `
    <div class="mail-compose">
      <label class="modal-form-row"><span>${esc(t('mail.to'))}</span><input class="form-control" id="mail-to" maxlength="80"></label>
      <label class="modal-form-row"><span>${esc(t('mail.subject'))}</span><input class="form-control" id="mail-subject" maxlength="120"></label>
      <label class="modal-form-row"><span>${esc(t('mail.message'))}</span><textarea class="form-control" id="mail-body" rows="4"></textarea></label>
      <button class="btn btn-primary" id="mail-send" type="button">${esc(t('mail.send'))}</button>
    </div>`;
}

function paint(root) {
  const listEl = root.querySelector('.mail-list-card');
  const sideEl = root.querySelector('.mail-side');
  if (!listEl || !sideEl) {
    return;
  }
  const n = unreadCount(SEED_MAILBOX);
  listEl.innerHTML = `
    <div class="mail-count caption-muted">${esc(t('mail.inbox'))} · ${n}</div>
    <div class="mail-list" role="listbox" aria-label="${esc(t('mail.inbox'))}">${renderList()}</div>
    <div class="mail-outbox-head caption-muted">${esc(t('mail.outbox'))} · ${outbox().length}</div>`;
  sideEl.innerHTML = `
    <div class="mail-reader">${renderReader()}</div>
    ${renderCompose()}`;
  root.querySelectorAll('[data-mail]').forEach(b => {
    b.addEventListener('click', () => {
      selected = b.dataset.mail;
      const seed = SEED_MAILBOX.find(x => x.id === selected);
      if (seed) {
        seed.read = true;
      }
      paint(root);
    });
  });
  root.querySelector('#mail-compose-btn')?.addEventListener('click', () => {
    composeOpen = true;
    paint(root);
  });
  root.querySelector('#mail-send')?.addEventListener('click', () => {
    const to = root.querySelector('#mail-to').value.trim();
    const subject = root.querySelector('#mail-subject').value.trim();
    const body = root.querySelector('#mail-body').value.trim();
    if (!to || !subject || !body) {
      return;
    }
    const d = new Date();
    const p = x => String(x).padStart(2, '0');
    saveSettings({
      outbox: [{
        id: `out-${Date.now()}`,
        to,
        subject,
        body,
        date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        read: true
      }, ...outbox()]
    });
    composeOpen = false;
    paint(root);
  });
}

export function initEmail() {
  if (booted) {
    return;
  }
  booted = true;
  const root = document.querySelector('[data-hr-email]');
  if (!root) {
    return;
  }
  if (!selected) {
    selected = SEED_MAILBOX[0]?.id || null;
  }
  applyI18n();
  paint(root);
  window.addEventListener(LANG_EVENT, () => paint(root));
}
