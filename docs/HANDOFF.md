# Handoff Notes - Houseworks MVP

## Session Log (2026-02-25 — UI/UX Audit #2, Post-Remediation)

### Audit scope
Full dark-mode crawl (breadth=10, depth=3) against Atlassian Design System. 7 pages visited.

### Bugs found and fixed in this session
1. **board_table.tsx line 2954** — Parent `div` with `uppercase tracking-wider` still applied ALL CAPS to all column headers (STATUS, PERSON). Removed `uppercase`. The prior fix to the child `<span>` was insufficient because CSS `text-transform` is inherited.
2. **board_table.tsx lines 1096–1250** — Mobile card field labels had `uppercase tracking-wide` on every `<label>` element. Removed via `sed` replace.
3. **activity_feed.tsx** — H3 "Activity Feed" inside card (heading hierarchy skip H1→H3); changed to `<p>`. Also: filter selects missing `aria-labels` added. `bg-white` → `bg-card` on filter selects. Timestamp tooltips added. "Load more" button `min-h-[44px]`.
4. **CRM client page** — Timeline type labels "EMAIL"/"CALL"/"NOTE" ALL CAPS: applied `charAt(0).toUpperCase() + slice(1).toLowerCase()` transform, removed `uppercase` CSS. Timestamp `title` tooltip added. "← CRM" → "Back to CRM". Timeline filter pill `py-1` → `py-2 min-h-[44px]`. Search input `aria-label` added.
5. **CRM list page** — "View →" → "View" (symbol removed).

