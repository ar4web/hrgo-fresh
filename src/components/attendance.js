// goHR — attendance (attendance.html). Daily attendance board:
// latest-working-day stats + two-week trend, filterable records table,
// manual logging, import and export.

import { t, currentLang, LANG_EVENT, applyI18n } from './i18n.js';
import { fmtDate, initialsOf, setText } from './hr-locale.js';
import { getSeed, saveImportedRows } from './hr-api.js';
import { exportData } from './import-export.js';
import { openImportModal } from './import-modal.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { DEPARTMENTS, SHIFT_START_MIN } from './hr-seed.js';
import { getSettings } from './hr-statutory.js';
import { renderEchart } from './chart-helper.js';
import { escapeHtml as esc, AVATAR_BG } from './markup.js';

const fmtInt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// Bilingual export headers (same pattern as the roster's EXPORT_COLS).
const ATT_EXPORT_COLS = [
  { key: 'emp', label: 'Code / الرمز' },
  { key: 'name', label: 'Name / الاسم' },
  { key: 'dept', label: 'Department / القسم' },
  { key: 'date', label: 'Date / التاريخ' },
  { key: 'st', label: 'Status / الحالة' },
  { key: 'cin', label: 'Check-in / الدخول' },
  { key: 'cout', label: 'Check-out / الانصراف' },
  { key: 'hours', label: 'Hours / الساعات' },
  { key: 'late', label: 'Late (min) / التأخير (دقيقة)' }
];

const ATT_SCHEMA = [
  { key: 'code', en: 'Code', ar: 'الرمز', required: true },
  { key: 'date', en: 'Date (YYYY-MM-DD)', ar: 'التاريخ (YYYY-MM-DD)', type: 'date', required: true },
  { key: 'st', en: 'Status (present / late / absent / leave)', ar: 'الحالة (present / late / absent / leave)' },
  { key: 'cin', en: 'Check-in (HH:MM)', ar: 'الدخول (HH:MM)' },
  { key: 'cout', en: 'Check-out (HH:MM)', ar: 'الانصراف (HH:MM)' }
];

const STATUSES = ['present', 'late', 'absent', 'leave'];
const STATUS_CLS = { present: 'green', late: 'yellow', absent: 'red', leave: 'blue' };

let filter = { date: '', dept: '', st: '', sort: 'date' };
let booted = false;
let dataTable = null;
let dataTableMounting = null;
let filterOptionsSignature = '';

// ── Lookups ──

function nameOf(code) {
  const e = getSeed('employees').find(x => x.code === code);
  if (!e) {
    return code || '—';
  }
  return currentLang() === 'ar' ? e.nameAr || e.nameEn : e.nameEn;
}
function empOf(code) {
  return getSeed('employees').find(x => x.code === code);
}
function deptName(code) {
  const d = DEPARTMENTS.find(x => x.code === code);
  if (!d) {
    return code || '—';
  }
  return currentLang() === 'ar' ? d.ar : d.en;
}
function statusOf(st) {
  const key = STATUSES.includes(st) ? st : 'present';
  return { key, label: t(`status.${key === 'leave' ? 'on-leave' : key}`), cls: STATUS_CLS[key] };
}

// ── Data helpers ──

function days() {
  return [...new Set(getSeed('attendance').map(r => r.date))].sort();
}
function latestDay() {
  const d = days();
  return d.length ? d[d.length - 1] : '';
}
function fmtDayLabel(iso) {
  try {
    return new Intl.DateTimeFormat(currentLang() === 'ar' ? 'ar-SA' : 'en-GB', {
      day: 'numeric',
      month: 'short'
    }).format(new Date(`${iso}T00:00:00`));
  } catch (_e) {
    return iso;
  }
}
function hoursOf(r) {
  if (!r.cin || !r.cout) {
    return 0;
  }
  const [ih, im] = r.cin.split(':').map(Number);
  const [oh, om] = r.cout.split(':').map(Number);
  return Math.max(0, Math.round(((oh * 60 + om - (ih * 60 + im) - 60) / 60) * 10) / 10);
}
function lateOf(r) {
  if (!r.cin) {
    return 0;
  }
  const p = getSettings().prefs && getSettings().prefs.attendance ? getSettings().prefs.attendance.graceMin : NaN;
  const grace = Number.isFinite(p) && p > 0 ? p : 0;
  const [ih, im] = r.cin.split(':').map(Number);
  return Math.max(0, ih * 60 + im - SHIFT_START_MIN - grace);
}

