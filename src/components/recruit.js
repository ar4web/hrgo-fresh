// goHR — recruitment (recruitment.html). Vacancies + candidate pipeline:
// a Kanban board (applied → screened → interview → offer → hired, with a
// rejected lane), vacancy cards with filters, and a hire flow that creates
// the employee record (next EMP code, probation status, wage breakdown)
// and stamps the candidate as hired — closing the loop into Employees.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, fmtSAR, setText } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { CLIENTS, DEPARTMENTS, EMPLOYEES, SKILLS, VACANCIES } from './hr-seed.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);
const round50 = n => Math.round((Number(n) || 0) / 50) * 50;

const STAGES = ['applied', 'screened', 'interview', 'offer', 'hired', 'rejected'];
const STAGE_KEY = {
  applied: 'rc.stageApplied',
  screened: 'rc.stageScreened',
  interview: 'rc.stageInterview',
  offer: 'rc.stageOffer',
  hired: 'rc.stageHired',
  rejected: 'rc.stageRejected'
};
const NEXT_STAGE = { applied: 'screened', screened: 'interview', interview: 'offer' };

let booted = false;
let vacFilter = '';

// ── Data ──

const cand = () => getSeed('candidates');
const vacOf = id => VACANCIES.find(v => v.id === id);
function vacTitle(id) {
  const v = vacOf(id);
  if (!v) {
    return id;
  }
  return currentLang() === 'ar' ? v.titleAr || v.titleEn : v.titleEn;
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}
function skillOf(code) {
  const s = SKILLS.find(x => x.code === code);
  if (!s) {
    return code;
  }
  return currentLang() === 'ar' ? s.ar : s.en;
}
function candName(c) {
  return currentLang() === 'ar' ? c.nameAr || c.nameEn : c.nameEn;
}

// ── Stats + vacancies ──

function renderStats() {
  const rows = cand();
  const active = rows.filter(r => r.stage !== 'hired' && r.stage !== 'rejected').length;
  const offers = rows.filter(r => r.stage === 'offer').length;
  const hired = rows.filter(r => r.stage === 'hired' && String(r.hiredCode || '').startsWith('EMP-')).length;
  const open = VACANCIES.filter(v => v.status === 'open').length;
  setText('rc-stat-vac', fmtInt(open));
  setText('rc-stat-active', fmtInt(active));
  setText('rc-stat-offers', fmtInt(offers));
  setText('rc-stat-hired', fmtInt(hired));
    const count = document.getElementById('rc-count');
  if (count) {
    count.textContent = t('inv.count').replace('{n}', fmtInt(rows.length)).replace('{month}', vacFilter ? vacTitle(vacFilter) : t('rc.allVacancies'));
  }
}

function renderVacancies() {
  const grid = document.getElementById('rc-vac-grid');
  if (!grid) {
    return;
  }
  grid.innerHTML = VACANCIES
    .map(v => {
      const c = v.client ? CLIENTS.find(x => x.id === v.client) : null;
      const inPipe = cand().filter(r => r.vacancy === v.id && r.stage !== 'rejected').length;
      const hired = cand().filter(r => r.vacancy === v.id && r.stage === 'hired').length;
      return `
      <div class="tpl-card">
        <div class="tpl-card-head">
          <div>
            <div class="tpl-card-name">${esc(vacTitle(v.id))}</div>
            <div class="caption-muted" style="font-size:11.5px">${esc(deptName(v.dept))}${c ? ` · ${esc(currentLang() === 'ar' ? c.nameAr || c.nameEn : c.nameEn)}` : ''}</div>
          </div>
          <span class="dc-cat-tag">${esc(t('inv.headsH'))}: ${fmtInt(v.count)}</span>
        </div>
        <div class="tpl-card-meta">
          <span>${esc(t('rc.appliedOn'))} ${esc(fmtDate(v.opened))}</span>
          <span class="caption-muted">${fmtInt(inPipe)} ${esc(t('rc.active'))} · ${fmtInt(hired)} ${esc(t('rc.stageHired').toLowerCase())}</span>
        </div>
      </div>`;
    })
    .join('');
}

// ── Kanban board ──

function inScope() {
  return cand().filter(r => !vacFilter || r.vacancy === vacFilter);
}

