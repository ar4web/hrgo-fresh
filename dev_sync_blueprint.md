# System Architecture & Synchronization Blueprint
This blueprint outlines the technical specifications for finalizing the web application's remaining core systems, establishing a unified layout, and locking down the authentication layer.

---

## 1. Unified Design System & Component Synchronization
All UI components must ingest styles from a centralized token layout instead of utilizing hardcoded values.

### A. The Structural Tokens
* **Base Layout Rules:** All parent containers must enforce standard spacing variables (e.g., `p-6` or `gap-4`).
* **Interactive States:** Every button, menu item, and tool trigger must share matching `:hover`, `:active`, and `:disabled` styling schemas.
* **Component Primitives:** Break down complex features into reusable layouts:
  * `<SettingToggle />` – Standardized switch with integrated loading states.
  * `<DataActionBtn />` – Reusable layout for import/export actions.

### B. Global System Controls
```
[Global Setting Store] ──(Syncs State via Context/Zustand)──► [Active UI Components]
          │                                                              │
          ├─► Theme Tokens (Light/Dark hex/variables) ───────────────────┤
          ├─► Localization, Preferences, & Formats ──────────────────────┤
          └─► Permission Gates (Enforces RBAC state) ────────────────────┘
```

---

## 2. Infrastructure, Tooling, & File Pipelines
Data manipulation tools require standardized schemas, sanitization layers, and predictable pipelines.

### A. Importer & Exporter Architecture
1. **Input Validation Layer:** Parses uploaded files (CSV/JSON), sanitizes rows, catches structural anomalies before backend execution, and reports inline errors.
2. **Batch Processing Worker:** Processes large files in chunks to avoid blocking the primary UI runtime loop.
3. **Download Stream Compiler:** Compiles local states or database views into exportable files with uniform time and date formatting.

### B. Settings-to-Component Wiring
* **State Persistence:** Local storage synchronization for user interface preferences combined with background database persistence for profile configurations.
* **Reactive Prop Injection:** UI layout objects and feature modules dynamically adapt based on active states derived from the global context or user preference schema.

---

## 3. Security, Authentication, & Access Boundaries
The authentication boundary forms the core safety net of the web application.

### A. Role-Based Access Control (RBAC) Matrix
| System Role | Dashboard Access | Settings Modification | Importer / Exporter | User Management Panel |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Full Read/Write | Global + System Settings | Full Input/Output | Create, Edit, Delete Users |
| **Workspace Manager**| Full Read/Write | Workspace Preferences Only | Full Input/Output | View Only / Team Invites |
| **Standard User** | Read / Restricted Write| Personal Profile Only | Restricted (Export Only) | Access Denied |
| **Demo / Guest User**| Read Only (Sandbox) | Session Sandboxed | Read Only (Mock Downloads) | Access Denied |

### B. Route & Core Data Guards
* **Client-Side Navigation Interceptors:** Verify session tokens and matching role permissions prior to rendering layouts.
* **Server-Side Security Overlays:** Ensure API responses filter data depending on the authorization token attached to the request payload.

---

## 4. AI Prompting Automation Scripts
Execute the scripts below inside your development environment to program the agent to refactor these exact components sequentially.

### Script 1: The Settings & Component Sync Protocol
> **Prompt:** "Analyze the root configuration architecture. Generate a global settings context provider that wraps the app layout. Refactor the setting menus, toolbars, buttons, and sub-components to react directly to changes in this global state. Implement strict local storage synchronization for preference fields."

### Script 2: Importer/Exporter Structure Deployment
> **Prompt:** "Create a centralized data transformation module. Code a reusable data importer supporting CSV/JSON with layout field-validation. Build an accompanying exporter that takes current table states and packages them cleanly. Match the action buttons to the core design system's interactive token criteria."

### Script 3: Core Auth Boundaries & RBAC Refactor
> **Prompt:** "Implement a complete authentication layout including user management panels, a sandbox demo bypass login, and a strict Role-Based Access Control (RBAC) handler. Lock down all private dashboard routes. Ensure the user session object propagates role tokens down to the DOM layer to completely disable unauthorized UI buttons."
