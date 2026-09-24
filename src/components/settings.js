// goHR — Settings hub (settings.html). One place wiring every configurable
// element of the system: company identity (sidebar brand + documents +
// ZATCA), theme/customize, Saudization targets (dashboard gauge), bell
// notification families + document window, annual-leave entitlement,
// overtime multiplier, expenses budget, file upload cap, meeting defaults,
// and a settings JSON backup. Values persist in the settings document and
// every module reads them live.

import { t, currentLang, LANG_EVENT, applyI18n, applyBranding } from './i18n.js';
import { getSettings, saveSettings, blankCompany, companyTheme, setCompanyTheme, legalSeller } from './hr-statutory.js';
import { showToast } from './toast.js';
import { download } from './import-export.js';
import { escapeHtml as esc } from './markup.js';
import { renderPageMeta } from './hr-locale.js';
import { ICONS } from './shell-render.js';
import { showModal } from './modal.js';
import { loadPrefs, applyPrefs, savePrefs } from './customize.js';

let booted = false;

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const val = id => document.getElementById(id)?.value ?? '';

function toastSaved() {
  showToast(t('set.saved'), { variant: 'success' });
}

const MAX_APP_LOGO = 300 * 1024;
const MAX_CO_LOGO = 500 * 1024;

function readImage(file, max, cb) {
  if (!file) {
    return;
  }
  if (file.size > max) {
    showToast(t('set.logoTooBig'), { variant: 'warning' });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => cb(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function paintLogoPreview(id, src) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.innerHTML = src
    ? `<img src="${esc(src)}" alt="">`
    : `<span class="set-logo-empty">${esc(t('set.none'))}</span>`;
}

// ── System & app identity ──

function loadApp() {
  const a = (getSettings().app || {});
  const name = document.getElementById('set-app-name');
  if (name) {
    name.value = a.name || 'goHR';
  }
  paintLogoPreview('set-app-logo-preview', a.logo || '');
}

function saveAppName() {
  const v = val('set-app-name').trim();
  saveSettings({ app: { name: v || 'goHR' } });
  applyBranding();
  toastSaved();
}

function saveAppLogo(dataUrl) {
  saveSettings({ app: { logo: dataUrl } });
  applyBranding();
  paintLogoPreview('set-app-logo-preview', dataUrl || '');
  toastSaved();
}

function saveCompanyLogo(dataUrl) {
  const s0 = getSettings();
  saveSettings({
    companies: s0.companies.map(c => (c.id === s0.activeCompanyId ? { ...c, logo: dataUrl } : c))
  });
  paintLogoPreview('set-co-logo-preview', dataUrl || '');
  toastSaved();
}

function loadCompanyLogo() {
  paintLogoPreview('set-co-logo-preview', (getSettings().company || {}).logo || '');
}

function companyLabel(c) {
  return c.nameEn || c.nameAr || c.id;
}

function loadGeneral() {
  const s0 = getSettings();
  const c = s0.company || {};
  // company switcher
  const sel = document.getElementById('set-company');
  if (sel) {
    sel.innerHTML = s0.companies.map(x => `<option value="${esc(x.id)}"${x.id === s0.activeCompanyId ? ' selected' : ''}>${esc(companyLabel(x))}</option>`).join('');
  }
  // default language
  const lang = document.getElementById('set-language');
  if (lang) {
    lang.value = s0.language === 'ar' ? 'ar' : 'en';
  }
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = v || '';
    }
  };
  set('set-name-en', c.nameEn);
  set('set-name-ar', c.nameAr);
  set('set-cr', c.cr);
  set('set-vat', c.vat);
  set('set-phone', c.phone);
  set('set-email', c.email);
  set('set-address', c.address);
  renderSettingsMeta();
}

function renderSettingsMeta() {
  const co = getSettings().company || {};
  const name = currentLang() === 'ar' ? (co.nameAr || co.nameEn) : (co.nameEn || co.nameAr);
  renderPageMeta([
    name || '',
    co.cr ? `${t('doc.crNo')}: ${co.cr}` : ''
  ]);
}