function visible() {
  let rows = getSeed('attendance').slice();
  if (filter.date) {
    rows = rows.filter(r => r.date === filter.date);
  }
  if (filter.dept) {
    rows = rows.filter(r => r.dept === filter.dept);
  }
  if (filter.st) {
    rows = rows.filter(r => r.st === filter.st);
  }
  const byName = (a, b) => nameOf(a.emp).localeCompare(nameOf(b.emp), currentLang() === 'ar' ? 'ar' : 'en');
  if (filter.sort === 'date') {
    rows.sort((a, b) => b.date.localeCompare(a.date) || byName(a, b));
  } else if (filter.sort === 'name') {
    rows.sort(byName);
  } else if (filter.sort === 'cin') {
    rows.sort((a, b) => (a.cin || '99:99').localeCompare(b.cin || '99:99') || byName(a, b));
  } else if (filter.sort === 'hours') {
    rows.sort((a, b) => hoursOf(b) - hoursOf(a) || byName(a, b));
  } else {
    rows.sort((a, b) => String(a.emp).localeCompare(String(b.emp)) || b.date.localeCompare(a.date));
  }
  // Settings grace re-prices every check-in; rows without a check-in keep
  // their recorded late value (imported manual entries).
  return rows.map(r => ({ ...r, hours: hoursOf(r), late: r.cin ? lateOf(r) : (r.late ?? 0) }));
}

// Latest-working-day counts, company-wide (stats/charts ignore the table
// filters — same policy as the roster's stats).
function dayCounts() {
  const day = latestDay();
  const rows = getSeed('attendance').filter(r => r.date === day);
  const c = { present: 0, late: 0, absent: 0, leave: 0 };
  rows.forEach(r => {
    if (c[r.st] !== undefined) {
      c[r.st] += 1;
    }
  });
  const scheduled = rows.length;
  const attended = c.present + c.late;
  return { day, ...c, scheduled, rate: scheduled ? Math.round((attended / scheduled) * 100) : 0 };
}

function avgHoursAll() {
  const rows = getSeed('attendance').filter(r => r.cin && r.cout);
  if (!rows.length) {
    return 0;
  }
  const sum = rows.reduce((acc, r) => acc + hoursOf(r), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

// ── Render: stats ──

function renderStats() {
  const c = dayCounts();
  setText('att-stat-present', fmtInt(c.present));
  setText('att-stat-late', fmtInt(c.late));
  setText('att-stat-absent', fmtInt(c.absent));
  setText('att-stat-leave', fmtInt(c.leave));
  setText('att-stat-rate', `${c.rate}%`);
  setText('att-stat-avg', `${fmtInt(avgHoursAll())}h`);
  const bar = document.getElementById('bar-rate');
  if (bar) {
    bar.style.width = `${c.rate}%`;
  }
  }

// ── Render: charts ──

function renderCharts() {
  const all = getSeed('attendance');
  const ds = days();
  const counts = STATUSES.reduce((acc, k) => ({ ...acc, [k]: 0 }), {});
  ds.forEach(day => {
    all.filter(r => r.date === day).forEach(r => {
      if (counts[r.st] !== undefined) {
        counts[r.st] += 1;
      }
    });
  });
  const seriesColor = { present: tk => tk.green, late: tk => tk.yellow, absent: tk => tk.red, leave: tk => tk.blue };
  renderEchart(
    document.getElementById('chart-att-trend'),
    tk => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
      grid: { left: 40, right: 12, top: 16, bottom: 44 },
      xAxis: {
        type: 'category',
        data: ds.map(fmtDayLabel),
        axisLabel: { color: tk.textMuted, fontSize: 10 },
        axisLine: { lineStyle: { color: tk.borderLight } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: tk.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: tk.borderLight } }
      },
      series: STATUSES.map(k => ({
        name: statusOf(k).label,
        type: 'bar',
        stack: 'day',
        barMaxWidth: 18,
        itemStyle: { color: seriesColor[k](tk), borderRadius: k === 'leave' ? [3, 3, 0, 0] : 0 },
        data: ds.map(day => all.filter(r => r.date === day && r.st === k).length)
      }))
    }),
    t('att.trendSummary')
      .replace('{p}', fmtInt(counts.present))
      .replace('{l}', fmtInt(counts.late))
      .replace('{a}', fmtInt(counts.absent))
      .replace('{v}', fmtInt(counts.leave))
  );
  const c = dayCounts();
  renderEchart(
    document.getElementById('chart-att-day'),
    tk => ({
      tooltip: { trigger: 'item' },
      title: {
        text: `${c.rate}%`,
        subtext: t('att.rate'),
        left: 'center',
        top: '32%',
        textStyle: { color: tk.text, fontSize: 24, fontWeight: 700 },
        subtextStyle: { color: tk.textMuted, fontSize: 11 }
      },
      legend: { bottom: 0, textStyle: { color: tk.textMuted, fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['55%', '78%'],
          center: ['50%', '44%'],
          label: { show: false },
          emphasis: { scale: true, scaleSize: 4, label: { show: true, fontSize: 13, fontWeight: 600 } },
          data: STATUSES.map(k => ({
            name: statusOf(k).label,
            value: c[k],
            itemStyle: { color: seriesColor[k](tk) }
          }))
        }
      ]
    }),
    t('att.daySummary')
      .replace('{date}', fmtDate(c.day))
      .replace('{p}', fmtInt(c.present))
      .replace('{l}', fmtInt(c.late))
      .replace('{a}', fmtInt(c.absent))
      .replace('{v}', fmtInt(c.leave))
  );
}

