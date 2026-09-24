// Go Dr. — central monitoring state (singleton store).
// This app is vanilla ES modules (no React/Redux), so the "central state" is a
// plain subscribable singleton. Instrumentation (godr/monitor.js) pushes facts
// in from every page; the Go Dr. dashboard (godr/page.js) subscribes and reads.
// Rolling buffers persist to sessionStorage so the dashboard sees everything
// that happened in this tab — on any page — before it was opened.

const ISSUES_KEY = 'hr:godr:issues';
const PAGES_KEY = 'hr:godr:pages';
const START_KEY = 'hr:godr:start';
const HIST_KEY = 'hr:godr:history';

const ISSUE_CAP = 100;   // rolling window of recorded issues
const HIST_CAP = 40;     // monitoring-cycle snapshots kept for trend charts
const DEDUP_MS = 60_000; // identical issues inside this window collapse into one (count++)

const state = {
  startedAt: Date.now(), // session uptime baseline
  lastCheck: null,       // timestamp of last completed monitoring cycle
  checks: 0,             // completed cycle count
  online: (typeof navigator !== 'undefined') ? navigator.onLine !== false : true,
  sw: 'unknown',         // 'active' | 'unavailable' | 'unknown'
  conn: null,            // connection snapshot — see godr/probe.js
  probes: {},            // pageKey -> { status, loadMs, http, at }
  visits: {},            // pageKey -> { visits, lastLoadMs, jsErrors, lastAt }
  issues: [],            // newest first, capped at ISSUE_CAP
  history: []            // per-cycle snapshots for trend charts (oldest → newest)
};

const listeners = new Set();
let initialized = false;

function readJson(key, fallback) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || 'null');
    return v == null ? fallback : v;
  } catch (_e) { return fallback; }
}
function writeJson(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_e) { /* private mode */ }
}
function emit() { listeners.forEach((fn) => { try { fn(state); } catch (_e) {} }); }

export function initStore() {
  if (initialized) return;
  initialized = true;
  let start = Number(sessionStorage.getItem(START_KEY) || 0);
  if (!start) { start = Date.now(); try { sessionStorage.setItem(START_KEY, String(start)); } catch (_e) {} }
  state.startedAt = start;
  state.issues = readJson(ISSUES_KEY, []);
  state.visits = readJson(PAGES_KEY, {});
  state.history = readJson(HIST_KEY, []);
}

function sameIssue(a, b) {
  return a.code === b.code && (a.page || '') === (b.page || '') &&
    (a.url || '') === (b.url || '') && (a.status || 0) === (b.status || 0);
}

export function recordIssue(issue) {
  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    count: 1,
    ...issue
  };
  const existing = state.issues.find((i) => sameIssue(i, entry) && entry.ts - i.ts < DEDUP_MS);
  if (existing) {
    existing.count += 1;
    existing.ts = entry.ts;
    if (entry.message) existing.message = entry.message;
    writeJson(ISSUES_KEY, state.issues);
    emit();
    return existing;
  }
  state.issues.unshift(entry);
  if (state.issues.length > ISSUE_CAP) state.issues.length = ISSUE_CAP;
  writeJson(ISSUES_KEY, state.issues);
  emit();
  return entry;
}

export function recordVisit(pageKey, loadMs) {
  const v = state.visits[pageKey] || { visits: 0, lastLoadMs: 0, jsErrors: 0, lastAt: 0 };
  v.visits += 1;
  if (loadMs > 0) v.lastLoadMs = loadMs;
  v.lastAt = Date.now();
  state.visits[pageKey] = v;
  writeJson(PAGES_KEY, state.visits);
  emit();
}

export function recordPageError(pageKey) {
  const v = state.visits[pageKey] || { visits: 0, lastLoadMs: 0, jsErrors: 0, lastAt: 0 };
  v.jsErrors += 1;
  v.lastAt = Date.now();
  state.visits[pageKey] = v;
  writeJson(PAGES_KEY, state.visits);
}

// Append a per-cycle snapshot for the trend charts. Silent (no emit): the
// monitoring cycle renders explicitly right after, so emitting would double it.
export function setHistoryPoint(pt) {
  state.history.push(pt);
  if (state.history.length > HIST_CAP) state.history.splice(0, state.history.length - HIST_CAP);
  writeJson(HIST_KEY, state.history);
}

export const store = {
  initStore,
  recordIssue,
  recordVisit,
  recordPageError,
  getState: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  setConn(conn) { state.conn = conn; emit(); },
  setProbe(pageKey, res) { state.probes[pageKey] = res; },
  setSw(status) { state.sw = status; emit(); },
  setOnline(online) { state.online = online; emit(); },
  setHistoryPoint,
  markChecked() { state.checks += 1; state.lastCheck = Date.now(); emit(); }
};
