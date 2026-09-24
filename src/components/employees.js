// goHR — employee directory (employees.html). Central dataset.
// Top charts + comprehensive filters + full table (name → all). Links to every page.

import { openMenu } from './menus.js';
import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, initialsOf, setText, renderPageMeta } from './hr-locale.js';
import { daysUntil, nitaqatEstimate, yearsBetween } from './hr-statutory.js';
import { getSeed } from './hr-api.js';
import { exportData } from './import-export.js';
import { openImportModal } from './import-modal.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DEPARTMENTS, PROFESSIONS, CLIENTS, SITES } from './hr-seed.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const EXPORT_COLS = [
  { key: 'code', label: 'Code / الرمز' },
  { key: 'nameEn', label: 'Name (EN)' },
  { key: 'nameAr', label: 'Name (AR) / الاسم' },
  { key: 'nat', label: 'Nationality / الجنسية' },
  { key: 'prof', label: 'Profession' },
  { key: 'dept', label: 'Department' },
  { key: 'join', label: 'Join date' },
  { key: 'basic', label: 'Basic' },
  { key: 'housing', label: 'Housing' },
  { key: 'transport', label: 'Transport' },
  { key: 'iqama', label: 'Iqama' },
  { key: 'iqamaExp', label: 'Iqama expiry' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'q', label: 'Qiwa' },
  { key: 'st', label: 'Status' }
];

let filter = {
  q: '',
  nat: '',
  dept: '',
  site: '',
  prof: '',
  exp: '',
  age: '',
  sponsor: '',
  st: '',
  sort: 'Code'
};
let booted = false;
let dataTable = null;

function profName(code) {
  const p = PROFESSIONS.find(x => x.code === code);
  if (!p) {
    return code || '—';
  }
  return currentLang() === 'ar' ? p.ar : p.en;
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}
function deployOf(e) {
  if (e.st === 'on-leave') {
    return { cls: 'yellow', label: t('status.on-leave') };
  }
  if (!e.client) {
    return { cls: 'blue', label: t('status.bench') };
  }
  const c = CLIENTS.find(x => x.id === e.client);
  const site = SITES.find(x => x.id === e.site);
  const cn = c ? (currentLang() === 'ar' ? c.nameAr : c.nameEn) : e.client;
  const sn = site ? (currentLang() === 'ar' ? site.nameAr : site.nameEn) : '';
  return { cls: 'green', label: t('status.deployed'), short: `${cn}${sn ? ` / ${sn}` : ''}` };
}
function iqamaBucket(e) {
  if (e.saudi || !e.iqamaExp) {
    return 'ok';
  }
  const d = daysUntil(e.iqamaExp);
  if (d < 0) {
    return 'expired';
  }
  if (d <= 30) {
    return 'le30';
  }
  if (d <= 90) {
    return 'le90';
  }
  return 'ok';
}

// Whole-year age from date of birth.
function ageOf(e) {
  if (!e.dob) {return null;}
  return Math.floor(yearsBetween(e.dob));
}

// Whole-year work experience (tenure) from the join date.
function experienceYears(e) {
  if (!e.join) {return null;}
  return Math.floor(yearsBetween(e.join));
}

function experienceBucket(e) {
  const y = experienceYears(e);
  if (y === null) {return '';}
  if (y < 1) {return 'lt1';}
  if (y < 3) {return '1-3';}
  if (y < 5) {return '3-5';}
  return '5+';
}

function ageBucket(e) {
  const a = ageOf(e);
  if (a === null) {return '';}
  if (a < 25) {return 'lt25';}
  if (a < 35) {return '25-34';}
  if (a < 45) {return '35-44';}
  return '45+';
}

function siteName(code) {
  if (code === 'bench') {return t('ro.benchUnassigned');}
  const s = SITES.find(x => x.id === code);
  return s ? (currentLang() === 'ar' ? s.nameAr : s.nameEn) : code;
}

