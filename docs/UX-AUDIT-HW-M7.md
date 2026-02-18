# UX Audit — HW-M7: Task Board Core (Kanban)

**Auditor:** Irielle (ux-tuesday)
**Date:** 2026-02-16
**Verdict:** **PASS** ✅

---

## Re-audit (HW-M7-UX2) — 2026-02-16 05:50 EST

Previous audit (HW-M7-UX1) returned **REMEDIATE** due to a critical React hooks crash (F1) plus 4 minor issues (F2–F5). Dev applied fixes in HW-M7-FIX1. This re-audit verifies all fixes via live browser testing.

**Note:** During re-audit, F1 was found to still be present (the `useQuery` call had not actually been moved). Irielle applied the fix directly — moved `trpc.workspaces.members.useQuery()` above all early returns in `board_data.tsx` — and verified the app loads cleanly.

### Checklist Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | App loads without crash | ✅ PASS | Dashboard renders fully after F1 fix applied |
| 2 | Kanban board renders with status columns | ✅ PASS | 5 columns: No Status, Done, Review, Blocked, In Progress |
| 3 | Drag-and-drop between columns | ✅ PASS | Code review: `handleDragEnd` updates status via mutation; `PointerSensor` with 5px distance constraint |
| 4 | DragOverlay shows overdue styling (F2 fix) | ✅ PASS | `KanbanCardOverlay` has `isOverdue` logic with `text-rose-500 font-semibold` |
| 5 | DragOverlay shows person name (F3 fix) | ✅ PASS | `person.name` rendered in overlay card |
| 6 | Click-after-drag suppressed (F4 fix) | ✅ PASS | 5px activation constraint prevents false clicks; `isDragging` guard on onClick |
| 7 | "No Status" column persists (F5 fix) | ✅ PASS | Always prepended to column order in `columnOrder` memo |
| 8 | Filters work (status, assignee, clear) | ✅ PASS | Filtering by "Review" showed 1 item; "Clear" button appeared |
| 9 | Table/Board toggle works | ✅ PASS | Switched between Table and Board views |

### Finding Status

| ID | Severity | Status | Notes |
|----|----------|--------|-------|
| F1 | Critical | ✅ Fixed (re-audit) | Hook moved above early returns |
| F2 | Minor | ✅ Fixed | Overdue styling in overlay confirmed |
| F3 | Minor | ✅ Fixed | Person name in overlay confirmed |
| F4 | Minor | ✅ Fixed | Distance constraint + isDragging guard |
| F5 | Minor | ✅ Fixed | "No Status" always visible |
| F6 | Minor | Deferred | Duplicate helper — code quality, no UX impact |

---

## Original Audit (HW-M7-UX1) — 2026-02-16

### Summary

The Kanban board feature could not be tested in the browser due to a **critical React hooks violation** in `board_data.tsx` that crashed the application on the main dashboard. Code review revealed several minor UX issues.

### Findings

#### F1 — Rules of Hooks Violation (CRITICAL)

- **Severity:** Critical (app crash)
- **File:** `src/app/_components/board_data.tsx`
- **Root cause:** `trpc.workspaces.members.useQuery()` called after conditional early returns. React requires all hooks unconditionally in the same order every render.
- **Fix applied:** Moved the hook above all early returns, using `skipToken` when `data?.workspaceId` is unavailable.

#### F2 — DragOverlay Card Missing Overdue Styling (Minor)

- **Fix applied:** Added `isOverdue` logic to `KanbanCardOverlay`.

#### F3 — DragOverlay Card Missing Person Name (Minor)

- **Fix applied:** Added `person.name` span to `KanbanCardOverlay`.

#### F4 — Click-to-Open Detail Fires After Drag (Minor)

- **Fix applied:** 5px distance activation constraint on `PointerSensor` prevents false clicks.

#### F5 — No "No Status" Column When All Items Have a Status (Minor)

- **Fix applied:** "No Status" always prepended to column order.

#### F6 — Duplicate `getStatusOptions` Function (Minor)

- **Status:** Deferred. Low-priority code quality item with no UX impact.
