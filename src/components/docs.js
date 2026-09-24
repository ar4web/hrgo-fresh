
// goHR — document generator (documents.html). Bilingual letters, contracts,
// agreements and notices over a {{placeholder}} engine: built-in template
// library (contracts, certificates, NOC, warnings, secondment, NDA…), a
// full template builder (author, duplicate, edit — saved as overlay), a
// compose flow with per-locale long dates and money, printable A4 output
// (EN / AR / both), and an issued-documents archive that reprints snapshots.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, setText, renderPageMeta } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { CLIENTS, COMPANIES, DEPARTMENTS, EMPLOYEES } from './hr-seed.js';
import { escapeHtml as esc } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);

import { getSettings, saveSettings, companyTheme } from './hr-statutory.js';
import { exportData, download } from './import-export.js';
// Legal identity of the issuing company — live from Settings → Company
// (the seed record is only a fallback for fields not filled in yet).
function SELLER() {
  const c = (getSettings() && getSettings().company) || {};
  const seed = COMPANIES.find(x => x.code === 'co-1') || COMPANIES[0] || {};
  const pick = (v, f) => (v && String(v).trim() ? String(v).trim() : f || '');
  return {
    nameEn: pick(c.nameEn, seed.nameEn),
    nameAr: pick(c.nameAr, seed.nameAr),
    crNo: pick(c.cr, seed.crNo),
    taxNo: pick(c.vat, seed.taxNo),
    addressEn: pick(c.address, seed.addressEn),
    addressAr: pick(c.address, seed.addressAr),
    phone: pick(c.phone, seed.phone),
    logo: c.logo || '',
    letterhead: c.letterhead || ''
  };
}
const CATS = ['', 'hr', 'contract', 'agreement', 'notice', 'custom'];
const CAT_KEY = { hr: 'doc.catHr', contract: 'doc.catContract', agreement: 'doc.catAgreement', notice: 'doc.catNotice', custom: 'doc.catCustom' };

const PH_GROUPS = [
  {
    label: 'doc.phDoc',
    items: ['doc.no', 'doc.today', 'doc.todayLong', 'doc.todayLongAr', 'doc.subject', 'doc.amount', 'doc.amountMoney', 'doc.amountMoneyAr', 'doc.date1', 'doc.date1Long', 'doc.date1LongAr', 'doc.date2', 'doc.date2Long', 'doc.date2LongAr', 'doc.text1', 'doc.text2', 'doc.note', 'doc.termLine', 'doc.termLineAr']
  },
  {
    label: 'doc.phEmp',
    items: ['emp.code', 'emp.nameEn', 'emp.nameAr', 'emp.titleEn', 'emp.titleAr', 'emp.deptEn', 'emp.deptAr', 'emp.nat', 'emp.iqama', 'emp.iqamaExp', 'emp.join', 'emp.joinLong', 'emp.joinLongAr', 'emp.basic', 'emp.basicMoney', 'emp.basicMoneyAr', 'emp.housing', 'emp.housingMoney', 'emp.housingMoneyAr', 'emp.transport', 'emp.transportMoney', 'emp.transportMoneyAr', 'emp.wage', 'emp.wageMoney', 'emp.wageMoneyAr', 'emp.sponsor']
  },
  { label: 'doc.phClient', items: ['client.nameEn', 'client.nameAr', 'client.cr', 'client.vat', 'client.addrEn', 'client.addrAr'] },
  { label: 'doc.phCo', items: ['co.nameEn', 'co.nameAr', 'co.cr', 'co.vat', 'co.addressEn', 'co.addressAr', 'co.phone'] }
];

let booted = false;
let dataTable = null;
let dataTableMounting = null;
let tab = 'templates';
let cat = '';

// ── Formatting (block-locale aware) ──