### Still outstanding (not fixed this session)
- Settings page cards still `bg-white` in dark mode (remediation pass didn't cover settings card divs)
- CRM list table headers (DISPLAY NAME, COMPANY, PHONE, WEBSITE) ALL CAPS — separate CRM table component
- CRM/Settings `bg-white` card backgrounds in dark mode
- Sidebar "HOUSEWORKS" wordmark ALL CAPS
- Board group rename input (in group bar) missing `aria-label`
- 6 popover/config section labels inside dropdowns still have `uppercase`
- Settings "Revoke" button 42×16px touch target

---

## Session Log (2026-02-25 — UI/UX Audit Remediation, All Phases)

### Summary
Applied 15-item UI/UX audit remediation across 10 files, covering all 4 phases.

### Changes Made
- **settings/page.tsx**: Moved 3 hooks (`getEmailIntegration`, `disconnectEmail`, `syncEmailNow`) above the conditional `if (status !== 'authenticated')` return — fixes React Rules of Hooks crash
- **header.tsx**: Removed `uppercase` from breadcrumb, changed `text-[10px]` → `text-xs`, added `min-w-0 flex-1` to title div for mobile clip fix
- **sidebar.tsx**: Removed `uppercase tracking-wider` from "Workspace"/"Boards" section labels, `text-[10px]` → `text-xs`, `bg-white` → `bg-card` on create-workspace modal
- **custom_select.tsx**: `bg-white` → `bg-card` on dropdown
- **board_table.tsx**:
  - `bg-white` → `bg-card` in 12 locations (date picker, status dropdown, column menu, rename input, row bg, group items container, add-item row, table section, sticky header, group name input, 2 toolbar buttons)
  - Removed `uppercase tracking-wide` from non-sortable column header
  - Added `aria-label` to mobile item input, desktop item input, add-item input, group name input
  - Toolbar buttons: `py-1 px-2` → `py-2 px-3` (touch target improvement)
  - StatusCell: added `<span>` shape indicator (border box) before status label
- **dashboard.tsx**: Added `title` tooltip attrs to relative timestamps; "View all →" → "View all activity"
- **page.tsx**: Dynamic document.title — shows `{board} — {workspace} — Houseworks` when board active
- **notifications/page.tsx**: Empty state upgraded from bare text to 2-line helpful message

## Session Log (2026-02-25 — UX Revision Pass #2: Board + CRM + Drawer)

### Board View
- **A3**: Removed "+ Add item" button from group header row — bottom add-item input still present
- **A4**: Rows now spreadsheet style: `gap-0`, `items-stretch`, no per-cell borders/bg; cells have `border-l border-slate-100`; STATUS fills entire cell height with color; PERSON/DATE/NUMBER/TEXT all flat and transparent
- **A5**: Group header connects to rows: `sm:rounded-b-none` on header, `sm:rounded-t-none sm:border-t-0` on items container, no `mt-4` gap
- **A6**: Date picker calendar now opens left-aligned when near right edge of viewport (prevents horizontal scroll)
- **A7**: Automations panel slides in from right with CSS `translateX` transition — no remount, table slides left
- **A8**: Overdue/warning/done indicators changed to icon-only (`⚠`/`✓`) inline with date — no more badges
- **A1/A2**: Removed duplicate `<Breadcrumbs>` from inside `board_table.tsx` sticky header; cleaner top aesthetic

### Item Drawer (B1)
- Drawer is now wider: `sm:w-[max(520px,35vw)]`
- Two tabs: **Fields** and **Activity**
- Removed: `RecurrenceSection`, `DependenciesSection`, `AttachmentsSection`
- Item name shown as static `h2` at top (not editable inline input)
- STATUS and PERSON rendered in 2-column grid on the same row
- Status is now a `<select>` dropdown (not buttons)
- Activity tab contains the comment box + ActivityFeed
- Comment box: single-row textarea with inline "Post" button; auto-expands on typing

### CRM Client Page
- **Schema**: Migration `m26_crm_entry_date_email_merge` — added `entry_date` + `entry_time` columns to `crm_timeline_entries`; merged `EMAIL_IN`/`EMAIL_OUT` → single `EMAIL` enum value (with data migration USING cast)
- **C1**: Timeline groups entries by date with `──── Feb 25, 2026 ────` separators; vertical thru-line on left; icon dots per entry type
- **C2**: Timeline search input (filter by title/body) + type filter pills (All | NOTE | EMAIL | ...)
- **C3**: Deal value field formats with comma separators while typing (both Add Deal + Edit Deal)
- **C4**: Add Entry type picker is now a 4-col icon grid instead of `<select>`
- **C5**: Add Entry form has Date (required, defaults to today) + Time (optional) fields; passed to `addTimelineEntry`
- **C6**: Conditional form fields by type — Meeting/Call hides title (auto-set); Document/Invoice/Deliverable shows URL field
- `email_sync.ts` updated to use `EMAIL` instead of `EMAIL_IN`/`EMAIL_OUT`

### Files changed
- `prisma/schema.prisma`
- `prisma/migrations/20260225000001_m26_crm_entry_date_email_merge/migration.sql`
- `src/server/api/routers/crm.ts`
- `src/server/crm/email_sync.ts`
- `src/app/_components/board_table.tsx`
- `src/app/_components/custom_select.tsx`
- `src/app/_components/item_detail_panel.tsx`
- `src/app/workspace/[id]/board/page.tsx`
- `src/app/crm/[workspaceId]/client/[clientId]/page.tsx`

---

## Session Log (2026-02-25 — Standalone CRM Architecture)

### Standalone Client Model
- **Motivation**: CRM clients were previously backed by board `Item` records (board-coupled). Now `Client` is a first-class model owned directly by `Workspace`.
- **Migration**: `20260225165119_standalone_crm_clients` — removed `CrmProfile`, added `Client` model; `CrmTimelineEntry`, `Deal`, `Contact` all now use `clientId` FK instead of `itemId`.
- **Router rewrites**: `crm.ts`, `deals.ts` fully rewritten using `Client` model and `clientId` everywhere. `quickbooks.ts` router/server and `email_sync.ts` updated to match.
- **MCP tools updated**: `src/mcp/tools/crm.ts` updated to `clientId`/`Client` model.
- **UI updates**: CRM list page no longer fetches boards; client detail page moved from `[itemId]` → `[clientId]` route folder.
- **Dashboard/Invoice components**: `crm_dashboard.tsx` and `crm_invoice_dialog.tsx` updated to use `clientId` and new field names (`displayName`, `client.company`).

---

## Session Log (2026-02-25 — Bug Fix Pass)

### Root-Cause Fix: TRPC completely broken
- **Root cause**: Turbopack/ESM module initialization + zod v4 — `z.nativeEnum(PrismaEnum)` was called at module evaluation time; in Next.js App Router ESM, Prisma enum exports were undefined during module loading, causing ALL TRPC calls to return 500.
- **Fix**: Replaced all `z.nativeEnum(X)` with hardcoded `z.enum([...values])` in: `notificationPrefs.ts`, `activity.ts`, `crm.ts`, `deals.ts`.

### CRM Fixes
- **Sidebar highlight**: CRM and client detail pages now pass `currentView="crm"` — Dashboard no longer highlighted when on CRM
- **Full-width**: Removed `max-w-6xl` wrapper from CRM page main content
- **Integrations tab removed**: Tab removed from CRM view (already exists in Settings → Integrations)
- **Dashboard blank state**: Added `isError` check to `CrmDashboard` — now shows empty state message instead of rendering nothing
- **Create client button**: Fixed by root-cause fix above (TRPC was crashing before button click ever fired)
- **Contacts model**: Added `Contact` model (migration `20260225163025_add_contacts_model`), CRUD in `crm.ts`, Contacts section in client detail page
- **Display Name**: Client list table header renamed "name" → "Display Name", modal placeholder updated

### Workspace Fix
- Workspace creation was broken due to TRPC crash — fixed by root-cause fix above

---

## Session Log (2026-02-23 — CRM Expansion M25–M30)

### Current Status — M25 through M30: All DEV-COMPLETE ✅

**M25 — CRM Shell & Navigation Fix**
- Both CRM pages now embed `<Sidebar>`, `<Header>`, `<footer>`, `<main>` landmark — matching notifications/page.tsx pattern
- CRM sub-tabs: Clients | Pipeline | Dashboard | Integrations (URL: `?tab=<name>`)
- All buttons/links have `min-h-[44px]` touch targets
- Search input has `aria-label` + associated `<label>`
- `boards.listByWorkspace` now returns `boardType` (fixed AUDIT-1)
- `src/app/crm/[workspaceId]/page.tsx` — rewritten with shell + tabs
- `src/app/crm/[workspaceId]/client/[itemId]/page.tsx` — rewritten with shell

**M26 — Rich Client Profile**
- Schema: `email String?` added to `CrmProfile` model
- `crm.updateProfile` extended with `email` + `tags` (stored in `customFields.tags`)
- `crm.deleteClient` procedure added
- Profile card redesigned: avatar circle (color from name), tier badge, email/phone/website/address/tags all editable
- Delete button with confirmation
- Migration: `20260223225235_m25_crm_email_deals`

**M27 — Separate Deals Model**
- Schema: `DealStage` enum + `Deal` model added; `Item.deals Deal[]` relation added
- Migration: same as M26 (combined)
- NEW: `src/server/api/routers/deals.ts` — `list`, `listByWorkspace`, `create`, `update`, `delete`
- `deals` router registered in `src/server/api/root.ts`
- Client profile page: Deals section (below profile card) with create/edit/delete modal
- CRM workspace page: Pipeline tab — 6-column kanban board (LEAD→LOST) with deal cards

**M28 — CRM Dashboard**
- `crm.dashboardStats(workspaceId)` procedure: totalClients, dealsOpen, pipelineValue, won/lost, dealsByStage, recentActivity, topClients
- NEW: `src/app/_components/crm_dashboard.tsx` — metric cards, stacked bar by stage, activity feed, top clients table
- Dashboard tab on CRM page wired to `<CrmDashboard>`

**M29 — Email Integration UI**
- NEW: `src/app/api/crm/email/connect/route.ts` — Gmail OAuth step 1 (mirrors QB connect pattern)
- NEW: `src/app/api/crm/email/callback/route.ts` — exchanges code, upserts EmailIntegration
- `crm.getEmailIntegration`, `crm.disconnectEmail`, `crm.syncEmailNow` procedures added
- Settings page: new "Integrations" tab with email integration card (connect/disconnect/sync now)

**M30 — List Enhancements**
- CRM client list: filter bar (tier dropdown + has email/company/phone toggles), active filter chips
- Sortable Name/Company columns (click header, asc/desc)
- Checkbox column with select-all; bulk action bar (assign tier, delete selected)
- Columns popover: toggle visibility of name/company/email/phone/website/address/tier

**TypeScript:** 0 new errors in any of the changed files.

**DB Migration:** `prisma/migrations/20260223225235_m25_crm_email_deals/` — adds `crm_profiles.email`, `DealStage` enum, `deals` table.

**Environment variables needed:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for Gmail OAuth)

