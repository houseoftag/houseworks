# Handoff Notes - Houseworks MVP

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
