# goHR — System Customization Blueprint

A single **Settings & customization** studio (opened from the ⚙ gear at the
bottom-left of the sidebar, or from the user menu → **Preferences**) that
re-skins the whole application live, with every choice persisted per device.

## 1. Design goals

1. **One matched theme pair.** Light and Dark share the same accent
   (construction orange `#f97316`) and the same charcoal sidebar; only the
   content surfaces flip (light paper ↔ charcoal).
2. **Everything is a token.** Font size, icon size, accent color, corner
   radius, spacing/density, control height, sidebar width and table
   alignment are all CSS custom properties on `:root`, so a slider can
   repaint the entire app instantly with no re-render.
3. **Company white-label.** Company name (EN + AR), logo, and accent color
   are part of the same studio and feed the existing branding pipeline
   (sidebar brand, tab title, favicon-area mark).
4. **Safe & reversible.** Every control has a sensible default, a live value
   readout, and one **Reset to defaults** action. Nothing is required.

## 2. Theme pair

| Token | Light (new) | Dark Orange |
|---|---|---|
| `--primary` | `#f97316` | `#f97316` |
| `--on-primary` | `#241100` | `#241100` |
| `--sidebar-bg` | `#16181c` charcoal | `#0e1013` |
| `--body-bg` | `#f3f5f8` | `#121417` |
| `--bg-surface` (cards) | `#ffffff` | `#1b1e23` |
| `--text` | `#191d23` | `#e6e9ee` |

Both themes share the orange active tint, fonts and shape language — only
surface luminance changes.

## 3. Customizable tokens

| Setting | Storage key | CSS variable(s) | Range / options | Default |
|---|---|---|---|---|
| Theme | `theme` | `data-theme` | Light / Dark | Light |
| Accent color | `accent` | `--primary`, `--primary-dk`, `--primary-lt`, `--primary-rgb`, `--sidebar-active`, `--card-hover-border`, `--on-primary` | swatches + hue slider (0–360°) + color picker | theme orange |
| Font size | `fontFactor` | `--font-factor` → `--font-size/-sm/-xs` | 0.85 – 1.25 | 1.00 |
| Font family | `fontFamily` | `--font`, `--font-ar` | Inter · System UI · IBM Plex | Inter |
| Icon size | `iconScale` | `--icon-scale` → `--icon-size`, `--nav-icon-size`, `--topbar-icon-size`, `--btn-icon-size` | 0.80 – 1.30 | 1.00 |
| Corners | `radius` | `--radius-base` → `--radius-sm/-/-lg/-xl` | 0 – 16 px | 6 px |
| Spacing / gaps / margins | `spacingFactor` | all `--space-1…8` | 0.80 – 1.40 | 1.00 |
| Control height (density) | `controlH` | `--control-h`, `--btn-h` | 28 – 44 px | 34 / 32 |
| Topbar height | `topbarH` | `--topbar-h` | 48 – 72 px | 56 |
| Sidebar width | `sidebarW` | `--sidebar-w` | 220 – 300 px (rail still 64) | 252 |
| Table alignment | `tableAlign` | `html[data-table-align]` | Start / Center / End | Start |

## 4. Company profile

| Field | Effect |
|---|---|
| Company name (EN) | Sidebar brand, browser tab suffix |
| Company name (AR) | Same when UI language is Arabic |
| Logo (image upload) | Replaces the brand mark (data-URL, ≤ ~200 KB, image only) |
| Remove logo | Falls back to the initial-letter mark |

Persisted into the existing `hr:settings:v1` company profile so the current
`applyBranding()` pipeline renders it.

## 5. Studio layout (modal, 720 px)

1. **Company** — name EN / name AR / logo uploader with preview & remove.
2. **Appearance** — Light/Dark segmented control; accent swatches, hue
   slider and native color picker (all three stay in sync).
3. **Typography** — font family select, font-size slider with live `%`.
4. **Shape & spacing** — corner radius, spacing factor, icon size, control
   height, topbar height, sidebar width sliders.
5. **Tables** — alignment select (Start / Center / End).
6. Footer — **Reset to defaults** (ghost, left) and **Done** (primary).

All changes apply on `input` (live preview) and persist immediately.

## 6. Storage & boot

- `localStorage['hr:customization:v1']` — all studio preferences.
- `localStorage['hr:settings:v1']` — company profile (existing contract).
- Boot order: `initTheme()` → `initI18n()` → `initCustomize()`; the
  pre-paint inline script keeps setting `data-theme` before first paint so
  there is no flash. The studio re-applies the accent after a theme toggle
  so a custom brand color survives light/dark switches.
- Print output is unaffected (paper-white flattening already exists).

## 7. Scope / non-goals

- No per-page theming — settings are global.
- No third-party font uploads (system + the two already-loaded families).
- No backend sync — preferences live in the browser, like the rest of the
  demo data.