---

## Session Log (2026-02-23 America/New_York)

### Current Status — HW-M19 through HW-M24: All DEV-COMPLETE ✅

All 6 milestones implemented in a single session using parallel background agents for M19/M20/M21 (no schema changes) and direct sequential implementation for M22/M23/M24 (schema migrations required).

**HW-M19 — UI Polish + User Profile**
- `sidebar.tsx`: `CreateWorkspaceDialog` modal + workspace selector with avatar chip/color
- `board_table.tsx`: `DatePickerPopover` (custom calendar) replaces native date input; breadcrumb in sticky header
- `settings/page.tsx`: "Profile" tab with editable name/image
- NEW: `src/server/api/routers/user.ts` — `me` + `updateProfile`
- `src/mcp/tools/workspaces.ts`: `update_user_profile`, `create_workspace` tools

**HW-M20 — Date Column Deadline Mode**
- `board_table.tsx`: deadline mode toggle in DATE column settings; visual indicators (green/red/amber)
- `src/server/notifications.ts`: `checkDeadlines()` function
- `src/worker/index.ts`: `deadline.check` hourly BullMQ job

**HW-M21 — Automations Overhaul**
- `board/page.tsx`: `view: 'board'|'automations'` state; automations as full-width sub-view
- `automation_panel.tsx`: `CustomSelect` everywhere; new triggers (`COLUMN_CHANGED`, `CRON_*`); AND/OR conditions; IF/ELSE branching
- `src/worker/index.ts`: cron automation queue; startup DB scan to re-register jobs
- NEW: `src/mcp/tools/automations.ts`: `list_automations`, `toggle_automation`

