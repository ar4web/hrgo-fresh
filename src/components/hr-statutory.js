// HR + Operations — KSA statutory engine (single versioned source).
// ONLY this module may contain KSA rates/rules. Everything else imports from here.
// Overrides (Nitaqat/licence/levy) merge from Settings store (localStorage in seed mode).

import { SEED_COMPANY, SEED_NITAQAT, SEED_LICENCE, GOSI_VERSIONS, GOSI_SANED, GOSI_HAZARDS, GOSI_CAP, GOSI_CUTOFF, LEAVE_TYPES, BLOCKED_DEDUCTIONS, COMPANIES } from './hr-seed.js';

const SETTINGS_KEY = 'hr:settings:v1';

// ── Customization store (Settings page reads/writes this shape) ──────────
// company: brand placeholders the owner completes in Settings.
// nitaqat: activity category / size band / target % (owner sets later).
// licence: service vs labour outsourcing scope (owner/counsel sets later).

export function blankCompany(id, over = {}) {
  return {
    id,
    nameEn: '',
    nameAr: '',
    cr: '',
    vat: '',
    address: '',
    phone: '',
    email: '',
    logo: '',
    primary: SEED_COMPANY.primary,
    letters: [],
    ...over
  };
}

const DEFAULT_SETTINGS = {
  companies: [
    blankCompany('co-1', {
      nameEn: SEED_COMPANY.nameEn,
      nameAr: SEED_COMPANY.nameAr,
      cr: SEED_COMPANY.crNo,
      address: SEED_COMPANY.addressEn,
      email: SEED_COMPANY.email,
      logo: SEED_COMPANY.logoUrl
    })
  ],
  activeCompanyId: 'co-1',
  app: {
    name: 'goHR',
    logo: '/images/logo-icon.svg'
  },
  nitaqat: {
    activity: SEED_NITAQAT.activity,
    size: SEED_NITAQAT.sizeClass,
    target: SEED_NITAQAT.targetPct
  },
  licence: {
    scope: SEED_LICENCE.scope,
    strictAjeer: SEED_LICENCE.strictAjeerGuards,
    confirmed: false
  },
  language: SEED_COMPANY.defaultLang || 'en'
};

function storedSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (_e) {
    return {};
  }
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function mergeDeep(base, over) {
  const out = { ...base };
  if (!isObj(over)) {
    return out;
  }
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? mergeDeep(base[k], over[k]) : over[k];
  }
  return out;
}

function asCompanyList(v) {
  return Array.isArray(v) ? v : [];
}

// Legacy single-company shape → companies array (one-time, on read).
function migrateCompanies(stored) {
  if (asCompanyList(stored.companies).length) {
    return stored;
  }
  const legacy = stored.company;
  const first = isObj(legacy)
    ? blankCompany('co-1', {
      nameEn: legacy.nameEn || '',
      nameAr: legacy.nameAr || '',
      cr: legacy.cr || '',
      vat: legacy.vat || '',
      address: legacy.address || '',
      phone: legacy.phone || '',
      email: legacy.email || '',
      logo: legacy.logo || '',
      primary: legacy.primary || SEED_COMPANY.primary,
      letters: Array.isArray(legacy.letters) ? legacy.letters : []
    })
    : blankCompany('co-1', {
      nameEn: SEED_COMPANY.nameEn,
      nameAr: SEED_COMPANY.nameAr,
      cr: SEED_COMPANY.crNo,
      address: SEED_COMPANY.addressEn,
      email: SEED_COMPANY.email,
      logo: SEED_COMPANY.logoUrl
    });
  return { ...stored, companies: [first], activeCompanyId: 'co-1' };
}

/** Resolved active company (brand/docs consumers use this). */
function getActiveCompany(s) {
  const settings = s || getSettings();
  const list = asCompanyList(settings.companies);
  return list.find(c => c.id === settings.activeCompanyId) || list[0] || blankCompany('co-1');
}

