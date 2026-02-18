# UX Audit — HW-M10: Board Views & Filtering

**Date:** 2026-02-17  
**Auditor:** UX Agent (automated)  
**App URL:** http://localhost:3002  
**Verdict:** ❌ **FAIL**

---

## Executive Summary

The HW-M10 feature set **cannot be tested end-to-end** due to a blocking runtime error. The board page crashes immediately with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in the filter bar component. This is caused by accessing `col.name` on Prisma `Column` objects whose actual field is `col.title`.

The code review reveals solid architecture — URL-persisted view mode, proper filter/sort utilities, native drag-and-drop kanban, and empty states — but the property name mismatch prevents any of it from rendering.

---

## Findings

| ID | Severity | Component | Description |
|----|----------|-----------|-------------|
| M10-001 | 🔴 P0 — Blocker | `board_filters.tsx:49` | `col.name.toLowerCase()` crashes — Column model uses `title`, not `name`. Prevents board page from loading. |
| M10-002 | 🔴 P0 — Blocker | `board_filters.tsx:66` | Same `col.name` → `col.title` bug in `allStatusOptions` useMemo. |
| M10-003 | 🔴 P0 — Blocker | `board_kanban.tsx:186` | Same `c.name` → `c.title` bug in kanban `statusColumn` lookup. |
| M10-004 | 🔴 P0 — Blocker | `board_filter_utils.ts:62,64` | `c.name` used in `filterAndSortItems` for status/priority column detection. Also, `ColumnLike` type (line 5) defines `name: string` but should be `title: string`. |
| M10-005 | 🟡 P2 — Minor | `board_filters.tsx` | No `aria-label` on filter `<select>` elements. Screen readers only see "All Statuses" etc. as first option, no field label. |
| M10-006 | 🟡 P2 — Minor | `board_kanban.tsx` | Draggable cards lack `aria-grabbed`, `aria-dropeffect`, or any ARIA drag-and-drop semantics. Keyboard-only users cannot move items between columns. |
| M10-007 | 🟡 P2 — Minor | `board_header.tsx` | View toggle buttons lack `aria-pressed` or `role="tablist"`/`role="tab"` semantics. Active state is visual-only. |
| M10-008 | 🟢 P3 — Nit | `board_filters.tsx` | Date inputs have `title` but no visible `<label>` elements — relies on the small "Due:" text span which isn't semantically linked. |
| M10-009 | 🟢 P3 — Nit | `board_kanban.tsx` | Kanban columns use hardcoded `w-[280px]` — on very narrow viewports (<320px) horizontal scroll works but column width doesn't adapt. Acceptable for MVP. |
| M10-010 | 🟢 P3 — Nit | Design consistency | Filter bar uses `rounded-lg` and `border-slate-200` which aligns with Atlassian-ish clean style. However, Atlassian DS uses specific token colors (`N20`, `B400`, etc.) — current implementation uses Tailwind slate/blue palette. Fine for now, flag for future design token migration. |

---

## What Could Not Be Tested (blocked by M10-001 through M10-004)

- Filter bar interaction (each filter type)
- Sort controls in both views
- Kanban drag-and-drop between columns
- View toggle (table ↔ board) URL persistence
- Empty states with filters returning no results
- Responsive behavior of rendered board/kanban views

---

## Recommended Fix

Replace all `col.name` / `c.name` references with `col.title` / `c.title` in:

1. `src/app/_components/board_filters.tsx` — lines 49, 66
2. `src/app/_components/board_kanban.tsx` — line 186
3. `src/app/_components/board_filter_utils.ts` — lines 5 (type), 62, 64

After fix, a **re-audit is required** to verify functional behavior.

---

## Code Quality Notes (from review)

- ✅ URL view persistence via `replaceState` — clean approach
- ✅ Filter/sort utility is well-separated (`board_filter_utils.ts`)
- ✅ Empty states implemented for both table and board views
- ✅ Drag-and-drop uses native HTML DnD API (no library dep)
- ✅ Optimistic invalidation on cell update mutation
- ⚠️ `filterAndSortItems` is called in both table and kanban — good reuse, but the type mismatch in `ColumnLike` means it silently fails at runtime too
