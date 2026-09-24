// goHR — workspace apps as desktop-style windows. The topbar grid button
// opens a launcher window; each workspace app (meetings, mail, chat,
// assistant) opens in its own floating, draggable, minimizable window over
// whatever page you are on — no page navigation. apps.html remains as a
// deep-link shim that opens the launcher (or ?app=mail) directly.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, setText, renderPageMeta } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { CHAT_CHANNELS, EMPLOYEES, SECONDMENTS } from './hr-seed.js';
import { ICONS, NAV } from './shell-render.js';
import { calcGosi, getSettings } from './hr-statutory.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';
import { openAppWindow, setWindowTitle, closeAppWindow, anyAppOpen } from './app-windows.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

let booted = false;
let mail = { folder: 'inbox', openId: null };
let chat = { channel: 'general' };
let aiLog = null; // [{ who: 'ai'|'me', text, links: [] }]

const empOf = code => EMPLOYEES.find(e => e.code === code);
function empName(code) {
  const e = empOf(code);
  if (!e) {
    return code || '—';
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}
const initials = name => String(name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── App registry ──

const WORKSPACE = [
  { key: 'meetings', icon: 'clock', desc: 'ap.appDesc.meetings', w: 860 },
  { key: 'mail', icon: 'fileText', desc: 'ap.appDesc.mail', w: 940 },
  { key: 'chat', icon: 'users', desc: 'ap.appDesc.chat', w: 780 },
  { key: 'ai', icon: 'trendingUp', desc: 'ap.appDesc.ai', w: 660 }
];
const titleKey = key => `ap.tab${key[0].toUpperCase()}${key.slice(1)}`;

function unreadMail() {
  return getSeed('mails').filter(m => !m.deleted && m.folder === 'inbox' && !m.read).length;
}
function upcomingMeetings() {
  return getSeed('meetings').filter(m => m.status !== 'done').length;
}

function tile(iconKey, label, desc, attrs, badge = 0) {
  const svg = ICONS[iconKey] || ICONS.dashboard;
  return `
    <div class="ap-tile" ${attrs}>
      <div class="ap-tile-icon">${svg}${badge ? `<span class="ap-tile-badge">${esc(fmtInt(badge))}</span>` : ''}</div>
      <div>
        <div class="ap-tile-label">${esc(label)}</div>
        <div class="caption-muted" style="font-size:11.5px">${esc(desc)}</div>
      </div>
    </div>`;
}

// ── Launcher window ──

function launcherBody() {
  return `
    <div class="ap-launch-sec">
      <div class="ap-launch-head"><div class="cell-strong" data-i18n="ap.workspace">Workspace apps</div><div class="caption-muted" style="font-size:11.5px" data-i18n="ap.workspaceSub"></div></div>
      <div class="ap-launch-grid" id="ap-ws-grid"></div>
    </div>
    <div class="ap-launch-sec">
      <div class="ap-launch-head"><div class="cell-strong" data-i18n="ap.modules">System modules</div><div class="caption-muted" style="font-size:11.5px" data-i18n="ap.modulesSub"></div></div>
      <div class="ap-launch-grid" id="ap-mod-grid"></div>
    </div>`;
}

function renderLauncher() {
  const ws = document.getElementById('ap-ws-grid');
  if (ws) {
    const badges = { meetings: upcomingMeetings(), mail: unreadMail() };
    ws.innerHTML = WORKSPACE.map(w =>
      tile(w.icon, t(titleKey(w.key)), t(w.desc), `role="button" tabindex="0" data-ap-tab="${w.key}"`, badges[w.key] || 0)
    ).join('');
  }
  const mods = document.getElementById('ap-mod-grid');
  if (mods) {
    mods.innerHTML = NAV.flatMap(g => g.items || [])
      .filter(n => n.key !== 'apps')
      .map(n => tile(n.icon, t(`nav.${n.key}`), `${n.href}`, `role="button" tabindex="0" data-ap-nav="${n.href}"`))
      .join('');
  }
}

// ── Meetings window ──

function meetings() {
  return getSeed('meetings').filter(m => !m.deleted);
}
function nextId(list, prefix) {
  let max = 0;
  for (const r of list) {
    const m = String(r.id || '').match(/(\d+)$/);
    if (m) {
      max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

function mtItem(m, past) {
  const attendees = (m.attendees || []).map(empOf).filter(Boolean);
  const chips = attendees
    .slice(0, 5)
    .map(e => `<span class="cell-avatar" title="${esc(empName(e.code))}" style="background:${AVATAR_BG[e.av] || 'var(--avatar-teal)'};color:white;width:24px;height:24px;font-size:9px;margin-inline-end:-6px;border:2px solid var(--bg-surface)">${esc(initials(empName(e.code)))}</span>`)
    .join('');
  const minutes = currentLang() === 'ar' ? m.minutesAr || m.minutes : m.minutes;
  return `
    <div class="mt-item" data-id="${esc(m.id)}">
      <div class="mt-date">
        <div class="mt-day">${esc(m.at.slice(8, 10))}</div>
        <div class="mt-mon">${esc(m.at.slice(5, 7))}/${esc(m.at.slice(2, 4))}</div>
      </div>
      <div class="mt-body">
        <div class="cell-strong" style="white-space:normal">${esc(currentLang() === 'ar' ? m.titleAr || m.title : m.title)}</div>
        <div class="caption-muted" style="font-size:11.5px">${esc(m.time)} · ${esc(m.where || '—')} · ${fmtInt(m.durMin || 30)}m</div>
        <div style="font-size:12px;margin-top:4px">${esc(currentLang() === 'ar' ? m.agendaAr || m.agenda : m.agenda)}</div>
        ${past && minutes ? `<div class="mt-minutes">${esc(t('mt.minutes'))}: ${esc(minutes)}</div>` : ''}
      </div>
      <div class="mt-side">
        <div class="mt-avatars">${chips}</div>
        ${past
          ? `<span class="status status-green">${esc(t('rx.bValid'))}</span>`
          : `<button class="btn btn-ghost btn-sm" data-mt-done="${esc(m.id)}" type="button">${esc(t('mt.done'))}</button>`}
      </div>
    </div>`;
}
function renderMeetings() {
  const rows = meetings().slice().sort((a, b) => String(a.at + a.time).localeCompare(String(b.at + b.time)));
  const upcoming = rows.filter(m => m.status !== 'done');
  const past = rows.filter(m => m.status === 'done');
  const up = document.getElementById('mt-upcoming');
  const pa = document.getElementById('mt-past');
  if (up) {
    up.innerHTML = upcoming.map(m => mtItem(m, false)).join('') || `<div class="fm-preview-note" style="margin:var(--space-3)">${esc(t('ml.empty'))}</div>`;
  }
  if (pa) {
    pa.innerHTML = past.map(m => mtItem(m, true)).join('') || `<div class="fm-preview-note" style="margin:var(--space-3)">${esc(t('ml.empty'))}</div>`;
  }
  setText('ap-badge-mt', fmtInt(upcoming.length));
}
function openMeetingNew() {
  const emps = EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob');
  showModal({
    title: t('mt.new'),
    size: 'lg',
    body: `
      <div class="dc-form-2col">
        <label class="modal-form-row"><span>${esc(t('mt.title'))}</span><input type="text" class="form-control" id="mt-title"></label>
        <label class="modal-form-row"><span>${esc(t('mt.where'))}</span><input type="text" class="form-control" id="mt-where"></label>
      </div>
      <div class="dc-form-2col">
        <label class="modal-form-row"><span>${esc(t('doc.hDate'))}</span><input type="date" class="form-control" id="mt-date" value="${isoToday()}"></label>
        <label class="modal-form-row"><span>${esc(t('mt.hTime'))}</span><input type="time" class="form-control" id="mt-time" value="10:00"></label>
      </div>
      <label class="modal-form-row"><span>${esc(t('mt.agenda'))}</span><input type="text" class="form-control" id="mt-agenda"></label>
      <div class="modal-form-row"><span>${esc(t('mt.attendees').replace('{n}', ''))}</span>
        <div class="mt-attendee-box">${emps.map(e => `<label class="lg-toggle"><input type="checkbox" value="${esc(e.code)}"> ${esc(empName(e.code))}</label>`).join('')}</div>
      </div>
      <div class="form-error" id="mt-err" hidden></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('mt.new'),
        variant: 'primary',
        action: () => {
          const err = document.getElementById('mt-err');
          const title = document.getElementById('mt-title')?.value?.trim();
          if (!title) {
            if (err) {
              err.textContent = t('mt.errTitle');
              err.hidden = false;
            }
            return false;
          }
          const attendees = [...document.querySelectorAll('.mt-attendee-box input:checked')].map(x => x.value);
          saveImportedRows('meetings', [
            {
              id: nextId(meetings(), 'MTG'),
              title,
              titleAr: title,
              at: document.getElementById('mt-date')?.value || isoToday(),
              time: document.getElementById('mt-time')?.value || '10:00',
              durMin: Number(getSettings().prefs && getSettings().prefs.apps ? getSettings().prefs.apps.meetingDur : NaN) || 30,
              where: document.getElementById('mt-where')?.value?.trim() || '',
              attendees,
              agenda: document.getElementById('mt-agenda')?.value?.trim() || '',
              agendaAr: document.getElementById('mt-agenda')?.value?.trim() || '',
              status: 'scheduled',
              minutes: '',
              minutesAr: ''
            }
          ]);
          showToast(t('mt.toastNew'), { variant: 'success' });
          renderMeetings();
          renderLauncher();
        }
      }
    ]
  });
}
function openMinutes(m) {
  showModal({
    title: `${t('mt.minutes')} · ${currentLang() === 'ar' ? m.titleAr || m.title : m.title}`,
    body: `<label class="modal-form-row"><span>${esc(t('mt.minutes'))}</span><textarea class="form-control" id="mt-minutes" rows="5" placeholder="${esc(t('mt.minutesPh'))}"></textarea></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('mt.done'),
        variant: 'primary',
        action: () => {
          const v = document.getElementById('mt-minutes')?.value?.trim() || '—';
          saveImportedRows('meetings', [{ ...m, status: 'done', minutes: v, minutesAr: v }]);
          showToast(t('mt.toastDone'), { variant: 'success' });
          renderMeetings();
          renderLauncher();
        }
      }
    ]
  });
}

// ── Mail window ──

function mails() {
  return getSeed('mails').filter(m => !m.deleted);
}
function msgTitle(m) {
  return currentLang() === 'ar' ? m.subjectAr || m.subject : m.subject;
}
function msgBody(m) {
  return currentLang() === 'ar' ? m.bodyAr || m.body : m.body;
}
function senderLabel(m) {
  if (m.folder === 'sent') {
    return `${t('ml.me')} → ${m.to ? empName(m.to) : m.toExt || '—'}`;
  }
  return m.from === 'me' ? t('ml.me') : m.from ? empName(m.from) : `${t('ml.external')} · ${m.fromExt || ''}`;
}
function renderMail() {
  const rows = mails()
    .filter(m => m.folder === mail.folder)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const unread = mails().filter(m => m.folder === 'inbox' && !m.read).length;
  setText('ml-unread', fmtInt(unread));
  setText('ap-badge-ml', fmtInt(unread));
  const list = document.getElementById('ml-list');
  if (list) {
    list.innerHTML =
      rows
        .map(
          m => `
      <button class="ap-msg ${m.read ? '' : 'unread'} ${mail.openId === m.id ? 'open' : ''}" data-ml-open="${esc(m.id)}" type="button">
        <span class="ap-msg-dot"></span>
        <span class="ap-msg-main">
          <span class="ap-msg-from">${esc(senderLabel(m))}${m.starred ? ' ★' : ''}</span>
          <span class="ap-msg-subj">${esc(msgTitle(m))}</span>
          <span class="ap-msg-prev">${esc(String(msgBody(m)).slice(0, 60))}…</span>
        </span>
        <span class="ap-msg-date">${esc(fmtDate(m.at))}</span>
      </button>`
        )
        .join('') || `<div class="fm-preview-note" style="margin:var(--space-3)">${esc(t('ml.empty'))}</div>`;
  }
  const reader = document.getElementById('ml-reader');
  if (reader) {
    const m = mails().find(x => x.id === mail.openId && x.folder === mail.folder);
    if (!m) {
      reader.innerHTML = `<div class="fm-preview-note" style="margin:0" >${esc(t('ml.empty'))}</div>`;
    } else {
      if (!m.read) {
        saveImportedRows('mails', [{ ...m, read: true }]);
      }
      const cur = mails().find(x => x.id === m.id);
      reader.innerHTML = `
        <div class="ap-reader-head">
          <div>
            <div class="cell-strong" style="white-space:normal">${esc(msgTitle(cur))}</div>
            <div class="caption-muted" style="font-size:12px">${esc(senderLabel(cur))} · ${esc(fmtDate(cur.at))}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="card-opt-btn" data-ml-star="${esc(cur.id)}" aria-label="${esc(t('ml.star'))}" data-tooltip="${esc(t('ml.star'))}"><svg viewBox="0 0 24 24" fill="${cur.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2 1.2-6.8-5-4.9 6.9-1z"/></svg></button>
            <button class="card-opt-btn" data-ml-del="${esc(cur.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
          </div>
        </div>
        <div class="ap-reader-body">${esc(msgBody(cur)).replace(/\n/g, '<br>')}</div>`;
      renderMailListOnly();
    }
  }
}
// refresh list without clobbering the reader (used after read-state change)
function renderMailListOnly() {
  const rows = mails()
    .filter(m => m.folder === mail.folder)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const unread = mails().filter(m => m.folder === 'inbox' && !m.read).length;
  setText('ml-unread', fmtInt(unread));
  setText('ap-badge-ml', fmtInt(unread));
  const list = document.getElementById('ml-list');
  if (list) {
    list.innerHTML =
      rows
        .map(
          m => `
      <button class="ap-msg ${m.read ? '' : 'unread'} ${mail.openId === m.id ? 'open' : ''}" data-ml-open="${esc(m.id)}" type="button">
        <span class="ap-msg-dot"></span>
        <span class="ap-msg-main">
          <span class="ap-msg-from">${esc(senderLabel(m))}${m.starred ? ' ★' : ''}</span>
          <span class="ap-msg-subj">${esc(msgTitle(m))}</span>
          <span class="ap-msg-prev">${esc(String(msgBody(m)).slice(0, 60))}…</span>
        </span>
        <span class="ap-msg-date">${esc(fmtDate(m.at))}</span>
      </button>`
        )
        .join('');
  }
}
function openCompose() {
  const emps = EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob');
  showModal({
    title: t('ml.compose'),
    body: `
      <label class="modal-form-row"><span>${esc(t('ml.to'))}</span><select class="form-control" id="ml-to"><option value="">${esc(t('doc.none'))}</option>${emps.map(e => `<option value="${esc(e.code)}">${esc(empName(e.code))} · ${esc(e.code)}</option>`).join('')}</select></label>
      <label class="modal-form-row"><span>${esc(t('ml.toExt'))}</span><input type="email" class="form-control" id="ml-to-ext" placeholder="name@company.com"></label>
      <label class="modal-form-row"><span>${esc(t('doc.subject'))}</span><input type="text" class="form-control" id="ml-subject"></label>
      <label class="modal-form-row" style="margin-bottom:0"><span>${esc(t('ml.body'))}</span><textarea class="form-control" id="ml-body" rows="5"></textarea></label>
      <div class="form-error" id="ml-err" hidden></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('ml.send'),
        variant: 'primary',
        action: () => {
          const err = document.getElementById('ml-err');
          const to = document.getElementById('ml-to')?.value || '';
          const toExt = document.getElementById('ml-to-ext')?.value?.trim() || '';
          const subject = document.getElementById('ml-subject')?.value?.trim();
          const body = document.getElementById('ml-body')?.value?.trim();
          if ((!to && !toExt) || !subject || !body) {
            if (err) {
              err.textContent = t('ml.errTo');
              err.hidden = false;
            }
            return false;
          }
          saveImportedRows('mails', [
            {
              id: nextId(mails(), 'M'),
              folder: 'sent',
              from: 'me',
              fromExt: '',
              to,
              toExt,
              subject,
              subjectAr: subject,
              body,
              bodyAr: body,
              at: isoToday(),
              read: true,
              starred: false,
              body: body + ((getSettings().prefs && getSettings().prefs.mail ? getSettings().prefs.mail.signature : '') ? `\n\n--\n${getSettings().prefs.mail.signature}` : ''),
              bodyAr: body + ((getSettings().prefs && getSettings().prefs.mail ? getSettings().prefs.mail.signature : '') ? `\n\n--\n${getSettings().prefs.mail.signature}` : '')
            }
          ]);
          showToast(t('ml.toastSent'), { variant: 'success' });
          mail.folder = 'sent';
          mail.openId = null;
          document.querySelectorAll('.ap-folder').forEach(f => f.classList.toggle('active', f.dataset.mlFolder === 'sent'));
          renderMail();
          renderLauncher();
        }
      }
    ]
  });
}

// ── Chat window ──

function chatMsgs() {
  return getSeed('chatMessages').filter(m => !m.deleted);
}
function renderChat() {
  const chanHost = document.getElementById('ch-channels');
  if (chanHost) {
    chanHost.innerHTML = CHAT_CHANNELS.map(c => {
      const on = chat.channel === c.id;
      const last = chatMsgs().filter(m => m.channel === c.id).slice(-1)[0];
      return `
      <button class="ap-folder ${on ? 'active' : ''}" data-ch-chan="${esc(c.id)}" type="button">
        <span>${esc(currentLang() === 'ar' ? c.nameAr || c.name : c.name)}</span>
        <span class="caption-muted" style="font-size:10.5px">${esc(String((currentLang() === 'ar' ? last?.textAr : last?.text) || last?.text || '').slice(0, 22))}…</span>
      </button>`;
    }).join('');
  }
  const chan = CHAT_CHANNELS.find(c => c.id === chat.channel);
  const head = document.getElementById('ch-head');
  if (head) {
    head.innerHTML = `<div class="cell-strong">${esc(currentLang() === 'ar' ? chan?.nameAr || chan?.name : chan?.name)}</div><div class="caption-muted" style="font-size:11.5px">${esc(currentLang() === 'ar' ? chan?.topicAr || chan?.topic : chan?.topic)}</div>`;
  }
  const host = document.getElementById('ch-msgs');
  if (host) {
    host.innerHTML = chatMsgs()
      .filter(m => m.channel === chat.channel)
      .map(m => {
        const mine = m.from === 'me';
        return `
        <div class="ap-bubble-row ${mine ? 'mine' : ''}">
          ${mine ? '' : `<span class="cell-avatar" style="background:${AVATAR_BG[empOf(m.from)?.av] || 'var(--avatar-azure)'};color:white;width:26px;height:26px;font-size:9px">${esc(initials(empName(m.from)))}</span>`}
          <div class="ap-bubble">
            <div class="ap-bubble-meta">${mine ? esc(t('ml.me')) : esc(empName(m.from))} · ${esc(String(m.at).slice(11, 16))}</div>
            <div>${esc(currentLang() === 'ar' ? m.textAr || m.text : m.text)}</div>
          </div>
        </div>`;
      })
      .join('');
    host.scrollTop = host.scrollHeight;
  }
}
function sendChat() {
  const input = document.getElementById('ch-input');
  const text = input?.value?.trim();
  if (!text) {
    return;
  }
  saveImportedRows('chatMessages', [
    {
      id: nextId(chatMsgs(), 'CM'),
      channel: chat.channel,
      from: 'me',
      text,
      textAr: text,
      at: `${isoToday()}T${new Date().toTimeString().slice(0, 5)}`
    }
  ]);
  if (input) {
    input.value = '';
  }
  renderChat();
}

// ── AI assistant window (local, live data) ──

function dataStats() {
  const today = isoToday();
  const emps = EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob');
  const saudi = emps.filter(e => e.nat === 'Saudi').length;
  const probation = emps.filter(e => e.st === 'probation').length;
  let expired = 0;
  let critical = 0;
  let urgent = 0;
  const band = iso => {
    if (!iso) {
      return null;
    }
    const d = Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
    if (d < 0) {
      expired += 1;
    } else if (d <= 7) {
      critical += 1;
    } else if (d <= 30) {
      urgent += 1;
    }
    return d;
  };
  for (const e of emps) {
    const expat = e.nat !== 'Saudi';
    if (expat) {
      band(e.iqamaExp);
    }
    band(e.passportExp);
    if (expat) {
      band(e.insExp);
    }
  }
  const inv = getSeed('invoices');
  const outstanding = r2(inv.filter(r => r.status === 'sent').reduce((a, r) => a + r.total, 0));
  const overdue = r2(inv.filter(r => r.status === 'sent' && r.due < today).reduce((a, r) => a + r.total, 0));
  const revenue = r2(inv.filter(r => r.status !== 'draft').reduce((a, r) => a + r.sub, 0));
  const cost = r2(
    SECONDMENTS.map(s => empOf(s.emp))
      .filter(Boolean)
      .reduce((a, e) => {
        const wage = (Number(e.basic) || 0) + (Number(e.housing) || 0) + (Number(e.transport) || 0);
        const g = calcGosi({ basic: Number(e.basic) || 0, housing: Number(e.housing) || 0, isSaudi: e.nat === 'Saudi' });
        return a + wage + g.employer;
      }, 0)
  );
  const margin = r2(revenue - cost);
  const pendingLeave = getSeed('leaves').filter(l => l.st === 'pending').length;
  const cands = getSeed('candidates');
  const pipeline = cands.filter(c => !['hired', 'rejected'].includes(c.stage)).length;
  const offers = cands.filter(c => c.stage === 'offer').length;
  const upcomingMt = meetings().filter(m => m.status !== 'done').length;
  return { emps: emps.length, saudi, probation, expired, critical, urgent, outstanding, overdue, revenue, cost, margin, pendingLeave, pipeline, offers, upcomingMt };
}
function answer(qRaw) {
  const q = qRaw.toLowerCase();
  const s = dataStats();
  const has = (...words) => words.some(w => q.includes(w));
  if (has('موظف', 'عدد', 'headcount', 'employee', 'staff', 'سعودي', 'saudization', 'سعودة')) {
    return {
      text: currentLang() === 'ar'
        ? `لديك ${fmtInt(s.emps)} موظفًا نشطًا: ${fmtInt(s.saudi)} سعوديًا و${fmtInt(s.emps - s.saudi)} وافدًا، منهم ${fmtInt(s.probation)} تحت التجربة.`
        : `You have ${fmtInt(s.emps)} active employees: ${fmtInt(s.saudi)} Saudi and ${fmtInt(s.emps - s.saudi)} expat, ${fmtInt(s.probation)} on probation.`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الموظفون' : 'Open Employees', nav: 'employees.html' }]
    };
  }
  if (has('انتهاء', 'تجديد', 'إقامة', 'وثائق', 'iqama', 'expir', 'renew', 'documents')) {
    return {
      text: currentLang() === 'ar'
        ? `الوثائق المتعثرة: ${fmtInt(s.expired)} منتهية، ${fmtInt(s.critical)} خلال ٧ أيام، ${fmtInt(s.urgent)} خلال ٣٠ يومًا. ابدأ بقائمة التجديدات.`
        : `Documents at risk: ${fmtInt(s.expired)} expired, ${fmtInt(s.critical)} within 7 days, ${fmtInt(s.urgent)} within 30 days. Start with the renewals worklist.`,
      links: [
        { label: currentLang() === 'ar' ? 'فتح التجديدات' : 'Open Renewals', nav: 'renewals.html' },
        { label: currentLang() === 'ar' ? 'فتح الملفات' : 'Open Files', nav: 'files.html' }
      ]
    };
  }
  if (has('فاتورة', 'فواتير', 'متأخر', 'مستحق', 'invoice', 'overdue', 'outstanding', 'payment')) {
    return {
      text: currentLang() === 'ar'
        ? `المستحق لديك ${fmtSARshort(s.outstanding)}، منه ${fmtSARshort(s.overdue)} متأخر عن الاستحقاق. راجع سجل المبيعات والمتابعة.`
        : `Outstanding is ${fmtSARshort(s.outstanding)}, of which ${fmtSARshort(s.overdue)} is overdue. Check the sales ledger and follow up.`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الفواتير' : 'Open Invoicing', nav: 'invoices.html' }]
    };
  }
  if (has('ربح', 'هامش', 'هوامش', 'تكلفة', 'إيراد', 'margin', 'profit', 'revenue', 'cost')) {
    const rate = s.revenue ? Math.round((s.margin / s.revenue) * 1000) / 10 : 0;
    return {
      text: currentLang() === 'ar'
        ? `الإيرادات المفوترة ${fmtSARshort(s.revenue)} مقابل تكلفة إسناد ${fmtSARshort(s.cost)} — هامش ${fmtSARshort(s.margin)} (${rate}%).`
        : `Billed revenue ${fmtSARshort(s.revenue)} vs secondment cost ${fmtSARshort(s.cost)} — margin ${fmtSARshort(s.margin)} (${rate}%).`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الربحية' : 'Open Profitability', nav: 'profitability.html' }]
    };
  }
  if (has('إجاز', 'اجاز', 'leave', 'vacation')) {
    return {
      text: currentLang() === 'ar'
        ? `${fmtInt(s.pendingLeave)} طلب إجازة بانتظار الاعتماد.`
        : `${fmtInt(s.pendingLeave)} leave request(s) awaiting approval.`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الإجازات' : 'Open Leave', nav: 'leave.html' }]
    };
  }
  if (has('توظيف', 'مرشح', 'استقطاب', 'offer', 'candidate', 'hiring', 'recruit', 'pipeline')) {
    return {
      text: currentLang() === 'ar'
        ? `خط الاستقطاب: ${fmtInt(s.pipeline)} مرشحًا نشطًا، منهم ${fmtInt(s.offers)} عرضًا بانتظار القبول.`
        : `Pipeline: ${fmtInt(s.pipeline)} active candidates, ${fmtInt(s.offers)} offer(s) awaiting acceptance.`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الاستقطاب' : 'Open Recruitment', nav: 'recruitment.html' }]
    };
  }
  if (has('اجتماع', 'meeting', 'schedule')) {
    return {
      text: currentLang() === 'ar'
        ? `${fmtInt(s.upcomingMt)} اجتماعًا قادمًا مجدولًا.`
        : `${fmtInt(s.upcomingMt)} upcoming meeting(s) scheduled.`,
      links: [{ label: currentLang() === 'ar' ? 'فتح الاجتماعات' : 'Open Meetings', tab: 'meetings' }]
    };
  }
  return {
    text: t('ai.greet'),
    links: []
  };
}
function fmtSARshort(n) {
  const v = Math.round(Number(n) || 0);
  return currentLang() === 'ar' ? `${v.toLocaleString('en-US')} ر.س` : `SAR ${v.toLocaleString('en-US')}`;
}
function ensureAi() {
  if (!aiLog) {
    aiLog = [{ who: 'ai', text: t('ai.greet'), links: [] }];
  }
}
function pushAi(q) {
  const a = answer(q);
  aiLog.push({ who: 'me', text: q, links: [] });
  aiLog.push({ who: 'ai', text: a.text, links: a.links });
  renderAi();
}
function renderAi() {
  const host = document.getElementById('ai-log');
  if (!host) {
    return;
  }
  host.innerHTML = aiLog
    .map(row => {
      const mine = row.who === 'me';
      return `
      <div class="ap-bubble-row ${mine ? 'mine' : ''}">
        ${mine ? '' : `<span class="cell-avatar" style="background:var(--primary);color:white;width:26px;height:26px;font-size:9px">AI</span>`}
        <div class="ap-bubble">
          ${row.who === 'ai' && aiLog.indexOf(row) === 0 ? `<div class="ap-bubble-meta">goHR</div>` : ''}
          <div>${esc(row.text)}</div>
          ${row.links.length ? `<div class="ap-ai-links">${row.links.map((l, i) => `<button class="ap-ai-link" data-ai-nav="${esc(l.nav || '')}" data-ai-tab="${esc(l.tab || '')}" data-idx="${i}" type="button">${esc(l.label)}</button>`).join('')}</div>` : ''}
        </div>
      </div>`;
    })
    .join('');
  host.scrollTop = host.scrollHeight;
}
function renderAiQuick() {
  const quickHost = document.getElementById('ai-quick');
  if (!quickHost) {
    return;
  }
  const QUICK = ['ai.qStaff', 'ai.qExpiry', 'ai.qOverdue', 'ai.qMargin', 'ai.qLeave', 'ai.qHiring'];
  quickHost.innerHTML = QUICK.map(k => `<button class="ap-ai-link" type="button" data-ai-quick="${esc(k)}">${esc(t(k))}</button>`).join('');
}

// ── Window bodies ──

function meetingsBody() {
  return `
    <div class="appwin-toolbar">
      <span class="status status-blue" data-i18n="ap.tabMeetings">Meetings</span>
      <button class="btn btn-primary btn-sm" data-win-cta="meetings" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg> <span data-i18n="mt.new">Schedule meeting</span></button>
    </div>
    <div class="card"><div class="card-header"><div class="card-title" data-i18n="mt.upcoming">Upcoming</div><span class="inv-tab-badge" id="ap-badge-mt"></span></div><div class="card-body p-0"><div id="mt-upcoming"></div></div></div>
    <div class="card" style="margin-top:var(--space-3)"><div class="card-header"><div class="card-title" data-i18n="mt.past">Past &amp; minutes</div></div><div class="card-body p-0"><div id="mt-past"></div></div></div>`;
}
function mailBody() {
  return `
    <div class="ap-mail">
      <div class="ap-mail-side">
        <button class="btn btn-primary btn-sm ap-compose-btn" id="ml-compose" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg> <span data-i18n="ml.compose">Compose</span></button>
        <button class="ap-folder active" data-ml-folder="inbox" type="button"><span data-i18n="ml.inbox">Inbox</span> <span class="rc-col-count" id="ml-unread"></span></button>
        <button class="ap-folder" data-ml-folder="sent" type="button"><span data-i18n="ml.sent">Sent</span></button>
      </div>
      <div class="ap-mail-list" id="ml-list"></div>
      <div class="ap-mail-reader" id="ml-reader"><div class="fm-preview-note" style="margin:0" data-i18n="ml.empty"></div></div>
    </div>`;
}
function chatBody() {
  return `
    <div class="ap-chat">
      <div class="ap-chat-side" id="ch-channels"></div>
      <div class="ap-chat-main">
        <div class="ap-chat-head" id="ch-head"></div>
        <div class="ap-chat-msgs" id="ch-msgs"></div>
        <div class="ap-chat-input">
          <input type="text" class="form-control" id="ch-input" data-i18n-placeholder="ch.placeholder" placeholder="Write a message…">
          <button class="btn btn-primary btn-sm" id="ch-send" type="button" data-i18n="ml.send">Send</button>
        </div>
      </div>
    </div>`;
}
function aiBody() {
  return `
    <div class="ap-ai">
      <div class="ap-chat-msgs" id="ai-log"></div>
      <div class="ap-ai-quick" id="ai-quick"></div>
      <div class="ap-chat-input">
        <input type="text" class="form-control" id="ai-input" data-i18n-placeholder="ai.placeholder" placeholder="Ask about your data…">
        <button class="btn btn-primary btn-sm" id="ai-send" type="button" data-i18n="ai.ask">Ask</button>
      </div>
      <div class="caption-muted" style="margin-top:8px;text-align:center" data-i18n="ai.note"></div>
    </div>`;
}

const RENDER = { meetings: renderMeetings, mail: renderMail, chat: renderChat, ai: openAiRender };
function openAiRender() {
  ensureAi();
  renderAiQuick();
  renderAi();
}

// ── Open / focus windows ──

function bindInputs(root) {
  root.querySelectorAll('.ap-folder[data-ml-folder]').forEach(f => {
    f.addEventListener('click', () => {
      mail.folder = f.dataset.mlFolder;
      mail.openId = null;
      root.querySelectorAll('.ap-folder[data-ml-folder]').forEach(x => x.classList.toggle('active', x === f));
      renderMail();
    });
  });
  root.querySelector('#ml-compose')?.addEventListener('click', openCompose);
  root.querySelector('#ch-send')?.addEventListener('click', sendChat);
  root.querySelector('#ch-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      sendChat();
    }
  });
  root.querySelector('#ai-send')?.addEventListener('click', () => {
    const input = root.querySelector('#ai-input');
    const v = input?.value?.trim();
    if (v) {
      pushAi(v);
      if (input) {
        input.value = '';
      }
    }
  });
  root.querySelector('#ai-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = root.querySelector('#ai-input');
      const v = input?.value?.trim();
      if (v) {
        pushAi(v);
        if (input) {
          input.value = '';
        }
      }
    }
  });
  root.querySelector('#ai-quick')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-ai-quick]');
    if (chip) {
      pushAi(t(chip.dataset.aiQuick));
    }
  });
}

function bindAppEvents(root) {
  root.addEventListener('click', e => {
    const ws = e.target.closest('[data-ap-tab]');
    if (ws) {
      openApp(ws.dataset.apTab);
      return;
    }
    const nav = e.target.closest('[data-ap-nav]');
    if (nav) {
      window.location.href = nav.dataset.apNav;
      return;
    }
    const cta = e.target.closest('[data-win-cta]');
    if (cta) {
      if (cta.dataset.winCta === 'meetings') {
        openMeetingNew();
      }
      return;
    }
    const done = e.target.closest('[data-mt-done]');
    if (done) {
      const m = meetings().find(x => x.id === done.dataset.mtDone);
      if (m) {
        openMinutes(m);
      }
      return;
    }
    const open = e.target.closest('[data-ml-open]');
    if (open) {
      mail.openId = open.dataset.mlOpen;
      renderMail();
      return;
    }
    const star = e.target.closest('[data-ml-star]');
    if (star) {
      const m = mails().find(x => x.id === star.dataset.mlStar);
      if (m) {
        saveImportedRows('mails', [{ ...m, starred: !m.starred }]);
        renderMail();
      }
      return;
    }
    const del = e.target.closest('[data-ml-del]');
    if (del) {
      const m = mails().find(x => x.id === del.dataset.mlDel);
      if (m && window.confirm(t('doc.confirmDelete'))) {
        saveImportedRows('mails', [{ ...m, deleted: true }]);
        mail.openId = null;
        renderMail();
        renderLauncher();
      }
      return;
    }
    const chan = e.target.closest('[data-ch-chan]');
    if (chan) {
      chat.channel = chan.dataset.chChan;
      renderChat();
      return;
    }
    const aiNav = e.target.closest('[data-ai-nav]');
    if (aiNav && !aiNav.dataset.aiQuick) {
      if (aiNav.dataset.aiNav) {
        window.location.href = aiNav.dataset.aiNav;
      } else if (aiNav.dataset.aiTab) {
        openApp(aiNav.dataset.aiTab);
      }
    }
  });
}

let langBound = false;
function ensureLangHook() {
  if (langBound) {
    return;
  }
  langBound = true;
  window.addEventListener(LANG_EVENT, () => {
    if (anyAppOpen()) {
      renderOpenWindows();
    }
    renderAppsMeta();
  });
}

function renderAppsMeta() {
  renderPageMeta([
    `${fmtInt(WORKSPACE.length)} ${t('ap.tabApps')}`,
    `${fmtInt(upcomingMeetings())} ${t('ap.tabMeetings')}`,
    `${fmtInt(unreadMail())} ${t('ap.tabMail')}`
  ]);
}

function openApp(key) {
  const def = WORKSPACE.find(w => w.key === key);
  if (!def) {
    ensureLangHook();
    return;
  }
  ensureLangHook();
  const win = openAppWindow({
    id: `app-${key}`,
    iconSvg: ICONS[def.icon] || '',
    title: t(titleKey(key)),
    width: def.w
  });
  if (win.fresh) {
    win.body.innerHTML = key === 'meetings' ? meetingsBody() : key === 'mail' ? mailBody() : key === 'chat' ? chatBody() : aiBody();
    applyI18n(win.body);
    bindInputs(win.body);
    bindAppEvents(win.el);
  }
  RENDER[key]();
  renderLauncher();
}

export function openAppsLauncher() {
  ensureLangHook();
  const win = openAppWindow({
    id: 'app-launcher',
    iconSvg: ICONS.grid || '',
    title: t('ap.tabApps'),
    width: 680
  });
  if (win.fresh) {
    win.body.innerHTML = launcherBody();
    win.body.classList.add('appwin-launcher');
    applyI18n(win.body);
    bindAppEvents(win.el);
  }
  renderLauncher();
}

// Re-render every open window (language switch).
function renderOpenWindows() {
  for (const key of WORKSPACE.map(w => w.key)) {
    if (document.getElementById(key === 'meetings' ? 'mt-upcoming' : key === 'mail' ? 'ml-list' : key === 'chat' ? 'ch-msgs' : 'ai-log')) {
      RENDER[key]();
    }
    setWindowTitle(`app-${key}`, t(titleKey(key)));
  }
  if (document.getElementById('ap-ws-grid')) {
    renderLauncher();
  }
  setWindowTitle('app-launcher', t('ap.tabApps'));
}

// ── Boot (apps.html shim) ──

export function initApps() {
  if (booted) {
    openAppsLauncher();
    return;
  }
  booted = true;
  ensureLangHook();
  renderAppsMeta();
  // Deep link: apps.html?app=mail opens that app window directly.
  const app = new URLSearchParams(window.location.search).get('app');
  if (app && WORKSPACE.some(w => w.key === app)) {
    openApp(app);
  } else {
    openAppsLauncher();
  }
}

// Keep closeAppWindow referenced for external shells that want to tidy up.
void closeAppWindow;