function longDate(iso, lang) {
  if (!iso) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));
  } catch (_e) {
    return iso;
  }
}
function money(n, lang) {
  const v = Number(n) || 0;
  if (lang === 'ar') {
    return `${v.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
  }
  return `SAR ${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function deptOf(code, lang) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return lang === 'ar' ? d.ar : d.en;
}

// ── Placeholder engine ──

function lookup(ctx, path) {
  let cur = ctx;
  for (const part of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = cur[part];
  }
  return cur;
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function renderBody(body, ctx) {
  return esc(body || '').replace(TOKEN_RE, (m, path) => {
    const v = lookup(ctx, path);
    if (v === undefined || v === null || v === '') {
      return `<span class="tok-missing">{{${path}}}</span>`;
    }
    return esc(String(v));
  });
}
function lintCount(body, ctx) {
  let n = 0;
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m;
  while ((m = re.exec(body || ''))) {
    const v = lookup(ctx, m[1]);
    if (v === undefined || v === null || v === '') {
      n += 1;
    }
  }
  return n;
}
function countTokens(body) {
  return (String(body || '').match(TOKEN_RE) || []).length;
}

// ── Context ──

function buildCtx(lang, emp, client, doc) {
  const co = {
    nameEn: SELLER().nameEn,
    nameAr: SELLER().nameAr,
    cr: SELLER().crNo || '—',
    vat: SELLER().taxNo || '—',
    addressEn: SELLER().addressEn || '—',
    addressAr: SELLER().addressAr || '—',
    phone: SELLER.phone || '—'
  };
  const e = emp
    ? {
        code: emp.code,
        nameEn: emp.nameEn,
        nameAr: emp.nameAr,
        titleEn: emp.titleEn || '—',
        titleAr: emp.titleAr || '—',
        deptEn: deptOf(emp.dept, 'en'),
        deptAr: deptOf(emp.dept, 'ar'),
        nat: emp.nat || '—',
        iqama: emp.iqama || '—',
        iqamaExp: emp.iqamaExp || '—',
        join: emp.join || '—',
        joinLong: longDate(emp.join, 'en'),
        joinLongAr: longDate(emp.join, 'ar'),
        basic: fmtInt(emp.basic),
        basicMoney: money(emp.basic, 'en'),
        basicMoneyAr: money(emp.basic, 'ar'),
        housing: fmtInt(emp.housing),
        housingMoney: money(emp.housing, 'en'),
        housingMoneyAr: money(emp.housing, 'ar'),
        transport: fmtInt(emp.transport),
        transportMoney: money(emp.transport, 'en'),
        transportMoneyAr: money(emp.transport, 'ar'),
        wage: fmtInt((Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0)),
        wageMoney: money((Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0), 'en'),
        wageMoneyAr: money((Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0), 'ar'),
        sponsor: emp.sponsor || '—'
      }
    : {
        code: '{{emp.code}}', nameEn: '{{emp.nameEn}}', nameAr: '{{emp.nameAr}}', titleEn: '{{emp.titleEn}}', titleAr: '{{emp.titleAr}}',
        deptEn: '{{emp.deptEn}}', deptAr: '{{emp.deptAr}}', nat: '{{emp.nat}}', iqama: '{{emp.iqama}}', iqamaExp: '{{emp.iqamaExp}}',
        join: '{{emp.join}}', joinLong: '{{emp.joinLong}}', joinLongAr: '{{emp.joinLongAr}}',
        basic: '{{emp.basic}}', basicMoney: '{{emp.basicMoney}}', basicMoneyAr: '{{emp.basicMoneyAr}}',
        housing: '{{emp.housing}}', housingMoney: '{{emp.housingMoney}}', housingMoneyAr: '{{emp.housingMoneyAr}}',
        transport: '{{emp.transport}}', transportMoney: '{{emp.transportMoney}}', transportMoneyAr: '{{emp.transportMoneyAr}}',
        wage: '{{emp.wage}}', wageMoney: '{{emp.wageMoney}}', wageMoneyAr: '{{emp.wageMoneyAr}}', sponsor: '{{emp.sponsor}}'
      };
  const c = client
    ? {
        nameEn: client.nameEn,
        nameAr: client.nameAr,
        cr: client.cr || '—',
        vat: client.vat || '—',
        addrEn: client.addrEn || client.city || '—',
        addrAr: client.addrAr || client.city || '—'
      }
    : {
        nameEn: '{{client.nameEn}}', nameAr: '{{client.nameAr}}', cr: '{{client.cr}}', vat: '{{client.vat}}',
        addrEn: '{{client.addrEn}}', addrAr: '{{client.addrAr}}'
      };
  const d = {
    no: doc.no,
    today: isoToday(),
    todayLong: longDate(isoToday(), 'en'),
    todayLongAr: longDate(isoToday(), 'ar'),
    subject: doc.subject || '—',
    amount: doc.amount ? fmtInt(doc.amount) : null,
    amountMoney: doc.amount ? money(doc.amount, 'en') : null,
    amountMoneyAr: doc.amount ? money(doc.amount, 'ar') : null,
    date1: doc.date1 || null,
    date1Long: doc.date1 ? longDate(doc.date1, 'en') : null,
    date1LongAr: doc.date1 ? longDate(doc.date1, 'ar') : null,
    date2: doc.date2 || null,
    date2Long: doc.date2 ? longDate(doc.date2, 'en') : null,
    date2LongAr: doc.date2 ? longDate(doc.date2, 'ar') : null,
    text1: doc.text1 || null,
    text2: doc.text2 || null,
    note: doc.note || '……………………………………',
    termLine: doc.date2 ? `, on a fixed term ending ${longDate(doc.date2, 'en')}` : ' (open-ended term)',
    termLineAr: doc.date2 ? `، ولمدة محددة تنتهي في ${longDate(doc.date2, 'ar')}` : ' (لمدة غير محددة)'
  };
  return { doc: d, emp: e, client: c, co };
}

// ── Data ──

function templates() {
  return getSeed('doctemplates').filter(r => !r.deleted);
}
function issued() {
  return getSeed('documents')
    .filter(r => !r.deleted)
    .slice()
    .sort((a, b) => (Number(b.no) || 0) - (Number(a.no) || 0));
}
function nextDocNo() {
  return getSeed('documents').reduce((mx, r) => Math.max(mx, Number(r.no) || 0), 0) + 1;
}
const tplName = tpl => (currentLang() === 'ar' ? tpl.nameAr || tpl.nameEn : tpl.nameEn);
const empOf = code => EMPLOYEES.find(e => e.code === code);
const clientOf = id => CLIENTS.find(c => c.id === id);
function empName(code) {
  const e = empOf(code);
  if (!e) {
    return code || '—';
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}

// ── Tabs ──

function setTab(next) {
  tab = next;
  document.querySelectorAll('.inv-tab').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-tabpanel]').forEach(p => {
    p.hidden = p.dataset.tabpanel !== tab;
  });
  if (tab === 'issued') {
    renderIssued();
  }
}

// ── Templates gallery ──

function renderGrid() {
  const grid = document.getElementById('dc-tpl-grid');
  if (!grid) {
    return;
  }
  const rows = templates().filter(r => !cat || r.cat === cat);
  grid.innerHTML = rows
    .map(tpl => {
      const ph = countTokens(tpl.bodyEn) + countTokens(tpl.bodyAr);
      return `
      <div class="tpl-card" data-id="${esc(tpl.id)}">
        <div class="tpl-card-head">
          <div>
            <div class="tpl-card-name">${esc(tplName(tpl))}</div>
            <div class="caption-muted" style="font-size:11.5px">${esc(currentLang() === 'ar' ? tpl.nameEn : tpl.nameAr)}</div>
          </div>
          <span class="dc-cat-tag">${esc(t(CAT_KEY[tpl.cat] || 'doc.catCustom'))}</span>
        </div>
        <div class="tpl-card-meta">
          <span>${esc(t('doc.phCount').replace('{n}', fmtInt(ph)))}</span>
          <span class="status ${tpl.builtIn ? 'status-blue' : 'status-green'}">${esc(tpl.builtIn ? t('doc.builtIn') : t('doc.mine'))}</span>
        </div>
        <div class="tpl-card-actions">
          <button class="btn btn-primary btn-sm" data-dc-use="${esc(tpl.id)}" type="button">${esc(t('doc.use'))}</button>
          <button class="card-opt-btn" data-dc-edit="${esc(tpl.id)}" aria-label="${esc(t('doc.edit'))}" data-tooltip="${esc(t('doc.edit'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>
          <button class="card-opt-btn" data-dc-dup="${esc(tpl.id)}" aria-label="${esc(t('doc.duplicate'))}" data-tooltip="${esc(t('doc.duplicate'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>
          ${tpl.builtIn ? '' : `<button class="card-opt-btn" data-dc-del="${esc(tpl.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>`}
        </div>
      </div>`;
    })
    .join('');
  const badge = document.getElementById('dc-tabcount-tpl');
  if (badge) {
    badge.textContent = fmtInt(templates().length);
  }
  renderPageMeta([
    `${fmtInt(templates().length)} ${t('doc.tabTemplates')}`,
    `${fmtInt(issued().length)} ${t('doc.tabIssued')}`
  ]);
}

// ── Compose + preview ──

function openCompose(tpl) {
  const d = tpl.defaults || {};
  const empOpts =
    `<option value="">${esc(t('doc.none'))}</option>` +
    EMPLOYEES.filter(e => e.st !== 'exited' && e.st !== 'huroob')
      .map(e => `<option value="${esc(e.code)}" ${d.emp === e.code ? 'selected' : ''}>${esc(currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn)} · ${esc(e.code)}</option>`)
      .join('');
  const clOpts =
    `<option value="">${esc(t('doc.none'))}</option>` +
    CLIENTS.map(c => `<option value="${esc(c.id)}" ${d.client === c.id ? 'selected' : ''}>${esc(currentLang() === 'ar' ? c.nameAr || c.nameEn : c.nameEn)}</option>`).join('');
  const f = (id, label, val, attrs = '') =>
    `<label class="modal-form-row"><span>${esc(label)}</span><input type="text" class="form-control" id="${id}" value="${esc(val ?? '')}"></label>`;
  const field = (id, label, val, type = 'text', extra = '') =>
    `<label class="modal-form-row"><span>${esc(label)}</span><input type="${type}" class="form-control" id="${id}" value="${esc(val ?? '')}" ${extra}></label>`;
  showModal({
    title: `${t('doc.compose')} · ${tplName(tpl)}`,
    size: 'md',
    body: `
      <label class="modal-form-row"><span>${esc(t('doc.employeeLbl'))}</span><select class="form-control" id="dc-emp">${empOpts}</select></label>
      <label class="modal-form-row"><span>${esc(t('doc.clientLbl'))}</span><select class="form-control" id="dc-client">${clOpts}</select></label>
      <label class="modal-form-row"><span>${esc(t('doc.subject'))}</span><input type="text" class="form-control" id="dc-subject" value="${esc(d.subject || '')}" placeholder="${esc(t('doc.subjectPh'))}"></label>
      <div class="dc-form-2col">
        ${field('dc-date1', t('doc.date1'), d.date1 || '', 'date')}
        ${field('dc-date2', t('doc.date2'), d.date2 || '', 'date')}
      </div>
      <div class="dc-form-2col">
        ${field('dc-amount', t('doc.amount'), d.amount ?? '', 'number', 'min="0" step="0.01"')}
        ${f('dc-text1', t('doc.text1'), d.text1)}
      </div>
      ${f('dc-text2', t('doc.text1') + ' · 2', d.text2)}
      ${f('dc-note', t('doc.note'), d.note)}
      <label class="modal-form-row" style="margin-bottom:0"><span>${esc(t('doc.output'))}</span>
        <select class="form-control" id="dc-out">
          <option value="both">${esc(t('doc.outBoth'))}</option>
          <option value="en">${esc(t('doc.outEn'))}</option>
          <option value="ar">${esc(t('doc.outAr'))}</option>
        </select></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('doc.preview'),
        variant: 'primary',
        action: () => {
          openPreview(tpl, readCompose());
          return false; // preview modal replaces this one — don't double-close
        }
      }
    ]
  });
}