function saveGeneral() {
  const err = document.getElementById('set-general-err');
  const nameEn = val('set-name-en').trim();
  const nameAr = val('set-name-ar').trim();
  if (!nameEn && !nameAr) {
    if (err) {
      err.textContent = t('set.errName');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  const s = getSettings();
  const patch = {
    nameEn,
    nameAr,
    cr: val('set-cr').trim(),
    vat: val('set-vat').trim(),
    phone: val('set-phone').trim(),
    email: val('set-email').trim(),
    address: val('set-address').trim()
  };
  saveSettings({
    companies: s.companies.map(c => (c.id === s.activeCompanyId ? { ...c, ...patch } : c))
  });
  applyBranding();
  renderSettingsMeta();
  toastSaved();
}

function loadSaudization() {
  const n = getSettings().nitaqat || {};
  const strict = getSettings().licence;
  const ajeerEl = document.getElementById('set-licence-ajeer');
  if (ajeerEl) {
    ajeerEl.checked = !(strict && strict.strictAjeer === false);
  }
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = v ?? '';
    }
  };
  set('set-nx-activity', n.activity);
  set('set-nx-size', n.size);
  set('set-nx-target', n.target);
}

function saveSaudization() {
  const err = document.getElementById('set-nx-err');
  const target = num(val('set-nx-target'));
  if (!Number.isFinite(target) || target < 0 || target > 100) {
    if (err) {
      err.textContent = t('set.errTarget');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({
    nitaqat: {
      activity: val('set-nx-activity').trim(),
      size: val('set-nx-size').trim(),
      target
    },
    licence: { strictAjeer: document.getElementById('set-licence-ajeer')?.checked !== false }
  });
  toastSaved();
}

// ── Attendance (late grace) ──

function loadAttendance() {
  const p = (getSettings().prefs && getSettings().prefs.attendance) || {};
  const el = document.getElementById('set-at-grace');
  if (el) {
    el.value = Number.isFinite(p.graceMin) && p.graceMin > 0 ? p.graceMin : 0;
  }
}

function saveAttendance() {
  const err = document.getElementById('set-at-err');
  const g = num(val('set-at-grace'));
  if (!Number.isFinite(g) || g < 0 || g > 120) {
    if (err) {
      err.textContent = t('set.errGrace');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({ prefs: { attendance: { graceMin: g } } });
  toastSaved();
}

// ── Invoicing (VAT + terms) ──

function loadInvoicing() {
  const p = (getSettings().prefs && getSettings().prefs.invoicing) || {};
  const vat = document.getElementById('set-iv-vat');
  const due = document.getElementById('set-iv-due');
  if (vat) {
    vat.value = Number.isFinite(p.vatRate) && p.vatRate >= 0 ? p.vatRate : 15;
  }
  if (due) {
    due.value = Number.isFinite(p.dueDays) && p.dueDays > 0 ? p.dueDays : 0;
  }
}

function saveInvoicing() {
  const err = document.getElementById('set-iv-err');
  const vat = num(val('set-iv-vat'));
  const due = num(val('set-iv-due'));
  if (!Number.isFinite(vat) || vat < 0 || vat > 100 || !Number.isFinite(due) || due < 0 || due > 120) {
    if (err) {
      err.textContent = t('set.errIv');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({ prefs: { invoicing: { vatRate: vat, dueDays: due } } });
  toastSaved();
}

function loadNotifications() {
  const p = (getSettings().prefs && getSettings().prefs.notif) || {};
  const on = (id, v, dflt = true) => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = v === undefined ? dflt : v !== false;
    }
  };
  on('set-nt-huroob', p.huroob);
  on('set-nt-docs', p.docs);
  on('set-nt-qiwa', p.qiwa);
  const win = document.getElementById('set-nt-window');
  if (win) {
    win.value = String(Number.isFinite(p.docDays) && p.docDays > 0 ? p.docDays : 30);
  }
}

function saveNotifications() {
  saveSettings({
    prefs: {
      notif: {
        huroob: document.getElementById('set-nt-huroob')?.checked !== false,
        docs: document.getElementById('set-nt-docs')?.checked !== false,
        qiwa: document.getElementById('set-nt-qiwa')?.checked !== false,
        docDays: num(val('set-nt-window')) || 30
      }
    }
  });
  window.dispatchEvent(new CustomEvent('hr:prefs-changed'));
  toastSaved();
}

function loadLeave() {
  const p = (getSettings().prefs && getSettings().prefs.leave) || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = Number.isFinite(v) && v > 0 ? v : '';
    }
  };
  set('set-lv-base', p.annualBase);
  set('set-lv-after5', p.annualAfter5);
}

function saveLeave() {
  const err = document.getElementById('set-lv-err');
  const base = num(val('set-lv-base'));
  const after5 = num(val('set-lv-after5'));
  if ((val('set-lv-base') && (!Number.isFinite(base) || base < 1)) || (val('set-lv-after5') && (!Number.isFinite(after5) || after5 < 1))) {
    if (err) {
      err.textContent = t('set.errDays');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({
    prefs: {
      leave: {
        annualBase: Number.isFinite(base) && base > 0 ? base : null,
        annualAfter5: Number.isFinite(after5) && after5 > 0 ? after5 : null
      }
    }
  });
  toastSaved();
}

function loadPayroll() {
  const p = (getSettings().prefs && getSettings().prefs.payroll) || {};
  const el = document.getElementById('set-pr-ot');
  if (el) {
    el.value = Number.isFinite(p.otMultiplier) && p.otMultiplier > 0 ? p.otMultiplier : 1.5;
  }
}

function savePayroll() {
  const err = document.getElementById('set-pr-err');
  const m = num(val('set-pr-ot'));
  if (!Number.isFinite(m) || m < 1 || m > 3) {
    if (err) {
      err.textContent = t('set.errOt');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({ prefs: { payroll: { otMultiplier: m } } });
  toastSaved();
}

function loadExpenses() {
  const p = (getSettings().prefs && getSettings().prefs.expenses) || {};
  const el = document.getElementById('set-xp-budget');
  if (el) {
    el.value = Number.isFinite(p.monthlyBudget) && p.monthlyBudget > 0 ? p.monthlyBudget : '';
  }
}

function saveExpenses() {
  const err = document.getElementById('set-xp-err');
  const b = num(val('set-xp-budget'));
  if (val('set-xp-budget') && (!Number.isFinite(b) || b < 0)) {
    if (err) {
      err.textContent = t('set.errAmount');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({ prefs: { expenses: { monthlyBudget: Number.isFinite(b) && b > 0 ? b : null } } });
  toastSaved();
}

function loadFiles() {
  const p = (getSettings().prefs && getSettings().prefs.files) || {};
  const el = document.getElementById('set-fm-max');
  if (el) {
    el.value = Number.isFinite(p.maxMB) && p.maxMB > 0 ? p.maxMB : 2;
  }
}

function saveFiles() {
  const err = document.getElementById('set-fm-err');
  const m = num(val('set-fm-max'));
  if (!Number.isFinite(m) || m < 0.5 || m > 10) {
    if (err) {
      err.textContent = t('set.errMb');
      err.hidden = false;
    }
    return;
  }
  if (err) {
    err.hidden = true;
  }
  saveSettings({ prefs: { files: { maxMB: m } } });
  toastSaved();
}

function loadApps() {
  const p = (getSettings().prefs && getSettings().prefs.apps) || {};
  const el = document.getElementById('set-ap-dur');
  if (el) {
    el.value = String([15, 30, 45, 60].includes(p.meetingDur) ? p.meetingDur : 30);
  }
  const sig = document.getElementById('set-ap-sig');
  if (sig) {
    sig.value = (getSettings().prefs && getSettings().prefs.mail ? getSettings().prefs.mail.signature : '') || '';
  }
}

function saveApps() {
  saveSettings({
    prefs: {
      apps: { meetingDur: num(val('set-ap-dur')) || 30 },
      mail: { signature: val('set-ap-sig').trim() }
    }
  });
  toastSaved();
}

function loadAll() {
  loadApp();
  loadGeneral();
  loadCompanyLogo();
  loadSaudization();
  loadNotifications();
  loadLeave();
  loadPayroll();
  loadAttendance();
  loadInvoicing();
  loadExpenses();
  loadFiles();
  loadApps();
}

export function initSettings() {
  const root = document.querySelector('[data-hr-settings]');
  if (!root) {
    return;
  }
  loadAll();

  // rail navigation — groups are collapsible dropdowns with icons
  const RAIL_STORE = 'hr:setrail:v1';
  const railState = (() => {
    try { return { org: true, prefs: true, modules: true, data: true, diag: true, ...JSON.parse(localStorage.getItem(RAIL_STORE) || '{}') }; }
    catch (_e) { return { org: true, prefs: true, modules: true, data: true, diag: true }; }
  })();
  const paintRail = () => {
    root.querySelectorAll('.set-rail-grp').forEach((g) => {
      const open = !!railState[g.dataset.grp];
      g.classList.toggle('closed', !open);
      g.querySelector('.set-rail-group')?.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  };
  const saveRail = () => {
    try { localStorage.setItem(RAIL_STORE, JSON.stringify(railState)); } catch (_e) { /* private mode */ }
  };
  root.querySelectorAll('[data-rail-icon]').forEach((el) => {
    el.innerHTML = ICONS[el.dataset.railIcon] || '';
  });
  root.querySelectorAll('[data-grp-toggle]').forEach((b) => {
    b.addEventListener('click', () => {
      const key = b.dataset.grpToggle;
      railState[key] = !railState[key];
      saveRail();
      paintRail();
    });
  });
  paintRail();
  // Appearance = direct action: opens the Customize modal immediately
  root.querySelector('[data-open-customize]')?.addEventListener('click', () => {
    import('./customize.js').then(m => m.openCustomizeSettings()).catch(() => {});
  });
  root.querySelectorAll('.set-rail-item').forEach(b => {
    b.addEventListener('click', () => {
      root.querySelectorAll('.set-rail-item').forEach(x => {
        const on = x === b;
        x.classList.toggle('active', on);
        x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      // navigating into a collapsed group re-opens it
      const grp = b.closest('.set-rail-grp');
      if (grp && grp.classList.contains('closed')) {
        railState[grp.dataset.grp] = true;
        saveRail();
        paintRail();
      }
      root.querySelectorAll('[data-set-panel]').forEach(p => {
        p.hidden = p.dataset.setPanel !== b.dataset.setSec;
      });
    });
  });

  document.getElementById('set-app-name')?.addEventListener('change', saveAppName);
  document.getElementById('set-app-logo')?.addEventListener('change', e => {
    readImage(e.target?.files?.[0], MAX_APP_LOGO, d => saveAppLogo(d));
  });
  document.getElementById('set-app-logo-reset')?.addEventListener('click', () => saveAppLogo(''));
  document.getElementById('set-co-logo')?.addEventListener('change', e => {
    readImage(e.target?.files?.[0], MAX_CO_LOGO, d => saveCompanyLogo(d));
  });
  document.getElementById('set-co-logo-reset')?.addEventListener('click', () => saveCompanyLogo(''));

  // ── Theme studio ─────────────────────────────────────────────────────────
  const SWATCHES = ['#f97316', '#b08d4a', '#2563eb', '#059669', '#7c3aed', '#dc2626'];
  const DOC_FONTS = {
    sans: 'inherit',
    serif: 'Georgia, "Times New Roman", serif'
  };
  const themeVars = () => {
    const th = companyTheme();
    const st = document.documentElement.style;
    st.setProperty('--doc-accent', th.primary);
    st.setProperty('--doc-font', DOC_FONTS[th.docFont] || 'inherit');
  };
  const signatureHtml = () => {
    const th = companyTheme();
    const s = legalSeller();
    const lang = th.signLang;
    const accent = th.primary;
    const ink = '#1f2937';
    const mut = '#6b7280';
    const base = 'font-family:Arial,\'Segoe UI\',sans-serif;font-size:12px;line-height:1.55;';
    const nmA = lang === 'ar' ? s.nameAr : s.nameEn;
    const nmB = lang === 'ar' ? '' : (lang === 'en' ? '' : s.nameAr);
    const addr = lang === 'ar' ? s.addressAr : s.addressEn;
    const crLbl = lang === 'ar' ? 'س.ت' : 'CR';
    const vatLbl = lang === 'ar' ? 'ض.ق' : 'VAT';
    const logo = s.logo ? `<img src="${esc(s.logo)}" alt="" style="height:44px;display:block;margin-bottom:6px">` : '';
    const contact = `${esc(s.phone)} · <a href="mailto:${esc(s.email)}" style="color:${accent};text-decoration:none">${esc(s.email)}</a><br>${esc(addr)}`;
    if (th.signStyle === 'minimal') {
      return `<div style="${base}color:${ink};direction:${lang === 'ar' ? 'rtl' : 'ltr'}"><span style="color:${accent};font-weight:bold">${esc(nmA)}</span>${nmB ? ` <span style="color:${mut}">· ${esc(nmB)}</span>` : ''} <span style="color:${mut}">| ${esc(s.phone)} · ${esc(s.email)} · ${crLbl} ${esc(s.crNo)}</span></div>`;
    }
    if (th.signStyle === 'classic') {
      return `<table style="border-collapse:collapse"><tr><td align="center" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="${base}color:${ink};padding:6px 14px;text-align:center">
${logo}<span style="font-size:14px;font-weight:bold;color:${accent}">${esc(nmA)}</span>${nmB ? `<br><span style="color:${mut}">${esc(nmB)}</span>` : ''}<br><span style="color:${mut}">${esc(s.phone)} · ${esc(s.email)}</span><br><span style="color:${mut}">${crLbl} ${esc(s.crNo)} · ${vatLbl} ${esc(s.taxNo)}</span><br><span style="color:${mut}">${esc(addr)}</span>
<div style="width:56px;height:2px;background:${accent};margin:8px auto 0"></div></td></tr></table>`;
    }
    // modern (default): accent bar + logo + stacked identity
    return `<table style="border-collapse:collapse"><tr><td dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="${base}color:${ink};border-${lang === 'ar' ? 'right' : 'left'}:3px solid ${accent};padding-${lang === 'ar' ? 'right' : 'left'}:12px">
${logo}<span style="font-size:14px;font-weight:bold;color:${accent}">${esc(nmA)}</span>${nmB ? `<br><span style="color:${mut}">${esc(nmB)}</span>` : ''}<br><span style="color:${mut}">${crLbl} ${esc(s.crNo)} · ${vatLbl} ${esc(s.taxNo)}</span><br><span>${contact}</span></td></tr></table>`;
  };
  const renderSignature = () => {
    const box = document.getElementById('set-sign-preview');
    if (box) {box.innerHTML = signatureHtml();}
  };
  const renderDocMock = () => {
    const el = document.getElementById('set-docmock');
    if (!el) {return;}
    const th = companyTheme();
    const s = legalSeller();
    const ar = currentLang() === 'ar';
    el.style.fontFamily = DOC_FONTS[th.docFont] || 'inherit';
    el.innerHTML = `
      <div class="doc-mock-head">
        <span class="doc-mock-name">${esc(ar ? s.nameAr : s.nameEn)}</span>
        <span class="doc-mock-alt">${esc(ar ? s.nameEn : s.nameAr)}</span>
      </div>
      <div class="doc-mock-meta"><span>#001248</span><span>${esc(s.phone)}</span><span>${esc(th.signLang === 'ar' ? s.addressAr : s.addressEn)}</span></div>
      <div class="doc-mock-line w90"></div><div class="doc-mock-line w75"></div><div class="doc-mock-line w90"></div><div class="doc-mock-line w60"></div>
      <div class="doc-mock-sign"><strong>${esc(ar ? s.nameAr : s.nameEn)}</strong> · ${esc(s.email)}</div>`;
  };
  const paintStudio = () => {
    const th = companyTheme();
    const accent = document.getElementById('set-theme-accent');
    if (accent) {accent.value = th.primary;}
    const df = document.getElementById('set-theme-docfont');
    if (df) {df.value = th.docFont;}
    const ss = document.getElementById('set-theme-signstyle');
    if (ss) {ss.value = th.signStyle;}
    const sl = document.getElementById('set-theme-signlang');
    if (sl) {sl.value = th.signLang;}
    const sw = document.getElementById('set-theme-swatches');
    if (sw) {
      sw.innerHTML = SWATCHES.map(c => `<button class="set-swatch${c.toLowerCase() === th.primary.toLowerCase() ? ' active' : ''}" type="button" data-swatch="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
      sw.querySelectorAll('[data-swatch]').forEach(b => {
        b.addEventListener('click', () => applyStudioAccent(b.dataset.swatch));
      });
    }
    renderSignature();
    renderDocMock();
  };
  const applyStudioAccent = (hex) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) {return;}
    // One accent drives everything: live UI paint + persist prefs + mirror to
    // the active company (applyPrefs → mirrorAccent) + paper/signature vars.
    const prefs = loadPrefs();
    prefs.accent = hex;
    savePrefs(prefs);
    applyPrefs(prefs);
    themeVars();
    paintStudio();
  };
  document.getElementById('set-theme-accent')?.addEventListener('input', e => applyStudioAccent(e.target.value));
  document.getElementById('set-theme-accent')?.addEventListener('change', e => applyStudioAccent(e.target.value));
  document.getElementById('set-theme-docfont')?.addEventListener('change', e => {
    setCompanyTheme({ docFont: e.target.value });
    themeVars();
    renderDocMock();
    renderSignature();
  });
  document.getElementById('set-theme-signstyle')?.addEventListener('change', e => {
    setCompanyTheme({ signStyle: e.target.value });
    renderSignature();
  });
  document.getElementById('set-theme-signlang')?.addEventListener('change', e => {
    setCompanyTheme({ signLang: e.target.value });
    renderSignature();
  });
  document.getElementById('set-sign-copy')?.addEventListener('click', async () => {
    const html = signatureHtml();
    let done = false;
    try {
      await navigator.clipboard.writeText(html);
      done = true;
    } catch (_e) { /* clipboard API blocked — fallback below */ }
    if (!done) {
      const ta = document.createElement('textarea');
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      try {document.execCommand('copy'); done = true;} catch (_e2) { /* ignore */ }
      ta.remove();
    }
    showToast(done ? t('set.signCopied') : t('set.signDownload'), { variant: 'success' });
  });
  document.getElementById('set-sign-download')?.addEventListener('click', () => {
    download('email-signature.html', signatureHtml(), 'text/html');
    showToast(t('set.signCopied'), { variant: 'success' });
  });
  // live gallery triggers
  document.getElementById('set-kit-toast-ok')?.addEventListener('click', () => showToast(t('set.tryToastOk'), { variant: 'success' }));
  document.getElementById('set-kit-toast-warn')?.addEventListener('click', () => showToast(t('set.tryToastWarn'), { variant: 'warning' }));
  document.getElementById('set-kit-toast-err')?.addEventListener('click', () => showToast(t('set.tryToastErr'), { variant: 'error' }));
  document.getElementById('set-kit-toast-info')?.addEventListener('click', () => showToast(t('set.tryToast')));
  document.getElementById('set-kit-dialog')?.addEventListener('click', () => {
    showModal({
      title: t('set.sampleDialog'),
      body: `
        <div class="set-sub">${esc(t('set.themeSub'))}</div>
        <label class="modal-form-row"><span>${esc(t('set.accentBrand'))}</span><input class="form-control" readonly value="${esc(companyTheme().primary)}"></label>
        <label class="modal-form-row"><span>${esc(t('set.docFont'))}</span><input class="form-control" readonly value="${esc(t(companyTheme().docFont === 'serif' ? 'set.docSerif' : 'set.docSans'))}"></label>`,
      actions: [
        { label: t('common.close'), variant: 'ghost' },
        { label: t('common.save'), variant: 'primary', action: () => { showToast(t('set.tryToastOk'), { variant: 'success' }); return true; } }
      ]
    });
  });
  paintStudio();
  themeVars();
  document.getElementById('set-general-save')?.addEventListener('click', saveGeneral);
  document.getElementById('set-company')?.addEventListener('change', () => {
    saveSettings({ activeCompanyId: val('set-company') });
    applyBranding();
    loadGeneral();
    toastSaved();
  });
  document.getElementById('set-company-add')?.addEventListener('click', () => {
    const s0 = getSettings();
    if (s0.companies.length >= 3) {
      showToast(t('set.maxCompanies'), { variant: 'warning' });
      return;
    }
    const id = `co-${Date.now().toString(36)}`;
    saveSettings({ companies: [...s0.companies, blankCompany(id, { nameEn: t('set.newCompany') })], activeCompanyId: id });
    applyBranding();
    loadGeneral();
    toastSaved();
  });
  document.getElementById('set-language')?.addEventListener('change', () => {
    saveSettings({ language: val('set-language') === 'ar' ? 'ar' : 'en' });
    toastSaved();
  });
  document.getElementById('set-nx-save')?.addEventListener('click', saveSaudization);
  document.getElementById('set-at-save')?.addEventListener('click', saveAttendance);
  document.getElementById('set-iv-save')?.addEventListener('click', saveInvoicing);
  document.getElementById('set-lv-save')?.addEventListener('click', saveLeave);
  document.getElementById('set-pr-save')?.addEventListener('click', savePayroll);
  document.getElementById('set-xp-save')?.addEventListener('click', saveExpenses);
  document.getElementById('set-fm-save')?.addEventListener('click', saveFiles);

  // instant-apply sections
  document.getElementById('set-nt-huroob')?.addEventListener('change', saveNotifications);
  document.getElementById('set-nt-docs')?.addEventListener('change', saveNotifications);
  document.getElementById('set-nt-qiwa')?.addEventListener('change', saveNotifications);
  document.getElementById('set-nt-window')?.addEventListener('change', saveNotifications);
  document.getElementById('set-ap-dur')?.addEventListener('change', saveApps);

  document.getElementById('set-export')?.addEventListener('click', () => {
    download('gohr-settings.json', JSON.stringify(getSettings(), null, 2), 'application/json');
    showToast(t('set.exported'), { variant: 'success' });
  });
  document.getElementById('set-import')?.addEventListener('change', e => {
    const file = e.target?.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || (!parsed.companies && !parsed.prefs && !parsed.nitaqat)) {
          throw new Error('bad shape');
        }
        saveSettings(parsed);
        applyBranding();
        loadAll();
        showToast(t('set.imported'), { variant: 'success' });
      } catch (_err) {
        showToast(t('set.importBad'), { variant: 'error' });
      }
    };
    reader.readAsText(file);
  });

  window.addEventListener(LANG_EVENT, () => {
    applyI18n(root);
    renderSettingsMeta();
  });

  if (booted) {
    applyI18n(root);
    return;
  }
  booted = true;
}
