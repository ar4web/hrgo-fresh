// goHR — invoicing (invoices.html). ZATCA-oriented client billing over the
// secondment registry and the statutory prims (invoiceLine, invoiceTotals,
// invoiceDue, VAT_RATE, ajeerCheck): monthly invoices per client with
// editable day/OT lines, Ajeer compliance flags, draft → sent → paid flow,
// three printable templates (ZATCA standard bilingual + QR/TLV, goHR house
// format, detailed), UBL-style XML export, a client list, a sales ledger
// with running balance, and an insights tab.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, fmtSAR, setText } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { exportData } from './import-export.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { CLIENTS, COMPANIES, EMPLOYEES, SECONDMENTS } from './hr-seed.js';
import { invoiceLine, invoiceTotals, invoiceDue, ajeerCheck, vatRate, getSettings, legalSeller } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';
import qrcode from 'qrcode-generator';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const isoToday = () => new Date().toISOString().slice(0, 10);

// Live legal identity (Settings → Company) with seed fallback.
const SELLER = () => legalSeller();
const ST_CLS = { draft: 'blue', sent: 'yellow', paid: 'green' };
const ST_KEY = { draft: 'inv.stDraft', sent: 'inv.stSent', paid: 'inv.stPaid' };
const REASON_KEY = r => `inv.reason.${String(r).replace(/-/g, '_')}`;
const TEMPLATES = [
  { id: 'zatca', key: 'tpl.zatca' },
  { id: 'house', key: 'tpl.house' },
  { id: 'detail', key: 'tpl.detail' }
];
const B = (en, ar) => `${en} · ${ar}`; // bilingual label for compliant docs

let booted = false;
let dataTable = null;
let dataTableMounting = null;
let month = isoToday().slice(0, 7);
let tab = 'invoices';
let ledger = { client: '', openOnly: false };
let template = 'zatca';
try {
  template = localStorage.getItem('hr:inv:template') || 'zatca';
} catch (_e) {
  /* private mode */
}

/** Set the invoice template and keep every picker chip in sync — the page-level
 *  picker and the one inside the document modal share the same selection. */
function setTemplate(id) {
  if (!TEMPLATES.some(x => x.id === id)) {return;}
  template = id;
  try {
    localStorage.setItem('hr:inv:template', template);
  } catch (_e) {
    /* private mode */
  }
  document.querySelectorAll('[data-inv-tpl]').forEach(b => b.classList.toggle('active', b.dataset.invTpl === template));
}

// ── Data ──

const clientOf = id => getSeed('clients').find(c => c.id === id);
const empOf = code => EMPLOYEES.find(e => e.code === code);
const secOf = code => SECONDMENTS.find(s => s.emp === code);
function nameOf(e) {
  return e ? (currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn) : '—';
}
function clientName(id) {
  const c = clientOf(id);
  if (!c) {
    return id;
  }
  return currentLang() === 'ar' ? c.nameAr || c.nameEn : c.nameEn;
}
function invoices() {
  return getSeed('invoices').slice().sort((a, b) => ((b.updated || '') < (a.updated || '') ? -1 : 1));
}
function ajeerOf(code, todayIso) {
  const sec = secOf(code);
  return ajeerCheck(sec, empOf(code), clientOf(sec?.client), todayIso);
}
const supplyDate = m => {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm, 0).toISOString().slice(0, 10);
};
const nextSeq = () => getSeed('invoices').reduce((mx, r) => Math.max(mx, Number(r.no) || 0), 0) + 1;

// ── ZATCA QR (Phase 1 TLV: seller name, VAT no, timestamp, total, VAT) ──

function utf8(s) {
  return Array.from(new TextEncoder().encode(String(s)));
}
function tlvBase64(pairs) {
  const bytes = [];
  for (const [tag, val] of pairs) {
    const v = utf8(val);
    bytes.push(tag, v.length, ...v);
  }
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}
function zatcaQrSvg(inv) {
  const issued = `${inv.updated || isoToday()}T00:00:00Z`;
  const payload = tlvBase64([
    [1, SELLER().nameEn],
    [2, SELLER().taxNo || ''],
    [3, issued],
    [4, (Number(inv.total) || 0).toFixed(2)],
    [5, (Number(inv.vat) || 0).toFixed(2)]
  ]);
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}

// ── UBL-style XML export (ZATCA phase-2 shape, demo scope) ──

const xmlEsc = s =>
  String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
