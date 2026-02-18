# UX Audit — HW-M16 & HW-M17

**Date:** 2026-02-17  
**Auditor:** UX Agent (code review — browser unavailable)  
**Method:** Source-code analysis of all relevant components  
**Verdict: CONDITIONAL PASS**

> Browser automation was unavailable (no Chrome tab attached). Audit performed via comprehensive source-code review of `item_detail_panel.tsx`, `board_table.tsx`, `board_kanban.tsx`, `board_kanban_full.tsx`, `dashboard.tsx`, `dependencies.ts`, and `items.ts`. A follow-up visual screenshot audit is recommended.

---

## Summary

Both milestones are functionally complete with good foundational UX. The recurrence UI offers clear frequency options with human-readable summaries, and the dependencies system includes circular-dependency prevention and grouped display. Key issues are around accessibility gaps and missing visual indicators at the board level.

---

## HW-M16 — Recurring Items & Due Date Automation

### What's Implemented
- **Recurrence editor** in item detail panel with frequency selector (daily, weekly, biweekly, monthly, custom)
- **Day-of-week picker** for weekly/biweekly patterns
- **Custom interval** (every N days) for daily/custom types
- **Start date field** pre-populated from existing DATE cell
- **Human-readable summary** ("Every Monday", "Every 2 weeks") via `recurrenceToText()`
- **Next due date display** alongside the 🔄 recurrence badge
- **Overdue indicators** on board table (rose-600 text + rose border + rose background) and kanban cards (rose-500 bold text)
- **Dashboard overdue count** card with red highlighting when > 0
- **Server-side `advanceDueDate()`** for auto-computing next occurrence

### What's Missing / Issues
See findings F1–F7 below.

---

## HW-M17 — Dependencies & Item Linking

### What's Implemented
- **Add dependency UI** with type selector (Blocks / Blocked by / Related to / Duplicates) + search-as-you-type
- **Remove dependency** via hover-reveal ✕ button with `aria-label`
- **Grouped display** by type with emoji icons (🚫 Blocks, ⛔ Blocked by, 🔗 Related to, 📋 Duplicates)
- **Board-level indicator** — 🔗 badge with count on table rows
- **Circular dependency prevention** — BFS cycle detection on server; user-facing error toast via `onError`
- **Self-link prevention** — server rejects same-item dependencies
- **Cross-board linking** — board title shown under each linked item

### What's Missing / Issues
See findings F8–F14 below.

---

## Findings