function visible(list) {
  const q = filter.q.toLowerCase();
  let out = list.filter(
    e =>
      (!q ||
        e.nameEn.toLowerCase().includes(q) ||
        (e.nameAr || '').includes(filter.q) ||
        e.code.toLowerCase().includes(q) ||
        (e.iqama || '').includes(q) ||
        (e.nid || '').includes(q) ||
        (e.phone || '').includes(q)) &&
      (!filter.st || e.st === filter.st) &&
      (!filter.dept || e.dept === filter.dept) &&
      (!filter.prof || e.prof === filter.prof) &&
      (!filter.nat || e.nat === filter.nat) &&
      (!filter.sponsor || e.sponsor === filter.sponsor) &&
      (!filter.site ||
        (filter.site === 'bench' ? !e.site : e.site === filter.site)) &&
      (!filter.exp || experienceBucket(e) === filter.exp) &&
      (!filter.age || ageBucket(e) === filter.age)
  );
  const s = filter.sort;
  out.sort((a, b) => {
    if (s === 'name') {
      return (a.nameEn || '').localeCompare(b.nameEn || '');
    }
    if (s === 'join') {
      return (a.join || '').localeCompare(b.join || '');
    }
    if (s === 'basic') {
      return (b.basic || 0) - (a.basic || 0);
    }
    if (s === 'iqamaExp') {
      return (a.iqamaExp || '').localeCompare(b.iqamaExp || '');
    }
    if (s === 'nat') {
      return (a.nat || '').localeCompare(b.nat || '');
    }
    if (s === 'prof') {
      return (a.prof || '').localeCompare(b.prof || '');
    }
    if (s === 'nid') {
      return (a.nid || a.iqama || '').localeCompare(b.nid || b.iqama || '');
    }
    return (a.code || '').localeCompare(b.code || '');
  });
  return out;
}