// ── Render: filters ──

function populateFilters() {
  const ds = days();
  const signature = JSON.stringify({ lang: currentLang(), ds, dept: DEPARTMENTS.map(d => d.code) });
  if (signature === filterOptionsSignature) {
    return;
  }
  filterOptionsSignature = signature;
  const dateSel = document.getElementById('att-date');
  if (dateSel) {
    const current = filter.date;
    dateSel.innerHTML = `<option value="">${esc(t('att.allDays'))}</option>` +
      ds.map(d => `<option value="${esc(d)}">${esc(fmtDate(d))}</option>`).join('');
    dateSel.value = current;
  }
  const deptSel = document.getElementById('att-dept');
  if (deptSel) {
    const current = deptSel.value;
    deptSel.innerHTML = `<option value="">${esc(t('common.all'))}</option>` +
      DEPARTMENTS.map(d => `<option value="${esc(d.code)}">${esc(currentLang() === 'ar' ? d.ar : d.en)}</option>`).join('');
    deptSel.value = current;
  }
}

function syncFilterControls() {
  const map = [['att-date', 'date'], ['att-dept', 'dept'], ['att-st', 'st'], ['att-sort', 'sort']];
  map.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = filter[key] || '';
    }
  });
}

function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);
  const keys = ['date', 'dept', 'st', 'sort'];
  keys.forEach(key => {
    const value = params.get(key);
    if (value !== null) {
      filter[key] = value;
    }
  });
  syncFilterControls();
}

function syncFilterCount() {
  const badge = document.getElementById('att-filter-count');
  if (!badge) {
    return;
  }
  const n = [filter.date, filter.dept, filter.st].filter(Boolean).length;
  badge.hidden = n === 0;
  badge.textContent = n ? String(n) : '';
}

