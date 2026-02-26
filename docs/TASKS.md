# Houseworks Tasks

> Completed milestones (M1–M18, UX audits, fixes, session logs) archived in `docs/TASKS-ARCHIVE.md`.

---

## MCP Maintenance Policy

**Every feature milestone that touches the Prisma schema or adds significant new functionality MUST queue an MCP update task.**

When writing a new milestone, include this item in the deliverables:

```
- [ ] **MCP Update** — Add/update tools in `src/mcp/tools/` for new <Feature> functionality
```

See `src/mcp/README.md` → Maintenance Policy for the full checklist.

---

## Completed — Recent

### HW-MCP — MCP Server (AI Agent Access Layer)
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)
- 10 domain tool files, 30 tools, 3 resources, `npm run mcp`

### HW-CRM-M25-M30 — CRM Expansion
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)
- M25: Shell & Navigation, M26: Rich Profile, M27: Deals, M28: Dashboard, M29: Email UI, M30: List Enhancements
- ~~**MCP Update**~~ ✅ (2026-02-26) — CRM tools updated: deals CRUD (5 tools), `update_client`, `delete_client`, `get_crm_dashboard_stats`, `list_email_integrations`. Also fixed `add_timeline_entry` enum bug.

### HW-AUDIT-BUGS — UI Audit: Bug Fixes & Structural Accessibility
- **Status:** **DEV-COMPLETE** ✅ (2026-02-26)
- AUDIT-1: CRM page crash fix, AUDIT-2: Home page data fix, AUDIT-3: Nav landmarks, AUDIT-4: Touch targets, AUDIT-5: Dark mode

### HW-AUDIT-POLISH — UI Audit: Polish & Consistency
- **Status:** **DEV-COMPLETE** ✅ (2026-02-26)
- AUDIT-6: Heading hierarchy, AUDIT-7: Page titles, AUDIT-8: Breadcrumbs, AUDIT-9: Settings landmarks, AUDIT-10: Touch targets, AUDIT-11: Novu badge guard

### HW-M18 — Keyboard Shortcuts & Power User Features
- **Status:** **DEV-COMPLETE** ✅ (2026-02-17)
- Global hotkeys, Ctrl+N quick-add, Ctrl+K command palette, arrow key nav, shift+click bulk select, undo/redo, ? help overlay

---

## Upcoming Milestones (HW-M19 through HW-M24)

---

## HW-M19 — UI Polish + User Profile
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **Workspace selector redesign** — richer component with avatar/color chip, name, member count badge, keyboard navigation.
2. **Date selector redesign** — custom `DatePickerPopover` replacing OS-native `<input type="date">`.
3. **Table header + breadcrumb fix** — sticky outer container with breadcrumb row.
4. **Create workspace modal** — `CreateWorkspaceDialog` in sidebar.
5. **User profile edit** — "Profile" tab in settings; new tRPC `user.updateProfile` mutation.
- [x] **MCP Update** — Add `update_user_profile(userId, name, image?)` and `create_workspace(name)` tools in `src/mcp/tools/workspaces.ts`

### Key files
`sidebar.tsx`, `board_table.tsx`, `settings/page.tsx`, `breadcrumbs.tsx`, `routers/user.ts`, `workspace_selector.tsx`

---

## HW-M20 — Date Column: Deadline Mode
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **Column settings schema extension** — DATE columns get `deadlineMode`, `linkedStatusColumnId`, `completeStatusValue`, `linkedAssigneeColumnId`.
2. **Column settings UI** — "Deadline Mode" toggle for DATE columns with linked column dropdowns.
3. **Cell display logic** — green checkmark / red exclamation / amber warning based on deadline status.
4. **Notifications** — BullMQ `deadline.check` cron job fires `DUE_DATE` notifications.
- [x] **MCP Update** — Update `set_cell_value` tool docs in `src/mcp/tools/cells.ts` to document deadline mode interpretation.

### Key files
`board_table.tsx`, `worker/index.ts`, `src/server/notifications.ts`, `column_settings_panel.tsx`