function spark(el, vals, color) {
  if (!el) {
    return;
  }
  el.innerHTML = vals
    .map(v => `<div class="bar" style="height:${v}%;background:${color}"></div>`)
    .join('');
}
const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct1 = n =>
  `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
function renderStats(list) {
  const n = nitaqatEstimate(list);
  const deployed = list.filter(e => e.client && e.st === 'active').length;
  const bench = list.filter(e => !e.client && !e.saudi && e.st === 'active').length;
  setText('emp-stat-total', fmtInt(list.length));
  setText('emp-stat-saudi', fmtInt(n.saudis));
  setText('emp-stat-expat', fmtInt(n.expats));
  setText('emp-stat-deployed', fmtInt(deployed));
  setText('emp-stat-bench', fmtInt(bench));
  setText('emp-stat-saud', fmtPct1(n.pct));
  const total = list.length || 1;
  const pctSaudi = Math.round((n.saudis / total) * 100);
  const pctExpat = 100 - pctSaudi;
  const pctDeployed = list.filter(e => e.st === 'active').length
    ? Math.round((deployed / list.filter(e => e.st === 'active').length) * 100)
    : 0;
  setText('stat-sub-total', t('dash.saudiExpatSub').replace('{saudi}', n.saudis).replace('{expat}', n.expats));
  setText('stat-sub-saudi', t('ro.pctOfTotal').replace('{n}', pctSaudi));
  setText('stat-sub-expat', t('ro.pctOfTotal').replace('{n}', pctExpat));
  setText('stat-sub-deployed', t('ro.pctOfActive').replace('{n}', pctDeployed));
  setText('stat-sub-saud', n.pct >= 25 ? t('ro.platinum') : t('ro.needPct').replace('{n}', (25 - n.pct).toFixed(1)));
  const bar = (id, pct, color) => {
    const b = document.getElementById(id);
    if (b) {
      b.style.width = pct + '%';
    }
    if (b) {
      b.style.background = color;
    }
  };
  bar('bar-saudi', pctSaudi, 'var(--green)');
  bar('bar-expat', pctExpat, 'var(--blue)');
  bar('bar-deployed', pctDeployed, 'var(--purple)');
  bar(
    'bar-saud',
    n.pct,
    n.pct >= 25 ? 'var(--green)' : n.pct >= 15 ? 'var(--yellow)' : 'var(--red)'
  );
  spark(
    document.getElementById('spark-total'),
    [40, 55, 45, 60, 50, 70, 65, 80, 75, 90],
    'var(--primary)'
  );
  spark(
    document.getElementById('spark-saudi'),
    [30, 35, 45, 40, 55, 50, 65, 60, 75, 70],
    'var(--green)'
  );
  spark(
    document.getElementById('spark-expat'),
    [50, 60, 55, 68, 62, 75, 72, 85, 80, 92],
    'var(--blue)'
  );
  spark(
    document.getElementById('spark-deployed'),
    [30, 35, 45, 40, 55, 50, 65, 60, 75, 70],
    'var(--purple)'
  );
  spark(
    document.getElementById('spark-bench'),
    [45, 40, 50, 38, 55, 42, 60, 48, 52, 46],
    'var(--yellow)'
  );
  spark(
    document.getElementById('spark-saud'),
    [20, 25, 30, 22, 35, 28, 40, 38, 45, 32],
    'var(--red)'
  );
  const cnt = document.getElementById('emp-count');
  if (cnt) {
    cnt.textContent = `${fmtInt(visible(getSeed('employees')).length)} / ${fmtInt(list.length)}`;
  }
  renderTicker(list);
  renderPageMeta([
    `${fmtInt(list.length)} ${t('ro.total')}`,
    `${fmtInt(list.filter(e => e.st === 'active').length)} ${t('status.active')}`,
    `${fmtInt(deployed)} ${t('status.deployed')}`,
    `${fmtInt(list.filter(e => e.st === 'on-leave').length)} ${t('status.on-leave')}`
  ]);
}

// Merged alert ticker: clean text strings only — no counts, days, or tallies.
function renderTicker(list) {
  const track = document.getElementById('emp-ticker-track');
  if (!track) {
    return;
  }
  const items = [];
  list
    .filter(e => e.st === 'huroob')
    .slice(0, 5)
    .forEach(e => {
      items.push({ cls: 'red', text: t('ro.tHuroob').replace('{name}', currentLang() === 'ar' ? (e.nameAr || e.nameEn) : e.nameEn) });
    });
  list
    .filter(e => !e.saudi && e.iqamaExp && daysUntil(e.iqamaExp) < 0)
    .slice(0, 8)
    .forEach(e => {
      items.push({ cls: 'red', text: t('ro.tIqExpired').replace('{name}', currentLang() === 'ar' ? (e.nameAr || e.nameEn) : e.nameEn) });
    });
  list
    .filter(
      e => !e.saudi && e.iqamaExp && daysUntil(e.iqamaExp) >= 0 && daysUntil(e.iqamaExp) <= 30
    )
    .slice(0, 8)
    .forEach(e => {
      items.push({ cls: '', text: t('ro.tIqExpiring').replace('{name}', currentLang() === 'ar' ? (e.nameAr || e.nameEn) : e.nameEn) });
    });
  list
    .filter(e => e.q === 'draft')
    .slice(0, 4)
    .forEach(e => {
      items.push({ cls: 'green', text: t('ro.tQiwaDraft').replace('{name}', currentLang() === 'ar' ? (e.nameAr || e.nameEn) : e.nameEn) });
    });
  if (!items.length) {
    track.innerHTML = `<span class="ticker-band green">${t('dash.allClear')}</span>`;
    return;
  }
  const half = items.map(a => `<span class="ticker-band ${a.cls}">${esc(a.text)}</span>`).join('');
  track.innerHTML = half + half; // duplicate for seamless loop
}

// Filter dropdowns list only values that actually exist in the roster —
// nothing empty or irrelevant. Rebuilt when the data changes (import/add).
let filterOptionsSignature = '';
function populateFilters() {
  const emps = getSeed('employees');
  const present = (values, order, labels) => {
    const found = new Set(values);
    return order.filter(v => found.has(v)).map(v => [v, labels[v] || v]);
  };
  const uniq = (fn) => [...new Set(emps.map(fn).filter(Boolean))].sort();
  const signature = JSON.stringify({
    lang: currentLang(),
    st: uniq(e => e.st),
    site: uniq(e => (e.site || 'bench')),
    exp: uniq(experienceBucket),
    age: uniq(ageBucket),
    dept: uniq(e => e.dept),
    prof: uniq(e => e.prof),
    nat: uniq(e => e.nat),
    sponsor: uniq(e => e.sponsor)
  });
  if (signature === filterOptionsSignature) {return;}
  filterOptionsSignature = signature;

  const fill = (id, options) => {
    const sel = document.getElementById(id);
    if (!sel) {return;}
    const current = sel.value;
    sel.innerHTML = `<option value="">${t('common.all')}</option>` +
      options.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    sel.value = current;
  };

  fill('emp-status', present(
    emps.map(e => e.st),
    ['active', 'probation', 'on-leave', 'huroob', 'exited'],
    { active: t('status.active'), probation: t('status.probation'),
      'on-leave': t('status.on-leave'), huroob: t('status.huroob'),
      exited: t('status.exited') }
  ));
  fill('emp-nat', uniq(e => e.nat).map(v => [v, v]));
  fill('emp-dept', uniq(e => e.dept).map(v => [v, deptName(v)]));
  fill('emp-prof', uniq(e => e.prof).map(v => [v, profName(v)]));
  fill('emp-sponsor', uniq(e => e.sponsor).map(v => [v, v]));
  fill('emp-site', present(
    emps.map(e => e.site || 'bench'),
    ['ST-001', 'ST-002', 'ST-003', 'ST-004', 'ST-005', 'ST-006', 'bench'],
    {
      'ST-001': siteName('ST-001'), 'ST-002': siteName('ST-002'),
      'ST-003': siteName('ST-003'), 'ST-004': siteName('ST-004'),
      'ST-005': siteName('ST-005'), 'ST-006': siteName('ST-006'),
      bench: siteName('bench')
    }
  ));
  fill('emp-exp', present(
    emps.map(experienceBucket),
    ['lt1', '1-3', '3-5', '5+'],
    { lt1: t('ro.expLt1'), '1-3': t('ro.exp13'), '3-5': t('ro.exp35'), '5+': t('ro.exp5') }
  ));
  fill('emp-age', present(
    emps.map(ageBucket),
    ['lt25', '25-34', '35-44', '45+'],
    { lt25: t('ro.ageLt25'), '25-34': t('ro.age2534'), '35-44': t('ro.age3544'), '45+': t('ro.age45') }
  ));
}

function empType(e) {
  return e.partTime ? t('file.partTime') : t('file.fullTime');
}
function hiredBy(e) {
  return e.dept === 'HR' ? t('ro.hrManager') : t('ro.recruitment');
}
function refOf(e) {
  return e.sponsor ? t('ro.sponsorRef').replace('{x}', e.sponsor) : '—';
}
function docStatus(e) {
  const complete = e.saudi ? !!e.nid : !!(e.iqama && e.iqamaExp);
  return complete ? { key: 'complete', label: t('ro.complete') }
    : { key: 'pending', label: t('ro.pending') };
}
function vacEligible(e) {
  if (!e.join) {
    return { key: 'none', label: '—' };
  }
  const join = new Date(e.join);
  const now = new Date();
  const months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (months >= 12 && (e.annualUsed || 0) < 21) {
    return { key: 'eligible', label: t('ro.eligible') };
  }
  return { key: 'no', label: t('ro.notEligible') };
}
function expiryOf(e) {
  if (e.iqamaExp) {
    return e.iqamaExp;
  }
  if (e.nidExp) {
    return e.nidExp;
  }
  if (e.saudi && e.join) {
    const d = new Date(e.join);
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().slice(0, 10);
  }
  return '';
}
function insStatus(e) {
  const exp = expiryOf(e);
  if (!exp) {
    return '—';
  }
  const d = daysUntil(exp);
  if (d < 0) {return { key: 'expired', label: t('ro.iqExpired') };}
  if (d <= 30) {return { key: 'expiring', label: t('ro.expiring') };}
  return { key: 'active', label: t('status.active') };
}
function insCompany(e) {
  return e.ins || (e.saudi ? '—' : 'Bupa');
}
function siteCity(e) {
  const s = SITES.find(x => x.id === e.site);
  if (!s) {
    return { site: e.site || '—', city: e.city || '—' };
  }
  return { site: currentLang() === 'ar' ? s.nameAr : s.nameEn, city: s.city || '—' };
}

function destroyDataTable() {
  if (!dataTable) {
    return;
  }
  dataTable.destroy();
  dataTable = null;
}

async function mountDataTable() {
  const table = document.querySelector('table.emp-table');
  if (!table || dataTable || table.classList.contains('dataTable')) {
    return;
  }
  const { default: DataTable } = await import('datatables.net');
  // The roster owns filtering/sorting so DataTables provides stable pagination
  // only. It is rebuilt after each roster render, preventing stale DT caches.
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
}

function resetRowSelection() {
  const selectAll = document.getElementById('emp-select-all');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
}

function syncFilterControls() {
  const controls = [
    ['emp-status', 'st'],
    ['emp-nat', 'nat'],
    ['emp-dept', 'dept'],
    ['emp-site', 'site'],
    ['emp-prof', 'prof'],
    ['emp-exp', 'exp'],
    ['emp-age', 'age'],
    ['emp-sponsor', 'sponsor']
  ];
  controls.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {el.value = filter[key] || '';}
  });
  const sort = document.getElementById('emp-sort');
  if (sort) {sort.value = filter.sort === 'code' ? 'Code' : filter.sort;}
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  // Dashboard KPI links use ?status=active/huroob.
  filter.st = params.get('status') || params.get('st') || '';
  const keys = ['q', 'nat', 'dept', 'site', 'prof', 'exp', 'age', 'sponsor', 'sort'];
  keys.forEach(key => {
    const value = params.get(key);
    if (value !== null) {
      filter[key] = value;
    }
  });
  if (filter.sort === 'code') {filter.sort = 'Code';}
  syncFilterControls();
}

function renderRows() {
  const tbody = document.getElementById('emp-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  populateFilters();
  const items = visible(getSeed('employees'));
  renderStats(getSeed('employees'));
  const cnt = document.getElementById('emp-count');
  if (cnt) {
    cnt.textContent = `${fmtInt(items.length)} / ${fmtInt(getSeed('employees').length)}`;
  }
  tbody.innerHTML =
    items
      .map(e => {
        const exp = expiryOf(e);
        const b = exp ? iqamaBucket({ ...e, iqamaExp: exp }) : 'ok';
        const iqStat =
          b === 'expired'
            ? { key: 'expired', label: t('ro.iqExpired') }
            : b === 'le30'
              ? { key: 'le30', label: t('ro.iqLe30') }
              : b === 'le90'
                ? { key: 'le90', label: t('ro.iqLe90') }
                : exp
                  ? { key: 'valid', label: t('ro.iqValid') }
                  : { key: 'none', label: t('ro.iqNoExpiry') };
        const iqCls =
          iqStat.key === 'expired'
            ? 'red'
            : iqStat.key === 'le30' || iqStat.key === 'le90'
              ? 'yellow'
              : iqStat.key === 'valid'
                ? 'green'
                : 'blue';
        const sc = siteCity(e);
        const dep = deployOf(e);
        const doc = docStatus(e);
        const vac = vacEligible(e);
        const ins = insStatus(e);
        const depText = dep.short || dep.label;
        const daySuffix = t('notif.dayShort');
        return `
    <tr data-code="${esc(e.code)}">
      <td><input type="checkbox" class="row-cb" aria-label="${t('ro.selectRow')}"></td>
      <td class="cell-mono">${esc(e.code)}</td>
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[e.av] || 'var(--avatar-teal)'};color:white">${esc(initialsOf(e.nameEn))}</div>
          <div>
            <div class="cell-strong"><button type="button" class="emp-name-btn" style="white-space:nowrap" data-emp-view="${esc(e.code)}">${esc(currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn)}</button></div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${esc(e.nat)}</td>
      <td style="font-size:12.5px">${esc(e.sponsor || '—')}</td>
      <td><span class="status status-${iqCls}">${esc(iqStat.label)}</span></td>
      <td style="font-size:12.5px">${exp ? `<span style="font-weight:600">${esc(e.saudi ? t('ro.nid') : t('file.iqama'))}</span>: ${esc(fmtDate(exp))}<div style="font-size:11px;color:var(--text-muted)">${esc(iqStat.label)} · ${daysUntil(exp)}${esc(daySuffix)}</div>` : '—'}</td>
      <td style="font-size:12.5px">${esc(profName(e.prof))}</td>
      <td style="font-size:12.5px"><span class="status status-blue">${esc(empType(e))}</span></td>
      <td><span class="status status-${esc(dep.cls)}">${esc(depText)}</span></td>
      <td style="font-size:12.5px">${esc(sc.site)}<div style="font-size:11px;color:var(--text-muted)">${esc(sc.city)}</div></td>
      <td style="font-size:12.5px">${esc(hiredBy(e))}</td>
      <td style="font-size:12.5px">${esc(refOf(e))}</td>
      <td><span class="status status-${doc.key === 'complete' ? 'green' : 'yellow'}">${esc(doc.label)}</span></td>
      <td><span class="status status-${vac.key === 'eligible' ? 'green' : 'blue'}">${esc(vac.label)}</span></td>
      <td style="font-size:12.5px"><span class="status status-${ins.key === 'active' ? 'green' : ins.key === 'expired' ? 'red' : 'yellow'}">${esc(ins.label)}</span><div style="font-size:11px;color:var(--text-muted)">${esc(insCompany(e))}</div></td>
      <td class="emp-actions-cell">
        <button class="card-opt-btn" data-emp-edit="${esc(e.code)}" aria-label="${t('ro.editRow').replace('{code}', e.code)}" data-tooltip="${t('common.edit')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.8 2.8 0 014 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>
        <button class="card-opt-btn" data-emp-view="${esc(e.code)}" aria-label="${t('ro.viewRow').replace('{code}', e.code)}" data-tooltip="${t('common.view')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </td>
    </tr>`;
      })
      .join('');
  // On zero results tbody stays EMPTY: DataTables then renders its own
  // localized emptyTable row. A colspan placeholder written here would be
  // read as row data and trip the tn/4 unknown-parameter alert.
  resetRowSelection();
  void mountDataTable();
}

export function initEmployees() {
  const root = document.querySelector('[data-hr-employees]');
  if (!root) {
    return;
  }
  populateFilters();
  applyUrlFilters();
  renderRows();
  syncFilterCount();
  cleanupToolbar(root);
  polishHeaders(root);
  bindRowHover(root);
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
  const empSearch = document.getElementById('emp-search');
  const bindSearch = el => {
    if (!el) {
      return;
    }
    el.addEventListener('input', e => {
      filter.q = e.target.value;
      renderRows();
    });
  };
  if (empSearch) {
    bindSearch(empSearch);
  }
  const onChange = (id, key) =>
    document.getElementById(id)?.addEventListener('change', e => {
      filter[key] = e.target.value;
      renderRows();
      syncFilterCount();
    });
  onChange('emp-status', 'st');
  onChange('emp-nat', 'nat');
  onChange('emp-dept', 'dept');
  onChange('emp-site', 'site');
  onChange('emp-prof', 'prof');
  onChange('emp-exp', 'exp');
  onChange('emp-age', 'age');
  onChange('emp-sponsor', 'sponsor');
  onChange('emp-sort', 'sort');
  // Filter popover — fixed panel opening under the button, edge to edge.
  const pop = document.getElementById('emp-filter-pop');
  const btn = document.getElementById('emp-filter-btn');
  const togglePop = (open) => {
    if (!pop || !btn) {return;}
    const show = open ?? pop.hasAttribute('hidden');
    if (show) {
      const r = btn.getBoundingClientRect();
      pop.style.top = `${r.bottom + 8}px`;
      pop.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      pop.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
  };
  btn?.addEventListener('click', e => {
    e.stopPropagation();
    togglePop();
  });
  document.addEventListener('click', e => {
    if (!pop || pop.hasAttribute('hidden')) {
      return;
    }
    if (e.target.closest('#emp-filter-pop, #emp-filter-btn')) {
      return;
    }
    pop.setAttribute('hidden', '');
    btn?.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pop && !pop.hasAttribute('hidden')) {
      togglePop(false);
    }
  });
  window.addEventListener('resize', () => togglePop(false));
  document.getElementById('emp-filter-clear')?.addEventListener('click', () => {
    filter = {
      q: filter.q,
      nat: '',
      dept: '',
      site: '',
      prof: '',
      exp: '',
      age: '',
      sponsor: '',
      st: '',
      sort: 'Code'
    };
    [
      'emp-status',
      'emp-nat',
      'emp-dept',
      'emp-site',
      'emp-prof',
      'emp-exp',
      'emp-age',
      'emp-sponsor'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
      }
    });
    const sort = document.getElementById('emp-sort');
    if (sort) {
      sort.value = 'Code';
    }
    renderRows();
    syncFilterCount();
  });
  // header click sorter
  root.querySelectorAll('th[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      filter.sort = th.dataset.sort === 'code' ? 'Code' : th.dataset.sort;
      const s = document.getElementById('emp-sort');
      if (s && [...s.options].some(o => o.value === filter.sort)) {
        s.value = filter.sort;
      }
      renderRows();
    });
  });
  document.getElementById('emp-select-all')?.addEventListener('change', e => {
    document.querySelectorAll('#emp-rows .row-cb').forEach(cb => {
      cb.checked = e.target.checked;
    });
  });
  document.getElementById('emp-rows')?.addEventListener('change', e => {
    if (!e.target.classList.contains('row-cb')) {
      return;
    }
    const selectAll = document.getElementById('emp-select-all');
    if (!selectAll) {
      return;
    }
    const boxes = [...document.querySelectorAll('#emp-rows .row-cb')];
    const checked = boxes.filter(cb => cb.checked).length;
    selectAll.checked = checked > 0 && checked === boxes.length;
    selectAll.indeterminate = checked > 0 && checked < boxes.length;
  });
  // Header actions: add / export / import (single icon family, right-aligned)
  document.getElementById('emp-add')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openAddModal();
  });
  document.getElementById('emp-export')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    exportData('csv', 'employees', EXPORT_COLS, visible(getSeed('employees')));
  });
  document.getElementById('emp-import')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEmployeeImport();
  });
  document.getElementById('emp-rows')?.addEventListener('click', e => {
    const view = e.target.closest('[data-emp-view]');
    if (view) {
      e.stopPropagation();
      e.preventDefault();
      openProfile(view.dataset.empView);
      return;
    }
    const edit = e.target.closest('[data-emp-edit]');
    if (edit) {
      e.stopPropagation();
      const code = edit.dataset.empEdit;
      openMenu(edit, [
        {
          label: t('emp.viewProfile'),
          action: () => openProfile(code)
        },
        { label: `${t('common.edit')} · ${code}`, action: () => openEditRecord(code) },
        {
          label: `${t('common.export')} CSV`,
          action: () =>
            exportData(
              'csv',
              code,
              EXPORT_COLS,
              getSeed('employees').filter(x => x.code === code)
            )
        }
      ]);
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    // Localize static chrome first so the rebuilt DataTable reads the
    // translated <th> labels, then rebuild filter options and rows.
    applyI18n(root);
    populateFilters();
    renderRows();
  });
}

function syncFilterCount() {
  const badge = document.getElementById('emp-filter-count');
  if (!badge) {
    return;
  }
  const n = ['st', 'nat', 'dept', 'site', 'prof', 'exp', 'age', 'sponsor'].filter(
    k => filter[k]
  ).length;
  badge.hidden = n === 0;
  badge.textContent = n ? String(n) : '';
}

function cleanupToolbar() {
  document.getElementById('emp-search')?.remove();
}

// Cramped header cells: CSS truncates with ellipsis; full label via title
// tooltip + smooth max-width expand on hover (see _hr.scss).
function polishHeaders(root) {
  root.querySelectorAll('thead th').forEach(th => {
    if (th.dataset.polished) {
      return;
    }
    th.dataset.polished = '1';
    th.title = th.textContent.trim().replace(/\s+/g, ' ');
  });
}

// Single-active-row mouseover: soft low-contrast gradient tint follows the
// cursor. Rows stay fully visible at all times — hover only highlights.
function bindRowHover(root) {
  const tbody = root.querySelector('#emp-rows');
  if (!tbody || tbody.dataset.hoverBound) {
    return;
  }
  tbody.dataset.hoverBound = '1';
  let hot = null;
  tbody.addEventListener('mouseover', e => {
    const tr = e.target.closest('tr');
    if (!tr || tr === hot || !tbody.contains(tr)) {
      return;
    }
    if (hot) {
      hot.style.background = '';
    }
    hot = tr;
    tr.style.background = 'linear-gradient(90deg, var(--primary-lt), transparent 85%)';
  });
  tbody.addEventListener('mouseout', e => {
    if (hot && (!e.relatedTarget || !hot.contains(e.relatedTarget))) {
      hot.style.background = '';
      hot = null;
    }
  });
}

const EMP_SCHEMA = [
  { key: 'code', en: 'Code', ar: 'الرمز', required: true },
  { key: 'nameEn', en: 'Name (EN)', ar: 'Name (AR)', required: true },
  { key: 'nat', en: 'Nationality', ar: 'الجنسية' },
  { key: 'prof', en: 'Profession', ar: 'المهنة' },
  { key: 'dept', en: 'Department', ar: 'القسم' },
  { key: 'join', en: 'Join date', ar: 'تاريخ الالتحاق', type: 'date' },
  { key: 'basic', en: 'Basic', ar: 'الأساسي', type: 'number' },
  { key: 'iqama', en: 'Iqama', ar: 'الإقامة' },
  { key: 'iqamaExp', en: 'Iqama expiry', ar: 'انتهاء الإقامة', type: 'date' },
  { key: 'phone', en: 'Phone', ar: 'الجوال' }
];

function openEmployeeImport() {
  openImportModal({
    titleEn: 'Import employees (Excel / CSV)',
    titleAr: 'استيراد الموظفين (Excel / CSV)',
    filename: 'employees',
    schema: EMP_SCHEMA,
    example: { code: 'EMP-0001', nameEn: 'Demo', join: '2024-01-01', basic: '5000' },
    onImport: rows => {
      // Halt is enforced by the modal when errors exist; here skip existing IDs
      // gracefully and persist only genuinely new records.
      const existing = new Set(getSeed('employees').map(e => String(e.code).toLowerCase()));
      const seen = new Set();
      const fresh = [];
      let skipped = 0;
      rows.forEach(r => {
        const key = String(r.code || '').toLowerCase();
        if (!key || existing.has(key) || seen.has(key)) {
          skipped += 1;
          return;
        }
        seen.add(key);
        fresh.push({
          code: r.code,
          nameEn: r.nameEn,
          nameAr: r.nameEn,
          nat: r.nat || '—',
          prof: r.prof || '',
          dept: r.dept || '',
          join: r.join || '',
          basic: Number(r.basic) || 0,
          housing: 0,
          transport: 0,
          iqama: r.iqama || '',
          iqamaExp: r.iqamaExp || '',
          phone: r.phone || '',
          st: 'active',
          q: 'draft',
          saudi: false,
          av: 'primary'
        });
      });
      try {
        const ov = JSON.parse(localStorage.getItem('hr:import:employees') || '[]');
        localStorage.setItem('hr:import:employees', JSON.stringify([...ov, ...fresh]));
      } catch (_e) {
        /* private mode */
      }
      renderRows();
      showToast(
        t('act.importAdded')
          .replace('{added}', fresh.length)
          .replace('{skipped}', skipped),
        { variant: 'success' }
      );
      return fresh.length;
    }
  });
}

function openAddModal() {
  showModal({
    title: t('emp.newEmployee'),
    body: `
      <div class="modal-form-row"><label>${t('emp.code')} *</label><input type="text" id="na-code" dir="ltr" required></div>
      <div class="modal-form-row"><label>${t('emp.nameEn')} *</label><input type="text" id="na-name"></div>
      <div class="modal-form-row"><label>${t('emp.joinDate')}</label><input type="date" id="na-join"></div>
      <div data-add-err style="font-size:12px;color:var(--red)"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body, close }) => {
          const code = body.querySelector('#na-code').value.trim();
          const name = body.querySelector('#na-name').value.trim();
          const err = body.querySelector('[data-add-err]');
          if (!code || !name) {
            err.textContent = t('emp.codeNameRequired');
            return false;
          }
          if (getSeed('employees').some(e => String(e.code).toLowerCase() === code.toLowerCase())) {
            err.textContent = t('emp.dupId').replace('{code}', code);
            return false;
          }
          try {
            const ov = JSON.parse(localStorage.getItem('hr:import:employees') || '[]');
            ov.push({
              code,
              nameEn: name,
              nameAr: name,
              join: body.querySelector('#na-join').value,
              basic: 0,
              housing: 0,
              transport: 0,
              st: 'active',
              q: 'draft',
              saudi: false,
              av: 'primary',
              nat: '—'
            });
            localStorage.setItem('hr:import:employees', JSON.stringify(ov));
          } catch (_e) {
            /* ignore */
          }
          renderRows();
          close();
        }
      }
    ]
  });
}