function cardHtml(c) {
  const e = {
    primary: 'var(--primary)',
    azure: 'var(--avatar-azure)',
    purple: 'var(--avatar-purple)',
    yellow: 'var(--yellow)',
    green: 'var(--green)',
    red: 'var(--avatar-red)',
    blue: 'var(--avatar-blue)'
  };
  const initials = (c.nameEn || c.id).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const canAdvance = !!NEXT_STAGE[c.stage];
  const isRejected = c.stage === 'rejected';
  const isHired = c.stage === 'hired';
  return `
    <div class="rc-card" data-id="${esc(c.id)}" role="button" tabindex="0">
      <div class="rc-card-top">
        <div class="cell-avatar" style="background:${e[c.av] || 'var(--primary)'};color:white;width:32px;height:32px;font-size:11px">${esc(initials)}</div>
        <div class="rc-card-name">
          <div class="cell-strong" style="white-space:normal;line-height:1.3">${esc(candName(c))}</div>
          <div class="caption-muted" style="font-size:11px">${esc(c.nat)} · ${fmtInt(c.expYears)} ${esc(t('eosb.yearsH'))}</div>
        </div>
      </div>
      <div class="rc-card-meta">${esc(t('rc.expected'))}: <strong>${esc(fmtSAR(c.expected))}</strong></div>
      <div class="rc-card-skills">${(c.skills || []).slice(0, 3).map(s => `<span class="rc-skill">${esc(skillOf(s))}</span>`).join('')}</div>
      ${isHired && c.hiredCode ? `<div class="rc-card-hired">${esc(t('rc.hiredAs').replace('{code}', c.hiredCode))}</div>` : ''}
      <div class="rc-card-actions">
        ${canAdvance ? `<button class="btn btn-primary btn-sm" data-rc-advance="${esc(c.id)}" type="button">${esc(t('rc.advance'))}</button>` : ''}
        ${c.stage === 'offer' ? `<button class="btn btn-primary btn-sm" data-rc-hire="${esc(c.id)}" type="button">${esc(t('rc.hire'))}</button>` : ''}
        ${!isHired && !isRejected ? `<button class="card-opt-btn" data-rc-reject="${esc(c.id)}" aria-label="${esc(t('rc.reject'))}" data-tooltip="${esc(t('rc.reject'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg></button>` : ''}
        ${isRejected ? `<button class="btn btn-ghost btn-sm" data-rc-restore="${esc(c.id)}" type="button">${esc(t('rc.restore'))}</button>` : ''}
      </div>
    </div>`;
}

function renderBoard() {
  const board = document.getElementById('rc-board');
  if (!board) {
    return;
  }
  const rows = inScope();
  board.innerHTML = STAGES
    .map(st => {
      const list = rows.filter(r => r.stage === st).sort((a, b) => String(a.applied).localeCompare(String(b.applied)));
      return `
      <div class="rc-col" data-stage="${st}">
        <div class="rc-col-head">
          <span class="rc-col-title">${esc(t(STAGE_KEY[st]))}</span>
          <span class="rc-col-count">${fmtInt(list.length)}</span>
        </div>
        <div class="rc-col-body">${list.map(cardHtml).join('')}</div>
      </div>`;
    })
    .join('');
}

function renderAll() {
  renderStats();
  renderVacancies();
  renderBoard();
}

// ── Stage moves ──

function patchCand(c, fields, toastKey) {
  saveImportedRows('candidates', [{ ...c, ...fields }]);
  showToast(t(toastKey), { variant: 'success' });
  renderAll();
}

function openAdvance(c) {
  const next = NEXT_STAGE[c.stage];
  patchCand(c, { stage: next }, 'rc.toastStage');
}

// ── Hire flow ──

function openHire(c) {
  const v = vacOf(c.vacancy);
  const basic = round50((Number(c.expected) || 3000) * 0.75);
  showModal({
    title: `${t('rc.hireTitle')} · ${candName(c)}`,
    body: `
      <div class="rx-renew-emp">
        <strong>${esc(vacTitle(c.vacancy))}</strong>
        <span class="caption-muted">${esc(deptName(v?.dept))}${v?.client ? ` · ${esc(v.client)}` : ''}</span>
      </div>
      <label class="modal-form-row"><span>${esc(t('rc.joinDate'))}</span><input type="date" class="form-control" id="rc-join" value="${isoToday()}"></label>
      <div class="dc-form-2col">
        <label class="modal-form-row"><span>${esc(t('rc.basic'))}</span><input type="number" class="form-control" id="rc-basic" value="${basic}" min="0" step="50"></label>
        <label class="modal-form-row"><span>${esc(t('rc.housing'))}</span><input type="number" class="form-control" id="rc-housing" value="${round50(basic * 0.25)}" min="0" step="50"></label>
      </div>
      <label class="modal-form-row" style="margin-bottom:0"><span>${esc(t('rc.transport'))}</span><input type="number" class="form-control" id="rc-transport" value="${round50(basic * 0.11)}" min="0" step="50"></label>
      <div class="form-error" id="rc-hire-err" hidden></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('rc.hire'),
        variant: 'primary',
        action: () => {
          const err = document.getElementById('rc-hire-err');
          if (err) {
            err.hidden = true;
          }
          const basicV = Number(document.getElementById('rc-basic')?.value) || 0;
          const join = document.getElementById('rc-join')?.value;
          if (!basicV || !join) {
            if (err) {
              err.textContent = t('rc.errWage');
              err.hidden = false;
            }
            return false;
          }
          const housing = Number(document.getElementById('rc-housing')?.value) || 0;
          const transport = Number(document.getElementById('rc-transport')?.value) || 0;
          const maxNo = EMPLOYEES.reduce((mx, e) => Math.max(mx, Number(String(e.code).replace(/\D/g, '')) || 0), 0);
          const code = `EMP-${String(maxNo + 1).padStart(4, '0')}`;
          const avs = ['primary', 'azure', 'purple', 'yellow', 'green', 'red', 'blue'];
          saveImportedRows('employees', [
            {
              code,
              nameEn: c.nameEn,
              nameAr: c.nameAr,
              nat: c.nat,
              prof: c.prof,
              titleEn: v?.titleEn || c.prof,
              titleAr: v?.titleAr || c.prof,
              dept: v?.dept || 'OPS',
              join,
              basic: basicV,
              housing,
              transport,
              iban: '',
              bank: '',
              q: 'sent',
              st: 'probation',
              gender: 'M',
              skills: c.skills || [],
              sponsor: 'HQ',
              phone: c.phone || '',
              av: avs[maxNo % avs.length]
            }
          ]);
          patchCand(c, { stage: 'hired', hiredCode: code }, 'rc.toastHired');
        }
      }
    ]
  });
}