// ── Render: rows ──

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
  // Serialize mounts: rapid successive renders (sync event bursts) must not
  // construct two instances before the first await resumes.
  if (dataTableMounting) {
    await dataTableMounting;
    if (dataTable || table.classList.contains('dataTable')) {
      return;
    }
  }
  dataTableMounting = (async () => {
    const { default: DataTable } = await import('datatables.net');
    // Same contract as the roster: the page owns filtering/sorting; DataTables
    // provides stable pagination only and is rebuilt after each render.
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

function renderRows() {
  const tbody = document.getElementById('att-rows');
  if (!tbody) {
    return;
  }
  destroyDataTable();
  populateFilters();
  const items = visible();
  renderStats();
  const cnt = document.getElementById('att-count');
  if (cnt) {
    cnt.textContent = `${fmtInt(items.length)} / ${fmtInt(getSeed('attendance').length)}`;
  }
  tbody.innerHTML =
    items
      .map(r => {
        const e = empOf(r.emp);
        const st = statusOf(r.st);
        return `
    <tr data-code="${esc(r.emp)}" data-date="${esc(r.date)}">
      <td class="cell-mono">${esc(r.emp)}</td>
      <td style="min-width:160px">
        <div class="cell-customer">
          <div class="cell-avatar" style="background:${AVATAR_BG[e?.av] || 'var(--avatar-teal)'};color:white">${esc(initialsOf(e?.nameEn || r.emp))}</div>
          <div>
            <div class="cell-strong"><button type="button" class="emp-name-btn" style="white-space:nowrap" data-emp-view="${esc(r.emp)}">${esc(nameOf(r.emp))}</button></div>
          </div>
        </div>
      </td>
      <td style="font-size:12.5px">${esc(deptName(r.dept))}</td>
      <td style="font-size:12.5px">${esc(fmtDate(r.date))}</td>
      <td><span class="status status-${st.cls}">${esc(st.label)}</span></td>
      <td class="cell-mono" style="font-size:12.5px">${r.cin ? esc(r.cin) : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${r.cout ? esc(r.cout) : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${r.cin && r.cout ? esc(String(r.hours)) : '—'}</td>
      <td class="cell-mono" style="font-size:12.5px">${r.late ? fmtInt(r.late) : '—'}</td>
    </tr>`;
      })
      .join('');
  // On zero results tbody stays EMPTY: DataTables then renders its own
  // localized emptyTable row. A colspan placeholder written here would be
  // read as row data and trip the tn/4 unknown-parameter alert.
  void mountDataTable();
}

function renderAll() {
  renderRows();
  renderCharts();
}

// ── Log attendance (manual entry) ──

function openLogModal() {
  const emps = getSeed('employees')
    .filter(e => e.st !== 'exited')
    .slice()
    .sort((a, b) => nameOf(a.code).localeCompare(nameOf(b.code), currentLang() === 'ar' ? 'ar' : 'en'));
  const day = latestDay();
  showModal({
    title: t('att.logAttendance'),
    body: `
      <div class="modal-form-row"><label>${t('dash.employee')} *</label>
        <select class="form-control" id="al-emp"><option value="">${esc(t('att.pickEmployee'))}</option>${emps.map(e => `<option value="${esc(e.code)}">${esc(nameOf(e.code))} · ${esc(e.code)}</option>`).join('')}</select></div>
      <div class="modal-form-row"><label>${t('att.date')} *</label><input type="date" class="form-control" id="al-date" value="${esc(day)}"></div>
      <div class="modal-form-row"><label>${t('common.status')}</label>
        <select class="form-control" id="al-st">${STATUSES.map(k => `<option value="${k}"${k === 'present' ? ' selected' : ''}>${esc(statusOf(k).label)}</option>`).join('')}</select></div>
      <div class="modal-form-row"><label>${t('att.checkIn')}</label><input type="time" class="form-control" id="al-cin" value="08:00"></div>
      <div class="modal-form-row" style="margin-bottom:0"><label>${t('att.checkOut')}</label><input type="time" class="form-control" id="al-cout" value="17:00"></div>
      <div data-al-err style="font-size:12px;color:var(--red);margin-top:8px"></div>`,
    actions: [
      { label: t('common.cancel'), variant: 'ghost' },
      {
        label: t('common.save'),
        variant: 'primary',
        action: ({ body, close }) => {
          const err = body.querySelector('[data-al-err]');
          const code = body.querySelector('#al-emp').value;
          const date = body.querySelector('#al-date').value;
          const st = body.querySelector('#al-st').value;
          const cin = body.querySelector('#al-cin').value;
          const cout = body.querySelector('#al-cout').value;
          if (!code || !date) {
            err.textContent = t('att.chooseEmp');
            return false;
          }
          const offSite = st === 'absent' || st === 'leave';
          if (!offSite && cin && cout && cout <= cin) {
            err.textContent = t('att.badTime');
            return false;
          }
          const e = empOf(code);
          const rec = {
            id: `${code}@${date}`,
            emp: code,
            dept: e?.dept || '',
            date,
            st,
            cin: offSite ? '' : cin,
            cout: offSite ? '' : cout,
            hours: offSite ? 0 : hoursOf({ cin, cout }),
            late: offSite ? 0 : lateOf({ cin })
          };
          saveImportedRows('attendance', [rec]);
          filter.date = date;
          syncFilterControls();
          renderAll();
          syncFilterCount();
          close();
          showToast(t('act.savedShort'), { variant: 'success' });
        }
      }
    ]
  });
}

// ── Import ──

function openAttendanceImport() {
  openImportModal({
    titleEn: t('att.importTitleEn'),
    titleAr: t('att.importTitleAr'),
    filename: 'attendance',
    schema: ATT_SCHEMA,
    example: { code: 'EMP-0001', date: latestDay(), st: 'late', cin: '08:20', cout: '17:10' },
    onImport: rows => {
      const codes = new Set(getSeed('employees').map(e => String(e.code).toLowerCase()));
      const seen = new Set();
      const fresh = [];
      let skipped = 0;
      rows.forEach(r => {
        const code = String(r.code || '').trim();
        const date = String(r.date || '').trim();
        const key = `${code}@${date}`.toLowerCase();
        if (!code || !date || !codes.has(code.toLowerCase()) || seen.has(key)) {
          skipped += 1;
          return;
        }
        seen.add(key);
        const st = STATUSES.includes(r.st) ? r.st : 'present';
        const offSite = st === 'absent' || st === 'leave';
        const cin = offSite ? '' : String(r.cin || '').trim();
        const cout = offSite ? '' : String(r.cout || '').trim();
        fresh.push({
          id: `${code}@${date}`,
          emp: code,
          dept: empOf(code)?.dept || '',
          date,
          st,
          cin,
          cout,
          hours: cin && cout ? hoursOf({ cin, cout }) : 0,
          late: cin ? lateOf({ cin }) : 0
        });
      });
      if (fresh.length) {
        saveImportedRows('attendance', fresh);
      }
      renderAll();
      showToast(
        t('act.importAdded').replace('{added}', fresh.length).replace('{skipped}', skipped),
        { variant: 'success' }
      );
      return fresh.length;
    }
  });
}

// ── Boot ──

export function initAttendance() {
  const root = document.querySelector('[data-hr-attendance]');
  if (!root) {
    return;
  }
  populateFilters();
  if (!filter.date && !new URLSearchParams(window.location.search).get('date')) {
    filter.date = latestDay(); // open on the latest working day, like a daily board
  }
  applyUrlFilters();
  renderAll();
  syncFilterCount();
  root.querySelectorAll('thead th').forEach(th => {
    if (th.dataset.polished) {
      return;
    }
    th.dataset.polished = '1';
    th.title = th.textContent.trim().replace(/\s+/g, ' ');
    if (th.dataset.sort) {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        filter.sort = th.dataset.sort;
        const s = document.getElementById('att-sort');
        if (s && [...s.options].some(o => o.value === filter.sort)) {
          s.value = filter.sort;
        }
        renderRows();
      });
    }
  });
  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
  const onChange = (id, key) =>
    document.getElementById(id)?.addEventListener('change', e => {
      filter[key] = e.target.value;
      renderRows();
      syncFilterCount();
    });
  onChange('att-date', 'date');
  onChange('att-dept', 'dept');
  onChange('att-st', 'st');
  onChange('att-sort', 'sort');
  // Filter popover — fixed panel opening under the button, edge to edge.
  const pop = document.getElementById('att-filter-pop');
  const btn = document.getElementById('att-filter-btn');
  const togglePop = open => {
    if (!pop || !btn) {
      return;
    }
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
    if (e.target.closest('#att-filter-pop, #att-filter-btn')) {
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
  document.getElementById('att-filter-clear')?.addEventListener('click', () => {
    filter = { date: '', dept: '', st: '', sort: 'date' };
    syncFilterControls();
    renderRows();
    syncFilterCount();
  });
  // Rail actions: log left, import/export right (same contract as the roster).
  document.getElementById('att-log')?.addEventListener('click', e => {
    e.stopPropagation();
    openLogModal();
  });
  document.getElementById('att-export')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    exportData('csv', 'attendance', ATT_EXPORT_COLS, visible());
  });
  document.getElementById('att-import')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openAttendanceImport();
  });
  document.getElementById('att-rows')?.addEventListener('click', e => {
    const view = e.target.closest('[data-emp-view]');
    if (view) {
      e.stopPropagation();
      e.preventDefault();
      window.location.href = `employee-file.html?code=${encodeURIComponent(view.dataset.empView)}`;
    }
  });
  window.addEventListener(LANG_EVENT, () => {
    // Localize static chrome first so the rebuilt DataTable reads the
    // translated <th> labels, then rebuild options, charts and rows.
    applyI18n(root);
    filterOptionsSignature = '';
    renderAll();
  });
}