**HW-M22 — Notifications Engine + Board Subscriptions**
- Schema migrations: `NotificationPreference` model + `UserBoardPrefs.subscribed`
- `notifications.ts`: `shouldNotify()` gating helper
- NEW: `notificationPrefs.ts` router + `notification_prefs_panel.tsx` component + `board_subscription_bell.tsx`
- `settings/page.tsx`: "Notifications" tab using `NotificationPrefsPanel`
- `board/page.tsx`: `BoardSubscriptionBell` added to header
- `src/mcp/tools/workspaces.ts`: `get_notification_preferences`, `set_board_subscription`

**HW-M23 — CRM Phase 1**
- Schema migration: `BoardType`, `CrmEntryType`, `EmailProvider` enums; `CrmProfile`, `CrmTimelineEntry`, `EmailIntegration` models
- NEW: `src/server/api/routers/crm.ts` + all CRM routes under `src/app/crm/`
- NEW: `src/server/crm/email_sync.ts` + `src/mcp/tools/crm.ts`
- `sidebar.tsx`: CRM icon + link in nav

**HW-M24 — CRM Phase 2: QuickBooks**
- Schema migration: `QuickBooksIntegration` model
- NEW: `src/server/crm/quickbooks.ts` + `src/server/api/routers/quickbooks.ts`
- NEW: QB OAuth routes (`/api/crm/quickbooks/connect`, `/api/crm/quickbooks/callback`)
- NEW: `crm_invoice_dialog.tsx` component
- `worker/index.ts`: `crm.email_sync` (hourly) + `crm.quickbooks_sync` (daily 2am) BullMQ jobs

**Environment variables needed for CRM email/QB features:** `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`

**TypeScript:** 0 new errors introduced. All pre-existing errors in `middleware.ts`, `auth.ts`, `boards.ts`, `cells.ts`, `items.ts`, `worker/index.ts` remain unchanged.

---

## Session Log (2026-02-17 20:41 America/New_York)

### Current Status — HW-M18: Keyboard Shortcuts & Power User Features — DEV-COMPLETE ✅

**New Files:**
- `use_hotkeys.ts` — Global `useHotkeys(bindings)` hook. Platform-aware key parsing (`mod` = ⌘ on Mac, Ctrl elsewhere). Filters shortcuts when typing in inputs (mod combos still fire). `formatHotkey()` utility for display.
- `use_undo_redo.ts` — `useUndoRedo(applyCellUpdate)` hook. Maintains 50-deep undo/redo stacks for cell edits.
- `new_item_dialog.tsx` — Ctrl+N/Cmd+N opens quick-add dialog with item name + group selector. Creates via `items.create` tRPC.
- `shortcut_help_overlay.tsx` — Press `?` to toggle help modal showing all shortcuts grouped by category.
- `keyboard_shortcuts.test.ts` — 7 unit tests for undo/redo logic, selection logic, key parsing.

