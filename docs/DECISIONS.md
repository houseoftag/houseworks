# Houseworks Decisions

## D-041: HW-M12 Global Search via Command Palette
- **Status:** Accepted
- **Decision:** Implement global search as a ⌘K command palette (modal overlay) rather than a persistent search bar. Search endpoint uses Prisma `contains` with case-insensitive mode rather than full-text search indices.
- **Why:** Command palette is the modern standard (Notion, Linear, GitHub, VS Code). It's non-intrusive, keyboard-first, and scales to future quick actions. Prisma `contains` is sufficient for the current data scale; PostgreSQL full-text search can be added later if performance requires it.

## D-018: Dual-Path Automation Evaluation (Inline + Worker)
- **Status:** Accepted
- **Decision:** Evaluate automation rules both inline in tRPC mutations (for immediate feedback) and via BullMQ worker (for background/retry). Inline evaluation fires-and-forgets (`void evaluateAutomations(...)`) to avoid blocking the mutation response.
- **Why:** Immediate rule execution gives users instant feedback (e.g., item moves to group right away). Worker provides reliability for retries and heavier actions. Dual path ensures rules fire even if one path fails.

## D-019: Priority Column Detection by Title Pattern
- **Status:** Accepted
- **Decision:** Detect "priority" columns by matching column title against `/priority/i` regex, since priority uses the STATUS column type with custom labels.
- **Why:** No separate PRIORITY column type exists in the schema. Convention-based detection is simple and works for the MVP. Can be formalized with a column metadata flag later.

## D-020: Automation Actions Support Assignee Notification by Default
- **Status:** Accepted
- **Decision:** The NOTIFY action defaults to `notifyAssignee: true`, sending notifications to whoever is assigned to the item. Falls back to all workspace members if no specific targets provided.
- **Why:** Most useful default — the person responsible for the item should know about automated changes.

## D-010: Execute Rename as a Safety-First, Two-Phase Migration
- **Status:** Accepted
- **Decision:** Split naming alignment into:
  1) safe/non-breaking label updates now,
  2) coordinated/high-risk rename completion later.
- **Why:** Avoid accidental breakage in auth, packaging, and environment-dependent flows.

## D-011: Safe Scope for This Pass
- **Status:** Accepted
- **Included now:** UI labels, human-readable branding text, docs, sender display name.
- **Excluded now:** package identity, auth email domain, seeded/test identity domains.
- **Why:** Included changes do not alter runtime contracts or external integrations.

## D-012: Deferred High-Risk Candidates Require Explicit Coordination
- **Status:** Accepted
- **Deferred items:**
  - `package.json` / lockfile package name,
  - `no-reply@houseworks.app` domain,
  - `admin@houseworks.local` dev credential namespace.
- **Why deferred:** these can affect CI/CD assumptions, external provider config, and local/dev auth flows.

## D-013: Historical Traceability
- **Status:** Accepted
- **Decision:** Keep one explicit note that Houseworks was formerly "Houseworks" for audit/debug continuity.

## D-021: Complete Rename of Package and Dev Credentials
- **Status:** Accepted
- **Decision:** Execute the rename of `package.json` package name and all `houseworks.local` dev credential occurrences to `houseworks.local`.
- **Why:** To complete the branding transition and ensure consistency across code, seeds, and documentation. Verification via `verify:freshness:static` and scoped linting confirms stability.

## D-022: Establish Mail-Domain Cutover Plan
- **Status:** Accepted
- **Decision:** Document a formal cutover plan and validation checklist for the official `@houseworks.app` migration.
- **Why:** The actual domain cutover involves external DNS and mail provider configuration that cannot be automated safely from this local environment. A documented plan ensures a safe and verifiable transition.

## Rename Completeness Gate
- **Current verdict:** **GO** for full rename completion.
- **Verification:** All deferred high-risk items (package metadata, dev credentials) have been migrated and validated.

## D-014: GitHub Rename Requires Canonical Remote First
- **Status:** Accepted
- **Decision:** Do not execute GitHub rename/cutover actions from this repo until a canonical remote target is confirmed and `origin` exists.
- **Why:** local repo currently has no `origin`; executing URL/rename steps without canonical target risks misbinding and broken contributor guidance.

## D-015: Safe Order of Operations for GitHub Naming Alignment
- **Status:** Accepted
- **Order:**
  1) Confirm canonical target (`owner/houseworks`) and permissions,
  2) rename GitHub repo (or create target and transfer),
  3) verify GitHub redirect behavior from old slug,
  4) update `origin` and any CI/badges/webhooks/integrations,
  5) publish contributor clone/remote update guidance.
- **Why:** preserves availability and minimizes breakage during transition.

- **GitHub Rename Execution Gate**
- **Current verdict:** ✅ **GO**
- **Action:** Local `origin` has been set to `https://github.com/tag-v/houseworks.git`. Remote repository creation/rename on GitHub is required to complete the sync.