// ── Candidate detail ──

function openDetail(c) {
  const v = vacOf(c.vacancy);
  showModal({
    title: candName(c),
    body: `
      <div class="payslip-emp">
        <div><span>${esc(t('rc.filterVacancy'))}</span><strong>${esc(vacTitle(c.vacancy))}</strong></div>
        <div><span>${esc(t('rc.dept'))}</span><strong>${esc(deptName(v?.dept))}</strong></div>
        <div><span>${esc(t('rc.phone'))}</span><strong dir="ltr">${esc(c.phone || '—')}</strong></div>
        <div><span>${esc(t('rc.appliedOn'))}</span><strong>${esc(fmtDate(c.applied))}</strong></div>
        <div><span>${esc(t('rc.expected'))}</span><strong>${esc(fmtSAR(c.expected))}</strong></div>
        <div><span>${esc(t('common.status'))}</span><strong>${esc(t(STAGE_KEY[c.stage]))}</strong></div>
      </div>
      <div class="rc-card-skills" style="margin-top:var(--space-2)">${(c.skills || []).map(s => `<span class="rc-skill">${esc(skillOf(s))}</span>`).join('')}</div>`,
    actions: [{ label: t('common.close'), variant: 'ghost' }]
  });
}

// ── Boot ──

export function initRecruit() {
  const root = document.querySelector('[data-hr-recruit]');
  if (!root) {
    return;
  }
  const sel = document.getElementById('rc-vacancy');
  if (sel) {
    sel.innerHTML =
      `<option value="">${esc(t('rc.allVacancies'))}</option>` +
      VACANCIES.map(v => `<option value="${esc(v.id)}">${esc(vacTitle(v.id))}</option>`).join('');
  }
  renderAll();
  sel?.addEventListener('change', () => {
    vacFilter = sel.value || '';
    renderStats();
    renderBoard();
  });
  root.addEventListener('click', e => {
    const advance = e.target.closest('[data-rc-advance]');
    if (advance) {
      const c = cand().find(x => x.id === advance.dataset.rcAdvance);
      if (c) {
        openAdvance(c);
      }
      return;
    }
    const hire = e.target.closest('[data-rc-hire]');
    if (hire) {
      const c = cand().find(x => x.id === hire.dataset.rcHire);
      if (c) {
        openHire(c);
      }
      return;
    }
    const reject = e.target.closest('[data-rc-reject]');
    if (reject) {
      const c = cand().find(x => x.id === reject.dataset.rcReject);
      if (c && window.confirm(t('rc.confirmReject'))) {
        patchCand(c, { stage: 'rejected' }, 'rc.toastRejected');
      }
      return;
    }
    const restore = e.target.closest('[data-rc-restore]');
    if (restore) {
      const c = cand().find(x => x.id === restore.dataset.rcRestore);
      if (c) {
        patchCand(c, { stage: 'applied' }, 'rc.toastStage');
      }
      return;
    }
    const card = e.target.closest('.rc-card');
    if (card && !e.target.closest('button')) {
      const c = cand().find(x => x.id === card.dataset.id);
      if (c) {
        openDetail(c);
      }
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    if (sel) {
      sel.innerHTML =
        `<option value="">${esc(t('rc.allVacancies'))}</option>` +
        VACANCIES.map(v => `<option value="${esc(v.id)}">${esc(vacTitle(v.id))}</option>`).join('');
    }
    renderAll();
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