function buildXml(inv) {
  const c = clientOf(inv.client);
  const today = isoToday();
  const lines = inv.lines
    .map((l, i) => {
      const calc = invoiceLine(l.rate, l.days, l.otH);
      const e = empOf(l.emp);
      return `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="DAY">${l.days}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="SAR">${calc.total.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${((calc.total * vatRate()) / (1 + vatRate())).toFixed(2)}</cbc:TaxAmount>
      </cac:TaxTotal>
      <cac:Item>
        <cbc:Name>${xmlEsc(`${t('doc.serviceDesc').replace('{prof}', e?.titleEn || '')} — ${l.emp}`)}</cbc:Name>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="SAR">${calc.daily.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEsc(inv.id)}</cbc:ID>
  <cbc:UUID>${xmlEsc(inv.id)}</cbc:UUID>
  <cbc:IssueDate>${xmlEsc(inv.updated || today)}</cbc:IssueDate>
  <cbc:IssueTime>00:00:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${Number(inv.no) || 1}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEsc(SELLER().nameEn)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:CitySubdivisionName>${xmlEsc(SELLER().addressEn)}</cbc:CitySubdivisionName></cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEsc(SELLER().taxNo)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:CompanyID>${xmlEsc(SELLER.crNo)}</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEsc(c?.nameEn || inv.client)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:CitySubdivisionName>${xmlEsc(c?.addrEn || '')}</cbc:CitySubdivisionName></cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEsc(c?.vat || '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:CompanyID>${xmlEsc(c?.cr || '')}</cbc:CompanyID></cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${Number(inv.vat).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">${Number(inv.sub).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${Number(inv.total).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${Number(inv.total).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines}
</Invoice>`;
}
function downloadXml(inv) {
  try {
    const blob = new window.Blob([buildXml(inv)], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.id}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 500);
  } catch (_e) {
    /* no download host (sandboxed iframe) */
  }
}

// ── Stats ──

function renderStats() {
  const rows = invoices();
  const billed = rows.filter(r => r.month === month).reduce((a, r) => a + r.total, 0);
  const out = rows.filter(r => r.status === 'sent').reduce((a, r) => a + r.total, 0);
  const today = isoToday();
  const overdue = rows.filter(r => r.status === 'sent' && r.due < today).reduce((a, r) => a + r.total, 0);
  const clients = new Set(SECONDMENTS.map(s => s.client)).size;
  setText('iv-stat-billed', fmtSAR(Math.round(billed * 100) / 100));
  setText('iv-stat-out', fmtSAR(Math.round(out * 100) / 100));
  setText('iv-stat-overdue', fmtSAR(Math.round(overdue * 100) / 100));
  setText('iv-stat-clients', fmtInt(clients));
    const tc = document.getElementById('iv-tabcount-inv');
  if (tc) {
    tc.textContent = fmtInt(rows.filter(r => r.month === month).length);
  }
  const cc = document.getElementById('iv-tabcount-cl');
  if (cc) {
    cc.textContent = fmtInt(getSeed('clients').length);
  }
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
  if (tab === 'ledger') {
    renderLedger();
  }
  if (tab === 'insights') {
    renderInsights();
  }
  if (tab === 'clients') {
    renderClients();
  }
}

// ── Invoices table ──

function destroyDataTable() {
  if (!dataTable) {
    return;
  }
  dataTable.destroy();
  dataTable = null;
}

async function mountDataTable() {
  const table = document.querySelector('[data-tabpanel="invoices"] table.emp-table');
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

function actionBtn(id, act, label, icon) {
  return `<button class="card-opt-btn" data-inv-${act} data-id="${esc(id)}" aria-label="${esc(label)}" data-tooltip="${esc(label)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icon}</svg></button>`;
}
const IC_VIEW = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
const IC_SEND = '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>';
const IC_EDIT = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>';

function renderRows() {
  const tbody = document.getElementById('iv-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  const rows = invoices().filter(r => r.month === month);
  const count = document.getElementById('iv-count');
  if (count) {
    count.textContent = t('inv.count').replace('{n}', fmtInt(rows.length)).replace('{month}', month);
  }
  tbody.innerHTML =
    rows
      .map(r => {
        const c = clientOf(r.client);
        const today = isoToday();
        const isOver = r.status === 'sent' && r.due < today;
        const overdueCls = isOver ? ' style="color:var(--red);font-weight:600;font-size:12.5px"' : ' style="font-size:12.5px"';
        const acts =
          actionBtn(r.id, 'view', t('common.view'), IC_VIEW) +
          (r.status === 'draft' ? actionBtn(r.id, 'edit', t('inv.edit'), IC_EDIT) + actionBtn(r.id, 'send', t('inv.markSent'), IC_SEND) : '') +
          (r.status === 'sent'
            ? `<button class="card-opt-btn" data-inv-paid data-id="${esc(r.id)}" aria-label="${esc(t('inv.markPaid'))}" data-tooltip="${esc(t('inv.markPaid'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg></button>`
            : '');
        return `
    <tr data-id="${esc(r.id)}">
      <td class="cell-mono" style="font-size:12.5px">#${fmtInt(r.no || 0)}<div class="caption-muted" style="font-size:11px">${esc(r.id)}</div></td>
      <td style="min-width:150px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[c?.av] || 'var(--avatar-teal)'};color:white">${esc((c?.nameEn || r.client).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
          <div>
            <div class="cell-strong" style="white-space:nowrap">${esc(clientName(r.client))}</div>
          </div>
        </div>
      </td>
      <td class="cell-mono" style="font-size:12.5px">${fmtInt(r.lines.length)}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(r.sub))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(r.vat))}</td>
      <td class="cell-mono" style="font-size:13px;font-weight:600">${esc(fmtSAR(r.total))}</td>
      <td${overdueCls}>${esc(fmtDate(r.due))}${isOver ? ' <span class="status status-red">*</span>' : ''}</td>
      <td><span class="status status-${ST_CLS[r.status] || 'blue'}">${esc(t(ST_KEY[r.status] || 'inv.stDraft'))}</span></td>
      <td class="emp-actions-cell">${acts}</td>
    </tr>`;
      })
      .join('');
  void mountDataTable();
}

function renderAll() {
  renderStats();
  renderRows();
  if (tab === 'clients') {
    renderClients();
  }
  if (tab === 'ledger') {
    renderLedger();
  }
  if (tab === 'insights') {
    renderInsights();
  }
}

// ── Status transitions ──

function patchInvoice(id, fields, toastKey) {
  const inv = invoices().find(r => r.id === id);
  if (!inv) {
    return;
  }
  saveImportedRows('invoices', [{ ...inv, ...fields, updated: isoToday() }]);
  showToast(t(toastKey), { variant: 'success' });
  renderAll();
}

// ── Generate / edit modal ──

function openEditor(client, existing) {
  const secs = SECONDMENTS.filter(s => s.client === client);
  const today = isoToday();
  const saved = code => (existing?.lines || []).find(l => l.emp === code);
  const rowsHtml = secs
    .map((s, i) => {
      const e = empOf(s.emp);
      const l = saved(s.emp) || { days: 30, otH: 0 };
      const ck = ajeerOf(s.emp, today);
      return `<tr>
        <td><div class="cell-strong" style="white-space:nowrap">${esc(nameOf(e))}</div><div class="caption-muted" style="font-size:11.5px">${esc(s.emp)} · ${esc(fmtSAR(s.rate))}</div></td>
        <td><span class="status status-${ck.ok ? 'green' : 'red'}" title="${esc(ck.reasons.map(r => t(REASON_KEY(r))).join(' · '))}">${esc(ck.ok ? t('inv.ajeerOk') : t('inv.ajeerFlag'))}</span></td>
        <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(s.rate))}</td>
        <td><input type="number" class="form-control inv-line-in" data-idx="${i}" data-emp="${esc(s.emp)}" data-f="days" value="${l.days}" min="0" max="31"></td>
        <td><input type="number" class="form-control inv-line-in" data-idx="${i}" data-emp="${esc(s.emp)}" data-f="otH" value="${l.otH || 0}" min="0" max="200"></td>
      </tr>`;
    })
    .join('');
  showModal({
    title: existing ? `${t('inv.edit')} · ${clientName(client)}` : t('inv.genTitle'),
    size: 'lg',
    body: `
      <div class="inv-gen-sub">${esc(t('inv.genFor').replace('{client}', clientName(client)).replace('{n}', fmtInt(secs.length)))}${existing ? ` · #${fmtInt(existing.no || 0)}` : ''}</div>
      <table class="payslip-table">
        <thead><tr>
          <th>${esc(t('inv.employeesH'))}</th>
          <th>${esc(t('inv.ajeerH'))}</th>
          <th>${esc(t('inv.rateH'))}</th>
          <th>${esc(t('inv.daysH'))}</th>
          <th>${esc(t('inv.otH'))}</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <label class="modal-form-row"><span>${esc(t('inv.notes'))}</span>
        <input type="text" class="form-control" id="iv-notes" value="${esc(existing?.notes || '')}" placeholder="${esc(t('inv.notesPh'))}"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: existing ? t('common.save') : t('inv.createDraft'),
        variant: 'primary',
        action: () => saveEditor(client, existing)
      }
    ]
  });
}

function saveEditor(client, existing) {
  const secs = SECONDMENTS.filter(s => s.client === client);
  const lines = secs.map(s => {
    const days = Math.max(0, Number(document.querySelector(`.inv-line-in[data-emp="${s.emp}"][data-f="days"]`)?.value) || 0);
    const otH = Math.max(0, Number(document.querySelector(`.inv-line-in[data-emp="${s.emp}"][data-f="otH"]`)?.value) || 0);
    return { emp: s.emp, rate: s.rate, days, otH };
  });
  const totals = computeTotals(lines);
  const c = clientOf(client);
  const id = existing?.id || `INV-${month}-${client}`;
  saveImportedRows('invoices', [
    {
      id,
      no: existing?.no || nextSeq(),
      month,
      client,
      status: 'draft',
      notes: document.getElementById('iv-notes')?.value || '',
      sub: totals.sub,
      vat: totals.vat,
      total: totals.total,
      due: existing?.due || invoiceDue(month, c?.billingDay, (getSettings().prefs && getSettings().prefs.invoicing ? getSettings().prefs.invoicing.dueDays : NaN) || 0),
      updated: isoToday(),
      lines
    }
  ]);
  showToast(t(existing ? 'inv.toastUpdated' : 'inv.toastDraft'), { variant: 'success' });
  document.querySelector('.modal-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  renderAll();
}

function computeTotals(lines) {
  return invoiceTotals(lines.map(l => ({ rate: l.rate, days: l.days, otH: l.otH })));
}

function genClients() {
  const map = {};
  for (const s of SECONDMENTS) {
    (map[s.client] = map[s.client] || []).push(s);
  }
  return Object.keys(map).sort().map(id => ({ id, secs: map[id] }));
}

function openGenerate() {
  const existing = invoices();
  const { body: genModalBody } = showModal({
    title: t('inv.genTitle'),
    size: 'lg',
    body: `
      <div class="inv-gen-sub">${esc(t('inv.genSub'))}</div>
      ${genClients()
        .map(g => {
          const c = clientOf(g.id);
          const has = existing.some(r => r.id === `INV-${month}-${g.id}` && r.status === 'draft');
          const locked = existing.some(r => r.id === `INV-${month}-${g.id}` && r.status !== 'draft');
          return `
        <div class="inv-gen-row">
          <div class="cell-customer">
            <div class="cell-avatar" style="background:${AVATAR_BG[c?.av] || 'var(--avatar-teal)'};color:white">${esc((c?.nameEn || g.id).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
            <div>
              <div class="cell-strong">${esc(clientName(g.id))}</div>
              ${has ? `<div class="inv-gen-note">${esc(t('inv.draftExists'))}</div>` : ''}
            </div>
          </div>
          <button class="btn ${locked ? 'btn-ghost' : 'btn-primary'} btn-sm" data-inv-genclient="${esc(g.id)}" type="button" ${locked ? `disabled title="${esc(t('inv.locked'))}"` : ''}>${esc(t('inv.genFor').replace('{client}', clientName(g.id)).replace('{n}', fmtInt(g.secs.length)))}</button>
        </div>`;
        })
        .join('')}`,
    actions: [{ label: t('common.close'), variant: 'ghost' }]
  });
  genModalBody.addEventListener('click', e => {
    const pick = e.target.closest('[data-inv-genclient]');
    if (pick) {
      const client = pick.dataset.invGenclient;
      const prev = invoices().find(r => r.id === `INV-${month}-${client}` && r.status === 'draft');
      // swap modal content to the editor
      document.querySelector('.modal-close')?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      setTimeout(() => openEditor(client, prev || null), 0);
    }
  });
}

// ── Invoice document (templates) ──

function flagsFor(inv) {
  const today = isoToday();
  return inv.lines
    .map(l => ({ l, ck: ajeerOf(l.emp, today) }))
    .filter(x => !x.ck.ok)
    .map(x => `${nameOf(empOf(x.l.emp))} — ${x.ck.reasons.map(r => t(REASON_KEY(r))).join(' · ')}`);
}

function sellerBlock(cls = '') {
  return `
    <div class="inv-party ${cls}">
      <div class="inv-party-title">${currentLang() === 'ar' ? `${B('Seller', 'البائع')}` : B('Seller', 'البائع')}</div>
      <div><strong>${esc(currentLang() === 'ar' ? SELLER().nameAr : SELLER().nameEn)}</strong></div>
      <div>${esc(SELLER().addressEn)}</div>
      <div>${esc(SELLER.addressAr)}</div>
      <div>${B('VAT number', 'الرقم الضريبي')}: <strong>${esc(SELLER().taxNo || '—')}</strong></div>
      <div>${B('CR number', 'رقم السجل التجاري')}: <strong>${esc(SELLER.crNo || '—')}</strong></div>
    </div>`;
}
function buyerBlock(inv) {
  const c = clientOf(inv.client);
  return `
    <div class="inv-party">
      <div class="inv-party-title">${B('Buyer', 'المشتري')}</div>
      <div><strong>${esc(c?.nameEn || '—')}</strong></div>
      <div>${esc(c?.nameAr || '')}</div>
      <div>${esc(c?.addrEn || '—')}</div>
      <div>${esc(c?.addrAr || '')}</div>
      <div>${B('VAT number', 'الرقم الضريبي')}: <strong>${esc(c?.vat || '—')}</strong></div>
      <div>${B('CR number', 'رقم السجل التجاري')}: <strong>${esc(c?.cr || '—')}</strong></div>
    </div>`;
}

function docBodyZatca(inv) {
  const c = clientOf(inv.client);
  return `
    <div class="payslip inv-doc inv-doc--zatca" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
      <div class="inv-zatca-badge">✓ ${esc(t('doc.zatcaBadge'))}</div>
      <div class="payslip-head">
        <div class="payslip-brand">${esc(currentLang() === 'ar' ? SELLER().nameAr : SELLER().nameEn)}</div>
        <div class="payslip-title">${esc(currentLang() === 'ar' ? B('Tax invoice', 'فاتورة ضريبية') : 'فاتورة ضريبية · Tax invoice')}</div>
      </div>
      <div class="inv-parties">${sellerBlock()}${buyerBlock(inv)}</div>
      <div class="payslip-emp">
        <div><span>${esc(B('Invoice No.', 'رقم الفاتورة'))}</span><strong>${esc(inv.id)}</strong></div>
        <div><span>${esc(B('Seq.', 'الرقم'))}</span><strong>#${fmtInt(inv.no || 0)}</strong></div>
        <div><span>${esc(B('Issue date', 'تاريخ الإصدار'))}</span><strong>${esc(fmtDate(inv.updated || isoToday()))}</strong></div>
        <div><span>${esc(B('Supply date', 'تاريخ التوريد'))}</span><strong>${esc(fmtDate(supplyDate(inv.month)))}</strong></div>
        <div><span>${esc(B('Due date', 'تاريخ الاستحقاق'))}</span><strong>${esc(fmtDate(inv.due))}</strong></div>
        <div><span>${esc(B('Month', 'الشهر'))}</span><strong>${esc(inv.month)}</strong></div>
      </div>
      <table class="payslip-table">
        <thead><tr>
          <th>${esc(B('Description', 'الوصف'))}</th>
          <th>${esc(B('Unit price', 'سعر الوحدة'))}</th>
          <th>${esc(B('Qty (days)', 'الكمية (أيام)'))}</th>
          <th>${esc(B('OT hours', 'ساعات إضافية'))}</th>
          <th style="text-align:end">${esc(B('Amount', 'المبلغ'))}</th>
        </tr></thead>
        <tbody>
          ${inv.lines
            .map(l => {
              const calc = invoiceLine(l.rate, l.days, l.otH);
              const e = empOf(l.emp);
              return `<tr>
            <td>${esc(t('doc.serviceDesc').replace('{prof}', currentLang() === 'ar' ? e?.titleAr || '' : e?.titleEn || ''))} <span style="color:#666">· ${esc(l.emp)}</span></td>
            <td>${esc(fmtSAR(calc.daily))}</td>
            <td>${fmtInt(l.days)}</td>
            <td>${fmtInt(l.otH)}</td>
            <td style="text-align:end">${esc(fmtSAR(calc.total))}</td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <div class="inv-doc-totals">
        <div><span>${esc(B('Taxable amount', 'المبلغ الخاضع للضريبة'))}</span><strong>${esc(fmtSAR(inv.sub))}</strong></div>
        <div><span>${esc(B('VAT 15%', 'ضريبة القيمة المضافة ١٥٪'))}</span><strong>${esc(fmtSAR(inv.vat))}</strong></div>
      </div>
      <div class="payslip-net"><span>${esc(B('Total incl. VAT', 'الإجمالي شامل الضريبة'))}</span><strong>${esc(fmtSAR(inv.total))}</strong></div>
      <div class="inv-qr-row">
        <div class="inv-qr">${zatcaQrSvg(inv)}</div>
        <div class="inv-qr-note">
          <div>${esc(currentLang() === 'ar' ? 'رمز الاستجابة السريعة وفق مواصفات هيئة الزكاة والضريبة والجمارك' : 'QR per ZATCA Phase-1 TLV specification')}</div>
          <div class="caption-muted">${esc(B('Buyer VAT', 'الرقم الضريبي للمشتري'))}: ${esc(c?.vat || '—')}</div>
        </div>
      </div>
      ${flagsFor(inv).length ? `<div class="inv-doc-flags"><div class="inv-doc-flags-title">${esc(t('inv.complianceNote'))}</div>${flagsFor(inv).map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
      <div class="payslip-foot">
        <div>${esc(t('inv.generated').replace('{date}', fmtDate(isoToday())))}</div>
      </div>
    </div>`;
}

function docBodyHouse(inv) {
  const c = clientOf(inv.client);
  return `
    <div class="payslip inv-doc inv-doc--house" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
      <div class="inv-house-band">
        <div>
          <div class="inv-house-brand">${esc(currentLang() === 'ar' ? SELLER().nameAr : SELLER().nameEn)}</div>
          <div class="inv-house-sub">${esc(currentLang() === 'ar' ? SELLER.addressAr : SELLER().addressEn)} · ${esc(t('doc.vatNo'))} ${esc(SELLER().taxNo || '')}</div>
        </div>
        <div class="inv-house-total">
          <div class="inv-house-total-label">${esc(t('inv.totalH'))}</div>
          <div class="inv-house-total-val">${esc(fmtSAR(inv.total))}</div>
          <div class="inv-house-total-sub">${esc(B('Invoice', 'فاتورة'))} #${fmtInt(inv.no || 0)} · ${esc(inv.month)}</div>
        </div>
      </div>
      <div class="payslip-emp">
        <div><span>${esc(t('inv.clientH'))}</span><strong>${esc(clientName(inv.client))}</strong></div>
        <div><span>${esc(t('doc.crNo'))}</span><strong>${esc(c?.cr || '—')}</strong></div>
        <div><span>${esc(t('inv.dueH'))}</span><strong>${esc(fmtDate(inv.due))}</strong></div>
        <div><span>${esc(t('inv.headsH'))}</span><strong>${fmtInt(inv.lines.length)}</strong></div>
      </div>
      ${inv.notes ? `<div class="inv-house-notes"><strong>${esc(t('inv.notes'))}:</strong> ${esc(inv.notes)}</div>` : ''}
      <table class="payslip-table">
        <thead><tr>
          <th>${esc(t('inv.employeesH'))}</th>
          <th>${esc(t('doc.siteH'))}</th>
          <th>${esc(t('inv.dailyH'))}</th>
          <th>${esc(t('inv.daysH'))}</th>
          <th style="text-align:end">${esc(t('inv.amountH'))}</th>
        </tr></thead>
        <tbody>
          ${inv.lines
            .map(l => {
              const calc = invoiceLine(l.rate, l.days, l.otH);
              const e = empOf(l.emp);
              const st = e?.site ? getSeed('sites').find(s => s.id === e.site) : null;
              return `<tr>
            <td>${esc(nameOf(e))} <span style="color:#666">· ${esc(l.emp)}</span></td>
            <td>${esc(st ? (currentLang() === 'ar' ? st.nameAr : st.nameEn) : '—')}</td>
            <td>${esc(fmtSAR(calc.daily))}</td>
            <td>${fmtInt(l.days)}</td>
            <td style="text-align:end">${esc(fmtSAR(calc.total))}</td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <div class="inv-doc-totals">
        <div><span>${esc(t('inv.subH'))}</span><strong>${esc(fmtSAR(inv.sub))}</strong></div>
        <div><span>${esc(t('inv.vatH'))}</span><strong>${esc(fmtSAR(inv.vat))}</strong></div>
      </div>
      <div class="payslip-net"><span>${esc(t('inv.totalH'))}</span><strong>${esc(fmtSAR(inv.total))}</strong></div>
      <div class="payslip-foot">
        <div>${esc(t('doc.termsText').replace('{d}', fmtInt(30)))}</div>
        <div>${esc(t('inv.generated').replace('{date}', fmtDate(isoToday())))}</div>
      </div>
    </div>`;
}

function docBodyDetail(inv) {
  return `
    <div class="payslip inv-doc inv-doc--detail" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
      <div class="payslip-head">
        <div class="payslip-brand">${esc(currentLang() === 'ar' ? SELLER().nameAr : SELLER().nameEn)}</div>
        <div class="payslip-title">${esc(t('inv.docTitle'))} · ${esc(inv.id)}</div>
      </div>
      <div class="payslip-emp">
        <div><span>${esc(t('inv.clientH'))}</span><strong>${esc(clientName(inv.client))}</strong></div>
        <div><span>${esc(t('inv.issueDate'))}</span><strong>${esc(fmtDate(inv.updated || isoToday()))}</strong></div>
        <div><span>${esc(t('doc.supplyDate'))}</span><strong>${esc(fmtDate(supplyDate(inv.month)))}</strong></div>
        <div><span>${esc(t('inv.dueH'))}</span><strong>${esc(fmtDate(inv.due))}</strong></div>
        ${inv.notes ? `<div><span>${esc(t('inv.notes'))}</span><strong>${esc(inv.notes)}</strong></div>` : ''}
      </div>
      <table class="payslip-table">
        <thead><tr>
          <th>${esc(t('inv.employeesH'))}</th>
          <th>${esc(t('doc.deptH'))}</th>
          <th>${esc(t('doc.profH'))}</th>
          <th>${esc(t('inv.rateH'))}</th>
          <th>${esc(t('inv.daysH'))}</th>
          <th>${esc(t('inv.otH'))}</th>
          <th style="text-align:end">${esc(t('inv.amountH'))}</th>
        </tr></thead>
        <tbody>
          ${inv.lines
            .map(l => {
              const calc = invoiceLine(l.rate, l.days, l.otH);
              const e = empOf(l.emp);
              const dept = { HR: 'HR', OPS: 'Ops', PRO: 'Projects', FIN: 'Finance', REC: 'Recruitment' }[e?.dept] || e?.dept || '—';
              return `<tr>
            <td>${esc(nameOf(e))} <span style="color:#666">· ${esc(l.emp)}</span></td>
            <td>${esc(dept)}</td>
            <td>${esc(currentLang() === 'ar' ? e?.titleAr || '—' : e?.titleEn || '—')}</td>
            <td>${esc(fmtSAR(l.rate))}</td>
            <td>${fmtInt(l.days)}</td>
            <td>${fmtInt(l.otH)}</td>
            <td style="text-align:end">${esc(fmtSAR(calc.total))}</td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <div class="inv-doc-totals">
        <div><span>${esc(t('inv.subH'))}</span><strong>${esc(fmtSAR(inv.sub))}</strong></div>
        <div><span>${esc(t('inv.vatH'))}</span><strong>${esc(fmtSAR(inv.vat))}</strong></div>
      </div>
      <div class="payslip-net"><span>${esc(t('inv.totalH'))}</span><strong>${esc(fmtSAR(inv.total))}</strong></div>
      ${flagsFor(inv).length ? `<div class="inv-doc-flags"><div class="inv-doc-flags-title">${esc(t('inv.complianceNote'))}</div>${flagsFor(inv).map(n => `<div>${esc(n)}</div>`).join('')}</div>` : ''}
      <div class="payslip-foot">
        <div>${esc(t('doc.termsText').replace('{d}', fmtInt(30)))}</div>
        <div>${esc(t('inv.generated').replace('{date}', fmtDate(isoToday())))}</div>
      </div>
    </div>`;
}

function openInvoiceDoc(id) {
  const inv = invoices().find(x => x.id === id);
  if (!inv) {
    return;
  }
  const renderBody = () =>
    template === 'house' ? docBodyHouse(inv) : template === 'detail' ? docBodyDetail(inv) : docBodyZatca(inv);
  const actions = [
    { label: t('common.close'), variant: 'ghost' },
    ...(template === 'zatca'
      ? [{ label: 'XML', variant: 'ghost', action: () => { downloadXml(inv); return false; } }]
      : []),
    {
      label: t('pay.print'),
      variant: 'primary',
      action: () => {
        document.body.dataset.print = 'invoice';
        window.print();
        return false;
      }
    }
  ];
  const { body: docModalBody } = showModal({
    title: `${t('inv.docTitle')} · #${fmtInt(inv.no || 0)}`,
    size: 'lg',
    body: `
      <div class="inv-tpl-picker" role="radiogroup" aria-label="${esc(t('tpl.pick'))}">
        <span class="inv-tpl-label">${esc(t('tpl.pick'))}</span>
        ${TEMPLATES.map(x => `<button type="button" class="inv-tpl-chip ${template === x.id ? 'active' : ''}" data-inv-tpl="${x.id}">${esc(t(x.key))}</button>`).join('')}
      </div>
      <div id="iv-doc-body">${renderBody()}</div>`,
    actions
  });
  docModalBody.addEventListener('click', e => {
        const chip = e.target.closest('[data-inv-tpl]');
        if (chip) {
          setTemplate(chip.dataset.invTpl);
          const host = document.getElementById('iv-doc-body');
          if (host) {
            host.innerHTML = renderBody();
          }
        }
  });
}

// ── Clients tab ──

function clientStats(id) {
  const rows = invoices().filter(r => r.client === id);
  const billed = rows.reduce((a, r) => a + r.total, 0);
  const open = rows.filter(r => r.status !== 'paid').reduce((a, r) => a + r.total, 0);
  const heads = SECONDMENTS.filter(s => s.client === id).length;
  return { billed, open, heads };
}

function renderClients() {
  const tbody = document.getElementById('iv-cl-rows');
  if (!tbody) {
    return;
  }
  tbody.innerHTML = getSeed('clients')
    .map(c => {
      const st = clientStats(c.id);
      return `
    <tr data-id="${esc(c.id)}">
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[c.av] || 'var(--avatar-teal)'};color:white">${esc((c.nameEn || c.id).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
          <div>
            <div class="cell-strong" style="white-space:nowrap">${esc(clientName(c.id))}</div>
            <div class="caption-muted" style="font-size:11.5px">${esc(c.contactEn || '')} · ${esc(c.phone || '')}</div>
          </div>
        </div>
      </td>
      <td class="cell-mono" style="font-size:12.5px">${esc(c.vat || '—')}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(c.cr || '—')}</td>
      <td style="font-size:12.5px">${esc(currentLang() === 'ar' ? c.addrAr || '—' : c.addrEn || '—')}</td>
      <td class="cell-mono" style="font-size:12.5px">${fmtInt(c.billingDay)}</td>
      <td class="cell-mono" style="font-size:12.5px">${fmtInt(st.heads)}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(fmtSAR(st.billed))}</td>
      <td class="cell-mono" style="font-size:13px;font-weight:600">${esc(fmtSAR(st.open))}</td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-inv-cedit="${esc(c.id)}" aria-label="${esc(t('inv.clientEdit'))}" data-tooltip="${esc(t('inv.clientEdit'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${IC_EDIT}</svg></button>
      </td>
    </tr>`;
    })
    .join('');
}

function openClientEdit(id) {
  const c = clientOf(id);
  if (!c) {
    return;
  }
  const f = (id2, label, val, type = 'text') =>
    `<label class="modal-form-row"><span>${esc(label)}</span><input type="${type}" class="form-control" id="${id2}" value="${esc(val)}"></label>`;
  showModal({
    title: `${t('inv.clientEdit')} · ${clientName(id)}`,
    body: `
      ${f('cl-name-en', 'Name (EN)', c.nameEn)}
      ${f('cl-name-ar', 'Name (AR)', c.nameAr)}
      ${f('cl-vat', t('inv.clientVat'), c.vat || '')}
      ${f('cl-cr', t('doc.crNo'), c.cr || '')}
      ${f('cl-addr-en', `${t('inv.clientAddr')} (EN)`, c.addrEn || '')}
      ${f('cl-addr-ar', `${t('inv.clientAddr')} (AR)`, c.addrAr || '')}
      ${f('cl-city', 'City', c.city || '')}
      ${f('cl-bday', t('inv.clientBillingDay'), c.billingDay || 5, 'number')}`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: () => {
          const val = sel => document.getElementById(sel)?.value?.trim();
          const bday = Math.min(28, Math.max(1, Number(document.getElementById('cl-bday')?.value) || 5));
          saveImportedRows('clients', [
            {
              ...c,
              nameEn: val('cl-name-en') || c.nameEn,
              nameAr: val('cl-name-ar') || c.nameAr,
              vat: val('cl-vat'),
              cr: val('cl-cr'),
              addrEn: val('cl-addr-en'),
              addrAr: val('cl-addr-ar'),
              city: val('cl-city') || c.city,
              billingDay: bday
            }
          ]);
          showToast(t('inv.toastClient'), { variant: 'success' });
          renderAll();
        }
      }
    ]
  });
}

// ── Ledger tab ──

function ledgerRows() {
  const today = isoToday();
  return getSeed('invoices')
    .slice()
    .sort((a, b) => ((a.updated || '') + a.id < (b.updated || '') + b.id ? -1 : 1))
    .filter(r => (!ledger.client || r.client === ledger.client) && (!ledger.openOnly || r.status !== 'paid'))
    .map(r => ({
      r,
      debit: r.total,
      credit: r.status === 'paid' ? r.total : 0,
      overdue: r.status === 'sent' && r.due < today
    }));
}

function renderLedger() {
  const sel = document.getElementById('lg-client');
  if (sel && !sel.options.length) {
    sel.innerHTML =
      `<option value="">${esc(t('lg.clientAll'))}</option>` +
      getSeed('clients').map(c => `<option value="${esc(c.id)}">${esc(clientName(c.id))}</option>`).join('');
  }
  const rows = ledgerRows();
  const all = getSeed('invoices');
  const issued = all.reduce((a, r) => a + r.total, 0);
  const collected = all.filter(r => r.status === 'paid').reduce((a, r) => a + r.total, 0);
  setText('lg-stat-issued', fmtSAR(Math.round(issued * 100) / 100));
  setText('lg-stat-collected', fmtSAR(Math.round(collected * 100) / 100));
  setText('lg-stat-open', fmtSAR(Math.round((issued - collected) * 100) / 100));
  const count = document.getElementById('lg-count');
  if (count) {
    count.textContent = t('inv.count').replace('{n}', fmtInt(rows.length)).replace('{month}', ledger.client ? clientName(ledger.client) : t('lg.clientAll'));
  }
  let balance = 0;
  const tbody = document.getElementById('lg-rows');
  if (!tbody) {
    return;
  }
  tbody.innerHTML =
    rows
      .map(({ r, debit, credit, overdue }) => {
        balance = Math.round((balance + debit - credit) * 100) / 100;
        return `
    <tr data-id="${esc(r.id)}">
      <td class="cell-mono" style="font-size:12.5px">#${fmtInt(r.no || 0)}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.updated || r.due))}</td>
      <td class="cell-mono" style="font-size:12.5px">${esc(r.id)}</td>
      <td style="font-size:12.5px">${esc(clientName(r.client))}</td>
      <td class="cell-mono" style="font-size:12.5px;color:var(--red)">${credit ? '' : esc(fmtSAR(debit))}</td>
      <td class="cell-mono" style="font-size:12.5px;color:var(--green)">${credit ? esc(fmtSAR(credit)) : ''}</td>
      <td class="cell-mono" style="font-size:12.5px;font-weight:600">${esc(fmtSAR(balance))}</td>
      <td><span class="status status-${ST_CLS[r.status] || 'blue'}">${esc(t(ST_KEY[r.status] || 'inv.stDraft'))}</span>${overdue ? ' <span class="status status-red">*</span>' : ''}</td>
    </tr>`;
      })
      .join('');
}

function exportLedger() {
  const L = (en, ar) => (currentLang() === 'ar' ? ar : en);
  let balance = 0;
  const cols = [
    { key: 'no', label: L('No.', 'الرقم') },
    { key: 'issued', label: L('Issued', 'تاريخ الإصدار') },
    { key: 'id', label: L('Invoice', 'الفاتورة') },
    { key: 'client', label: L('Client', 'العميل') },
    { key: 'debit', label: L('Debit', 'مدين') },
    { key: 'credit', label: L('Credit', 'دائن') },
    { key: 'balance', label: L('Balance', 'الرصيد') },
    { key: 'status', label: L('Status', 'الحالة') }
  ];
  const items = ledgerRows().map(({ r, debit, credit }) => {
    balance = Math.round((balance + debit - credit) * 100) / 100;
    return {
      no: r.no || 0,
      issued: r.updated || r.due,
      id: r.id,
      client: clientName(r.client),
      debit: credit ? '' : debit,
      credit: credit || '',
      balance,
      status: t(ST_KEY[r.status])
    };
  });
  exportData('csv', 'sales-ledger.csv', cols, items);
}

function printLedger() {
  const rows = ledgerRows();
  let balance = 0;
  const body = `
    <div class="payslip inv-ledger-doc" dir="${currentLang() === 'ar' ? 'rtl' : 'ltr'}">
      <div class="payslip-head">
        <div class="payslip-brand">${esc(currentLang() === 'ar' ? SELLER().nameAr : SELLER().nameEn)}</div>
        <div class="payslip-title">${esc(t('lg.title'))}</div>
      </div>
      <div class="payslip-emp">
        <div><span>${esc(t('doc.vatNo'))}</span><strong>${esc(SELLER().taxNo || '—')}</strong></div>
        <div><span>${esc(t('doc.crNo'))}</span><strong>${esc(SELLER.crNo || '—')}</strong></div>
        <div><span>${esc(t('lg.dateH'))}</span><strong>${esc(fmtDate(isoToday()))}</strong></div>
        ${ledger.client ? `<div><span>${esc(t('inv.clientH'))}</span><strong>${esc(clientName(ledger.client))}</strong></div>` : ''}
      </div>
      <table class="payslip-table">
        <thead><tr>
          <th>${esc(t('lg.seqH'))}</th><th>${esc(t('lg.dateH'))}</th><th>${esc(t('lg.invoiceH'))}</th>
          <th>${esc(t('inv.clientH'))}</th><th style="text-align:end">${esc(t('lg.debitH'))}</th>
          <th style="text-align:end">${esc(t('lg.creditH'))}</th><th style="text-align:end">${esc(t('lg.balanceH'))}</th>
        </tr></thead>
        <tbody>
          ${rows
            .map(({ r, debit, credit }) => {
              balance = Math.round((balance + debit - credit) * 100) / 100;
              return `<tr><td>#${fmtInt(r.no || 0)}</td><td>${esc(fmtDate(r.updated || r.due))}</td><td>${esc(r.id)}</td><td>${esc(clientName(r.client))}</td><td style="text-align:end">${credit ? '' : esc(fmtSAR(debit))}</td><td style="text-align:end">${credit ? esc(fmtSAR(credit)) : ''}</td><td style="text-align:end">${esc(fmtSAR(balance))}</td></tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <div class="payslip-foot"><div>${esc(t('inv.generated').replace('{date}', fmtDate(isoToday())))}</div></div>
    </div>`;
  showModal({
    title: t('lg.title'),
    size: 'lg',
    body,
    actions: [
      { label: t('common.close'), variant: 'ghost' },
      {
        label: t('pay.print'),
        variant: 'primary',
        action: () => {
          document.body.dataset.print = 'ledger';
          window.print();
          return false;
        }
      }
    ]
  });
}

// ── Insights tab ──

function insightKpis() {
  const rows = invoices();
  const billed = rows.reduce((a, r) => a + r.total, 0);
  const paid = rows.filter(r => r.status === 'paid').reduce((a, r) => a + r.total, 0);
  const vatDeclared = rows.filter(r => r.status !== 'draft').reduce((a, r) => a + r.vat, 0);
  const today = isoToday();
  let ok = 0;
  let total = 0;
  for (const r of rows) {
    for (const l of r.lines) {
      total += 1;
      if (ajeerOf(l.emp, today).ok) {
        ok += 1;
      }
    }
  }
  return {
    coll: billed ? Math.round((paid / billed) * 100) : 0,
    avg: rows.length ? billed / rows.length : 0,
    vatDeclared,
    comp: total ? Math.round((ok / total) * 100) : 100
  };
}

function renderInsights() {
  const k = insightKpis();
  setText('in-stat-coll', `${k.coll}%`);
  setText('in-stat-avg', fmtSAR(Math.round(k.avg * 100) / 100));
  setText('in-stat-vat', fmtSAR(Math.round(k.vatDeclared * 100) / 100));
  setText('in-stat-comp', `${k.comp}%`);

  // billing by month (stacked sub + vat)
  const byMonth = {};
  for (const r of getSeed('invoices')) {
    byMonth[r.month] = byMonth[r.month] || { sub: 0, vat: 0 };
    byMonth[r.month].sub += r.sub;
    byMonth[r.month].vat += r.vat;
  }
  const months = Object.keys(byMonth).sort();
  renderEchart(
    document.getElementById('chart-iv-month'),
    tk => ({
      tooltip: { trigger: 'axis' },
      legend: { data: [t('inv.subH'), t('inv.vatH')], textStyle: { color: tk.textMuted, fontSize: 11 }, top: 0 },
      grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: months, axisLabel: { color: tk.textMuted, fontSize: 10 }, axisLine: { lineStyle: { color: tk.borderLight } } },
      yAxis: {
        type: 'value',
        axisLabel: { color: tk.textMuted, fontSize: 10, formatter: v => `${fmtInt(v / 1000)}k` },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      series: [
        { name: t('inv.subH'), type: 'bar', stack: 'b', barMaxWidth: 26, itemStyle: { color: tk.primary }, data: months.map(m => Math.round(byMonth[m].sub)) },
        { name: t('inv.vatH'), type: 'bar', stack: 'b', barMaxWidth: 26, itemStyle: { color: tk.borderLight }, data: months.map(m => Math.round(byMonth[m].vat)) }
      ]
    }),
    t('in.byMonthSub')
  );

  // receivables aging
  const today = isoToday();
  const openRows = getSeed('invoices').filter(r => r.status === 'sent');
  const buckets = { cur: 0, d30: 0, d60: 0, d60p: 0 };
  for (const r of openRows) {
    const past = Math.round((new Date(`${today}T00:00:00`) - new Date(`${r.due}T00:00:00`)) / 86400000);
    if (past <= 0) {
      buckets.cur += r.total;
    } else if (past <= 30) {
      buckets.d30 += r.total;
    } else if (past <= 60) {
      buckets.d60 += r.total;
    } else {
      buckets.d60p += r.total;
    }
  }
  const agingData = [
    { name: t('in.aCur'), value: Math.round(buckets.cur) },
    { name: t('in.a30'), value: Math.round(buckets.d30) },
    { name: t('in.a60'), value: Math.round(buckets.d60) },
    { name: t('in.a60p'), value: Math.round(buckets.d60p) }
  ].filter(d => d.value > 0);
  renderEchart(
    document.getElementById('chart-iv-aging'),
    tk => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 10 } },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '44%'],
          label: { show: false },
          data: agingData.map((d, i) => ({ ...d, itemStyle: { color: [tk.primary, tk.yellow, tk.primaryDk, tk.red][i] || tk.primary } }))
        }
      ]
    }),
    t('in.agingSub')
  );

  // billing by client
  const byClient = {};
  for (const r of getSeed('invoices')) {
    byClient[r.client] = (byClient[r.client] || 0) + r.total;
  }
  const clientData = Object.keys(byClient).map(id => ({ name: clientName(id), value: Math.round(byClient[id]) }));
  renderEchart(
    document.getElementById('chart-iv-client'),
    tk => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 10 } },
      series: [
        {
          type: 'pie',
          radius: ['48%', '72%'],
          center: ['50%', '44%'],
          label: { show: false },
          data: clientData.map((d, i) => ({ ...d, itemStyle: { color: [tk.primary, tk.blue][i] || tk.primary } }))
        }
      ]
    }),
    t('in.byClientSub')
  );
}

// ── Export (month invoices) ──

function exportCsv() {
  const L = (en, ar) => (currentLang() === 'ar' ? ar : en);
  const cols = [
    { key: 'id', label: L('Invoice', 'الفاتورة') },
    { key: 'client', label: L('Client', 'العميل') },
    { key: 'heads', label: L('Heads', 'الموظفون') },
    { key: 'sub', label: L('Subtotal', 'المجموع') },
    { key: 'vat', label: L('VAT 15%', 'ضريبة ١٥٪') },
    { key: 'total', label: L('Total', 'الإجمالي') },
    { key: 'due', label: L('Due date', 'تاريخ الاستحقاق') },
    { key: 'status', label: L('Status', 'الحالة') }
  ];
  const items = invoices()
    .filter(r => r.month === month)
    .map(r => ({
      id: r.id,
      client: clientName(r.client),
      heads: r.lines.length,
      sub: r.sub,
      vat: r.vat,
      total: r.total,
      due: r.due,
      status: t(ST_KEY[r.status])
    }));
  exportData('csv', `invoices-${month}.csv`, cols, items);
}

// ── Boot ──

export function initInvoices() {
  const root = document.querySelector('[data-hr-invoices]');
  if (!root) {
    return;
  }
  const monthEl = document.getElementById('iv-month');
  if (monthEl && !monthEl.value) {
    monthEl.value = month;
  }
  renderAll();
  window.addEventListener('afterprint', () => {
    delete document.body.dataset.print;
  });
  document.querySelectorAll('.inv-tab').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  });
  monthEl?.addEventListener('change', () => {
    month = monthEl.value || isoToday().slice(0, 7);
    renderAll();
  });
  document.getElementById('iv-generate')?.addEventListener('click', openGenerate);
  document.getElementById('iv-export')?.addEventListener('click', exportCsv);
  // Page-level template picker — sets the default used by Generate and Print.
  document.querySelector('.inv-tpl-picker')?.addEventListener('click', e => {
    const chip = e.target.closest('[data-inv-tpl]');
    if (chip) { setTemplate(chip.dataset.invTpl); }
  });
  document.getElementById('lg-client')?.addEventListener('change', e => {
    ledger.client = e.target.value;
    renderLedger();
  });
  document.getElementById('lg-open')?.addEventListener('change', e => {
    ledger.openOnly = e.target.checked;
    renderLedger();
  });
  document.getElementById('lg-export')?.addEventListener('click', exportLedger);
  document.getElementById('lg-print')?.addEventListener('click', printLedger);
  root.addEventListener('click', e => {
    const view = e.target.closest('[data-inv-view]');
    if (view) {
      openInvoiceDoc(view.dataset.id);
      return;
    }
    const edit = e.target.closest('[data-inv-edit]');
    if (edit) {
      const inv = invoices().find(r => r.id === edit.dataset.id);
      if (inv && inv.status === 'draft') {
        openEditor(inv.client, inv);
      }
      return;
    }
    const send = e.target.closest('[data-inv-send]');
    if (send) {
      patchInvoice(send.dataset.id, { status: 'sent' }, 'inv.toastSent');
      return;
    }
    const paid = e.target.closest('[data-inv-paid]');
    if (paid) {
      patchInvoice(paid.dataset.id, { status: 'paid' }, 'inv.toastPaid');
      return;
    }
    const cedit = e.target.closest('[data-inv-cedit]');
    if (cedit) {
      openClientEdit(cedit.dataset.invCedit);
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    const sel = document.getElementById('lg-client');
    if (sel) {
      sel.innerHTML = '';
    }
    renderAll();
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