| ID | Description | Severity | Heuristic / Standard |
|----|-------------|----------|---------------------|
| F1 | **Recurrence: no `aria-live` region for next-due-date updates.** When recurrence is saved, the "Next: date" text updates silently. Screen readers won't announce the change. | Major | WCAG 1.3.1 (Info & Relationships), 4.1.3 (Status Messages) |
| F2 | **Recurrence: 🔄 emoji used as sole indicator.** No text alternative for the recurrence state when collapsed. The `role="img" aria-label="Recurring"` is present but the parent container lacks context for AT users scanning the panel. | Minor | WCAG 1.1.1 (Non-text Content) |
| F3 | **Recurrence: no "monthly on day X" option.** The monthly pattern doesn't expose a day-of-month selector despite the `dayOfMonth` field existing on `RecurrenceRule`. Users can only get "Every month" without specifying which day. | Major | Nielsen #7 (Flexibility & Efficiency) |
| F4 | **Recurrence editor: no confirmation on "Remove".** Clicking "Remove" immediately deletes the recurrence rule. Destructive action without undo or confirmation. | Minor | Nielsen #5 (Error Prevention) |
| F5 | **Overdue styling relies solely on color (rose-600).** No icon, badge, or text label accompanies the color change on overdue dates. Color-blind users may miss it. | Major | WCAG 1.4.1 (Use of Color) |
| F6 | **Board table: no recurrence indicator on rows.** Unlike dependencies (🔗 badge), recurring items have no visual cue in the table/kanban views. Users must open the detail panel to discover recurrence. | Major | Nielsen #1 (Visibility of System Status) |
| F7 | **Recurrence: interval input lacks max value.** The `<input type="number" min={1}>` has no `max` constraint. User could enter 99999 days. | Minor | Nielsen #5 (Error Prevention) |
| F8 | **Dependency remove button: opacity-0 until hover.** The ✕ button is invisible by default (`opacity-0 group-hover:opacity-100`). Keyboard-only and touch users cannot discover or reach it. | Critical | WCAG 2.1.1 (Keyboard), 2.4.7 (Focus Visible) |
| F9 | **Dependency search: no keyboard navigation of results.** Search results are plain `<button>` elements inside a scrollable div but lack `role="listbox"` / `aria-activedescendant` patterns. Arrow-key navigation is not implemented. | Major | WCAG 2.1.1 (Keyboard), Atlassian DS (Dropdown) |
| F10 | **Dependency type selector uses `<select>` without description.** No `aria-label` or visible label on the type dropdown in the add-dependency form. | Minor | WCAG 1.3.1 (Info & Relationships) |
| F11 | **No "blocked" badge on board-level rows.** The 🔗 badge shows total dependencies but doesn't distinguish items that are blocked (cannot proceed). A "Blocked" badge would improve status visibility. | Major | Nielsen #1 (Visibility of System Status) |
| F12 | **Circular dependency error message is generic.** The server returns "This dependency would create a circular chain" but doesn't show the chain path. Users can't understand why the link was rejected. | Minor | Nielsen #9 (Help Users Diagnose Errors) |
| F13 | **Dependency section: no empty-state call to action.** "No dependencies" italic text doesn't suggest what to do. Should include a brief explanation or inline "Add" link. | Minor | Nielsen #10 (Help & Documentation) |
| F14 | **Kanban cards don't show dependency indicators.** The 🔗 badge exists on table rows but not on kanban cards (`board_kanban.tsx`, `board_kanban_full.tsx`). Inconsistent across views. | Major | Nielsen #4 (Consistency & Standards) |

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Major | 7 |
| Minor | 6 |

---

## Verdict: CONDITIONAL PASS

**Condition:** Fix the 1 critical issue (F8 — dependency remove button inaccessible to keyboard/touch) before release. The 7 major issues should be addressed in the next sprint.

### Required for Gate Clearance
- [ ] **F8** — Make dependency remove button visible on focus and on touch devices (e.g., `focus:opacity-100` + always-visible on mobile breakpoints)

### Recommended Before Next Milestone
- [ ] **F5** — Add overdue icon/text alongside color indicator
- [ ] **F6** — Add recurrence indicator to board table/kanban rows
- [ ] **F11** — Add "Blocked" status badge to board views
- [ ] **F14** — Add dependency indicator to kanban cards
- [ ] **F3** — Expose day-of-month selector for monthly recurrence
- [ ] **F9** — Add keyboard navigation to dependency search results
- [ ] **F1** — Add `aria-live` region for dynamic recurrence/date updates

---

## Appendix: Methodology

Evaluated against:
- **Nielsen's 10 Usability Heuristics** (1994, updated)
- **WCAG 2.2 Level AA** success criteria
- **Atlassian Design System** patterns (status badges, dropdowns, inline edit)

Files reviewed:
- `src/app/_components/item_detail_panel.tsx` (RecurrenceSection, DependenciesSection)
- `src/app/_components/board_table.tsx` (overdue styling, dependency badge)
- `src/app/_components/board_kanban.tsx` + `board_kanban_full.tsx` (overdue styling)
- `src/app/_components/dashboard.tsx` (overdue count)
- `src/server/api/routers/dependencies.ts` (cycle detection, CRUD)
- `src/server/api/routers/items.ts` (setRecurrence, advanceDueDate)

> **Note:** This audit was conducted via source-code review only. A visual/interactive follow-up audit with browser screenshots is recommended to verify rendering, color contrast ratios, and interaction flows.
