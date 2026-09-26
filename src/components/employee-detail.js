// HR + Operations — employee 360 file (employee-file.html?code=EMP-0001).
// Dense printable dossier: personal, job/pay, GOSI, residency, documents and skills.
// Enhanced with performance score, star rating, and key metrics.

import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { t, currentLang, LANG_EVENT } from './i18n.js';
import { fmtSAR, fmtDate, fmtHijri, initialsOf, maskIban } from './hr-locale.js';
import { calcGosi, calcEOSB, daysUntil, yearsBetween, annualBalance } from './hr-statutory.js';
import { getSeed } from './hr-api.js';
import { exportData } from './import-export.js';
import { DEPARTMENTS, PROFESSIONS, SKILLS, SPONSORS, CLIENTS, SITES } from './hr-seed.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

let booted = false;

function requestedCode() {
  return new URLSearchParams(window.location.search).get('code') || 'EMP-0001';
}

function findEmployee() {
  const code = requestedCode();
  const list = getSeed('employees');
  return {
    code,
    employee: list.find(e => e.code === code) || list[0] || null,
    missing: !list.some(e => e.code === code)
  };
}

function emp() {
  return findEmployee().employee;
}

const EXPORT_COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'nameEn', label: 'Name (EN)' },
  { key: 'nameAr', label: 'Name (AR)' },
  { key: 'nat', label: 'Nationality' },
  { key: 'prof', label: 'Profession' },
  { key: 'dept', label: 'Department' },
  { key: 'join', label: 'Join' },
  { key: 'basic', label: 'Basic' },
  { key: 'housing', label: 'Housing' },
  { key: 'transport', label: 'Transport' },
  { key: 'iqama', label: 'Iqama' },
  { key: 'iqamaExp', label: 'Iqama expiry' },
  { key: 'q', label: 'Qiwa' },
  { key: 'st', label: 'Status' }
];

function profName(code) {
  const p = PROFESSIONS.find(x => x.code === code);
  return p ? (currentLang() === 'ar' ? p.ar : p.en) : code || '—';
}

function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  return d ? (currentLang() === 'ar' ? d.ar : d.en) : code || '—';
}

function skillName(code) {
  const skill = SKILLS.find(x => x.code === code);
  return skill ? (currentLang() === 'ar' ? skill.ar : skill.en) : code;
}

function sponsorName(code) {
  const sponsor = SPONSORS.find(x => x.id === code);
  return sponsor ? (currentLang() === 'ar' ? sponsor.nameAr : sponsor.nameEn) : code || '—';
}

function expBadge(iso) {
  if (!iso) {
    return `<span class="status status-red">${t('status.missing')}</span>`;
  }
  const d = daysUntil(iso);
  if (d < 0) {
    return `<span class="status status-red">${fmtDate(iso)} · ${t('status.expired')}</span>`;
  }
  if (d <= 30) {
    return `<span class="status status-red">${fmtDate(iso)} · ${d} ${t('common.days')}</span>`;
  }
  if (d <= 90) {
    return `<span class="status status-yellow">${fmtDate(iso)} · ${d} ${t('common.days')}</span>`;
  }
  return `<span class="status status-green">${fmtDate(iso)}</span>`;
}

function kv(k, v) {
  return `<div class="hr-kv"><span>${k}</span><strong>${v}</strong></div>`;
}

function kvd(k, v) {
  return `<div class="hr-kv"><span>${k}</span><strong>${esc(v ?? '')}</strong></div>`;
}

function exportEmployee(e) {
  if (!e) {return;}
  exportData('xlsx', e.code, EXPORT_COLUMNS, [e], 'Employee');
}

