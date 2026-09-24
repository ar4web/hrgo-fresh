// Go Dr. — page catalog + problem→solution rule engine.
// Every detected problem is an "issue" with a `code`; this module maps each
// code to a severity plus a human-readable diagnosis (prob) and a concrete
// fix (fix). Texts come from i18n (godr.*) with {placeholder} interpolation.

import { t } from '../i18n.js';

// One row per route/page in the app. `key` matches body[data-page] so visit
// stats (load time, JS errors) recorded by godr/monitor.js land on the row.
export const CATALOG = [
  { key: 'dashboard', file: 'dashboard.html', labelKey: 'nav.dashboard' },
  { key: 'analytics', file: 'analytics.html', labelKey: 'nav.analytics' },
  { key: 'employees', file: 'employees.html', labelKey: 'nav.employees' },
  { key: 'employee-file', file: 'employee-file.html', labelKey: 'godr.page.empFile' },
  { key: 'recruitment', file: 'recruitment.html', labelKey: 'nav.recruitment' },
  { key: 'attendance', file: 'attendance.html', labelKey: 'nav.attendance' },
  { key: 'leave', file: 'leave.html', labelKey: 'nav.leave' },
  { key: 'payroll', file: 'payroll.html', labelKey: 'nav.payroll' },
  { key: 'invoices', file: 'invoices.html', labelKey: 'nav.invoices' },
  { key: 'expenses', file: 'expenses.html', labelKey: 'nav.expenses' },
  { key: 'profitability', file: 'profitability.html', labelKey: 'nav.profitability' },
  { key: 'eosb', file: 'eosb.html', labelKey: 'nav.eosb' },
  { key: 'renewals', file: 'renewals.html', labelKey: 'nav.renewals' },
  { key: 'documents', file: 'documents.html', labelKey: 'nav.documents' },
  { key: 'files', file: 'files.html', labelKey: 'nav.files' },
  { key: 'apps', file: 'apps.html', labelKey: 'nav.apps' },
  { key: 'settings', file: 'settings.html', labelKey: 'nav.settings' },
  { key: 'users', file: 'users.html', labelKey: 'nav.users' },
  { key: 'go-dr', file: 'go-dr.html', labelKey: 'godr.title' },
  { key: 'vendor', file: 'vendor.html', labelKey: 'vendor.portal' },
  { key: 'login', file: 'login.html', labelKey: 'godr.page.login' }
];

export const pageByKey = (key) => CATALOG.find((p) => p.key === key);

// Probe URL — pages live at <base>src/pages/<file>.html in dev AND in the
// production build, so one URL scheme serves both.
export function pageUrl(entry) {
  return `${import.meta.env.BASE_URL}src/pages/${entry.file}`;
}

export function pageLabel(key) {
  const entry = pageByKey(key);
  if (entry) return t(entry.labelKey);
  return key;
}

// Interpolate {placeholders} in an i18n string.
export function tf(key, params = {}) {
  let s = t(key);
  for (const [k, v] of Object.entries(params)) {
    if (s.includes(`{${k}}`)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

const RULES = {
  'conn.offline': { sev: 'critical', prob: 'godr.prob.connOffline', fix: 'godr.fix.connOffline' },
  'conn.cut': { sev: 'critical', prob: 'godr.prob.connCut', fix: 'godr.fix.connCut' },
  'conn.weak': { sev: 'warning', prob: 'godr.prob.connWeak', fix: 'godr.fix.connWeak' },
  'page.error': { sev: 'critical', prob: 'godr.prob.pageError', fix: 'godr.fix.pageError' },
  'page.timeout': { sev: 'critical', prob: 'godr.prob.pageTimeout', fix: 'godr.fix.pageTimeout' },
  'page.lost': { sev: 'critical', prob: 'godr.prob.pageLost', fix: 'godr.fix.pageLost' },
  'page.weak': { sev: 'warning', prob: 'godr.prob.pageWeak', fix: 'godr.fix.pageWeak' },
  'js.error': { sev: 'warning', prob: 'godr.prob.jsError', fix: 'godr.fix.jsError' },
  'promise.rejection': { sev: 'warning', prob: 'godr.prob.promise', fix: 'godr.fix.promise' },
  'asset.missing': { sev: 'warning', prob: 'godr.prob.asset', fix: 'godr.fix.asset' },
  'api.network': { sev: 'critical', prob: 'godr.prob.apiNet', fix: 'godr.fix.apiNet' },
  'ws.drop': { sev: 'warning', prob: 'godr.prob.ws', fix: 'godr.fix.ws' },
  'sw.http': { sev: 'warning', prob: 'godr.prob.swHttp', fix: 'godr.fix.swHttp' },
  'sw.net': { sev: 'critical', prob: 'godr.prob.swNet', fix: 'godr.fix.swNet' }
};

// Map an issue → { sev, prob, fix }. `api.status` severity depends on the
// HTTP status code, so it is resolved dynamically.
export function diagnose(issue) {
  if (!issue) return null;
  if (issue.code === 'api.status') {
    const s = Number(issue.status) || 0;
    if (s >= 500) return { sev: 'critical', prob: 'godr.prob.api5xx', fix: 'godr.fix.api5xx' };
    if (s === 401) return { sev: 'info', prob: 'godr.prob.api401', fix: 'godr.fix.api401' };
    if (s === 403) return { sev: 'warning', prob: 'godr.prob.api403', fix: 'godr.fix.api403' };
    if (s === 404) return { sev: 'warning', prob: 'godr.prob.api404', fix: 'godr.fix.api404' };
    return { sev: 'warning', prob: 'godr.prob.apiOther', fix: 'godr.fix.apiOther' };
  }
  return RULES[issue.code] || { sev: 'info', prob: 'godr.prob.unknown', fix: 'godr.fix.unknown' };
}

// Interpolation params for an issue's problem/fix texts.
export function issueParams(issue) {
  return {
    page: issue.page ? pageLabel(issue.page) : '',
    url: issue.url || '',
    status: issue.status || '',
    ms: issue.slowMs || '',
    msg: (issue.message || '').slice(0, 120),
    n: issue.count || '',
    mb: issue.mb || ''
  };
}

// Synthesize the connection issue so the connection card gets a reason + fix.
export function connIssueFor(conn) {
  if (!conn) return null;
  if (conn.signal === 'lost') return { code: 'conn.offline', page: 'go-dr' };
  if (conn.signal === 'cut') return { code: 'conn.cut', page: 'go-dr', count: conn.streak };
  if (conn.signal === 'weak') {
    return { code: 'conn.weak', page: 'go-dr', slowMs: conn.rtt, mb: conn.downlink };
  }
  return null;
}

export function overallOf(sevs) {
  if (sevs.includes('critical')) return 'critical';
  if (sevs.includes('warning')) return 'degraded';
  return 'ok';
}

// Health score for the speedometer gauge: start at 100 and subtract per
// detected problem — critical −20, warning −7, info −2 (floor 0). This makes
// one broken page bite hard while a stray info note barely dents the needle.
export function scoreOf(sevs) {
  let score = 100;
  for (const sev of sevs) {
    if (sev === 'critical') score -= 20;
    else if (sev === 'warning') score -= 7;
    else if (sev === 'info') score -= 2;
  }
  return Math.max(0, score);
}
