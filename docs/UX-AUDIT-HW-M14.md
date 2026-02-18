# UX Audit: HW-M14 — Workspace Settings & Team Management

**Date:** 2026-02-17  
**Auditor:** UX Agent  
**App URL:** http://localhost:3002/settings  
**Standards:** Nielsen's 10 Heuristics · WCAG 2.2 AA · Atlassian Design System  
**Scope:** Settings page (`/settings`) — Workspace, Team, and Boards tabs

---

## Summary

The Settings page is well-structured with a clean tabbed layout, good visual hierarchy, and solid destructive-action safeguards (type-to-confirm for workspace deletion). Key issues center on accessibility gaps (missing labels, keyboard traps), inconsistent confirmation patterns for destructive actions, and code duplication between the page and dialog implementations.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| Major | 7 |
| Minor | 8 |

---

## Critical Issues

### C1. Board Delete uses `window.confirm()` — inconsistent & inaccessible
**Location:** Boards tab → Delete button  
**Heuristic:** Consistency & Standards (H4), Error Prevention (H5)  
**Details:** Board deletion uses `window.confirm()` while workspace deletion uses an inline type-to-confirm pattern. The native confirm dialog is not styleable, breaks the design system, and cannot be customized for screen readers. In headless/automated browser contexts it may silently accept or reject.  
**Recommendation:** Replace with an inline confirmation or a custom modal dialog matching the workspace delete pattern. At minimum use a two-step inline confirm ("Are you sure?" → "Yes, delete").

### C2. Member Remove uses `window.confirm()` — same issue
**Location:** Team tab → Remove button (visible for non-owner members)  
**Heuristic:** Consistency & Standards (H4), Error Prevention (H5)  
**Details:** Same `window.confirm()` pattern as board delete. Removing a team member is a significant action that deserves a proper in-app confirmation.  
**Recommendation:** Custom confirmation dialog or inline confirm step.

### C3. Missing `<label>` elements on all form inputs
**Location:** All tabs — every `<input>` and `<select>`  
**Heuristic:** WCAG 1.3.1 (Info and Relationships), WCAG 4.1.2 (Name, Role, Value)  
**Details:** Inputs use `placeholder` text as the only label. Placeholders disappear on focus/input, leaving no persistent label. Screen readers may not announce the field purpose. The workspace name input, email input, role selects, and delete confirmation input all lack associated `<label>` elements or `aria-label` attributes.  
**Recommendation:** Add visible `<label>` elements (preferred) or at minimum `aria-label` attributes to every input and select.

---

## Major Issues

### M1. Duplicate code: settings page vs. dialog component
**Location:** `src/app/settings/page.tsx` and `src/app/_components/workspace_settings.tsx`  
**Heuristic:** Maintainability (engineering)  
**Details:** The full-page `/settings` and the `<WorkspaceSettings>` dialog component contain nearly identical logic (~500 lines each) with copy-pasted mutations, state management, and UI. Bug fixes must be applied in two places.  
**Recommendation:** Extract shared tab content into reusable components consumed by both the page and dialog.

### M2. Tab panel missing `aria-labelledby` / `id` linkage
**Location:** All tabs  
**Heuristic:** WCAG 4.1.2 (Name, Role, Value)  
**Details:** The `role="tabpanel"` element has no `id` or `aria-labelledby` connecting it to the active `role="tab"` button. The tabs lack `aria-controls` pointing to the panel. This breaks the ARIA tabs pattern.  
**Recommendation:** Add `id` to each tab and tabpanel, with `aria-controls` on tabs and `aria-labelledby` on panels per [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).

### M3. Tabs not keyboard-navigable with arrow keys
**Location:** Tab bar  
**Heuristic:** WCAG 2.1.1 (Keyboard), Atlassian DS Tabs component  
**Details:** The tabs are `<button>` elements which support Tab key navigation, but the WAI-ARIA tabs pattern requires Left/Right arrow key navigation between tabs (with `tabindex` management). Currently all three tabs are in the tab order.  
**Recommendation:** Implement roving `tabindex` with arrow key support per ARIA tabs pattern.

### M4. Owner can change their own role / demote themselves
**Location:** Team tab → role `<select>` on own member row  
**Heuristic:** Error Prevention (H5)  
**Details:** The Owner can change their own role to Admin or Member via the dropdown. If they're the only owner, this could lock everyone out of admin functions. The `<select>` is not disabled for the current user's own row.  
**Recommendation:** Disable role changes for the current user's own membership, or at least prevent the last Owner from demoting themselves. Show a tooltip explaining why.

### M5. No email validation before enabling "Send invite"
**Location:** Team tab → Invite by email  
**Heuristic:** Error Prevention (H5)  
**Details:** The Send invite button is enabled as soon as any character is typed in the email field (`!inviteEmail` is the only check). Invalid emails like "x" will be submitted and presumably fail server-side.  
**Recommendation:** Add client-side email format validation. Disable the button until a valid-looking email is entered. Show inline validation feedback.

