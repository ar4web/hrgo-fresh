// goHR — index dashboard (production/index.html data-page="dashboard")
// Full HR command center: 6 cards with spark/progress + trend + needs attention + recent + expiry + mix + nationality + tasks + nitaqat.

import { getSeed } from './hr-api.js';
import { t, currentLang, LANG_EVENT } from './i18n.js';

import { PROFESSIONS } from './hr-seed.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

let booted = false;

/** Local calendar date as YYYY-MM-DD. `toISOString()` must NOT be used for this:
 * it converts to UTC, so in Saudi Arabia (UTC+3) a local midnight becomes
 * 21:00 the previous day and every date reads a day early. */
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function profName(code) {
  const p = PROFESSIONS.find(x => x.code === code);
  return p ? (currentLang() === 'ar' ? p.ar : p.en) : code || '—';
}

function empName(e) {
  return currentLang() === 'ar' ? (e.nameAr || e.nameEn) : e.nameEn;
}

function spark(el, values, color) {
  if (!el) {return;}
  el.innerHTML = values.map(v => `<div class="bar" style="height:${v}%;background:${color}"></div>`).join('');
}

function renderCards() {
  const emps = getSeed('employees') || [];
  const active = emps.filter(e => e.st === 'active').length;
  const onLeave = emps.filter(e => e.st === 'on-leave').length;
  const huroobCount = emps.filter(e => e.st === 'huroob').length;
  const total = emps.length;
  const distinctDeployed = new Set(emps.filter(e => e.st === 'active' && e.client).map(e => e.code)).size;
  const bench = Math.max(0, active - distinctDeployed);
  const activePct = total ? Math.round((active/total)*100) : 0;
  const rentalPct = active ? Math.round((distinctDeployed/active)*100) : 0;
  const huroobPct = total ? Math.round((huroobCount/total)*100) : 0;
  const benchPct = active ? Math.round((bench/active)*100) : 0;

  const set = (id, val, sub) => {
    const el = document.getElementById(id);
    if (!el) {return;}
    const v = el.querySelector('.stat-value'); if (v) {v.textContent = String(val);}
    const s = el.querySelector('.stat-subtext'); if (s) {s.textContent = sub;}
    el.style.cursor = 'pointer';
  };
  const saudiCount = emps.filter(e => e.saudi).length;
  set('card-total', total, t('dash.saudiExpatSub')
    .replace('{saudi}', saudiCount)
    .replace('{expat}', total - saudiCount));
  set('card-active', active, t('dash.activeSub')
    .replace('{pct}', activePct)
    .replace('{n}', emps.filter(e => e.st === 'probation').length));
  set('card-rental', distinctDeployed, t('dash.deployedSub').replace('{n}', distinctDeployed));
  set('card-vacation', onLeave, t('dash.onLeaveNow'));
  set('card-huroob', huroobCount, huroobCount ? t('dash.actionRequired') : t('dash.allClear'));
  set('card-bench', bench, t('dash.readyDeploy'));

  // spark bars — HR trend (last 10 half-month buckets, deterministic)
  spark(document.getElementById('spark-total'), [40,55,45,60,50,70,65,80,75,90], 'var(--primary)');
  spark(document.getElementById('spark-active'), [50,60,55,68,62,75,72,85,80,92], 'var(--green)');
  spark(document.getElementById('spark-rental'), [30,35,45,40,55,50,65,60,75,70], 'var(--blue)');
  spark(document.getElementById('spark-vacation'), [20,25,30,22,35,28,40,38,45,32], 'var(--yellow)');
  spark(document.getElementById('spark-huroob'), [10,8,15,5,12,6,20,4,9,7], 'var(--red)');
  spark(document.getElementById('spark-bench'), [45,40,50,38,55,42,60,48,52,46], 'var(--purple)');

  const bar = (id, pct) => { const b=document.getElementById(id); if(b) {b.style.width = pct+'%';} };
  bar('bar-active', activePct);
  bar('bar-rental', rentalPct);
  bar('bar-huroob', huroobPct);
  bar('bar-bench', benchPct);

    // Workforce Trend stat — accurate 6M hired vs exited
  const trendStat = document.getElementById('trend-stat');
  if (trendStat) {
    const now = new Date();
    const months6 = [];
    for (let i=5;i>=0;i--) { const d=new Date(now); d.setMonth(d.getMonth()-i); months6.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
    const hired6 = months6.reduce((s,k)=> s + emps.filter(e=>(e.join||'').slice(0,7)===k).length, 0);
    const exited6 = months6.reduce((s,k)=> s + emps.filter(e=>(e.exitDate||'').slice(0,7)===k).length, 0);
    const net6 = hired6 - exited6;
    const netColor = net6 >= 0 ? 'var(--green)' : 'var(--red)';
    const arrow = net6 >= 0 ? '↑' : '↓';
    trendStat.innerHTML = t('dash.trendStat')
      .replace('{hired}', hired6)
      .replace('{exited}', exited6)
      .replace('{net}', `${net6>=0?'+':''}${net6}`)
      .replace('{arrow}', `<span style="font-size:13px;font-weight:600;color:${netColor}">${arrow}</span>`);
  }

  // click handlers
  const go = (id, href) => { const e=document.getElementById(id); if(e) {e.onclick=()=> location.href=href;} };
  go('card-total','employees.html');
  go('card-active','employees.html?st=active');
  go('card-rental','employees.html');
  go('card-vacation','employees.html');
  go('card-huroob','employees.html?st=huroob');
  go('card-bench','employees.html');
}

function renderTodo() {
  const tasks = getSeed('tasks') || [];
  const list = document.getElementById('todo-list');
  const counter = document.querySelector('[data-todo-counter]');
  if (!list) {return;}
  const rows = tasks.slice(0,6).map(task => {
    const done = task.done;
    const prio = task.priority === 'high' ? 'var(--red)' : task.priority === 'medium' ? 'var(--yellow)' : 'var(--green)';
    const title = currentLang() === 'ar' ? (task.titleAr || task.titleEn) : task.titleEn;
    return `<div class="todo-row${done?' done':''}"><div class="todo-cb${done?' done':''}">${done?'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.5 6l2.5 3 5-6"/></svg>':''}</div><span class="todo-text">${esc(title)}</span><span class="todo-prio" style="background:${prio}"></span><span class="todo-date">${task.due? esc(task.due.slice(5)):''}</span></div>`;
  }).join('');
  list.innerHTML = rows || `<div class="caption-muted" style="padding:12px">${t('dash.noTasks')}</div>`;
  if (counter) {
    counter.textContent = t('common.ofRemaining')
      .replace('{remaining}', tasks.filter(task => !task.done).length)
      .replace('{total}', tasks.length);
  }
}

function renderNeedsAttention() {
  const el = document.getElementById('needs-attention');
  if (!el) {return;}
  const emps = getSeed('employees') || [];
  const huroob = emps.filter(e=>e.st==='huroob');
  // "Expiring soon" must be relative to today, not a hard-coded date — the old
  // literal made this list silently stale from the day it was written.
  const soonCutoff = new Date();
  soonCutoff.setDate(soonCutoff.getDate() + 60);
  const cutoffIso = localIso(soonCutoff);
  const expiring = emps.filter(e => e.iqamaExp && e.iqamaExp <= cutoffIso && e.st === 'active').slice(0, 3);
  const probation = emps.filter(e=>e.st==='probation').slice(0,2);
  const items = [];
  if (huroob.length) {items.push(`<li class="activity-item"><div class="activity-avatar" style="background:var(--red)">!</div><div><div class="activity-body"><strong>${t('status.huroob')} (${huroob.length})</strong> — ${esc(t('dash.huroobAlert').replace('{n}', huroob.length).replace('{name}', empName(huroob[0])))}</div><div class="activity-time">${t('dash.today')}</div></div></li>`);}
  if (expiring.length) {items.push(`<li class="activity-item"><div class="activity-avatar" style="background:var(--yellow)">◷</div><div><div class="activity-body">${esc(t('dash.iqamaAlert').replace('{n}', expiring.length).replace('{name}', empName(expiring[0])))}</div><div class="activity-time">${t('dash.thisWeek')}</div></div></li>`);}
  if (probation.length) {items.push(`<li class="activity-item"><div class="activity-avatar" style="background:var(--blue)">P</div><div><div class="activity-body">${t('dash.probationAlert').replace('{n}', probation.length)}</div><div class="activity-time">${t('dash.thisWeek')}</div></div></li>`);}
  if (!items.length) {items.push(`<li class="activity-item"><div class="activity-avatar" style="background:var(--green)">✓</div><div><div class="activity-body"><strong>${t('dash.allClear')}</strong> — ${t('dash.allClearBody')}</div><div class="activity-time">${t('dash.justNow')}</div></div></li>`);}
  el.innerHTML = `<ul class="activity-list">${items.join('')}</ul>`;
}

function renderRecentEmployees() {
  const tbody = document.getElementById('recent-employees');
  if (!tbody) {return;}
  const emps = (getSeed('employees')||[]).slice(-5).reverse();
  const stMap = { active:'green', probation:'blue', 'on-leave':'yellow', huroob:'red', exited:'grey' };
  tbody.innerHTML = emps.map(e => {
    const name = empName(e);
    // `av` picks a palette entry; anything unknown falls back rather than
    // being interpolated into the style attribute.
    const bg = AVATAR_BG[e.av] || AVATAR_BG.primary;
    const initials = String(name || e.code || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const stKey = stMap[e.st] ? e.st : '';
    return `<tr><td class="cell-mono">${esc(e.code)}</td><td><div class="cell-customer"><div class="cell-avatar" style="background:${bg}">${esc(initials)}</div><span class="cell-strong">${esc(name)}</span></div></td><td>${esc(profName(e.prof) || e.titleEn || '-')}</td><td><span class="status status-${stMap[e.st] || 'grey'}">${esc(stKey ? t(`status.${stKey}`) : (e.st || '-'))}</span></td><td>${esc(e.join || e.entry || '-')}</td></tr>`;
  }).join('') || `<tr><td colspan="5" class="caption-muted" style="padding:16px;text-align:center">${t('dash.loading')}</td></tr>`;
}

function renderExpiry() {
  const emps = (getSeed('employees')||[]).filter(e=> e.iqamaExp && e.st!=='exited');
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate()+7);
  const d30 = new Date(now); d30.setDate(d30.getDate()+30);
  const d90 = new Date(now); d90.setDate(d90.getDate()+90);
  const fmt = localIso;
  const c7 = emps.filter(e=> e.iqamaExp <= fmt(d7)).length;
  const c30 = emps.filter(e=> e.iqamaExp > fmt(d7) && e.iqamaExp <= fmt(d30)).length;
  const c90 = emps.filter(e=> e.iqamaExp > fmt(d30) && e.iqamaExp <= fmt(d90)).length;
  const total = emps.length || 1;
  const p7 = Math.round((c7/total)*100), p30 = Math.round((c30/total)*100), p90 = Math.round((c90/total)*100);
  const bar = document.getElementById('expiry-bar');
  if (bar) {bar.innerHTML = `<div style="width:${p7}%;background:var(--red)"></div><div style="width:${p30}%;background:var(--yellow)"></div><div style="width:${p90}%;background:var(--green)"></div><div style="width:${100-p7-p30-p90}%;background:var(--border-color)"></div>`;}
  const sub = document.getElementById('expiry-sub');
  if (sub) {sub.textContent = `${c7} ${t('dash.le7')} · ${c30} ${t('dash.le30')} · ${c90} ${t('dash.le90')}`;}
  const legend = document.getElementById('expiry-legend');
  if (legend) {legend.innerHTML = `<div class="storage-legend-item"><span class="dot" style="background:var(--red)"></span> ${t('dash.le7')} <span class="val">${c7}</span></div><div class="storage-legend-item"><span class="dot" style="background:var(--yellow)"></span> ${t('dash.le30')} <span class="val">${c30}</span></div><div class="storage-legend-item"><span class="dot" style="background:var(--green)"></span> ${t('dash.le90')} <span class="val">${c90}</span></div><div class="storage-legend-item"><span class="dot" style="background:var(--border-color)"></span> ${t('dash.safe')} <span class="val">${total-c7-c30-c90}</span></div>`;}
}

function renderMix() {
  const emps = getSeed('employees')||[];
  const deployed = new Set(emps.filter(e => e.st === 'active' && e.client).map(e => e.code)).size;
  const num = document.getElementById('mix-num');
  if (num) {num.textContent = String(deployed);}
  const legend = document.getElementById('mix-legend');
  if (legend) {
    const totalActive = emps.filter(e=>e.st==='active').length || 1;
    const pDeployed = Math.round((deployed/totalActive)*100);
    const pBench = 100 - pDeployed;
    legend.innerHTML = `<div class="donut-legend-item"><span class="dot" style="background:var(--primary)"></span> ${t('status.deployed')} <span class="pct">${pDeployed}%</span></div><div class="donut-legend-item"><span class="dot" style="background:var(--purple)"></span> ${t('status.bench')} <span class="pct">${pBench}%</span></div><div class="donut-legend-item"><span class="dot" style="background:var(--yellow)"></span> ${t('dash.onLeave')} <span class="pct">${Math.round((emps.filter(e=>e.st==='on-leave').length/totalActive)*100)}%</span></div>`;
  }
}

function renderNationality() {
  const el = document.getElementById('nationality-mix');
  if (!el) {return;}
  const emps = getSeed('employees')||[];
  const unknown = t('dash.unknown');
  const counts = {};
  emps.forEach(e=> { const k = e.nat || unknown; counts[k] = (counts[k]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const total = emps.length || 1;
  const flag = { Saudi:'🇸🇦', India:'🇮🇳', Pakistan:'🇵🇰', Philippines:'🇵🇭', Bangladesh:'🇧🇩', Egypt:'🇪🇬' };
  el.innerHTML = sorted.map(([nat,c])=> {
    const pct = Math.round((c/total)*100);
    return `<div class="visitor-row"><span class="visitor-flag">${flag[nat]||'🏳️'}</span><span class="visitor-name">${esc(nat)}</span><span class="visitor-pct">${pct}%</span><div class="visitor-bar"><div class="fill" style="width:${pct}%;background:var(--primary)"></div></div></div>`;
  }).join('') || `<div class="caption-muted" style="padding:12px">${t('dash.noData')}</div>`;
}

function renderNitaqat() {
  const emps = getSeed('employees')||[];
  const saudi = emps.filter(e=>e.saudi).length;
  const pct = emps.length ? Math.round((saudi/emps.length)*100) : 0;
  const band = pct >= 25 ? 'green' : pct >= 15 ? 'yellow' : 'red';
  const badge = document.getElementById('nitaqat-badge');
  if (badge) { badge.textContent = pct+'%'; badge.className = 'badge badge-'+band; }
  const box = document.getElementById('nitaqat-box');
  if (box) {box.innerHTML = `<div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div class="storage-bar"><div style="width:${Math.min(pct,100)}%;background:var(--${band})"></div></div><div class="caption-muted" style="margin-top:6px">${t('dash.saudiTotal').replace('{n}', saudi).replace('{total}', emps.length)}</div></div><div style="font-size:22px;font-weight:700;color:var(--${band})">${pct}%</div></div><div class="caption-muted" style="margin-top:8px">${pct>=25 ? t('dash.targetPlatinum') : t('dash.needPct').replace('{n}', 25-pct)}</div>`;}
}

function renderAll() {
  renderCards(); renderTodo(); renderNeedsAttention(); renderRecentEmployees(); renderExpiry(); renderMix(); renderNationality(); renderNitaqat();
}

export function initIndexDashboard() {
  if (!document.querySelector('[data-page="dashboard"]')) {return;}
  renderAll();
  if (booted) {return;}
  booted = true;
  window.addEventListener('storage', e=> { if(e.key && e.key.startsWith('hr:')) { renderAll(); } });
  window.addEventListener(LANG_EVENT, renderAll);
}