/** Calculate a performance score (0-100) from employee attributes */
function calcPerformanceScore(e) {
  if (!e) return 0;
  let score = 50; // base
  
  // Tenure factor (0-15 pts)
  if (e.join) {
    const years = yearsBetween(e.join);
    score += Math.min(15, years * 2);
  }
  
  // Saudi national bonus (10 pts)
  if (e.saudi) score += 10;
  
  // Skills relevance (0-10 pts)
  if (e.skills?.length) {
    score += Math.min(10, e.skills.length * 2);
  }
  
  // GOSI enrolled (5 pts)
  if (e.gosi && e.gosiOn) score += 5;
  
  // Active status (5 pts)
  if (e.st === 'active') score += 5;
  
  // Document completeness - Qiwa authenticated (5 pts)
  if (e.q === 'authenticated') score += 5;
  
  // Has IBAN/Bank (5 pts)
  if (e.iban && e.bank) score += 5;
  
  // Has email/phone (5 pts)
  if (e.email && e.phone) score += 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreToStars(score) {
  const full = Math.floor(score / 20);
  const half = score % 20 >= 10 ? 1 : 0;
  const empty = 5 - full - half;
  let html = '';
  for (let i = 0; i < full; i++) {
    html += '<svg class="star full" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l1.18-6.88L0 9.27l6.91-1.01L12 2z"/></svg>';
  }
  if (half) {
    html += '<svg class="star half" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l1.18-6.88L0 9.27l6.91-1.01L12 2z"/></svg>';
  }
  for (let i = 0; i < empty; i++) {
    html += '<svg class="star empty" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l1.18-6.88L0 9.27l6.91-1.01L12 2z"/></svg>';
  }
  return html;
}

function scoreLabel(score) {
  if (score >= 90) return t('perf.excellent');
  if (score >= 75) return t('perf.good');
  if (score >= 60) return t('perf.fair');
  if (score >= 40) return t('perf.needsImprovement');
  return t('perf.poor');
}

function renderHeader(e, info) {
  const aHead = document.getElementById('a4-head');
  const avatarEl = document.getElementById('a4-avatar');
  const warning = document.getElementById('emp-file-warning');
  const starsEl = document.getElementById('emp-stars');
  const scoreLabelEl = document.getElementById('emp-score-label');
  if (!e) {
    if (aHead) {aHead.innerHTML = `<div class="hr-empty">${t('file.recordNotFound')}</div>`;}
    if (starsEl) {starsEl.innerHTML = '';}
    if (scoreLabelEl) {scoreLabelEl.textContent = '—';}
    return;
  }
  if (avatarEl) {
    avatarEl.style.background = AVATAR_BG[e.av] || 'var(--avatar-teal)';
    avatarEl.textContent = initialsOf(e.nameEn);
  }
  const displayName = currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
  document.title = `${displayName} · ${e.code} | goHR`;
  if (warning) {
    warning.hidden = !info.missing;
    warning.textContent = info.missing
      ? t('file.codeNotFound').replace('{code}', info.code)
      : '';
  }
  if (!aHead) {return;}
  const client = CLIENTS.find(c => c.id === e.client);
  const site = SITES.find(s => s.id === e.site);
  const total = (e.basic || 0) + (e.housing || 0) + (e.transport || 0);
  const statusTone = e.st === 'active' ? 'green' : e.st === 'huroob' ? 'red' : 'yellow';
  const clientName = client ? (currentLang() === 'ar' ? client.nameAr : client.nameEn) : '';
  const siteName = site ? (currentLang() === 'ar' ? site.nameAr : site.nameEn) : '';
  aHead.innerHTML = `
    <div class="emp-file-head-row">
      <div class="emp-file-head-main">
        <h1 class="emp-file-name" id="emp-file-name">${esc(displayName)}</h1>
        <div class="emp-file-sub">${esc(e.code)} · ${esc(profName(e.prof))} · ${esc(deptName(e.dept))} · ${esc(fmtDate(e.join))}</div>
        <div class="emp-file-badges">
          <span class="status status-${statusTone}">${esc(t(`status.${e.st}`))}</span>
          <span class="status status-blue">${esc(e.nat)}</span>
          ${client
            ? `<span class="status status-green">${esc(clientName)}${siteName ? ` · ${esc(siteName)}` : ''}</span>`
            : `<span class="status status-blue">${esc(t('status.bench'))}</span>`}
        </div>
      </div>
      <div class="emp-file-package">
        <div>${t('file.totalPackage')}</div>
        <strong>${esc(fmtSAR(total))}</strong>
        <span>${esc(e.phone || '—')}<br>${esc(e.email || '—')}</span>
      </div>
    </div>`;
  
  // Performance Score & Stars
  const score = calcPerformanceScore(e);
  if (starsEl) {starsEl.innerHTML = scoreToStars(score);}
  if (scoreLabelEl) {scoreLabelEl.textContent = `${score} · ${scoreLabel(score)}`;}
}

function renderMetrics(e) {
  const tenureEl = document.getElementById('metric-tenure');
  const saudizationEl = document.getElementById('metric-saudization');
  const docsEl = document.getElementById('metric-docs');
  const leaveEl = document.getElementById('metric-leave');
  if (!e) return;
  
  // Tenure
  const tenure = e.join ? yearsBetween(e.join).toFixed(1) : '—';
  if (tenureEl) {tenureEl.textContent = tenure === '—' ? '—' : t('file.years').replace('{n}', tenure);}
  
  // Saudization
  const saud = e.saudi ? t('file.saudi') : t('file.expat2');
  if (saudizationEl) {saudizationEl.textContent = saud;}
  
  // Document score (based on Qiwa, IBAN, passport, etc.)
  let docScore = 0;
  if (e.q === 'authenticated') docScore += 25;
  if (e.iban && e.bank) docScore += 25;
  if (e.passport && e.passportExp) docScore += 20;
  if (e.saudi ? (e.nid) : (e.iqama && e.iqamaExp)) docScore += 15;
  if (e.gosi && e.gosiOn) docScore += 15;
  if (docsEl) {docsEl.textContent = `${docScore}%`;}
  
  // Leave balance
  const leave = e.join ? annualBalance(e.join, e.annualUsed || 0) : null;
  if (leaveEl) {
    leaveEl.textContent = leave ? `${leave.left} ${t('common.days')}` : '—';
  }
}

function renderBody(e) {
  const grid = document.getElementById('a4-grid');
  const extra = document.getElementById('a4-extra');
  if (!grid || !e) {return;}
  const total = (e.basic || 0) + (e.housing || 0) + (e.transport || 0);
  const g = calcGosi({ basic: e.basic, housing: e.housing, isSaudi: e.saudi, enrolledOn: e.gosiOn });
  const eosb = calcEOSB({ basic: e.basic, joinDate: e.join, endReason: 'termination' });
  const tenure = e.join ? yearsBetween(e.join).toFixed(1) : '—';
  const leave = e.join ? annualBalance(e.join, e.annualUsed || 0) : null;
  const client = CLIENTS.find(c => c.id === e.client);
  const site = SITES.find(s => s.id === e.site);
  const clientName = client ? (currentLang() === 'ar' ? client.nameAr : client.nameEn) : '';
  const siteName = site ? (currentLang() === 'ar' ? site.nameAr : site.nameEn) : '';

  // A4 dense dossier — all areas visible, not tabs.
  const overview =
    `<div class="a4-card"><h2>${t('file.personal')}</h3>` +
    `<div class="hr-kv"><span>${t('emp.code')}</span><strong>${esc(e.code)}</strong></div>` +
    kvd(t('file.nationality'), e.nat) +
    kvd(e.saudi ? t('file.nationalId') : t('file.iqama'), e.saudi ? e.nid || '—' : e.iqama || '—') +
    kvd(t('emp.phone'), e.phone || '—') +
    kvd(t('file.email'), e.email || '—') +
    kvd(t('file.gender'), e.gender === 'F' ? t('file.female') : e.gender === 'M' ? t('file.male') : '—') +
    kvd(t('file.join'), `${fmtDate(e.join)} · ${fmtHijri(e.join)}`) +
    (e.entry ? kvd(t('file.ksaEntry'), fmtDate(e.entry)) : '') +
    kvd('Qiwa', t(`status.${e.q}`)) +
    '</div>';
  const job =
    `<div class="a4-card"><h2>${t('file.jobPay')}</h3>` +
    kvd(t('file.department'), deptName(e.dept)) +
    kvd(t('file.jobTitle'), currentLang() === 'ar' ? e.titleAr || e.titleEn : e.titleEn) +
    kvd(t('file.profession'), profName(e.prof)) +
    kvd(t('file.employment'), e.partTime ? t('file.partTime') : t('file.fullTime')) +
    kvd(t('file.basic'), fmtSAR(e.basic)) +
    kvd(t('file.housing'), fmtSAR(e.housing)) +
    kvd(t('file.transport'), fmtSAR(e.transport)) +
    kv(t('file.total'), `<b>${fmtSAR(total)}</b>`) +
    kvd(t('file.eosbEst'), fmtSAR(eosb.net)) +
    '</div>';
  const deployment =
    `<div class="a4-card"><h2>${t('file.deployment')}</h3>` +
    kvd(t('file.workStatus'), t(`status.${e.st}`)) +
    kvd(t('file.client'), clientName || t('status.bench')) +
    kvd(t('file.site'), siteName || '—') +
    kvd(t('file.sponsor'), sponsorName(e.sponsor)) +
    kvd(t('file.city'), site?.city || e.city || '—') +
    '</div>';
  const leaveCard =
    `<div class="a4-card"><h2>${t('file.timeLeave')}</h3>` +
    kvd(t('file.tenure'), tenure === '—' ? '—' : t('file.years').replace('{n}', tenure)) +
    (leave ? kvd(t('file.annualEnt'), `${leave.entitlement} ${t('common.days')}`) : '') +
    (leave ? kvd(t('file.annualUsed'), `${leave.used} ${t('common.days')}`) : '') +
    (leave ? kvd(t('file.annualBalance'), `${leave.left} ${t('common.days')}`) : '') +
    kvd(t('file.lastExit'), e.exitDate ? fmtDate(e.exitDate) : '—') +
    '</div>';
  const gosi =
    `<div class="a4-card"><h2>${t('file.gosi')}</h3>` +
    kvd(t('file.gosiNo'), e.gosi || (e.saudi ? '—' : t('file.expat2'))) +
    kv(t('file.system'), g.system === 'expat' ? t('file.expat2') : g.system === 'old' ? t('file.old9') : t('file.newPct').replace('{pct}', Math.round(g.pensionRate * 100))) +
    kvd(t('file.contributory'), fmtSAR(g.base)) +
    kvd(t('file.employee'), fmtSAR(g.employee)) +
    kvd(t('file.employer'), fmtSAR(g.employer)) +
    '</div>';
  const residency = e.saudi
    ? `<div class="a4-card"><h2>${t('file.residency')}</h3><div class="hr-kv"><span>${t('file.nationalId')}</span><strong>${esc(e.nid || '—')}</strong></div>${kvd(t('file.iban'), e.iban ? maskIban(e.iban) : '—')}${kvd(t('emp.bank'), e.bank || '—')}</div>`
    : `<div class="a4-card"><h2>${t('file.residency')}</h3>` +
      kvd(t('file.iqamaNo'), e.iqama || '—') +
      kv(t('file.expiry'), expBadge(e.iqamaExp)) +
      kvd(t('file.iqamaProfession'), profName(e.prof)) +
      kvd(t('file.iban'), e.iban ? maskIban(e.iban) : '—') +
      kvd(t('emp.bank'), e.bank || '—') +
      '</div>';
  const docs =
    `<div class="a4-card"><h2>${t('file.documents')}</h3>` +
    kvd(t('file.contract'), t('file.pdfValid')) +
    kvd(e.saudi ? t('file.nidCopy') : t('file.iqamaCopy'), t('file.pdfValid')) +
    kvd('Qiwa', t(`status.${e.q}`)) +
    kvd(t('file.insurance'), e.ins || '—') +
    '</div>';
  const skills = e.skills?.length
    ? `<div class="a4-card"><h2>${t('file.skills')}</h3><div class="a4-skill-list">` +
      e.skills.map(s => `<span class="status status-blue">${esc(skillName(s))}</span>`).join('') +
      '</div></div>'
    : '';
  grid.innerHTML = overview + job + deployment + leaveCard + gosi + residency + docs + skills;
  if (extra) {
    extra.innerHTML = `<div class="a4-card a4-notes"><h2>${t('file.notes')}</h3><div>${
      t('file.dossierFoot')
        .replace('{code}', esc(e.code))
        .replace('{date}', fmtDate(new Date().toISOString().slice(0, 10)))
    }</div>${e.legalNote ? `<div class="a4-legal-note">${esc(currentLang() === 'ar' ? e.legalNoteAr || e.legalNote : e.legalNote)}</div>` : ''}</div>`;
  }
}

function renderAll() {
  const info = findEmployee();
  renderHeader(info.employee, info);
  renderMetrics(info.employee);
  renderBody(info.employee);
}

function openEditModal(e) {
  showModal({
    title: `${t('common.edit')} · ${esc(e.code)}`,
    body: `
      <div class="form-group"><label class="form-label">${t('emp.phone')}</label>
        <input class="form-control" id="ed-phone" value="${esc(e.phone || '')}" dir="ltr"></div>
      <div class="form-group"><label class="form-label">IBAN</label>
        <input class="form-control" id="ed-iban" value="${esc(e.iban || '')}" dir="ltr"></div>
      <div class="form-group" style="margin-bottom:0"><label class="form-label">${t('emp.bank')}</label>
        <input class="form-control" id="ed-bank" value="${esc(e.bank || '')}"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body }) => {
          e.phone = body.querySelector('#ed-phone').value.trim();
          e.iban = body.querySelector('#ed-iban').value.trim();
          e.bank = body.querySelector('#ed-bank').value.trim();
          try {
            const ov = JSON.parse(localStorage.getItem('hr:import:employees') || '[]');
            const i = ov.findIndex(x => x.code === e.code);
            const patch = { ...e };
            if (i >= 0) {
              ov[i] = patch;
            } else {
              ov.push(patch);
            }
            localStorage.setItem('hr:import:employees', JSON.stringify(ov));
          } catch (_err) {
            /* ignore */
          }
          renderAll();
          showToast(t('act.savedShort'), { variant: 'success' });
        }
      }
    ]
  });
}

export function initEmployeeDetail() {
  const root = document.querySelector('[data-hr-employee]');
  if (!root) {
    return;
  }
  renderAll();
  if (booted) {
    return;
  }
  booted = true;
  document.getElementById('emp360-print')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  });
  document.getElementById('emp360-export')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    exportEmployee(emp());
  });
  document.getElementById('emp360-edit')?.addEventListener('click', () => {
    const current = emp();
    if (current) {openEditModal(current);}
  });
  window.addEventListener(LANG_EVENT, renderAll);
}