### M6. No focus management after actions
**Location:** All tabs  
**Heuristic:** WCAG 2.4.3 (Focus Order)  
**Details:** After creating a workspace, renaming, sending an invite, or deleting a board, focus is not programmatically moved. Users relying on keyboard/screen reader lose their place.  
**Recommendation:** After mutations, move focus to a relevant element (e.g., the new workspace in the list, the invite email input after sending, etc.).

### M7. Delete workspace section visible to all roles (no guard)
**Location:** Workspace tab  
**Heuristic:** Error Prevention (H5), Match between system and real world (H2)  
**Details:** The delete workspace section with type-to-confirm is always rendered regardless of the user's role. Non-owners will presumably get a server error. The UI should not present actions the user cannot perform.  
**Recommendation:** Gate the delete section on `canManage` or a stricter owner-only check. Same applies to "Create workspace" and "Rename workspace" if those should be restricted.

---

## Minor Issues

### m1. Invite role selector allows assigning "Owner" role
**Location:** Team tab → Invite by email → role select  
**Heuristic:** Match between system and real world (H2)  
**Details:** The invite role dropdown includes "Owner" as an option. Inviting someone directly as Owner is unusual and potentially dangerous. Most apps restrict this to Admin/Member for invites.  
**Recommendation:** Remove Owner from the invite role options, or add a confirmation step.

### m2. No empty state guidance on Boards tab
**Location:** Boards tab (when no boards exist)  
**Heuristic:** Help and documentation (H10)  
**Details:** Shows "No boards in this workspace." as italic text with no call-to-action. Users aren't guided on how to create a board.  
**Recommendation:** Add a CTA button or link ("Create your first board") or explain where boards are created.

### m3. "Back to dashboard" link could use breadcrumb pattern
**Location:** Top of settings page  
**Heuristic:** Recognition rather than recall (H6), Atlassian DS Navigation  
**Details:** The back link is functional but doesn't convey location context. A breadcrumb (Dashboard > Settings) would better orient users.  
**Recommendation:** Consider a breadcrumb or at least show the current workspace name in the back link.

### m4. Delete confirmation input is case-sensitive
**Location:** Workspace tab → Delete workspace  
**Heuristic:** Flexibility and efficiency of use (H7)  
**Details:** The delete confirmation requires exact case match (`deleteConfirm !== selectedWs.name`). If the workspace is "Post-Production", typing "post-production" won't work.  
**Recommendation:** Use case-insensitive comparison: `deleteConfirm.toLowerCase() !== selectedWs.name.toLowerCase()`.

### m5. No loading states for initial data fetch
**Location:** All tabs  
**Heuristic:** Visibility of system status (H1)  
**Details:** While mutations show loading text ("Saving…", "Deleting…"), the initial data queries (members, boards, invites) show no skeleton or spinner. Content pops in after load.  
**Recommendation:** Add skeleton loaders or spinners for initial data fetches.

### m6. Rename input pre-filled but Save disabled — unclear why
**Location:** Workspace tab → Rename workspace  
**Heuristic:** Visibility of system status (H1)  
**Details:** The rename input shows the current name and Save is disabled. It's not immediately obvious that you need to *change* the name for Save to enable. No helper text explains this.  
**Recommendation:** Add helper text like "Edit the name above and click Save" or show a subtle disabled reason tooltip.

### m7. Role select uses raw enum values (OWNER, ADMIN, MEMBER)
**Location:** Team tab → Pending invites → "Role: MEMBER"  
**Heuristic:** Match between system and real world (H2)  
**Details:** The pending invites section displays the raw role value (e.g., "Role: MEMBER") rather than title-cased or user-friendly labels.  
**Recommendation:** Display as "Role: Member" with proper casing.

### m8. Color contrast on description/helper text
**Location:** Various — `text-slate-400` on white/slate-50 backgrounds  
**Heuristic:** WCAG 1.4.3 (Contrast Minimum)  
**Details:** `text-slate-400` (#94a3b8) on white (#ffffff) has a contrast ratio of ~3.3:1, below the 4.5:1 AA requirement for normal text. This affects email addresses, descriptions, and helper text throughout settings.  
**Recommendation:** Use `text-slate-500` (#64748b, ~5.4:1) or darker for all body/helper text.

---

## Positive Observations

- **Type-to-confirm for workspace deletion** — Excellent error prevention pattern for the most destructive action
- **Clear visual hierarchy** — Danger zone section has distinct red border/background treatment
- **Disabled states on buttons** — Create, Save, Delete buttons properly disabled until valid input
- **Toast notifications** — Success/error feedback on all mutations
- **Inline board rename** — Clean edit-in-place pattern with Save/Cancel and keyboard support (Enter/Escape)
- **Back to dashboard link** — Clear escape hatch from settings
- **Tab UI is clean** — Good visual design with active indicator

---

## Recommended Priority

1. **C3** (labels) — Highest impact accessibility fix, affects all inputs
2. **C1 + C2** (window.confirm) — Replace with in-app confirmations
3. **M2 + M3** (ARIA tabs) — Complete the accessibility pattern
4. **M4** (self-demotion) — Prevent account lockout
5. **m8** (contrast) — Quick CSS fix for AA compliance
6. **M1** (dedup) — Technical debt that compounds over time
