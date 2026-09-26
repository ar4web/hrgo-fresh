// User management (admin) — create accounts, assign the account type via
// login-ID prefix + role, enable/disable, reset passwords, delete.
// Server-enforced: users.read (admin/manager) and users.write (admin only).
import { t, currentLang, applyI18n, LANG_EVENT } from './i18n.js';
import {  getSession, api, destFor, refreshTokens } from './session.js';
import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { escapeHtml as esc } from './markup.js';

import { wireSecurity } from './security-panel.js';


function guard() {
  const s = getSession();
  const role = s && s.user && s.user.role;
  if (!s || !s.refreshToken) {
    window.location.replace('login.html');
    return null;
  }
  if (role !== 'admin' && role !== 'manager') {
    window.location.replace(destFor(s.user));
    return null;
  }
  return { session: s, canWrite: role === 'admin' };
}

const ROLE_META = {
  admin: { color: '#f97316', key: 'um.roleAdmin' },
  manager: { color: '#3b82f6', key: 'um.roleManager' },
  employee: { color: '#14b8a6', key: 'um.roleEmployee' },
  vendor: { color: '#a78bfa', key: 'um.roleVendor' }
};
const roleChip = (role) => {
  const m = ROLE_META[role] || ROLE_META.employee;
  return `<span class="um-role" data-role="${esc(role)}"><i style="background:${m.color}"></i>${esc(t(m.key))}</span>`;
};
const statusChip = (status) => `<span class="um-status ${status === 'active' ? 'is-on' : 'is-off'}"><i></i>${esc(status === 'active' ? t('um.active') : t('um.disabled'))}</span>`;
const initials = (name) => String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const ICONS_UM = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  key: '<path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>'
};
const iconBtn = (icon, attr, id, label) =>
  `<button class="um-act" ${attr}="${esc(id)}" aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS_UM[icon]}</svg></button>`;

// client-side search + role filter state
const FILTER = { q: '', role: 'all' };

function renderRoleChips(rows) {
  const host = document.getElementById('um-roles');
  if (!host) {return;}
  const counts = { all: rows.length };
  for (const r of rows) {counts[r.role] = (counts[r.role] || 0) + 1;}
  const order = ['all', 'admin', 'manager', 'employee', 'vendor'];
  host.innerHTML = order
    .filter(k => counts[k])
    .map(k => `<button class="chip um-role-chip${FILTER.role === k ? ' active' : ''}" type="button" data-um-role="${k}">${esc(k === 'all' ? t('um.all') : t(k === 'vendor' ? 'auth.roleVendor' : `um.role${k[0].toUpperCase()}${k.slice(1)}`))} · ${counts[k]}</button>`)
    .join('');
  host.querySelectorAll('[data-um-role]').forEach(b => {
    b.addEventListener('click', () => {
      FILTER.role = b.dataset.umRole;
      applyFilter(ctx0.rows);
    });
  });
}

function applyFilter(rows) {
  const q = FILTER.q.trim().toLowerCase();
  const filtered = rows.filter(u =>
    (FILTER.role === 'all' || u.role === FILTER.role) &&
    (!q || [u.loginId, u.nameEn, u.nameAr, u.email, u.phone].some(v => String(v || '').toLowerCase().includes(q))));
  renderRows(filtered);
  renderRoleChips(rows);
  const cnt = document.getElementById('um-count');
  if (cnt) {
    cnt.textContent = filtered.length === rows.length
      ? `${filtered.length}`
      : `${filtered.length} / ${rows.length}`;
  }
  const roleCount = r => rows.filter(u => u.role === r).length;
  }

function renderLoadError(status) {
  const body = document.getElementById('um-rows');
  if (!body) {return;}
  body.innerHTML = `
    <tr class="um-error-row">
      <td colspan="5">
        <div class="um-error">
          <span class="caption-muted">${esc(t('um.loadErr'))} (${esc(status)})</span>
          <button class="btn btn-outline btn-sm" id="um-retry" type="button">${esc(t('common.retry'))}</button>
        </div>
      </td>
    </tr>`;
  body.querySelector('#um-retry')?.addEventListener('click', () => {
    body.innerHTML = `<tr><td colspan="5"><span class="caption-muted">${esc(t('common.loading'))}</span></td></tr>`;
    loadRows(ctx0);
  });
}

