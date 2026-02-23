# HANDOFF.md - Houseworks Development Handoff

## Current State: 19 UX Revisions Complete (All Milestones)

### All Milestones Shipped
All 19 UX revision items from the full UX pass are now implemented.

---

## Milestone Summary

### M1 — Board Table Bug Fixes (`board_table.tsx`)
- **1a** Filter no-results: removed early return; shows banner with "Clear filters" inside groups DndContext
- **1b** Date click propagation: `e.stopPropagation()` on `CustomDateInput` outer div
- **1c** Row rename flash: `nameSavedFlash` state + `commitNameSave` helper; Enter key blurs input, shows green ring for 800ms
- **1d** Row ellipsis menu portal: rebuilt with `createPortal` + `getBoundingClientRect` + `position: fixed`

### M2 — Board Header Restructure (`board_header.tsx`)
- **2a** `⋯` ellipsis menu (portal) for Delete/Duplicate/Template actions; visible icon buttons for Columns + Automations (⚡)
- **2b** AutomationPanel converted to right-side slide-in drawer (`fixed right-0 top-0 h-screen w-[480px]`) with backdrop
- **2c** Views system: chevron dropdown next to board name; save/switch/delete views backed by `BoardView` DB model
- **2d** Search button (⌘K) in board header

### M2c — Schema + Routers
- `prisma/schema.prisma`: Added `BoardView` and `UserBoardPrefs` models
- `src/server/api/routers/boardViews.ts`: `list`, `create`, `update`, `delete`
- `src/server/api/routers/userBoardPrefs.ts`: `get`, `setColumnWidths`
- Migration: `20260223031637_add_board_views_and_user_prefs`

### M3 — Sidebar + Layout
- **3a** Viewport-locked layout: `h-screen overflow-hidden flex` on root, `flex-1 overflow-y-auto` on main
- **3b** Collapsible sidebar: `w-14` (icons) / `w-56` (expanded), localStorage persistence
- **3c** Activity removed from sidebar nav (lives in Dashboard)
- **3d** Settings navigates via `router.push('/settings')` (sidebar stays mounted)
- **3e** Workspace picker uses shared `CustomSelect` component

### M4 — Settings Cleanup
- Removed "Workspace" tab (Create/Rename/Delete workspace) from settings page
- Default tab is now "team"

### M5 — Table Frozen Layout + Column Resize (`board_table.tsx`)
- **5a** Horizontal scroll: `<div className="overflow-x-auto">` wraps column header DndContext + groups; `minWidth: 'max-content'` on header and item rows; gridTemplate uses `minmax(220px, 2.2fr)` / `minmax(140px, 1fr)` minimums
- **5c** Column resize: drag handles (absolute right-0) on each column header cell; `handleResizeStart` captures mouse delta and updates `columnWidths` state; saves to `UserBoardPrefs` on mouseup via `trpc.userBoardPrefs.setColumnWidths`; widths loaded from `trpc.userBoardPrefs.get` on mount

---

## Key Files Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `BoardView`, `UserBoardPrefs` models |
| `src/server/api/routers/boardViews.ts` | New CRUD router |
| `src/server/api/routers/userBoardPrefs.ts` | New get/setColumnWidths router |
| `src/server/api/root.ts` | Registered both new routers |
| `src/app/_components/custom_select.tsx` | Extracted from board_table; used in sidebar too |
| `src/app/_components/board_table.tsx` | M1 bugs, M5 layout + resize |
| `src/app/_components/board_header.tsx` | M2 full restructure |
| `src/app/_components/board_data.tsx` | M2b/2c wiring |
| `src/app/_components/automation_panel.tsx` | Drawer mode |
| `src/app/_components/sidebar.tsx` | M3b/3c/3d/3e |
| `src/app/page.tsx` | M3a viewport-lock, collapsible sidebar |
| `src/app/settings/page.tsx` | M4 remove workspace tab |
| `src/app/workspace/[id]/board/page.tsx` | Views + automation drawer wiring |

## Architecture Notes
- Column resize state is local to `BoardTable`, loaded from DB on mount, saved on drag-end
- Views store filters+sort as JSON in `BoardView`; switching a view calls `onFiltersChange` + `onSortChange`
- Sidebar collapse state persisted to `localStorage['sidebar-collapsed']`
- `AutomationPanel` uses `open?: boolean` prop to switch between inline and drawer modes