## D-024: HW-M4 Post-rename hygiene & naming alignment (Completion Pass)
- **Status:** Accepted
- **Decision:** Execute a thorough final sweep for residual legacy tokens (`houseworks` -> `houseworks`) in docs and config.
- **Why:** To ensure brand consistency and clear naming debt before proceeding to heavy feature work. Non-breaking constraints applied.

## D-016: Re-open app-facing checkpoint cadence under Houseworks name
- **Status:** Accepted
- **Decision:** Start `HW-CP1` as an app-facing checkpoint focused on first-run board creation clarity and feedback states.
- **Why:** Current rename/governance cleanup is useful, but user-facing trust and usability must resume to align with Houseworks product goal.
- **Gate:** Dev completion alone is non-closing; PM closure requires follow-up UX running-app audit + triage (explicit CLOSE/NO-CLOSE).

## D-017: Empty-state CTA should route user directly into the BOARD creation surface
- **Status:** Accepted
- **Decision:** Add an explicit empty-state CTA in `BoardData` (“Create Your First Board”) that scrolls to workspace controls and opens the `BOARD` tab.
- **Why:** First-run users need a clear primary action and a visible destination for that action without hunting UI tabs.

## D-018: Create-board must expose visible status feedback beyond toasts
- **Status:** Accepted
- **Decision:** Keep toast notifications, but also add inline status messaging in BOARD tab for `loading`, `success`, and `error` states.
- **Why:** Toasts are ephemeral; inline feedback confirms state transition and supports first-run trust/clarity.

## D-019: Error copy must include explicit next action
- **Status:** Accepted
- **Decision:** Standardize fallback copy to: “Could not create board. Check your board title and workspace selection, then retry.” via shared helper.
- **Why:** Actionable language reduces ambiguity and gives user a concrete recovery path.

## D-020: Add a lightweight automated guard with built-in test runner
- **Status:** Accepted
- **Decision:** Add a node:test-based unit check (`tsx --test`) for create-board feedback copy (success and actionable error).
- **Why:** Project currently has no dedicated test framework; this keeps scope minimal while adding a repeatable guard.

## D-023: HW-M3 GitHub Naming Alignment Execution (Assessment & Remote Setup)
- **Status:** Accepted
- **Decision:** Establish canonical GitHub remote (`origin`) and execute GitHub slug migration. Candidate URL: `https://github.com/tag-v/houseworks.git`.
- **Why:** To align local and remote repository naming and ensure consistent links/badges/CI integration.

## D-025: HW-M5 Mail Domain Cutover Pre-flight Findings
- **Status:** Accepted
- **Findings:**
  - Target domain `houseworks.app` is currently `NXDOMAIN` (not registered or no DNS records).
  - Staging mail test is blocked by missing `RESEND_API_KEY` (placeholder in `.env`).
  - Production code (`src/server/auth.ts`) still points to `no-reply@houseworks.app`.
- **Recommendation:** Do not proceed with cutover until `houseworks.app` is registered/configured and a valid Resend API key is provided.


## D-026: HW-M6 PR Assembly & Final Rename Hygiene
- **Status:** Accepted
- **Decision:** Create PR branch `pr/rename-hygiene-m6` with all rename work, seed migrations, and doc updates as a single clean commit. Final `grep -r "houseworks"` audit confirms zero stray legacy references.
- **Why:** Consolidates all naming alignment work into a reviewable PR-ready branch for clean merge into main.

## D-027: HW-M7 Reuse Existing Data Model for Task Board
- **Status:** Accepted
- **Decision:** Do not create a separate `Task` model. The existing Board → Group → Item → CellValue architecture already represents tasks. Items are tasks; STATUS/PERSON/DATE columns provide status, assignee, and due date fields. Build a Kanban board view as an alternate presentation of the same data.
- **Why:** The monday.com-style flexible column/cell architecture is more powerful than a fixed Task model. Adding a parallel model would create data duplication and sync complexity. The Kanban view is simply a different grouping (by status) of the same items.

## D-029: HW-M8 Dashboard as Default Authenticated View
- **Status:** Accepted
- **Decision:** When no board is selected, show a workspace dashboard with stats (total boards, total items, items by status) and recent boards. Clicking a board navigates to it; clicking Dashboard in sidebar returns to this view.
- **Why:** Users need a useful landing page after login, not an empty board view. The dashboard provides orientation and quick access.

## D-030: HW-M8 Board Header with Integrated View Toggle
- **Status:** Accepted
- **Decision:** Move the Table/Board view toggle into a dedicated BoardHeader component that also shows board name and member count. Remove the standalone toggle from BoardData.
- **Why:** Consolidates board context (name, members, view mode) into a single header component for better UX clarity.

## D-031: HW-M4-v2 Dashboard Shows Workspace Context
- **Status:** Accepted
- **Decision:** Enhance the `dashboardStats` tRPC endpoint to return the user's workspace name and member count. Display this prominently at the top of the dashboard.
- **Why:** AC1 requires the dashboard to show workspace name and member count. Prior M8 dashboard showed board stats but lacked workspace identity context. Adding a workspace header card provides orientation for users with multiple workspaces.