**Modified Files:**
- `board_table.tsx` — Added arrow key cell navigation (↑↓←→ to move focus, Enter to edit, Esc to stop), Shift+Click range selection with selection count badge, undo/redo tracking in `updateCell.onMutate`.
- `page.tsx` — Mounted `<NewItemDialog />` and `<ShortcutHelpOverlay />` at app root.

**Lint:** PASS (0 new errors). **Tests:** PASS (41/41 — 7 new).

**Milestones M2–M18: All DEV-COMPLETE.**

---

### Previous Status — HW-M17: Dependencies & Item Linking — DEV-COMPLETE ✅

**Schema:** New `ItemDependency` model with `DependencyType` enum (BLOCKS, BLOCKED_BY, RELATES_TO, DUPLICATES). Migration `20260218012313_add_item_dependencies`. Unique constraint on (sourceItemId, targetItemId, type).

**Backend:**
- `dependencies.create` — Creates dependency link with workspace membership check + circular dependency prevention (BFS)
- `dependencies.delete` — Removes dependency with access check
- `dependencies.listByItem` — Returns all dependencies as source and target, with linked item name + board title
- Board queries now include `_count` for `dependenciesAsSource` and `dependenciesAsTarget`

**UI:**
- DependenciesSection in item detail panel: grouped by type, searchable item picker for adding, remove button
- 🔗 badge with count on table rows and kanban cards

**Lint:** PASS (0 new errors). **Tests:** PASS (34/34).

---

### Previous Status — HW-M16: Recurring Items & Due Date Automation — DEV-COMPLETE ✅

**Schema:** Added `recurrence` (Json) and `next_due_date` (DateTime) to Item model. Migration `20260218002211_add_recurrence_fields`.

**Backend:**
- `items.setRecurrence` mutation — set/edit/remove recurrence rules (daily/weekly/biweekly/monthly/custom)
- Auto-generate next instance in `cells.update` when status → Done/Complete on recurring items
- DUE_DATE_APPROACHING inline evaluation when date set within 24h, notifies assigned users

**UI:**
- RecurrenceSection in item detail panel: frequency picker, day-of-week, start date, human-readable summary
- Overdue highlighting already present in table (red border/text on date input) and kanban (red text on date badge)

**Lint:** PASS (0 new errors). **Tests:** PASS (34/34).

---

### Previous Status — HW-M15-FIX: UX Audit Fixes (Attachments) — DEV-COMPLETE ✅

**All P1 + P2 findings resolved, plus 4 P3 fixes:**

- **F1**: `alert()` → `pushToast()` for all upload errors (WCAG 4.1.3 compliance)
- **F2**: ARIA labels on delete buttons (`Delete attachment {fileName}`), attach button, emoji icons
- **F3**: Download link uses `download` only (removed `target="_blank"`), added download icon + aria-label
- **F4**: Spinner SVG on attach button during upload
- **F5**: Drag-and-drop support on attachments section with visual ring on dragover
- **F6**: Image thumbnails (40×40 `object-cover`) replace emoji for `image/*` attachments
- **F7**: Multi-file upload (`multiple` attr + loop)
- **F9**: Client-side 10 MB size check + hint text shown below header
- **F10**: `aria-label` + `role="status"` on board table attachment badge
- **F11**: Empty state → dashed drop zone CTA
- **F12**: Success toasts on attach/delete
- **F13**: Focus returns to attach button after operations

**Lint: PASS** (0 new errors; pre-existing `no-explicit-any` in board_table unchanged).

**Files changed:** `item_detail_panel.tsx`, `board_table.tsx`

---

### Previous Status — HW-M14-FIX: UX Audit Fixes (Settings Page) — DEV-COMPLETE ✅

**All 3 critical issues fixed + 2 major + 3 minor:**