// Employee profile opens the dedicated, printable employee 360 file.
function openProfile(code) {
  if (!code) {return;}
  window.location.href = `employee-file.html?code=${encodeURIComponent(code)}`;
}

function openEditRecord(code) {
  const list = getSeed('employees');
  const e = list.find(x => x.code === code);
  if (!e) {
    return;
  }
  showModal({
    title: `${t('common.edit')} · ${esc(code)}`,
    body: `
      <div class="modal-form-row"><label class="form-label">${t('emp.phone')}</label>
        <input class="form-control" id="er-phone" value="${esc(e.phone || '')}" dir="ltr"></div>
      <div class="modal-form-row"><label class="form-label">IBAN</label>
        <input class="form-control" id="er-iban" value="${esc(e.iban || '')}" dir="ltr"></div>
      <div class="modal-form-row" style="margin-bottom:0"><label class="form-label">${t('emp.bank')}</label>
        <input class="form-control" id="er-bank" value="${esc(e.bank || '')}"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body }) => {
          const patch = {
            ...e,
            phone: body.querySelector('#er-phone').value.trim(),
            iban: body.querySelector('#er-iban').value.trim(),
            bank: body.querySelector('#er-bank').value.trim()
          };
          try {
            const ov = JSON.parse(localStorage.getItem('hr:import:employees') || '[]');
            const i = ov.findIndex(x => x.code === code);
            if (i >= 0) {
              ov[i] = patch;
            } else {
              ov.push(patch);
            }
            localStorage.setItem('hr:import:employees', JSON.stringify(ov));
          } catch (_err) {
            /* private mode */
          }
          renderRows();
          showToast(t('act.savedShort'), { variant: 'success' });
        }
      }
    ]
  });
}