---

## HW-M21 — Automations Overhaul
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **Sub-view layout** — `view: 'board' | 'automations'` state with full-width `<AutomationPanel>`.
2. **CustomSelect replacement** — replace all native `<select>` with `CustomSelect`.
3. **Trigger additions** — `COLUMN_CHANGED`, `CRON_INTERVAL`, `CRON_DAILY`, `CRON_WEEKLY`.
4. **AND/OR condition blocks** — condition arrays with logic combinator.
5. **IF/ELSE branching actions** — recursive then/else action lists.
- [x] **MCP Update** — Add `src/mcp/tools/automations.ts` with `list_automations(boardId)` and `toggle_automation(id, enabled)` tools; register in `src/mcp/server.ts`.

### Key files
`automation_panel.tsx`, `routers/automations.ts`, `worker/index.ts`, `src/worker/evaluate.ts`, `board/page.tsx`

---

## HW-M22 — Notifications Engine + Board Subscriptions
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **`NotificationPreference` model** — userId, type, boardId, enabled; unique constraint.
2. **`UserBoardPrefs.subscribed` field** — board subscription toggle.
3. **Notification gating** — `shouldNotify()` helper with board → global → default cascade.
4. **Preferences UI** — grid with type rows × board columns.
5. **Board subscription UI** — bell icon toggle in board header.
- [x] **MCP Update** — Add `get_notification_preferences(userId)` and `set_board_subscription(userId, boardId, subscribed)` tools in `src/mcp/tools/workspaces.ts`.

### Schema changes
- `NotificationPreference` model (migration `20260223153941`)
- `UserBoardPrefs.subscribed` field (same migration)

### Key files
`prisma/schema.prisma`, `src/server/notifications.ts`, `settings/page.tsx`, `board/page.tsx`, `routers/userBoardPrefs.ts`

---

## HW-M23 — CRM Phase 1: Client Boards + Timeline + Email
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **Schema additions** — `Board.boardType`, `CrmProfile`, `CrmTimelineEntry`, `EmailIntegration` models + enums.
2. **CRM routes** — `/crm`, `/crm/[workspaceId]`, `/crm/[workspaceId]/client/[itemId]`.
3. **CRM client list view** — reuses board table with CRM-specific columns.
4. **Client profile / timeline view** — editable profile + timeline feed with type-specific icons.
5. **Email integration** — OAuth for Gmail/Outlook, 30-day sync, BullMQ hourly job.
6. **CRM sidebar nav** — icon + link for workspaces with CRM boards.
- [x] **MCP Update** — New `src/mcp/tools/crm.ts`: `list_clients`, `get_client`, `create_client`, `add_timeline_entry`, `list_timeline` tools; register in `src/mcp/server.ts`.

### Schema changes
- `Board.boardType` enum + field (migration `20260223154215`)
- `CrmProfile`, `CrmTimelineEntry`, `EmailIntegration` models + `CrmEntryType` enum

### Key files
`prisma/schema.prisma`, `src/app/crm/`, `src/server/crm/email_sync.ts`, `sidebar.tsx`, `src/mcp/tools/crm.ts`

---

## HW-M24 — CRM Phase 2: QuickBooks Integration
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** ✅ (2026-02-23)

### Deliverables
1. **QB OAuth + sync** — `QuickBooksIntegration` model, customer→client sync, invoice→timeline entries.
2. **Revenue YTD column** — auto-updated NUMBER column from paid invoices.
3. **Invoice actions from CRM** — "Create Invoice" button with pre-populated QB form.
4. **Account statements** — invoice timeline entries with status/amount/due date display.
- [x] **MCP Update** — Add `sync_quickbooks(workspaceId)` and `list_invoices(clientId)` tools to `src/mcp/tools/crm.ts`.

### Schema changes
- `QuickBooksIntegration` model (migration `20260223154234`)

### Key files
`prisma/schema.prisma`, `src/server/crm/quickbooks.ts`, `src/app/crm/`, `src/app/settings/`
