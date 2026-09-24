# goHR — Agent Instructions (Saudi HRMS Master Context)

## 🎯 1. REPOSITORY CORE MANDATE
* **Scope:** Enterprise-grade HRMS tailored strictly for the **Saudi Labor Market** (MHRSD compliance, Nitaqat, Dual Hijri/Gregorian tracking, Saudi Wages Protection System, and Article 84/85 ESB metrics).
* **Status:** **70% completed.** Optimize and upgrade existing codebase logic instead of breaking or recreating components.

## 🛠️ 2. VISUAL DESIGN SYSTEM TOKENS
* **Color Scheme:** Pro executive system tokens. Base theme uses deep gray-on-navy blue backgrounds (`--body-bg` / `--bg-dark`) paired with crisp light-grey structural borders.
* **Layout Density:** High-density, compact executive layout.
* **Component Heights:** All form controls and input elements must enforce a strict height of **34px** with `space-y-3` or `space-x-3` layout padding. Text fields must always align left.
* **Global Layout Rule:** Exactly **ONE global search bar** allowed in the header navigation layout. Individual sub-pages are **forbidden** from embedding standalone page search boxes.
* **Color Usage:** Charts and all UI elements must pull colors strictly from SCSS/CSS custom theme variables (e.g., `var(--color-primary)`) defined in `src/styles/_tokens.scss`. **No Tailwind, no inline hex strings.**
* **Iconography:** Vanilla JS Lucide icons (or SVG injection via Lucide), maintaining exact size requirements: **16px** for inline elements/buttons, **20px** for navigation bars, fixed stroke width **2**.

## 🔒 3. ACCESS CONTROL MATRIX (RBAC) & DEMO
* **Security Roles:** Super Admin (Full access), Line Manager (Team metrics & approvals), Standard Employee (Read-only personal items).
* **Sandbox Demo:** A **'Launch Live Demo' toggle switch on the login view** must assign a guest token that renders all destructive mutation buttons (Save, Delete, Export) completely `disabled` and grayed out. **This toggle does not exist yet — active sprint task to build next.**

## 🚨 4. STUPID AGENT LOOP PREVENTION PROTOCOL
* **MANDATORY HALT:** If you lose track of the 34px token, layout variables, or lack explicit documentation, you are **FORBIDDEN** from guessing or adding temporary placeholders (`// TODO`). Stop generation immediately and ask the human user for plain-text clarification.
* **FAIL-SAFE:** If a local build (`npm run build`) or node server boot script fails after your edit, immediately rollback to the last stable git state and output the terminal stack trace.

---

## Project Architecture (Reference)

### Tech Stack
- **Frontend:** Vanilla JS + SCSS + Vite (multi-page: each `src/pages/*.html` = separate entry)
- **Backend:** Node.js (native `http`) + SQLite (`node:sqlite`, WAL mode) + JWT (HS256)
- **Auth:** Seed users — Admin `ADM-001`/`Admin123`, Manager `MGR-001`/`manager123`, Employee `EMP-001`/`employee123`, Vendor `VND-001`/`vendor123`

### Key Commands
| Task | Command |
|------|---------|
| Dev (both) | `./start-dev.ps1` (sets `AUTH_BYPASS=1`) |
| Frontend | `npm run dev` (port 9173) |
| Backend | `node server/index.mjs` (port 8080) |
| Build | `npm run build` |
| Docker | `docker compose up --build` |

### Saudi-Specific Constraints
- **Iqama validation:** `^2\d{9}$` (starts with 2, 10 digits) — `auth-core.mjs:549`
- **Geofence:** Default `allowedCountries: ['SA']`, `failMode: 'open'` — configurable via `/api/geofence` (admin)
- **Dual calendar:** Hijri/Gregorian sync required in date pickers
- **WPS/Mudad:** CSV formats for payroll exports

### RBAC Permissions (from `auth-core.mjs:32-47`)
| Role | Permissions |
|------|-------------|
| admin | `*` |
| manager | `attendance.read/write`, `employees.read`, `payroll.read`, `documents.read`, `users.read` |
| employee | `attendance.read.self`, `attendance.write.self`, `profile.read`, `payslip.read.self` |
| vendor | `profile.read`, `payslip.read.self`, `documents.read.self` |

### File Conventions
- Components: `src/components/*.js` (vanilla JS modules)
- Styles: `src/styles/_*.scss` → `main.scss` (CSS custom properties for theming)
- Pages: `src/pages/*.html` + optional `*.js`
- Server: `server/*.mjs` (ES modules, Node 22+ APIs)

### Critical Pitfalls
- ❌ No search bars on sub-pages (global header only)
- ❌ No hardcoded colors (use CSS custom properties from `_tokens.scss`)
- ❌ No `any` type usage
- ❌ No view files > 250 lines (split into sub-components)
- ⚠️ Dev clears stale Service Workers on load — hard-refresh if HMR breaks
- ⚠️ SQLite requires Node 22+ (`node:sqlite` built-in)