1. **C1 + C2**: Replaced `window.confirm()` for board delete and member remove with `InlineConfirmButton` component (two-step: click → "Yes, delete/remove" + Cancel, 4s auto-reset).
2. **C3**: Added `aria-label` to all 8 inputs/selects across all tabs.
3. **M2 + M3**: ARIA tabs pattern complete — `id`/`aria-controls`/`aria-labelledby` linkage + roving tabIndex with arrow key navigation.
4. **m4**: Case-insensitive workspace delete confirmation.
5. **m7**: Role enum title-cased in pending invites.
6. **m8**: Helper text contrast improved (`text-slate-400` → `text-slate-500`).

**Lint: PASS** (0 errors).

---

## Previous Session (2026-02-17 17:48 America/New_York)

### Previous Status — HW-M15: File Attachments & Rich Content — DEV-COMPLETE ✅

**All 6 deliverables implemented:**

1. **Schema & Migration**: Added `Attachment` model (id, itemId, fileName, fileType, fileSize, url, uploadedById, createdAt) + `m15_attachments` migration.
2. **File Storage**: Local filesystem storage at `public/uploads/` with unique filenames (`/api/upload` endpoint handles multipart upload).
3. **tRPC Router**: `attachments` router (list, create, delete with ownership check).
4. **Item Detail Panel**: "Attachments" section with file list, icons (image, pdf, doc, xls, csv), download links, and delete button. "Attach file" button opens file picker.
5. **Board Table**: Attachment count badge (📎 N) on items with attachments.
6. **Lint/Tests**: PASS (suppressed `any` for attachment count type inference until tRPC types propagate).

**Milestones M2–M15: All DEV-COMPLETE.**

---

## Previous Session (2026-02-17 16:01 America/New_York)

### Previous Status — HW-M13: Templates & Cloning — DEV-COMPLETE ✅

**All 3 deliverables implemented:**

1. **Board Templates System**: `BoardTemplate` model + `templates` tRPC router (list, createFromBoard, createBoardFromTemplate, delete). Template Gallery on dashboard with card selection UI. "Save as Template" dialog from board header. "New from Template" flow creates board with template structure.
2. **Item Cloning**: `items.clone` mutation copies item + all cell values. "Clone" button in item detail panel header.
3. **Board Duplication**: `boards.duplicate` mutation copies columns + groups. Optional `includeItems` copies items with cell values (column ID remapping). "Duplicate" dialog from board header with title + include-items checkbox.

**Lint: PASS** (0 errors on new/changed files).
**Tests: PASS** (26/26 — 6 new tests).

**Milestones M2–M13: All DEV-COMPLETE.**

---

## Previous Session (2026-02-17 15:45 America/New_York)

### Previous Status — HW-M12-FIX: UX Audit Fixes — DEV-COMPLETE ✅

**Fixed all issues from `docs/UX-AUDIT-HW-M12.md`:**

1. **tRPC auth context (BLOCKER)**: `auth()` (NextAuth v5) fails inside tRPC's fetch adapter because Next.js async request context doesn't propagate. Replaced with `getToken({ req })` in `src/server/api/trpc.ts` — reads JWT directly from request cookies. Fixes `search.query` and `notifications.getUnreadCount` 500/401 errors.
2. **Accessibility**: Added `aria-modal="true"`, focus trap (Tab cycling), `role="listbox"`/`role="option"`/`aria-selected`/`aria-activedescendant` combobox pattern.
3. **UX**: 250ms debounce on search input; error state shown on API failure.

**TypeScript: PASS** (0 errors in `src/`).
**Milestones M2–M12 + M12-FIX: All DEV-COMPLETE.**

---

## Previous Session (2026-02-17 15:20 America/New_York)

### Previous Status — HW-M12: Global Search & Quick Actions — DEV-COMPLETE ✅

**All 4 deliverables implemented:**

1. **Search API** (`src/server/api/routers/search.ts`): tRPC `search.query` endpoint with full-text search across items and boards, scoped by workspace membership. Prisma `contains` with case-insensitive mode.
2. **Command Palette** (`src/app/_components/search_command.tsx`): ⌘K/Ctrl+K opens modal overlay with search input, categorized results (Boards/Items), keyboard nav (↑↓/Enter/Esc), mouse selection, loading spinner, empty states, keyboard hint footer.
3. **Header Integration**: Search button in header with icon + ⌘K badge. Props passed for board/item selection navigation.
4. **Navigation Wiring**: Search results navigate to boards. Item selection navigates to the item's board.

