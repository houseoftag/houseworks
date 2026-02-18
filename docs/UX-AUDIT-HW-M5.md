# UX Audit: HW-M5 — Board/Kanban View

**Auditor:** Irielle (UX Agent)  
**Date:** 2026-02-16  
**Scope:** Board/Kanban view at `/workspace/[id]/board` — columns, cards, DnD, CRUD, quick-create, responsive, accessibility  
**Overall Verdict:** FAIL ❌ (1 Critical, 1 Major, 2 Minor issues)

---

## Findings

### 1. ❌ CRITICAL — Items silently disappear due to status label case mismatch

**Location:** `board_kanban_full.tsx` → `getStatusOptions()` vs `getItemStatus()`

**Description:** `getStatusOptions()` title-cases status labels from column settings (e.g., `"In progress"` → `"In Progress"`), but `getItemStatus()` returns the raw cell value label (`"In progress"`). When `itemsByStatus` groups items by status, the raw label doesn't match the title-cased column key. Items end up in an orphan bucket that is never rendered.

**Repro:**
1. Seed data has "Episode 04 – Color pass" with status `"In progress"` (lowercase p)
2. Column option key is `"In progress"`, title-cased to `"In Progress"` by `getStatusOptions()`
3. The item's `getItemStatus()` returns `{ label: "In progress" }` — no match → item vanishes

**Impact:** Any item whose stored status label doesn't exactly match the title-cased version will silently disappear from the board. Users will think tasks are lost.

**Fix:** Normalize comparison in `itemsByStatus` grouping (e.g., case-insensitive `.toLowerCase()` comparison), OR stop title-casing in `getStatusOptions()` and use the raw label, OR normalize labels on write.

---

### 2. ❌ MAJOR — Quick-create mutation hangs indefinitely on failure

**Description:** When the `items.create` tRPC mutation fails (e.g., DB connection error), the quick-create input stays stuck on "Adding…" with no timeout, no error message, and no way to recover except manually clicking Cancel.

**Repro:**
1. Click "+ Add task" in any column
2. Type a task name and click "Add"
3. If the backend is unreachable, the button remains "Adding…" forever

**Expected:** Show a toast error after a reasonable timeout (~5s), reset the button to "Add", and keep the user's input so they can retry.

**Impact:** Users cannot tell if the action failed. They may leave the page thinking the task was created.

**Fix:** The `onError` callback on `createItem` mutation should reset loading state. The current code has an `onError` that pushes a toast, but the `isPending` state from the mutation controls the button — if the mutation never settles (network timeout), the button stays disabled. Add a timeout wrapper or ensure the mutation always settles.

---

### 3. ⚠️ MINOR — No priority badges visible on cards

**Description:** Cards show title, assignee, and date correctly, but no priority badges appear. This is because the seed data only has one STATUS column — the priority detection logic requires either a column named "Priority" or a second STATUS column. This is technically correct behavior, but the AC says "priority badge" should be visible.

**Recommendation:** Either:
- Add a "Priority" STATUS column in the seed data so the feature is demo-able out of the box
- Show a subtle "(no priority)" indicator or omit gracefully (current behavior is graceful omission — acceptable)

**Severity:** Minor — the code is correct, but the feature can't be verified without seed data that includes a Priority column.

---

### 4. ⚠️ MINOR — Column delete button (✕) has no confirmation

**Description:** The ✕ button on column headers immediately deletes the status option with no confirmation dialog. Accidentally deleting a column could orphan items into "No Status."

**Repro:**
1. Hover over any column header (Done, Review, etc.)
2. Click ✕ — column is immediately removed

**Expected:** A confirmation prompt ("Delete column 'Done'? X items will move to No Status.")

---

## Passing Checks

| Check | Result |
|-------|--------|
| Dedicated route `/workspace/[id]/board` renders | ✅ PASS |
| Columns render with correct status labels and colors | ✅ PASS |
| Cards show title, assignee avatar+name, due date | ✅ PASS |
| Overdue dates highlighted in red | ✅ PASS |
| Table/Board view toggle works | ✅ PASS |
| Filters (status, person) present and functional | ✅ PASS |
| "+ Add task" quick-create UI opens inline | ✅ PASS |
| "+ Add Column" button present and functional UI | ✅ PASS |
| Column rename via double-click (UI present, `cursor:pointer` + title hint) | ✅ PASS |
| Column delete via hover ✕ button (UI present) | ✅ PASS |
| Responsive at 768px — columns shrink, horizontal scroll | ✅ PASS |
| Empty column placeholder ("Drop items here") | ✅ PASS |
| Breadcrumbs show correct path | ✅ PASS |
| DnD infrastructure present (@dnd-kit sensors, droppable zones) | ✅ PASS (code review; browser DnD simulation inconclusive) |
| Board not found state handled | ✅ PASS (code review) |
| No STATUS column state handled | ✅ PASS (code review) |

---

## Accessibility Notes

- Column headers use `<h3>` — good semantic structure
- Cards are rendered as `<button>` elements — keyboard accessible for opening detail
- Drag handles use `@dnd-kit` attributes — keyboard DnD supported by library
- Color-coded status dots lack text labels at small sizes (column headers have text, cards don't show status text) — acceptable since items are grouped by column
- No ARIA live regions for DnD feedback — the `<status>` element at bottom provides DnD announcements ✅

---

## Blockers for Checkpoint Close

1. **MUST FIX:** Status label case mismatch causing items to vanish (Critical)
2. **SHOULD FIX:** Quick-create error handling — mutation should always settle and show feedback (Major)

Items 3–4 are nice-to-haves and should not block the checkpoint.