/** Company/nitaqat/licence/language merged over seed defaults. */
// One-time identity upgrade: profiles saved before the Basmat Almawared
// branding still carry the 'goHR' placeholder — refresh them from the seed
// until the owner customizes the name or uploads their own logo.
function refreshSeedIdentity(s) {
  const list = Array.isArray(s.companies) ? s.companies : [];
  const c = list.find(x => x.id === s.activeCompanyId) || list[0];
  if (c && c.nameEn === 'goHR' && !c.logo) {
    Object.assign(c, {
      nameEn: SEED_COMPANY.nameEn,
      nameAr: SEED_COMPANY.nameAr,
      logo: SEED_COMPANY.logoUrl,
      email: c.email || SEED_COMPANY.email
    });
  }
}

export function getSettings() {
  const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const merged = mergeDeep(base, migrateCompanies(storedSettings()));
  refreshSeedIdentity(merged);
  // Derived view: every existing `s.company.*` reader keeps working and
  // always sees the ACTIVE company (2–3 companies supported).
  merged.company = getActiveCompany(merged);
  return merged;
}

/** Persist full or partial settings; returns the merged result. */
export function saveSettings(next) {
  const merged = mergeDeep(getSettings(), next || {});
  delete merged.company; // derived view only — companies[] is the source
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (_e) {
    /* private mode */
  }
  return getSettings();
}

// ── Dates ────────────────────────────────────────────────────────────────