function readCompose() {
  return {
    emp: document.getElementById('dc-emp')?.value || '',
    client: document.getElementById('dc-client')?.value || '',
    subject: document.getElementById('dc-subject')?.value?.trim() || '',
    date1: document.getElementById('dc-date1')?.value || '',
    date2: document.getElementById('dc-date2')?.value || '',
    amount: document.getElementById('dc-amount')?.value || '',
    text1: document.getElementById('dc-text1')?.value?.trim() || '',
    text2: document.getElementById('dc-text2')?.value?.trim() || '',
    note: document.getElementById('dc-note')?.value?.trim() || '',
    out: document.getElementById('dc-out')?.value || 'both'
  };
}

function paperHtml(rendered, out, meta) {
  const blocks = [];
  if (out !== 'ar') {
    blocks.push(`<div class="doc-body doc-body--en" dir="ltr">${rendered.en}</div>`);
  }
  if (out !== 'en') {
    blocks.push(`<div class="doc-body doc-body--ar" dir="rtl">${rendered.ar}</div>`);
  }
  const co = SELLER();
  // Imported letterhead replaces the typed header (it carries logo + address
  // artwork already); otherwise the typed header + company logo are used.
  const head = co.letterhead
    ? `<div class="doc-letterhead"><img src="${esc(co.letterhead)}" alt=""></div>`
    : `<div class="doc-head">
        ${co.logo ? `<div class="doc-head-logo"><img src="${esc(co.logo)}" alt=""></div>` : ''}
        <div class="doc-head-name">${esc(currentLang() === 'ar' ? co.nameAr : co.nameEn)} <span class="doc-head-alt">${esc(currentLang() === 'ar' ? co.nameEn : co.nameAr)}</span></div>
        <div class="doc-head-sub">${esc(co.addressEn)} · ${esc(co.addressAr)}</div>
        <div class="doc-head-sub">${esc(t('doc.vatNo') || 'doc.vatNo')}: ${esc(co.taxNo || '—')} · CR ${esc(co.crNo || '—')}</div>
      </div>`;
  return `
    <div class="doc-paper" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
      ${head}
      <div class="doc-meta">
        <div><span>${esc(t('doc.docNo'))}</span><strong>#${fmtInt(meta.no)}</strong></div>
        <div><span>${esc(t('doc.issueDate'))}</span><strong>${esc(fmtDate(isoToday()))}</strong></div>
        ${meta.emp ? `<div><span>${esc(t('doc.employeeLbl'))}</span><strong>${esc(empName(meta.emp))}</strong></div>` : ''}
      </div>
      ${blocks.join('<div class="doc-divider"></div>')}
    </div>`;
}