async function loadRows(ctx, retried = false) {
  ctx0 = ctx;
  const r = await api('GET', '/api/admin/users');
  if (!r.ok) {
    // token expired mid-view: one silent re-auth attempt, then a visible Retry
    if (!retried && r.status === 401) {
      const ok = await refreshTokens();
      if (ok) {return loadRows(ctx, true);}
    }
    if (!getSession()) {
      window.location.replace('login.html'); // session fully dead → re-login
      return;
    }
    renderLoadError(r.status);
    return;
  }
  ctx.rows = r.data.rows || [];
  if (!ctx.rows.length) {
    const body = document.getElementById('um-rows');
    if (body) {body.innerHTML = `<tr><td colspan="5"><div class="um-error" style="padding:18px 0"><span class="caption-muted">${esc(t('um.empty'))}</span></div></td></tr>`;}
    renderRoleChips([]);
    const cnt = document.getElementById('um-count');
    if (cnt) {cnt.textContent = '0';}
    return;
  }
  applyFilter(ctx.rows);
}

function renderRows(rows) {
  const ctx = ctx0;
  const body = document.getElementById('um-rows');
  const ar = currentLang() === 'ar';
  body.innerHTML = rows.map((u) => {
    const meta = ROLE_META[u.role] || ROLE_META.employee;
    const name = esc(ar && u.nameAr ? u.nameAr : u.nameEn);
    return `
    <tr>
      <td>
        <div class="um-user">
          <span class="um-avatar" style="background:${meta.color}1f;color:${meta.color}">${esc(initials(u.nameEn))}</span>
          <div class="um-user-meta">
            <div class="um-user-name">${name}</div>
            <div class="um-user-id">${esc(u.loginId)}${u.email ? ` · ${esc(u.email)}` : ''}</div>
          </div>
        </div>
      </td>
      <td>${roleChip(u.role)}</td>
      <td class="cell-mono um-phone">${esc(u.phone || '—')}</td>
      <td>${statusChip(u.status)}</td>
      <td class="um-actions-cell">
        ${ctx.canWrite ? `
        ${iconBtn('edit', 'data-um-edit', u.id, t('um.edit'))}
        ${iconBtn('key', 'data-um-reset', u.id, t('um.resetPw'))}
        ${iconBtn(u.status === 'active' ? 'ban' : 'check', 'data-um-toggle', u.id, u.status === 'active' ? t('um.disable') : t('um.enable'))}
        ${iconBtn('trash', 'data-um-del', u.id, t('common.delete'))}` : ''}
      </td>
    </tr>`;
  }).join('');

  body.querySelectorAll('[data-um-toggle]').forEach(b => {
    b.addEventListener('click', async () => {
      const next = b.dataset.status === 'active' ? 'disabled' : 'active';
      const out = await api('PUT', `/api/admin/users/${b.dataset.umToggle}`, { status: next });
      if (!out.ok) {return showToast(t(out.data.error === 'cannot_disable_self' ? 'um.errSelf' : 'um.err'), { variant: 'error' });}
      showToast(t('um.saved'), { variant: 'success' });
      loadRows(ctx);
    });
  });
  body.querySelectorAll('[data-um-edit]').forEach(b => {
    b.addEventListener('click', () => editModal(ctx, ctx.rows.find(x => x.id === b.dataset.umEdit)));
  });
  body.querySelectorAll('[data-um-reset]').forEach(b => {
    b.addEventListener('click', () => resetPwModal(ctx, b.dataset.umReset));
  });
  body.querySelectorAll('[data-um-del]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!window.confirm(t('um.confirmDel'))) {return;}
      const out = await api('DELETE', `/api/admin/users/${b.dataset.umDel}`);
      if (!out.ok) {return showToast(t(out.data.error === 'cannot_delete_self' ? 'um.errSelf' : 'um.err'), { variant: 'error' });}
      showToast(t('um.saved'), { variant: 'success' });
      loadRows(ctx);
    });
  });
}