## D-032: HW-M5 Dedicated Board Route + Enhanced Kanban
- **Status:** Accepted
- **Decision:** Create a dedicated `/workspace/[id]/board` route using Next.js App Router dynamic segments. Build an enhanced `BoardKanbanFull` component that extends the existing kanban with priority badges, inline task quick-create, and column CRUD (add/rename/delete status options directly from the board view). Priority is detected from a STATUS column named "Priority" or the second STATUS column on the board.
- **Why:** The existing kanban in `board_kanban.tsx` is embedded in the main page and lacks column management, quick-create, and priority display. A dedicated route provides a shareable URL (`/workspace/:id/board`) and the enhanced component adds the CRUD and quick-create features needed for a monday.com-style workflow.

## D-033: HW-M6 Reuse Update Model for Comments
- **Status:** Accepted
- **Decision:** Use the existing `Update` model (id, itemId, userId, content, createdAt) for the comments/activity feature instead of creating a separate `Comment` model. The `items.getDetail` endpoint returns updates alongside all cell values and board columns in a single query.
- **Why:** The `Update` model already serves exactly the same purpose as a Comment model. Adding a parallel model would create confusion and data duplication. The existing `items.createUpdate` mutation handles comment creation.

## D-034: HW-M6 Single-Query Detail Endpoint
- **Status:** Accepted
- **Decision:** Create `items.getDetail` that returns the item, its group, the board's columns (ordered by position), all cell values with column metadata, and updates with user info — all in one query. The panel component uses this single endpoint to render all fields.
- **Why:** Avoids waterfall requests (item → columns → cells → updates). The panel needs all this data immediately on open, so a single rich query provides the best UX.

## D-028: HW-M7 Board View as Kanban Over STATUS Column
- **Status:** Accepted
- **Decision:** The Kanban board view groups all items (across all groups) by their first STATUS column's value. Drag-and-drop between columns updates the cell value. Filters apply to both table and board views.
- **Why:** This matches user expectation of a project board (like Trello/monday.com board view) while leveraging the existing flexible data model.

## D-035: HW-M9 Notification Model Enhancement
- **Status:** Accepted
- **Decision:** Extend the existing `Notification` model with `type` (enum: ASSIGNMENT, COMMENT, STATUS_CHANGE, MENTION, DUE_DATE), `itemId`, and `boardId` fields. Add a separate `ActivityLog` model for tracking all item changes (status, assignment, field edits, comments) to power the activity feed.
- **Why:** The original notification model was too generic (just title/message/link). Typed notifications enable type-specific icons, filtering, and routing. Activity logs are separate from notifications because not every change generates a notification (e.g., the actor doesn't need to be notified of their own actions), but every change should be logged for the timeline.

## D-036: HW-M9 Notification Triggers via Inline Creation
- **Status:** Accepted
- **Decision:** Create notifications inline in the tRPC mutation handlers (cells.update for PERSON/STATUS changes, items.createUpdate for comments) rather than via a separate queue/worker.
- **Why:** Simplicity. The notification creation is a single DB insert that adds negligible latency. A queue-based approach would add complexity without meaningful benefit at this scale. If performance becomes an issue, these can be moved to the existing BullMQ automation queue later.

## D-037: HW-M9 Follower Model via Update Authors
- **Status:** Accepted
- **Decision:** Define "item followers" as users who have previously posted an Update (comment) on the item, plus any user assigned via a PERSON column. No explicit follow/unfollow mechanism.
- **Why:** Matches the behavior users expect from tools like Jira/monday.com — if you've commented on something, you get notified of further activity. An explicit follow/unfollow can be added later as an enhancement.

## D-038: HW-M10 Native HTML Drag-and-Drop for Kanban
- **Status:** Accepted
- **Decision:** Replace `@dnd-kit` in the board/kanban view with the native HTML Drag-and-Drop API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). The table view retains `@dnd-kit` for column/row reordering.
- **Why:** Reduces bundle size and external dependency surface for the kanban view. Native DnD is sufficient for column-to-column status changes. `@dnd-kit` is still used in the table view where within-group item reordering and column reordering require more sophisticated DnD capabilities.

## D-039: HW-M10 View Mode Persistence via URL Search Params
- **Status:** Accepted
- **Decision:** Persist the view mode (table/board) in the URL via `?view=board` search parameter using `window.history.replaceState`. Default is table view (no param).
- **Why:** Enables shareable board links and preserves view choice on page refresh without requiring server-side state.

## D-040: HW-M10 Shared Filter/Sort Utilities
- **Status:** Accepted
- **Decision:** Extract filtering and sorting logic into a shared `board_filter_utils.ts` module used by both BoardTable and BoardKanban. Filter bar supports: status, person/assignee, priority, due date range. Sort supports: created date, due date, priority, title (asc/desc).
- **Why:** Single source of truth for item filtering/sorting avoids duplication and ensures consistent behavior across view modes.