function openPreview(tpl, compose, snapshot) {
  const emp = compose.emp ? empOf(compose.emp) : null;
  const client = compose.client ? clientOf(compose.client) : null;
  const no = snapshot ? snapshot.no : nextDocNo();
  const ctx = buildCtx(currentLang(), emp, client, {
    no: `#${fmtInt(no)}`,
    subject: compose.subject,
    amount: compose.amount ? Number(compose.amount) : 0,
    date1: compose.date1,
    date2: compose.date2,
    text1: compose.text1,
    text2: compose.text2,
    note: compose.note
  });
  // snapshots are stored already-rendered — display as-is (no double escaping)
  const rendered = snapshot
    ? { en: snapshot.renderedEn, ar: snapshot.renderedAr }
    : { en: renderBody(tpl.bodyEn, ctx), ar: renderBody(tpl.bodyAr, ctx) };
  const missing = snapshot ? 0 : lintCount(tpl.bodyEn, ctx) + lintCount(tpl.bodyAr, ctx);
  const meta = { no, emp: compose.emp };
  showModal({
    title: `${t('doc.preview')} · ${snapshot ? `#${fmtInt(snapshot.no)}` : tplName(tpl)}`,
    size: 'lg',
    body: `
      ${missing ? `<div class="dc-lint">${esc(t('doc.unresolved').replace('{n}', fmtInt(missing)))}</div>` : ''}
      ${paperHtml(rendered, snapshot ? snapshot.out : compose.out, meta)}`,
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      ...(snapshot
        ? []
        : [
            {
              label: t('doc.saveAsTpl'),
              variant: 'ghost',
              action: () => {
                saveAsTemplate(tpl, compose);
                return false;
              }
            },
            {
              label: t('doc.saveCopy'),
              variant: 'outline',
              action: () => {
                saveCopy(tpl, compose, rendered);
                return false;
              }
            }
          ]),
      {
        label: t('doc.word'),
        variant: 'outline',
        action: () => {
          exportDocWord(no, meta, paperHtml(rendered, compose && compose.out ? compose.out : (currentLang() === 'ar' ? 'ar' : 'en'), meta));
          return false;
        }
      },
      ...(snapshot
        ? [
            {
              label: t('doc.editContent'),
              variant: 'outline',
              action: ({ dialog }) => editSnapshotContent(dialog, snapshot)
            }
          ]
        : []),
      {
        label: t('doc.pdf'),
        variant: 'primary',
        action: () => {
          document.body.dataset.print = 'letter';
          window.print();
          return false;
        }
      }
    ]
  });
}

