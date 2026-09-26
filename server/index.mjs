// goHR auth API server — standalone (production) entry.
// Dev preview: vite proxies /auth + /api here. Run: node server/index.mjs
import { createServer } from 'node:http';
import { handleAuth } from './auth-routes.mjs';
import { dbStatus } from './auth-core.mjs';

const port = Number(process.env.AUTH_PORT) || 8080;
const bypass = process.env.AUTH_BYPASS === '1' && process.env.NODE_ENV !== 'production';
// AUTH_BYPASS makes every route answer as a full admin, so it must never be
// reachable off-host. Bind to loopback whenever it is on; a host that wants it
// has to say so by also clearing NODE_ENV and setting AUTH_BYPASS_HOST.
const host = bypass ? (process.env.AUTH_BYPASS_HOST || '127.0.0.1') : '0.0.0.0';
let requestQueue = Promise.resolve();
const server = createServer((req, res) => {
  const run = requestQueue.then(() => handleAuth(req, res));
  requestQueue = run.catch(() => {});
  run.catch((e) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
    console.error('[auth]', e);
  });
});
server.listen(port, host, () => {
  console.log(`[auth] goHR auth API on http://${host}:${port} (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);
  if (bypass) {
    console.warn(`[auth] WARNING AUTH_BYPASS=1 — every route answers as admin (${host === '0.0.0.0' ? 'BOUND TO ALL INTERFACES' : 'loopback only'}). Never set this outside local development.`);
  }
  try {
    const st = dbStatus();
    console.log('[auth] db: ' + st.driver + ' → ' + st.file + ' (' + st.rows.users + ' users, integrity: ' + st.integrity + ')');
  } catch (e) {
    console.error('[auth] db status failed:', e.message);
  }
});
export default server;
