# UX Audit — HW-M8: Dashboard & Navigation Polish

**Auditor:** Irielle (ux-houseworks)
**Date:** 2026-02-16
**Verdict:** **REMEDIATE** (2 findings, 0 critical)

---

## Audit Method

Browser automation was unavailable (no Chrome tab attached). Audit performed via:
- Full code review of all new/changed files
- Lint verification (`npm run lint` on changed files: **PASS**)
- Dev server liveness check (`curl` returns 307 auth redirect: **PASS**)
- tRPC endpoint review (`dashboardStats`)

---

## Checklist Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Dashboard renders after login with stats and board list | ✅ PASS | `Dashboard` component queries `dashboardStats`, renders 3 stat cards + recent boards list. Loading skeleton provided. |
| 2 | Sidebar highlights current page correctly | ✅ PASS | `currentView` prop drives `bg-white/10 text-white` for dashboard; `bg-white/20` for selected board. |
| 3 | Board list in sidebar is clickable and navigates | ✅ PASS | `onSelectBoard(board.id)` fires on click, `page.tsx` sets `selectedBoardId` which switches to board view. |
| 4 | Board header shows name, member count, view toggle | ✅ PASS | `BoardHeader` renders `boardName`, pluralized member count, and Table/Board toggle buttons with active styling. |
| 5 | Breadcrumbs render correctly; workspace link returns to dashboard | ✅ PASS | `Breadcrumbs` renders Workspace > Board > View. First item has `onClick: onNavigateDashboard` which calls `setSelectedBoardId(null)`. |
| 6 | No visual regressions on existing Kanban/table views | ✅ PASS | `BoardTable` and `BoardKanban` usage unchanged. View toggle moved to `BoardHeader` but same state/callbacks. |
| 7 | Responsive behavior | ⚠️ F1 | See below |
| 8 | Empty states handled | ✅ PASS | Dashboard: "No boards yet" with CTA. Sidebar: "No workspaces found" / "No boards yet". Stats card: "No items yet" italic. |

---

## Findings

### F1 — Sidebar hidden below `lg` breakpoint with no mobile alternative (Minor)

- **Severity:** Minor
- **File:** `src/app/_components/sidebar.tsx`
- **Issue:** Sidebar uses `hidden lg:flex` — on screens below 1024px the entire sidebar (including dashboard link and board navigation) disappears with no hamburger menu, drawer, or alternative navigation.
- **Impact:** Mobile/tablet users have no way to navigate between dashboard and boards, or switch between boards.
- **Recommendation:** Add a mobile nav trigger (hamburger icon in header) that opens the sidebar as a slide-over drawer on small screens. Can defer to a follow-up milestone if mobile support is not yet a priority.

### F2 — Workspace Settings button is a no-op (Minor)

- **Severity:** Minor
- **File:** `src/app/_components/sidebar.tsx`
- **Issue:** The "⚙️ Workspace Settings" button in the sidebar footer has no `onClick` handler and the `currentView` type includes `'settings'` but nothing navigates to it.
- **Impact:** Clicking the button does nothing. Users may expect it to work since it's visually styled as interactive.
- **Recommendation:** Either wire it to a settings view/page, or mark it as "Coming Soon" with `disabled` styling and a tooltip.

---

## Code Quality Notes (non-blocking)

1. **Type assertions in `board_data.tsx`:** Several `(data as { ... })` casts (lines for `hasGroups`, `hasColumns`, `boardTitle`, `workspaceName`). Consider typing the tRPC return type more precisely to avoid runtime uncertainty.
2. **Hardcoded "Today's Focus" section in `page.tsx`:** The overdue/review/deliver counts (2, 4, 1) are static placeholders. Not a regression but could confuse users who expect live data.
3. **`dashboardStats` endpoint performance:** For large workspaces, fetching all boards with all groups and items could be expensive. Consider adding `_count` aggregations at the DB level rather than in-memory iteration.

---

## Verdict: **REMEDIATE**

**F1** and **F2** are both minor and could be deferred if mobile is out of scope for this milestone. If the team confirms mobile navigation is not yet a priority and the Settings button is intentionally a placeholder, this can be upgraded to **PASS** without code changes — just needs explicit acknowledgment.

All core HW-M8 functionality (dashboard stats, sidebar navigation, board header, breadcrumbs, empty states) is correctly implemented and well-structured.