function addModal(ctx) {
  showModal({
    title: t('um.add'),
    size: 'md',
    body: `
      <label class="modal-form-row"><span>${esc(t('um.loginId'))}</span><input class="form-control" id="um-f-loginid" placeholder="EMP-014"></label>
      <div class="caption-muted" style="margin:-6px 0 8px">${esc(t('um.prefixHint'))}</div>
      <label class="modal-form-row"><span>${esc(t('um.nameEn'))}</span><input class="form-control" id="um-f-nameen"></label>
      <label class="modal-form-row"><span>${esc(t('um.nameAr'))}</span><input class="form-control" id="um-f-namear"></label>
      <label class="modal-form-row"><span>${esc(t('um.role'))}</span>
        <select class="form-control" id="um-f-role">
          <option value="employee">${esc(t('um.roleEmployee'))}</option>
          <option value="manager">${esc(t('um.roleManager'))}</option>
          <option value="admin">${esc(t('um.roleAdmin'))}</option>
          <option value="vendor">${esc(t('um.roleVendor'))}</option>
        </select>
      </label>
      <label class="modal-form-row"><span>${esc(t('um.phone'))}</span><input class="form-control" id="um-f-phone" placeholder="+9665…"></label>
      <label class="modal-form-row"><span>Iqama</span><input class="form-control" id="um-f-iqama" placeholder="2XXXXXXXXX"></label>
      <label class="modal-form-row"><span>Email</span><input class="form-control" id="um-f-email" type="email"></label>
      <label class="modal-form-row"><span>${esc(t('auth.password'))}</span><input class="form-control" id="um-f-pw" type="password" placeholder="≥ 6"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'), variant: 'primary',
        action: async ({ dialog }) => {
          const val = (id) => dialog.querySelector(`#${id}`).value.trim();
          const payload = {
            loginId: val('um-f-loginid'), nameEn: val('um-f-nameen'), nameAr: val('um-f-namear'),
            role: dialog.querySelector('#um-f-role').value, phone: val('um-f-phone'),
            iqama: val('um-f-iqama'), email: val('um-f-email'), password: dialog.querySelector('#um-f-pw').value
          };
          const out = await api('POST', '/api/admin/users', payload);
          if (!out.ok) {
            const key = { invalid_login_id: 'um.prefixHint', login_id_taken: 'um.errTaken', password_too_short: 'um.errPw', invalid_iqama_format: 'auth.errIqamaFormat' }[out.data.error] || 'um.err';
            showToast(t(key), { variant: 'error' });
            return false;
          }
          showToast(t('um.saved'), { variant: 'success' });
          loadRows(ctx);
          return true;
        }
      }
    ]
  });
}

