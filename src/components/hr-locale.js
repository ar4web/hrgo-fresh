// HR + Operations — locale helpers (SAR money, Gregorian + Hijri dates).
// No hand-formatted dates or money anywhere else — import from here.

import { currentLang } from './i18n.js';

// Bilingual picker — one copy. Was copy-pasted in ~50 page modules.
export function L(en, ar) {
  return currentLang() === 'ar' ? ar : en;
}

// Null-safe text setter — one copy. Was copy-pasted in ~38 page modules.
export function setText(id, v) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = v;
  }
}

// Null-safe HTML setter — for the few pages that render markup (contracts, reviews, reports).
export function fmtSAR(amount, opts = {}) {
  const lang = opts.lang || currentLang();
  const locale = lang === 'ar' ? 'ar-SA' : 'en-SA';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: opts.dp ?? 0
    }).format(amount || 0);
  } catch (_e) {
    return `${amount || 0} SAR`;
  }
}

export function fmtDate(iso, opts = {}) {
  if (!iso) {
    return '—';
  }
  const lang = opts.lang || currentLang();
  const locale = lang === 'ar' ? 'ar-SA' : 'en-GB';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${iso}T00:00:00`));
  } catch (_e) {
    return iso;
  }
}

export function fmtHijri(iso, opts = {}) {
  if (!iso) {
    return '—';
  }
  const lang = opts.lang || currentLang();
  const locale = (lang === 'ar' ? 'ar-SA' : 'en-SA') + '-u-ca-islamic-umalqura';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(`${iso}T00:00:00`));
  } catch (_e) {
    return '';
  }
}

export function initialsOf(name) {
  return (name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function maskIban(iban) {
  if (!iban) {
    return '—';
  }
  const clean = iban.replace(/\s+/g, '');
  if (clean.length < 8) {
    return iban;
  }
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}