// Inline contenteditable editing of an issued snapshot's rendered bodies.
function editSnapshotContent(dialog, snapshot) {
  const bodies = dialog.querySelectorAll('.doc-body');
  const editing = dialog.dataset.editing === '1';
  if (!editing) {
    bodies.forEach(b => {
      b.setAttribute('contenteditable', 'true');
      b.classList.add('doc-body--editing');
    });
    dialog.dataset.editing = '1';
    showToast(t('doc.editHint'), { variant: 'info' });
    return false;
  }
  const en = dialog.querySelector('.doc-body--en');
  const ar = dialog.querySelector('.doc-body--ar');
  const snap = issued().find(x => x.id === snapshot.id);
  if (snap) {
    saveImportedRows('documents', [{
      ...snap,
      renderedEn: en ? en.innerHTML : snap.renderedEn,
      renderedAr: ar ? ar.innerHTML : snap.renderedAr
    }]);
    showToast(t('doc.toastEdited'), { variant: 'success' });
  }
  bodies.forEach(b => {
    b.removeAttribute('contenteditable');
    b.classList.remove('doc-body--editing');
  });
  dialog.dataset.editing = '0';
  return false;
}

// Export the paper as a Word-editable .doc (HTML payload Word opens natively).
function exportDocWord(no, meta, paperInner) {
  // Company theme engine: the paper carries the brand accent + paper font
  // chosen in Settings → Theme studio.
  const th = companyTheme();
  const accent = th.primary;
  const bodyFont = th.docFont === 'serif' ? 'Georgia, \'Times New Roman\', serif' : '\'Segoe UI\', Tahoma, Arial, sans-serif';
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Document #${fmtInt(no)}</title>
<style>
@page { size: A4; margin: 18mm; }
body { font-family: ${bodyFont}; font-size: 12.5pt; color: #1f2937; }
.doc-paper { max-width: 100%; }
.doc-letterhead img { width: 100%; max-height: 120pt; object-fit: contain; margin-bottom: 12pt; }
.doc-head { border-bottom: 2px solid ${accent}; padding-bottom: 8pt; margin-bottom: 8pt; }
.doc-head-logo img { height: 48pt; margin-bottom: 4pt; }
.doc-head-name { font-size: 15pt; font-weight: bold; color: ${accent}; }
.doc-head-alt { font-size: 10pt; color: #6b7280; font-weight: normal; }
.doc-head-sub { font-size: 9pt; color: #6b7280; }
.doc-meta { display: table; width: 100%; margin: 10pt 0; }
.doc-meta div { display: table-cell; font-size: 9.5pt; color: #374151; padding-inline-end: 16pt; }
.doc-divider { border-top: 1px solid #d1d5db; margin: 10pt 0; }
.doc-body { line-height: 1.9; }
</style></head><body>${paperInner}</body></html>`;
  download(`document-${fmtInt(no)}.doc`, new Blob(['\ufeff', html], { type: 'application/msword' }));
  showToast(t('doc.toastWord'), { variant: 'success' });
}

function saveCopy(tpl, compose, rendered) {
  const no = nextDocNo();
  saveImportedRows('documents', [
    {
      id: `DOC-${String(no).padStart(4, '0')}`,
      no,
      tplId: tpl.id,
      titleEn: `${tpl.nameEn}${compose.subject ? ` — ${compose.subject}` : ''}`,
      titleAr: `${tpl.nameAr || tpl.nameEn}${compose.subject ? ` — ${compose.subject}` : ''}`,
      out: compose.out,
      emp: compose.emp,
      client: compose.client,
      renderedEn: rendered.en.replace(/<span class="tok-missing">|<\/span>/g, m => (m.startsWith('<span') ? '{{' : '')),
      renderedAr: rendered.ar.replace(/<span class="tok-missing">|<\/span>/g, m => (m.startsWith('<span') ? '{{' : '')),
      ctxDoc: {
        subject: compose.subject,
        amount: compose.amount,
        date1: compose.date1,
        date2: compose.date2,
        text1: compose.text1,
        text2: compose.text2,
        note: compose.note
      },
      createdAt: isoToday()
    }
  ]);
  showToast(t('doc.toastCopy'), { variant: 'success' });
}

function saveAsTemplate(tpl, compose) {
  saveImportedRows('doctemplates', [
    {
      ...tpl,
      id: `tpl-my-${Date.now()}`,
      builtIn: false,
      cat: 'custom',
      nameEn: `${tpl.nameEn} (copy)`,
      nameAr: `${tpl.nameAr || tpl.nameEn} (نسخة)`,
      defaults: { ...compose }
    }
  ]);
  showToast(t('doc.toastTpl'), { variant: 'success' });
  renderGrid();
}

// ── Template builder ──

function openBuilder(source) {
  const isNew = !source;
  const editing = source ? { ...source } : { id: `tpl-my-${Date.now()}`, cat: 'custom', bodyEn: '', bodyAr: '', nameEn: '', nameAr: '', builtIn: false };
  const catOpts = CATS.filter(Boolean)
    .map(c => `<option value="${c}" ${editing.cat === c ? 'selected' : ''}>${esc(t(CAT_KEY[c]))}</option>`)
    .join('');
  showModal({
    title: isNew ? t('doc.builderNew') : t('doc.builderEdit'),
    size: 'lg',
    body: `
      <div class="dc-form-2col">
        <label class="modal-form-row"><span>${esc(t('doc.tplNameEn'))}</span><input type="text" class="form-control" id="dc-tpl-name-en" value="${esc(editing.nameEn)}"></label>
        <label class="modal-form-row"><span>${esc(t('doc.tplNameAr'))}</span><input type="text" class="form-control" id="dc-tpl-name-ar" value="${esc(editing.nameAr)}"></label>
      </div>
      <label class="modal-form-row"><span>${esc(t('doc.catAll'))} / ${esc(t('doc.catHr'))}</span><select class="form-control" id="dc-tpl-cat">${catOpts}</select></label>
      <div class="dc-ph-title">${esc(t('doc.placeholders'))}</div>
      ${PH_GROUPS.map(g => `
        <div class="dc-ph-group">
          <span class="dc-ph-group-label">${esc(t(g.label))}</span>
          ${g.items.map(p => `<button type="button" class="dc-ph-chip" data-dc-ph="${esc(p)}">{{${esc(p)}}}</button>`).join('')}
        </div>`).join('')}
      <label class="modal-form-row"><span>${esc(t('doc.bodyEn'))}</span><textarea class="form-control dc-body" id="dc-body-en" rows="8" dir="ltr">${esc(editing.bodyEn)}</textarea></label>
      <label class="modal-form-row" style="margin-bottom:0"><span>${esc(t('doc.bodyAr'))}</span><textarea class="form-control dc-body" id="dc-body-ar" rows="8" dir="rtl">${esc(editing.bodyAr)}</textarea></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('doc.save'),
        variant: 'primary',
        action: () => {
          const nameEn = document.getElementById('dc-tpl-name-en')?.value?.trim();
          const nameAr = document.getElementById('dc-tpl-name-ar')?.value?.trim();
          const bodyEn = document.getElementById('dc-body-en')?.value || '';
          const bodyAr = document.getElementById('dc-body-ar')?.value || '';
          if (!nameEn && !nameAr) {
            showToast(t('doc.errName'), { variant: 'warning' });
            return false;
          }
          const catSel = document.getElementById('dc-tpl-cat')?.value || 'custom';
          saveImportedRows('doctemplates', [
            {
              ...editing,
              id: isNew || source?.builtIn ? `tpl-my-${Date.now()}` : editing.id,
              builtIn: false,
              nameEn: nameEn || nameAr,
              nameAr: nameAr || nameEn,
              cat: catSel,
              bodyEn,
              bodyAr,
              defaults: editing.defaults || {}
            }
          ]);
          showToast(t('doc.toastTpl'), { variant: 'success' });
          renderGrid();
        }
      }
    ]
  });
  // placeholder chips insert at the cursor of the last-focused body editor
  let lastBody = null;
  document.querySelectorAll('.dc-body').forEach(ta => {
    ta.addEventListener('focus', () => {
      lastBody = ta;
    });
  });
  document.querySelector('.modal-body')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-dc-ph]');
    if (!chip) {
      return;
    }
    const ta = lastBody || document.getElementById('dc-body-en');
    if (!ta) {
      return;
    }
    const tok = `{{${chip.dataset.dcPh}}}`;
    const s = ta.selectionStart ?? ta.value.length;
    const epos = ta.selectionEnd ?? s;
    ta.value = ta.value.slice(0, s) + tok + ta.value.slice(epos);
    ta.dispatchEvent(new window.Event('input', { bubbles: true }));
    ta.focus();
  });
}

