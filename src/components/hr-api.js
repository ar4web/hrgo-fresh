// goHR — data access. Seed mode (default) merges hr-seed.js with any
// locally imported rows (localStorage overlay). API mode (?api=1) uses httpAdapter.

import { EMPLOYEES, CLIENTS, SITES, ORG_LINKS, DEPARTMENTS, ROLES, ROLE_SCOPES, AUDIT_LOG, TASKS, SKILLS, COMPANIES, SALUTATIONS, ATTENDANCE, LEAVES, SECONDMENTS, INVOICES, DOC_TEMPLATES, DOCUMENTS, FILE_ENTRIES, VACANCIES, CANDIDATES, MEETINGS, MAILS, CHAT_CHANNELS, CHAT_MESSAGES, EXPENSES } from './hr-seed.js';

const SEED_MAP = {
  employees: EMPLOYEES,
  clients: CLIENTS,
  sites: SITES,
  orgLinks: ORG_LINKS,
  departments: DEPARTMENTS,
  roles: ROLES,
  roleScopes: ROLE_SCOPES,
  auditLog: AUDIT_LOG,
  tasks: TASKS,
  skills: SKILLS,
  companies: COMPANIES,
  salutations: SALUTATIONS,
  attendance: ATTENDANCE,
  leaves: LEAVES,
  secondments: SECONDMENTS,
  invoices: INVOICES,
  doctemplates: DOC_TEMPLATES,
  documents: DOCUMENTS,
  fileentries: FILE_ENTRIES,
  vacancies: VACANCIES,
  candidates: CANDIDATES,
  meetings: MEETINGS,
  expenses: EXPENSES,
  mails: MAILS,
  chatChannels: CHAT_CHANNELS,
  chatMessages: CHAT_MESSAGES
};

const API_MAP = {
  employees: { path: '/api/hr/employees', listKey: 'employees' },
  clients: { path: '/api/hr/clients', listKey: 'clients' },
  sites: { path: '/api/hr/sites', listKey: 'sites' },
  orgLinks: { path: '/api/hr/org', listKey: 'links' },
  departments: { path: '/api/hr/departments', listKey: 'departments' },
  roles: { path: '/api/hr/roles', listKey: 'roles' },
  auditLog: { path: '/api/hr/audit', listKey: 'entries' },
  tasks: { path: '/api/hr/tasks', listKey: 'tasks' },
  skills: { path: '/api/hr/skills', listKey: 'skills' },
  companies: { path: '/api/hr/companies', listKey: 'companies' },
  salutations: { path: '/api/hr/salutations', listKey: 'salutations' }
};

function overlayRows(name) {
  try {
    return JSON.parse(localStorage.getItem(`hr:import:${name}`) || '[]');
  } catch (_e) {
    return [];
  }
}

function writeOverlay(name, rows) {
  try {
    localStorage.setItem(`hr:import:${name}`, JSON.stringify(rows));
  } catch (_e) {
    /* quota */
  }
}

function keyOf(r) {
  return r.code || r.id || r.emp || r.no;
}

export function saveImportedRows(name, rows) {
  const prev = overlayRows(name);
  writeOverlay(name, prev.concat(rows));
}

/** Seeds merged with local overlay (seed mode only). Overlay rows whose key
 *  matches a seed row act as patches; unknown keys append as new rows. */
export function getSeed(name) {
  const raw = SEED_MAP[name];
  if (raw && !Array.isArray(raw)) {
    return raw; // object seeds (e.g. roleScopes) carry no row overlays
  }
  const base = (raw || []).slice();
  const extra = overlayRows(name);
  if (!extra.length) {
    return base;
  }
  const out = base.slice();
  for (const r of extra) {
    const k = keyOf(r);
    const i = out.findIndex(x => keyOf(x) === k);
    if (i >= 0) {
      out[i] = { ...out[i], ...r };
    } else {
      out.push(r);
    }
  }
  return out;
}