function editModal(ctx, u) {
  if (!u) {return;}
  showModal({
    title: `${t('um.edit')} · ${u.loginId}`,
    size: 'md',
    body: `
      <div class="set-row"><span class="cell-strong">${esc(t('um.loginId'))}</span><span class="cell-mono">${esc(u.loginId)}</span></div>
      <label class="modal-form-row"><span>${esc(t('um.role'))}</span>
        <select class="form-control" id="um-e-role">
          <option value="employee"${u.role === 'employee' ? ' selected' : ''}>${esc(t('um.roleEmployee'))}</option>
          <option value="manager"${u.role === 'manager' ? ' selected' : ''}>${esc(t('um.roleManager'))}</option>
          <option value="admin"${u.role === 'admin' ? ' selected' : ''}>${esc(t('um.roleAdmin'))}</option>
          <option value="vendor"${u.role === 'vendor' ? ' selected' : ''}>${esc(t('um.roleVendor'))}</option>
        </select>
      </label>
      <label class="modal-form-row"><span>${esc(t('um.nameEn'))}</span><input class="form-control" id="um-e-nameen" value="${esc(u.nameEn)}"></label>
      <label class="modal-form-row"><span>${esc(t('um.nameAr'))}</span><input class="form-control" id="um-e-namear" value="${esc(u.nameAr)}"></label>
      <label class="modal-form-row"><span>${esc(t('um.phone'))}</span><input class="form-control" id="um-e-phone" value="${esc(u.phone)}"></label>
      <label class="modal-form-row"><span>Iqama</span><input class="form-control" id="um-e-iqama" value="${esc(u.iqama || '')}"></label>
      <label class="modal-form-row"><span>Email</span><input class="form-control" id="um-e-email" type="email" value="${esc(u.email)}"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'), variant: 'primary',
        action: async ({ dialog }) => {
          const val = (id) => dialog.querySelector(`#${id}`).value.trim();
          const out = await api('PUT', `/api/admin/users/${u.id}`, {
            role: dialog.querySelector('#um-e-role').value,
            nameEn: val('um-e-nameen'), nameAr: val('um-e-namear'),
            phone: val('um-e-phone'), iqama: val('um-e-iqama'), email: val('um-e-email')
          });
          if (!out.ok) {
            showToast(t(out.data.error === 'invalid_iqama_format' ? 'auth.errIqamaFormat' : 'um.err'), { variant: 'error' });
            return false;
          }
          showToast(t('um.saved'), { variant: 'success' });
          loadRows(ctx);
          return true;
        }
      }
    ]
  });
}

let ctx0 = { rows: [] };

function resetPwModal(ctx, id) {
  showModal({
    title: t('um.resetPw'),
    size: 'sm',
    body: `<label class="modal-form-row"><span>${esc(t('auth.password'))}</span><input class="form-control" id="um-r-pw" type="password" placeholder="≥ 6"></label>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'), variant: 'primary',
        action: async ({ dialog }) => {
          const pw = dialog.querySelector('#um-r-pw').value;
          const out = await api('PUT', `/api/admin/users/${id}`, { password: pw });
          if (!out.ok) {showToast(t(out.data.error === 'password_too_short' ? 'um.errPw' : 'um.err'), { variant: 'error' }); return false;}
          showToast(t('um.saved'), { variant: 'success' });
          return true;
        }
      }
    ]
  });
}

async function wireDatabase() {
  const card = document.getElementById('db-card');
  if (!card) {return;}
  const r = await api('GET', '/api/system/db');
  if (!r.ok) {return;} // non-admins: the card stays hidden
  const q = (id) => document.getElementById(id);
  q('db-driver').textContent = r.data.driver === 'sqlite' ? t('db.sqlite') : 'JSON';
  q('db-file').textContent = r.data.file || '—';
  q('db-integrity').textContent = r.data.integrity || '—';
  if (r.data.integrity === 'ok') {q('db-badge').hidden = false;}
  const rows = r.data.rows || {};
  q('db-rows').textContent = (rows.users || 0) + ' ' + t('db.users') + ' · ' + (rows.sessions || 0) + ' ' + t('db.sessions') + ' · ' + (rows.logs || 0) + ' ' + t('db.audit');
  card.hidden = false;
}

export function initUsers() {
  const ctx = guard();
  if (!ctx) {return;}
  document.getElementById('um-add')?.addEventListener('click', () => addModal(ctx));
  const search = document.getElementById('um-search');
  if (search) {
    search.placeholder = t('um.search');
    search.addEventListener('input', () => {
      FILTER.q = search.value;
      applyFilter(ctx.rows || []);
    });
  }
  loadRows(ctx);
  wireSecurity(ctx);
  wireDatabase();
  applyI18n();
  window.addEventListener(LANG_EVENT, () => {
    if (ctx0 && ctx0.rows) {applyFilter(ctx0.rows);}
  });
}