// ── Issued archive ──

function renderIssued() {
  setText('dc-count', t('xp.count').replace('{n}', fmtInt(issued().length)).replace('{total}', fmtInt(issued().length)));
  const tbody = document.getElementById('dc-iss-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  const rows = issued();
  const badge = document.getElementById('dc-tabcount-iss');
  if (badge) {
    badge.textContent = fmtInt(rows.length);
  }
  tbody.innerHTML =
    rows
      .map(r => `
    <tr data-id="${esc(r.id)}">
      <td class="cell-mono" style="font-size:12.5px">#${fmtInt(r.no)}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.createdAt))}</td>
      <td style="min-width:180px">
        <div class="cell-strong" style="white-space:normal">${esc(currentLang() === 'ar' ? r.titleAr || r.titleEn : r.titleEn)}</div>
      </td>
      <td style="font-size:12.5px">${esc(tplName(templates().find(x => x.id === r.tplId) || { nameEn: r.tplId, nameAr: r.tplId }))}</td>
      <td style="font-size:12.5px">${esc(r.emp ? empName(r.emp) : '—')}</td>
      <td style="font-size:12.5px">${esc(r.out === 'both' ? t('doc.langBoth') : r.out === 'en' ? t('doc.langEn') : t('doc.langAr'))}</td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-dc-view="${esc(r.id)}" aria-label="${esc(t('doc.reprint'))}" data-tooltip="${esc(t('doc.reprint'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button class="card-opt-btn" data-dc-del-doc="${esc(r.id)}" aria-label="${esc(t('doc.delete'))}" data-tooltip="${esc(t('doc.delete'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
      </td>
    </tr>`)
      .join('');
  void mountDataTable();
}

function destroyDataTable() {
  if (!dataTable) {
    return;
  }
  dataTable.destroy();
  dataTable = null;
}

async function mountDataTable() {
  const table = document.querySelector('[data-tabpanel="issued"] table.emp-table');
  if (!table || dataTable || table.classList.contains('dataTable')) {
    return;
  }
  if (dataTableMounting) {
    await dataTableMounting;
    if (dataTable || table.classList.contains('dataTable')) {
      return;
    }
  }
  dataTableMounting = (async () => {
    const { default: DataTable } = await import('datatables.net');
    dataTable = new DataTable(table, {
      pageLength: parseInt(table.dataset.pageLength || '10', 10),
      lengthChange: false,
      searching: false,
      ordering: false,
      order: [],
      language: {
        emptyTable: t('common.noData'),
        info: t('dt.info'),
        infoEmpty: t('dt.infoEmpty'),
        infoFiltered: t('dt.infoFiltered'),
        zeroRecords: t('dt.zero'),
        paginate: { previous: t('dt.previous'), next: t('dt.next') }
      }
    });
  })();
  await dataTableMounting;
  dataTableMounting = null;
}

// ── Boot ──


// ── Letterhead (import / replace / remove) ──

function openLetterhead() {
  const cur = (getSettings().company || {}).letterhead || '';
  showModal({
    title: t('doc.letterhead'),
    body: `
      <div class="set-sub">${esc(t('doc.letterheadSub'))}</div>
      <div class="dc-lh-preview" id="dc-lh-preview">${cur ? `<img src="${esc(cur)}" alt="">` : `<span class="fm-preview-note">${esc(t('set.none'))}</span>`}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0">${esc(t('doc.lhImport'))}<input type="file" id="dc-lh-file" accept="image/png,image/jpeg,image/webp" hidden></label>
        ${cur ? `<button class="btn btn-ghost btn-sm" id="dc-lh-remove" type="button">${esc(t('doc.lhRemove'))}</button>` : ''}
      </div>`,
    actions: [
      { label: t('common.close'), variant: 'primary' }
    ]
  });
  document.getElementById('dc-lh-file')?.addEventListener('change', e => {
    const file = e.target?.files?.[0];
    if (!file) {
      return;
    }
    if (file.size > 800 * 1024) {
      showToast(t('doc.lhTooBig'), { variant: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      saveLetterhead(dataUrl);
      const box = document.getElementById('dc-lh-preview');
      if (box) {
        box.innerHTML = `<img src="${esc(dataUrl)}" alt="">`;
      }
      showToast(t('doc.toastLh'), { variant: 'success' });
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('dc-lh-remove')?.addEventListener('click', () => {
    saveLetterhead('');
    const box = document.getElementById('dc-lh-preview');
    if (box) {
      box.innerHTML = `<span class="fm-preview-note">${esc(t('set.none'))}</span>`;
    }
    showToast(t('doc.toastLhRemoved'), { variant: 'success' });
  });
}

function saveLetterhead(dataUrl) {
  const s0 = getSettings();
  saveSettings({
    companies: s0.companies.map(c => (c.id === s0.activeCompanyId ? { ...c, letterhead: dataUrl } : c))
  });
}

// ── Issued archive → Excel ──

function exportIssuedExcel() {
  const L = (en, ar) => (currentLang() === 'ar' ? ar : en);
  const rows = issued().map(r => ({
    no: r.no,
    date: r.createdAt,
    title: currentLang() === 'ar' ? r.titleAr || r.titleEn : r.titleEn,
    tpl: (templates().find(x => x.id === r.tplId) ? tplName(templates().find(x => x.id === r.tplId)) : r.tplId),
    out: r.out === 'ar' ? L('Arabic', 'عربي') : r.out === 'en' ? L('English', 'إنجليزي') : L('Bilingual', 'ثنائي اللغة'),
    emp: r.emp ? empName(r.emp) : ''
  }));
  exportData('excel', 'documents', [
    { key: 'no', label: L('No.', 'الرقم') },
    { key: 'date', label: L('Date', 'التاريخ') },
    { key: 'title', label: L('Document', 'المستند') },
    { key: 'tpl', label: L('Template', 'القالب') },
    { key: 'out', label: L('Language', 'اللغة') },
    { key: 'emp', label: L('Employee', 'الموظف') }
  ], rows, 'Issued');
}

export function initDocs() {
  // Letterhead manager (import / replace / remove)
  document.getElementById('dc-letterhead')?.addEventListener('click', openLetterhead);
  // Issued archive → Excel
  document.getElementById('dc-export')?.addEventListener('click', exportIssuedExcel);

  const root = document.querySelector('[data-hr-docs]');
  if (!root) {
    return;
  }
  renderGrid();
  window.addEventListener('afterprint', () => {
    delete document.body.dataset.print;
  });
  document.querySelectorAll('.inv-tab').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });
  root.querySelectorAll('.dc-cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      cat = chip.dataset.dcCat || '';
      root.querySelectorAll('.dc-cat-chip').forEach(c => c.classList.toggle('active', c === chip));
      renderGrid();
    });
  });
  document.getElementById('dc-new-tpl')?.addEventListener('click', () => openBuilder(null));
  root.addEventListener('click', e => {
    const use = e.target.closest('[data-dc-use]');
    if (use) {
      const tpl = templates().find(x => x.id === use.dataset.dcUse);
      if (tpl) {
        openCompose(tpl);
      }
      return;
    }
    const edit = e.target.closest('[data-dc-edit]');
    if (edit) {
      const tpl = templates().find(x => x.id === edit.dataset.dcEdit);
      if (tpl) {
        openBuilder(tpl);
      }
      return;
    }
    const dup = e.target.closest('[data-dc-dup]');
    if (dup) {
      const tpl = templates().find(x => x.id === dup.dataset.dcDup);
      if (tpl) {
        openBuilder({ ...tpl, id: null, nameEn: `${tpl.nameEn} (copy)`, nameAr: `${tpl.nameAr || tpl.nameEn} (نسخة)` });
      }
      return;
    }
    const del = e.target.closest('[data-dc-del]');
    if (del) {
      const tpl = templates().find(x => x.id === del.dataset.dcDel);
      if (tpl && window.confirm(t('doc.confirmDelete'))) {
        saveImportedRows('doctemplates', [{ ...tpl, deleted: true }]);
        showToast(t('doc.toastTplDeleted'), { variant: 'success' });
        renderGrid();
      }
      return;
    }
    const view = e.target.closest('[data-dc-view]');
    if (view) {
      const doc = issued().find(x => x.id === view.dataset.dcView);
      if (doc) {
        openPreview(templates().find(x => x.id === doc.tplId) || { nameEn: doc.titleEn, nameAr: doc.titleAr }, { ...doc.ctxDoc, emp: doc.emp, client: doc.client, out: doc.out }, doc);
      }
      return;
    }
    const delDoc = e.target.closest('[data-dc-del-doc]');
    if (delDoc) {
      const doc = issued().find(x => x.id === delDoc.dataset.dcDelDoc);
      if (doc && window.confirm(t('doc.confirmDelete'))) {
        saveImportedRows('documents', [{ ...doc, deleted: true }]);
        showToast(t('doc.toastDeleted'), { variant: 'success' });
        renderIssued();
      }
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    renderGrid();
    if (tab === 'issued') {
      renderIssued();
    }
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
