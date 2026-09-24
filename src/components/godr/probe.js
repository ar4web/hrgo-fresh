// Go Dr. — active probes: connection health + per-page availability.
//
// Connection: navigator.connection (Network Information API) when available,
// ALWAYS cross-checked with a live ping to the app's own auth API
// (<base>auth/health — cheap, unauthenticated, proxied through the same
// origin). The ping is the fallback where the API is missing (Safari/Firefox)
// and the source of truth for "is the backend actually reachable".
//
// Pages: every catalog page's HTML is fetched (cache-busted, 8 s timeout,
// concurrency 4) to measure load time and availability — including pages the
// user never opened this session. JS-error attribution for visited pages
// comes from the monitor's store instead.

import { CATALOG, pageUrl } from './rules.js';
import { store } from './store.js';

const PING_TIMEOUT = 5000;
const PAGE_TIMEOUT = 8000;
const PAGE_POOL = 4;

const WEAK_PING_MS = 800;   // live ping slower than this → weak
const WEAK_API_RTT = 500;   // connection.rtt estimate slower than this → weak
const WEAK_DOWNLINK = 0.7;  // Mbps below this → weak
const SLOW_PAGE_MS = 1500;  // page load above this → weak
const TIMEOUT_PAGE_MS = 4000; // page load above this → treated as timed out

function timeoutSignal(ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

let pingStreak = 0; // consecutive failed pings (module lifetime)

export async function probeConnection() {
  const c = (typeof navigator !== 'undefined' && navigator.connection) || {};
  const online = navigator.onLine !== false;
  const base = {
    type: c.type || '',
    effectiveType: c.effectiveType || '',
    apiRtt: Number.isFinite(c.rtt) ? c.rtt : null,
    downlink: Number.isFinite(c.downlink) ? c.downlink : null,
    saveData: !!c.saveData,
    online,
    pingRtt: null,
    pingOk: false,
    streak: pingStreak,
    at: Date.now()
  };

  if (!online) {
    pingStreak += 1;
    return { ...base, streak: pingStreak, signal: 'lost' };
  }

  const t0 = performance.now();
  const to = timeoutSignal(PING_TIMEOUT);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}auth/health?godr=${Date.now()}`,
      { cache: 'no-store', signal: to.signal });
    to.done();
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) throw new Error(`ping ${res.status}`);
    pingStreak = 0;
    base.pingOk = true;
    base.pingRtt = ms;
  } catch (_err) {
    to.done();
    pingStreak += 1;
    base.pingRtt = null;
  }
  base.streak = pingStreak;

  let signal = 'strong';
  if (!base.pingOk && pingStreak >= 2) signal = 'cut';
  else if (!base.pingOk) signal = 'weak';
  else if (
    base.pingRtt > WEAK_PING_MS ||
    (base.apiRtt != null && base.apiRtt > WEAK_API_RTT) ||
    base.effectiveType === '2g' || base.effectiveType === 'slow-2g' ||
    (base.downlink != null && base.downlink < WEAK_DOWNLINK)
  ) signal = 'weak';

  return {
    ...base,
    // Display RTT: the live ping is the real measurement; the API estimate is
    // the fallback when the ping could not run.
    rtt: base.pingRtt != null ? base.pingRtt : base.apiRtt,
    rttSource: base.pingRtt != null ? 'ping' : (base.apiRtt != null ? 'api' : null),
    signal
  };
}

async function probePage(entry) {
  const url = pageUrl(entry);
  const t0 = performance.now();
  const to = timeoutSignal(PAGE_TIMEOUT);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: to.signal });
    to.done();
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) return { status: 'error', loadMs: ms, http: res.status, at: Date.now() };
    const status = ms > TIMEOUT_PAGE_MS ? 'timeout' : (ms > SLOW_PAGE_MS ? 'weak' : 'ok');
    return { status, loadMs: ms, http: res.status, at: Date.now() };
  } catch (err) {
    to.done();
    const ms = Math.round(performance.now() - t0);
    if (navigator.onLine === false) return { status: 'lost', loadMs: ms, http: 0, at: Date.now() };
    const timedOut = err && err.name === 'AbortError';
    return { status: timedOut ? 'timeout' : 'lost', loadMs: ms, http: 0, at: Date.now() };
  }
}

// Probe all catalog pages, pushing each result into the store as it lands.
export async function probePages(onResult) {
  let i = 0;
  const worker = async () => {
    while (i < CATALOG.length) {
      const entry = CATALOG[i];
      i += 1;
      const res = await probePage(entry);
      onResult(entry.key, res);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PAGE_POOL, CATALOG.length) }, worker));
}

// One monitoring cycle: connection snapshot → page probes → mark checked.
export async function runCycle() {
  const conn = await probeConnection();
  store.setConn(conn);

  if (!conn.online) {
    CATALOG.forEach((e) => store.setProbe(e.key, { status: 'lost', loadMs: 0, http: 0, at: Date.now() }));
  } else {
    await probePages((key, res) => {
      store.setProbe(key, res);
      if (res.status === 'error') store.recordIssue({ code: 'page.error', page: key, status: res.http });
      else if (res.status === 'timeout') store.recordIssue({ code: 'page.timeout', page: key, slowMs: res.loadMs });
      else if (res.status === 'lost') store.recordIssue({ code: 'page.lost', page: key });
      else if (res.status === 'weak') store.recordIssue({ code: 'page.weak', page: key, slowMs: res.loadMs });
    });
  }

  if (conn.signal === 'cut') store.recordIssue({ code: 'conn.cut', page: 'go-dr', count: conn.streak });
  else if (conn.signal === 'weak') store.recordIssue({ code: 'conn.weak', page: 'go-dr', slowMs: conn.rtt, mb: conn.downlink });

  store.markChecked();
  return conn;
}