**Lint: PASS** (0 errors on new/changed files).
**Tests: PASS** (20/20 — 4 new search tests).

**Milestones M2–M12: All DEV-COMPLETE.**

---

## Previous Session (2026-02-17 15:01 America/New_York)

### Previous Status — HW-M11: Automations & Rules Engine — DEV-COMPLETE ✅

**All 5 deliverables implemented:**

1. **Inline Rule Evaluation Engine** (`src/server/automations/evaluate.ts`): Synchronous evaluation of automation rules in tRPC mutations. Fires on cell updates (status, priority, assignee changes) and item creation. No longer relies solely on BullMQ worker for rule processing.
2. **Expanded Trigger Types**: STATUS_CHANGED, PRIORITY_CHANGED, ASSIGNEE_CHANGED, ITEM_CREATED. Priority detection via column title pattern (`/priority/i`).
3. **New Action Types**: NOTIFY (send notifications to assignee/all members), MOVE_TO_GROUP (auto-move items between groups), SET_PERSON (auto-assign), plus existing LOG and SET_STATUS.
4. **Enhanced UI** (`automation_panel.tsx`): Full IF/THEN rule builder with all trigger/action combos. Edit, delete, toggle automations. Workspace member picker for auto-assign. Group selector for auto-move. Notification message customization.
5. **Updated Worker** (`src/worker/index.ts`): Handles all new trigger/action types in BullMQ worker for background processing alongside inline evaluation.

**Lint: PASS** (0 new errors; pre-existing `any` in cells.ts unchanged).

**Milestones M2–M11: All DEV-COMPLETE.**

---

## Previous Session (2026-02-17 14:21 America/New_York)

### HW-M10: Board Views & Filtering — DEV-COMPLETE ✅

**All 6 deliverables implemented:**

1. **Enhanced Filter Bar**: Status, assignee, priority, due date range filters + sort by created/due date/priority/title (asc/desc). Filter icon and sort icon in the bar.
2. **Kanban with Native DnD**: Rewrote `board_kanban.tsx` — removed `@dnd-kit` dependency, uses native HTML `draggable`/`onDragStart`/`onDragOver`/`onDrop`. Cards drag between status columns to update status.
3. **Shared Filter/Sort Utils**: New `board_filter_utils.ts` — `filterAndSortItems()` used by both views. Priority sorting uses ranked order (Critical > High > Medium > Low).
4. **Table View Filtering**: `BoardTable` now accepts `filters` and `sort` props. Items within each group are filtered/sorted. Empty groups hidden when filters active.
5. **URL-Persisted View Mode**: `?view=board` URL param via `history.replaceState`. Default is table (no param). Custom `useUrlViewMode` hook.
6. **Empty States**: Both views show search icon + "No items match your filters" + guidance when filters return zero results.

**Lint: PASS** (0 errors/warnings on new code; pre-existing `any` warnings in board_table.tsx unchanged).

**Milestones M2–M10: All DEV-COMPLETE.**

### Next Steps
- UX audit for M10 features
- Consider adding label/tag column type and filter (currently no LABEL column type in schema)
- Consider saved filter presets
- Consider calendar view as a third view mode

---

## Previous Session (2026-02-17 14:05 America/New_York)

### Previous Status — UX Audit Follow-Up: Data Fetching NOT BROKEN, Mobile Layout FIXED

**UX Audit `docs/UX-AUDIT-2026-02-17.md` Finding #1 (Critical Data Fetching Failure): NOT REPRODUCIBLE.**
- Signed in as admin@houseworks.local via browser — dashboard loads correctly: Post-Production workspace, 1 board, 3 items, status breakdown all present.
- Root cause of original audit finding was likely a stale/missing session in the auditor's browser instance.

**UX Audit Finding #2 (Mobile Layout Collisions at 375px): FIXED.**

**Milestones M2–M9: All DEV-COMPLETE.** HW-FIX-001 and HW-FIX-002 also complete.

---

## Previous Session (2026-02-17 08:46 America/New_York)

### Previous Status — HW-M9: Notifications & Activity Feed — DEV-COMPLETE

All M9 features implemented: typed notifications, activity logging, enhanced notification bell, activity feed on item detail.

## Previous Status

**Stage 1 (MVP) is Complete.** The application is functional with a high-fidelity board interface and core management features.