export function daysUntil(iso, fromIso) {
  const from = fromIso ? new Date(fromIso) : new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(`${iso}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

// Whole calendar days between two ISO dates, inclusive of both ends.
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;
}

export function yearsBetween(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = toIso ? new Date(`${toIso}T00:00:00`) : new Date();
  let y = (to - from) / 31557600000;
  return Math.max(0, y);
}

// ── GOSI ─────────────────────────────────────────────────────────────────

export function gosiPensionRate(atIso) {
  const at = atIso || new Date().toISOString().slice(0, 10);
  let rate = GOSI_VERSIONS[0].pension;
  for (const v of GOSI_VERSIONS) {
    if (at >= v.from) {
      rate = v.pension;
    }
  }
  return rate;
}

function isOldGosiSystem(enrolledOn) {
  return !!enrolledOn && enrolledOn < GOSI_CUTOFF;
}

// Returns monthly SAR (major units, rounded to 2dp).
export function calcGosi({
  basic = 0,
  housing = 0,
  isSaudi = false,
  enrolledOn = null,
  at = null
} = {}) {
  const base = Math.min(Math.max(0, basic + housing), GOSI_CAP);
  if (!isSaudi) {
    const hazards = round2(base * GOSI_HAZARDS);
    return { base, employee: 0, employer: hazards, pension: 0, saned: 0, hazards, system: 'expat' };
  }
  const old = isOldGosiSystem(enrolledOn);
  const pensionRate = old ? 0.09 : gosiPensionRate(at);
  const pension = round2(base * pensionRate);
  const saned = round2(base * GOSI_SANED);
  const hazards = round2(base * GOSI_HAZARDS);
  return {
    base,
    employee: round2(pension + saned),
    employer: round2(pension + saned + hazards),
    pension,
    saned,
    hazards,
    system: old ? 'old' : 'new',
    pensionRate
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ── EOSB (Art. 84/85) ────────────────────────────────────────────────────
// endReason: termination | resignation | resignation-fixed | art80 | art81

export function calcEOSB({ basic = 0, joinDate, endDate = null, endReason = 'termination' } = {}) {
  if (!basic || !joinDate) {
    return { net: 0, gross: 0, haircut: 0, years: 0, factor: 0, reason: endReason };
  }
  if (endReason === 'art80') {
    return { net: 0, gross: 0, haircut: 0, years: 0, factor: 0, reason: endReason };
  }
  const years = yearsBetween(joinDate, endDate);
  const first5 = Math.min(years, 5);
  const rest = Math.max(0, years - 5);
  const gross = round2(basic * 0.5 * first5 + basic * rest);
  let factor = 1;
  // 2026 nuance (Art. 85): the resignation haircut applies only to fixed-term
  // resignation. Indefinite resignation, termination, contract end and Art. 81
  // exits keep the full award; Art. 80 forfeits it (handled above).
  if (endReason === 'resignation-fixed') {
    if (years < 2) {
      factor = 0;
    } else if (years < 5) {
      factor = 1 / 3;
    } else if (years < 10) {
      factor = 2 / 3;
    } else {
      factor = 1;
    }
  }
  const net = round2(gross * factor);
  return {
    net,
    gross,
    haircut: round2(gross - net),
    years: round2(years),
    factor,
    reason: endReason
  };
}

// ── Payroll line (P4) ────────────────────────────────────────────────────
// Contract monthly wage = basic + housing + transport (seed shape; no `rate`
// field on employees). Gross = wage + OT (hourly slice of wage/30 @1.5x) +
// extras. Deductions carry a category; Art. 40 employer-borne cats are
// flagged, never silently applied — the payroll UI must refuse to save them.

export function calcPayLine(emp, { otH = 0, extras = 0, deductions = [], at = null } = {}) {
  const rate = (Number(emp.basic) || 0) + (Number(emp.housing) || 0) + (Number(emp.transport) || 0);
  const daily = round2(rate / 30);
  const otPay = round2((rate / 30 / 8) * otRate() * (Number(otH) || 0));
  const gross = round2(rate + otPay + (Number(extras) || 0));
  const g = calcGosi({
    basic: emp.basic,
    housing: emp.housing,
    isSaudi: !!emp.saudi,
    enrolledOn: emp.gosiOn,
    at
  });
  const deds = deductions || [];
  const blocked = deds.filter(d => isBlockedDeduction(d.cat));
  const dedTotal = round2(deds.reduce((s, d) => s + (Number(d.amount) || 0), 0));
  const net = round2(gross - g.employee - dedTotal);
  return {
    emp: emp.code,
    daily,
    otH: Number(otH) || 0,
    otPay,
    extras: Number(extras) || 0,
    gross,
    gosiBase: g.base,
    gosiEmp: g.employee,
    gosiEr: g.employer,
    gosiSystem: g.system,
    deductions: deds,
    dedTotal,
    net,
    blocked
  };
}

// ── WPS / SIF (P4) ───────────────────────────────────────────────────────
// Pay within the first 10 days of the following month (§0.7).

export function wpsDeadline(month) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(y, m, 10); // m is 1-based month → 0-based next month
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// SIF working format v1.1 (pipe-delimited). Rows append optional ID fields
// when provided — idType: 1 = national ID (Saudis), 2 = Iqama (expats) —
// which Mudad expects per employee. Confirm the final fixed-width layout
// with the bank/finance before first live filing; the backend emits it.
export function sifBuild(month, lines) {
  const errors = [];
  const rows = (lines || []).map(l => {
    if (!l.iban) {
      errors.push(`${l.emp}: missing IBAN`);
    }
    if (!(Number(l.net) > 0)) {
      errors.push(`${l.emp}: non-positive net payable`);
    }
    const fils = Math.round((Number(l.net) || 0) * 100);
    const row = [
      'SAL',
      String(month).replace('-', ''),
      l.iban || 'NOIBAN',
      String(fils).padStart(12, '0'),
      l.emp
    ];
    if (l.idType && l.idNum) {
      row.push(String(l.idType), String(l.idNum));
    }
    return row.join('|');
  });
  const total = round2((lines || []).reduce((s, l) => s + (Number(l.net) || 0), 0));
  const head = ['SIF', 'V1', month, rows.length, Math.round(total * 100)].join('|');
  return { text: [head, ...rows].join('\n') + '\n', errors, total, count: rows.length };
}

// ── Leave ────────────────────────────────────────────────────────────────

function annualEntitlement(joinDate, atIso) {
  const t = LEAVE_TYPES.find(l => l.code === 'annual');
  return yearsBetween(joinDate, atIso) >= 5 ? t.after5 : t.base;
}

// ── Nitaqat estimate ─────────────────────────────────────────────────────
// Weighted: full-time Saudi = 1, part-time Saudi ≥ 3000 = 1/3.

export function nitaqatEstimate(employees, targetPct = 0) {
  const list = (employees || []).filter(e => e.st !== 'exited' && e.st !== 'huroob');
  let saudiUnits = 0;
  let saudis = 0;
  let expats = 0;
  let qiwaAuth = 0;
  for (const e of list) {
    if (e.saudi) {
      saudis += 1;
      const wage = (e.basic || 0) + (e.housing || 0) + (e.transport || 0);
      if (e.partTime) {
        saudiUnits += wage >= 3000 ? 1 / 3 : 0;
      } else {
        saudiUnits += wage >= 4000 ? 1 : 0;
      }
      if (e.q === 'authenticated') {
        qiwaAuth += 1;
      }
    } else {
      expats += 1;
    }
  }
  const total = saudis + expats;
  const pct = total ? (saudiUnits / total) * 100 : 0;
  const qiwaPct = saudis ? (qiwaAuth / saudis) * 100 : 100;
  return {
    saudis,
    expats,
    total,
    saudiUnits: Math.round(saudiUnits * 100) / 100,
    pct: Math.round(pct * 10) / 10,
    qiwaAuth,
    qiwaPct: Math.round(qiwaPct),
    targetPct,
    gap: Math.max(0, Math.round((targetPct - pct) * 10) / 10)
  };
}

// ── Ajeer activation gates (§0.11) ───────────────────────────────────────

export function ajeerCheck(assignment, employee, client, todayIso) {
  const reasons = [];
  const today = todayIso || new Date().toISOString().slice(0, 10);
  if (!assignment) {
    return { ok: false, reasons: ['missing-assignment'] };
  }
  if (!employee) {
    return { ok: false, reasons: ['missing-employee'] };
  }
  if (employee.st === 'exited') {
    reasons.push('employee-exited');
  }
  if (!employee.saudi) {
    if (!employee.iqama) {
      reasons.push('no-iqama');
    } else if (employee.iqamaExp && employee.iqamaExp < today) {
      reasons.push('iqama-expired');
    }
  }
  // Guardrails can be relaxed in Settings → Saudization & licence.
  const strict = !(getSettings().licence && getSettings().licence.strictAjeer === false);
  if (strict && !assignment.consent) {
    reasons.push('no-consent');
  }
  if (strict && !assignment.ajeer) {
    reasons.push('no-ajeer-ref');
  }
  if (assignment.ajeerExp && assignment.ajeerExp < today) {
    reasons.push('ajeer-expired');
  }
  if (assignment.start && assignment.end) {
    const span = yearsBetween(assignment.start, assignment.end);
    if (span > 3.01) {
      reasons.push('over-3y-cap');
    }
  }
  if (client && client.wpsOk === false) {
    reasons.push('client-wps-fail');
  }
  if (client && client.nitaqat === 'Red') {
    reasons.push('client-nitaqat-red');
  }
  return { ok: reasons.length === 0, reasons };
}

// ── Payroll guards ───────────────────────────────────────────────────────

function isBlockedDeduction(category) {
  return BLOCKED_DEDUCTIONS.includes((category || '').toLowerCase());
}

// ── Expiry bands + pre-renewal checklist (P1) ─────────────────────────────
// Renewal alert schedule: 90 / 60 / 30 / 7 days before expiry.
export function expiryBand(days) {
  if (days === null || days === undefined || Number.isNaN(days)) {
    return 'missing';
  }
  if (days < 0) {
    return 'expired';
  }
  if (days <= 7) {
    return 'critical';
  }
  if (days <= 30) {
    return 'urgent';
  }
  if (days <= 90) {
    return 'soon';
  }
  return 'ok';
}

// Pre-renewal checklist, auto-evaluated from worker + residency docs.
// docs: { passportExp, insExp, fines }. Saudis have no Iqama chain.
export function renewalChecklist(emp, docs = {}) {
  if (!emp) {
    return [];
  }
  if (emp.saudi) {
    return [{ key: 'saudi', ok: true, detail: 'no-iqama-chain' }];
  }
  const today = new Date().toISOString().slice(0, 10);
  const pp = docs.passportExp ? daysUntil(docs.passportExp, today) : null;
  const ins = docs.insExp ? daysUntil(docs.insExp, today) : null;
  return [
    { key: 'passport', ok: pp !== null && pp >= 180, detail: pp === null ? 'missing' : `${pp}d` },
    {
      key: 'insurance',
      ok: ins !== null && ins >= 0,
      detail: ins === null ? 'missing' : `${ins}d`
    },
    { key: 'fines', ok: (docs.fines || 0) === 0, detail: `${docs.fines || 0}` },
    { key: 'gosi', ok: true, detail: 'expat-2pct' }
  ];
}

// ── Time & leave engine (P2) ─────────────────────────────────────────────
// Weekend: Fri(5)+Sat(6). days param: JS getDay() numbers to skip.

const OT_RATE = 1.5;

/**
 * Legal company identity for documents (letters, invoices, ZATCA, payslips).
 * Reads the active company from the settings document; seed values fill any
 * field the owner has not completed yet. This is separate from the APP
 * identity (goHR name + system logo) shown in the sidebar.
 */
export function legalSeller() {
  const c = (getSettings() && getSettings().company) || {};
  const seed = COMPANIES.find(x => x.code === 'co-1') || {};
  const pick = (v, d) => (v && String(v).trim() ? String(v).trim() : d || '');
  return {
    nameEn: pick(c.nameEn, seed.nameEn),
    nameAr: pick(c.nameAr, seed.nameAr),
    crNo: pick(c.cr, seed.crNo),
    taxNo: pick(c.vat, seed.taxNo),
    addressEn: pick(c.address, seed.addressEn),
    addressAr: pick(c.address, seed.addressAr),
    phone: pick(c.phone, seed.phone),
    email: pick(c.email, seed.email),
    logo: c.logo || '',
    letterhead: c.letterhead || ''
  };
}

// ── Company theme engine ───────────────────────────────────────────────────
// One brand theme resolves every branded surface: app UI accent (--primary),
// document papers, payslips, ZATCA invoices (--doc-accent / --doc-font),
// email signature and notification pop-ups. Stored per company profile.
export function companyTheme() {
  const s = getSettings();
  const co = (s.companies || []).find(c => c.id === s.activeCompanyId) || (s.companies || [])[0] || {};
  const t = co.theme || {};
  const primary = (co.primary && /^#[0-9a-fA-F]{6}$/.test(co.primary) && co.primary)
    || SEED_COMPANY.primary || '#f97316';
  return {
    primary,
    docFont: t.docFont === 'serif' ? 'serif' : 'sans',
    signStyle: ['classic', 'modern', 'minimal'].includes(t.signStyle) ? t.signStyle : 'modern',
    signLang: t.signLang === 'en' || t.signLang === 'ar' ? t.signLang : 'both'
  };
}

export function setCompanyTheme(patch) {
  const s = getSettings();
  const co = (s.companies || []).find(c => c.id === s.activeCompanyId) || (s.companies || [])[0];
  if (co) {
    co.theme = { ...(co.theme || {}), ...patch };
    saveSettings(s);
  }
  return co ? co.theme : {};
}

/** VAT rate as a fraction — statutory 15%, overridable in Settings. */
export function vatRate() {
  const p = Number(getSettings().prefs && getSettings().prefs.invoicing ? getSettings().prefs.invoicing.vatRate : NaN);
  return Number.isFinite(p) && p >= 0 ? p / 100 : VAT_RATE;
}

/** Overtime multiplier — statutory default 1.5, overridable in Settings. */
export function otRate() {
  const m = Number(getSettings().prefs && getSettings().prefs.payroll ? getSettings().prefs.payroll.otMultiplier : NaN);
  return Number.isFinite(m) && m > 0 ? m : OT_RATE;
}
const MAX_DAY_HOURS = 11;
const RAMADAN_DAY_HOURS = 6;
const NORMAL_DAY_HOURS = 8;

// Working-day count in [from..to], skipping weekend + public-holiday spans.
// holidays: [{ start, days }]
export function annualBalance(joinDate, usedDays = 0, pendingDays = 0) {
  const ent = annualEntitlement(joinDate);
  const used = (usedDays || 0) + (pendingDays || 0);
  return { entitlement: ent, used, left: Math.max(0, ent - used) };
}

// Sick pay tier by cumulative sick day in the year (Art. 117: 30 full, 60 at
// 3/4, 30 unpaid). Returns { rate, tier }.
// Hajj: once, after 2 years of service.
// Weekend-shifted observance: Fri/Sat holiday starts move to Sunday.
// Day split for timesheets. Weekend work is all overtime. Flags >11h days.
// — P3: billing + Ajeer —
export const VAT_RATE = 0.15;

const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// Monthly-rate billing: daily = rate/30, OT at 1.5x the hourly slice.
export function invoiceLine(rate, days, otH) {
  const daily = rate / 30;
  const reg = daily * (days || 0);
  const otRate = (daily / 8) * OT_RATE;
  const ot = otRate * (otH || 0);
  return { daily: r2(daily), reg: r2(reg), otRate: r2(otRate), ot: r2(ot), total: r2(reg + ot) };
}

export function invoiceTotals(lines) {
  const sub = (lines || []).reduce((s, l) => s + invoiceLine(l.rate, l.days, l.otH).total, 0);
  const vat = sub * vatRate();
  return { sub: r2(sub), vat: r2(vat), total: r2(sub + vat) };
}

function permitStatus(exp, todayIso) {
  if (!exp) {
    return 'missing';
  }
  const today = todayIso || new Date().toISOString().slice(0, 10);
  if (exp < today) {
    return 'expired';
  }
  return daysUntil(exp, today) <= 30 ? 'expiring' : 'active';
}

// Beneficiary must return the worker within 1 working day (Fri/Sat skipped).
function returnDeadline(returnedAt) {
  const d = new Date(`${returnedAt}T00:00:00`);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 5 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

// Licence scope guard (D11–D12): service vs labour vs both.
// Due date = billingDay of the month after the service month (clamped to 28).
export function invoiceDue(month, billingDay, termsDays = 0) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1); // first day of next month (m is 0-based next)
  const day = Math.min(Math.max(1, billingDay || 5), 28);
  d.setDate(day + (Number(termsDays) || 0));
  return d.toISOString().slice(0, 10);
}

// ── Contracts: placeholders + lint + dates (P5) ────────────────────────────
// Template bodies use {{name}} placeholders drawn from records (no retyping).
// lintTemplate blocks saves with unbalanced braces or unknown names.

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + Number(n || 0));
  return fmtYMD(d);
}

// Probation must be stated in the contract and may not exceed 180 days (§0.4).
// ── T2 dashboard windows (pure; todayIso injectable so tests never rot) ───

// Vacation pipeline buckets for approved annual leaves. returning = anyone
// whose last day off falls within the next 14 days (regardless of start).
// Return efficiency over completed vacations (returnedAt set).
// Headcount buckets for the §1 status ring (huroob/exited visible, not hidden).
export function headcountByStatus(employees) {
  const out = { active: 0, probation: 0, 'on-leave': 0, exited: 0, huroob: 0, other: 0 };
  for (const e of employees || []) {
    if (out[e.st] === undefined) {
      out.other += 1;
    } else {
      out[e.st] += 1;
    }
  }
  return out;
}

// Tenure buckets in whole years between join and today.
export function tenureBuckets(employees, todayIso) {
  const out = { lt1: 0, y1_3: 0, y3_5: 0, gte5: 0 };
  for (const e of employees || []) {
    if (e.st === 'exited' || e.st === 'huroob' || !e.join) {
      continue;
    }
    const y = yearsBetween(e.join, todayIso || new Date().toISOString().slice(0, 10));
    if (y < 1) {
      out.lt1 += 1;
    } else if (y < 3) {
      out.y1_3 += 1;
    } else if (y < 5) {
      out.y3_5 += 1;
    } else {
      out.gte5 += 1;
    }
  }
  return out;
}

// ── T2 §1 separation series (pure; fixed window for tests) ─────────────────
// Hired = joins in month (any current status). Boarded = onboarding cases
// reaching final stage 10 that month. Exited = exitDate in month.
export function separationSeries(employees, onboarding, todayIso, windowMo = 6) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  const months = [];
  for (let i = windowMo - 1; i >= 0; i--) {
    const x = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    months.push({ ym, label: `${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getFullYear()).slice(2)}` });
  }
  const inMo = (iso, ym) => (iso || '').startsWith(ym);
  return {
    labels: months.map(m => m.label),
    hired: months.map(m => (employees || []).filter(e => inMo(e.join, m.ym)).length),
    boarded: months.map(
      m => (onboarding || []).filter(o => o.stages && inMo(String(o.stages[10] || ''), m.ym)).length
    ),
    exited: months.map(m => (employees || []).filter(e => inMo(e.exitDate, m.ym)).length)
  };
}

// ── T2 §2 vacation eligibility (pure) ──────────────────────────────────────
// Eligible now = payable (no exited/huroob) + probation done + annual
// balance left + no active request (pending, or approved ending ≥ today).
// ── T2 §4 expiry deck (pure) ───────────────────────────────────────────────
// Per-doc-type bands over payable expats. Missing = no date on file (data
// gap, shown — never folded into another band).
export function expiryDeck(employees, docs, todayIso) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const docByEmp = {};
  (docs || []).forEach(d => {
    docByEmp[d.emp] = d;
  });
  const band = iso => {
    if (!iso) {
      return 'missing';
    }
    const d = daysUntil(iso, today);
    if (d < 0) {
      return 'expired';
    }
    if (d <= 60) {
      return 'expiring';
    }
    return 'valid';
  };
  const fresh = () => ({ valid: 0, expiring: 0, expired: 0, missing: 0 });
  const out = { iqama: fresh(), passport: fresh(), insurance: fresh() };
  for (const e of employees || []) {
    if (e.saudi || e.st === 'exited' || e.st === 'huroob') {
      continue;
    }
    out.iqama[band(e.iqamaExp)] += 1;
    const doc = docByEmp[e.code] || {};
    out.passport[band(doc.passportExp)] += 1;
    out.insurance[band(doc.insExp)] += 1;
  }
  return out;
}

// Iqama countdown bands (days until expiry): 0–30 / 31–60 / 61–90.
export function iqamaBuckets(employees, todayIso) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const out = { le30: 0, le60: 0, le90: 0 };
  for (const e of employees || []) {
    if (e.saudi || e.st === 'exited' || e.st === 'huroob' || !e.iqamaExp) {
      continue;
    }
    const d = daysUntil(e.iqamaExp, today);
    if (d >= 0 && d <= 30) {
      out.le30 += 1;
    } else if (d > 30 && d <= 60) {
      out.le60 += 1;
    } else if (d > 60 && d <= 90) {
      out.le90 += 1;
    }
  }
  return out;
}

// Active contracts ending within `withinDays` (open-ended excluded).
// ── T2 §6 action-center ticker (pure) ──────────────────────────────────────
// Stale return = beneficiary returned the worker, 1 working day passed, and
// the employee still sits on an active assignment (needs PRO follow-up).
