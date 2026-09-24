// goHR auth API server — standalone (production) entry.
// Dev preview: vite proxies /auth + /api here. Run: node server/index.mjs
import { createServer } from 'node:http';
import { handleAuth } from './auth-routes.mjs';
import { dbStatus } from './auth-core.mjs';

const port = Number(process.env.AUTH_PORT) || 8080;
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
server.listen(port, () => {
  console.log(`[auth] goHR auth API on http://localhost:${port} (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);
  try {
    const st = dbStatus();
    console.log('[auth] db: ' + st.driver + ' → ' + st.file + ' (' + st.rows.users + ' users, integrity: ' + st.integrity + ')');
  } catch (e) {
    console.error('[auth] db status failed:', e.message);
  }
});
export default server;
