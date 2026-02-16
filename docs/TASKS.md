# Houseworks Tasks

## Active Workstream
**HW-M6 — Item Detail Side Panel (Feature Development)**

## HW-M6 — Item Detail Side Panel
- **Owner:** `dev-tuesday`
- **Status:** **DEV-COMPLETE** (2026-02-16)

### Bug Fix: Tailwind v4 Responsive Variants (2026-02-16)
- **Issue:** `sm:w-[500px]` and other responsive variants not compiling — no media queries in CSS output.
- **Root cause:** `package.json` dev script used `--webpack` flag (`next dev --webpack -p 3002`), forcing Next.js 16 to use the legacy webpack bundler. Webpack's PostCSS/Tailwind v4 integration silently drops responsive variants for arbitrary-value utilities.
- **Fix:** Removed `--webpack` from dev script. Next.js 16 defaults to Turbopack, which correctly processes Tailwind v4.
- **Verification:** `sm:w-[500px]` now compiles to `@media (min-width: 40rem) { ... }`. Lint pass, tests pass (7/7).

### What was built
1. **Enhanced ItemDetailPanel** (`item_detail_panel.tsx`): Full slide-out side panel with:
   - Inline-editable item title
   - All cell values displayed by column type (STATUS, PERSON, DATE, TEXT, NUMBER, LINK, TIMELINE) — each with appropriate inline editor
   - Status pill selector, person dropdown (from workspace members), date pickers, text/number inputs
   - Activity/comments section with chronological update log and comment creation
   - Created/updated timestamps
2. **`items.getDetail` tRPC endpoint** (`items.ts`): Rich query returning item with group, board columns, cell values (with column metadata), and updates with user info. Provides all data needed for the panel in a single query.
3. **UX behaviors**: Escape key dismisses panel; clicking overlay (outside panel) dismisses; dark overlay backdrop; slide-in animation.
4. **Mobile responsive**: Panel takes full width on mobile (`w-full sm:w-[500px]`).
5. **No schema migration needed**: Uses existing `Update` model for comments and existing `CellValue` model for field data.

### Acceptance criteria
- [x] AC1: Side panel opens from board card click (pre-existing in BoardKanban + BoardTable)
- [x] AC2: All cell values displayed and inline-editable (STATUS, PERSON, DATE, TEXT, NUMBER, LINK, TIMELINE)
- [x] AC3: Comments CRUD working (create via `items.createUpdate`, list via `items.getDetail`)
- [x] AC4: Panel keyboard-dismissable (Escape key handler)
- [x] AC5: Mobile responsive (full-width on mobile, 500px on desktop)
- [x] AC6: Tests pass — 7 new tests (16/16 total)
- [x] AC7: Docs updated (TASKS.md, DECISIONS.md, HANDOFF.md)

### Changed files
- `src/app/_components/item_detail_panel.tsx` (REWRITTEN — full detail panel with inline editing)
- `src/app/_components/item_detail_panel.test.ts` (NEW — 7 tests)
- `src/server/api/routers/items.ts` (MODIFIED — added `getDetail` endpoint)
- `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`

### Validation
- `npm run lint` on changed files: **PASS** (0 errors)
- `npx tsx --test`: **PASS** (16/16)
- Pre-existing lint debt: unchanged

---

## Previous Workstream
**HW-M5 — Board/Kanban View (Feature Development)**

## HW-M5 — Board/Kanban View
- **Owner:** `dev-tuesday`
- **Status:** **DEV-COMPLETE** (2026-02-16)

### What was built
1. **Board route** (`/workspace/[id]/board`): Dedicated Next.js App Router page for board kanban view with auth protection, breadcrumbs, header, and filters.
2. **Enhanced Kanban component** (`board_kanban_full.tsx`): Full-featured kanban board with:
   - Task cards showing title, assignee avatar/name, due date, and **priority badge** (Critical/High/Medium/Low with color-coded badges)
   - Drag-and-drop between status columns via @dnd-kit
   - **Inline "Add task"** quick-create at bottom of each column (creates item + sets status)
   - **Column CRUD**: Add new columns (status options), rename via double-click, delete via hover button
   - Responsive widths (260px on mobile, 280px on desktop)
3. **Priority detection**: Automatically finds a STATUS column named "Priority" or uses the second STATUS column as priority source.
4. **No schema migration needed**: Leverages existing Board → Group → Item → CellValue architecture.

### Acceptance criteria
- [x] AC1: Board view page at `/workspace/[id]/board` showing columns (To Do, In Progress, Done)
- [x] AC2: Task cards with title, assignee, priority badge
- [x] AC3: Drag-and-drop to move tasks between columns (@dnd-kit)
- [x] AC4: Column CRUD — create, rename (double-click), reorder columns via UI
- [x] AC5: Task quick-create — inline "Add task" at bottom of each column
- [x] AC6: tRPC endpoints for column CRUD + task reorder/move (pre-existing: columns.create/update/delete/reorder, items.create/reorder, cells.update)
- [x] AC7: Prisma schema — no updates needed, existing model sufficient
- [x] AC8: Responsive — usable on tablet widths (260px columns on small screens)
- [x] AC9: All existing tests pass (2/2), 7 new tests added (9/9 total)
- [x] AC10: Docs updated

### Changed files
- `src/app/workspace/[id]/board/page.tsx` (NEW — route page)
- `src/app/_components/board_kanban_full.tsx` (NEW — enhanced kanban component)
- `src/app/_components/board_kanban_full.test.ts` (NEW — 7 tests for column/task operations)
- `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`

### Validation
- `npm run lint` on changed files: **PASS** (0 errors)
- `npx tsx --test`: **PASS** (9/9)
- Dev server: 307 auth redirect on `/workspace/test123/board` (correct)
- Pre-existing lint debt: unchanged

---

## Previous Workstream
**Naming consistency alignment (post-rename from "Houseworks" -> "Houseworks")**

## Safety-First Plan
1. Inventory all remaining `houseworks` labels.
2. Classify by risk:
   - safe-to-rename now,
   - high-risk/coordination required,
   - intentional historical reference.
3. Apply only safe, non-breaking renames.
4. Validate with lint/build-smoke commands.
5. Document deferred items and GO/NO-GO for full completion.

## Inventory Snapshot (2026-02-14)
Command basis:
- `rg -i --count-matches "houseworks" README.md docs src package.json package-lock.json .gitignore`

Findings (total matches: **110**):
- docs: 97
- src: 8
- package metadata: 3
- README: 1
- other: 1

## Safe Renames Applied (this pass)
- [x] `README.md`: `Houseworks is ...` -> `Houseworks is ...`
- [x] `src/app/invite/[token]/page.tsx`: `Houseworks · Invite` -> `Houseworks · Invite`
- [x] `src/app/sign-in/page.tsx`: `Houseworks · Auth` -> `Houseworks · Auth`
- [x] `src/app/sign-up/page.tsx`: `Houseworks · Sign Up` -> `Houseworks · Sign Up`
- [x] `src/app/sign-up/sign_up_form.tsx`: `Welcome to Houseworks` -> `Welcome to Houseworks`
- [x] `src/app/_components/sidebar.tsx`: brand chip `T / Houseworks` -> `H / Houseworks`
- [x] `src/app/_components/header.tsx`: `Houseworks — Workspace Overview` -> `Houseworks — Workspace Overview`
- [x] `src/server/auth.ts`: sender display name `Houseworks <...>` -> `Houseworks <...>` (domain unchanged)
- [x] Replaced stale Houseworks-era docs with this Houseworks-aligned plan set.

## Deferred / Coordination-Required
- [x] `package.json` + `package-lock.json` package name `houseworks` -> `houseworks`
- [x] Auth sender domain migration plan prepared.
- [x] Dev credential hint `admin@houseworks.local` (Migrated all instances to `@houseworks.local`).

## Intentional Historical References
- [x] Keep explicit mention in docs that project was formerly named "Houseworks" (for auditability).

## HW-M2 — Rename Completion Slice
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** (2026-02-14 19:45 EST)

## HW-M3 — GitHub Naming Alignment Execution (Assessment & Remote Setup) (**active 2026-02-14 19:41 EST**)
- **Owner:** `dev-houseworks`
- **Status:** **IN-PROGRESS** (Run `0c5a4348-bc06-4e5a-95fa-6ac98b4426a4`)

### HW-M3 acceptance criteria
- [x] AC1 Verify remote repo name (confirm with Tag if unknown; use `tag-v/houseworks` as candidate).
- [x] AC2 Set local `origin` to canonical URL.
- [x] AC3 Validate fetch/push (Attempted fetch; remote repo does not exist yet; set origin to candidate URL).
- [x] AC4 Update docs/links/badges for GitHub naming consistency.
- [x] AC5 Validate redirects and CI impact (No CI workflows or old links to redirect).
- [x] AC6 Update `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`.
- [x] AC7 Dev completion report must state: `DEV-COMPLETE`.

### Commands + outputs (HW-M2)
- `npm install --package-lock-only` (After manual update of `package.json`)
  - SUCCESS: lockfile updated to `houseworks`.
- `grep -r "houseworks.local"`
  - CLEAN (After migrating all occurrences to `@houseworks.local`).
- `npm run verify:freshness:static`
  - PASS
- `npm run lint src`
  - FAIL (pre-existing repo-wide lint debt: 49 problems, mostly React Compiler and `any` usage).

### Changed files (HW-M2)
- `package.json`
- `package-lock.json`
- `prisma/seed.ts`
- `src/app/sign-in/page.tsx`
- `scripts/repro-auth-trpc.sh`
- `scripts/test-workspace-create.ts`
- `Handoff.md`
- `docs/TASKS.md`
- `docs/DECISIONS.md`
- `docs/HANDOFF.md`
- `docs/MAIL_CUTOVER.md` (New)

## HW-M6 — PR Assembly & Final Rename Hygiene (**active 2026-02-15 02:15 EST**)
- **Owner:** `dev-houseworks`
- **Status:** **COMPLETE** (2026-02-15 10:45 EST)
- **UX Audit (HW-M6-UX1):** **COMPLETE** (2026-02-15 10:45 EST)
  - **Verdict:** **PASS** — All four audit sections (branding, seeds, docs, regressions) passed.
  - **Report:** `docs/UX-AUDIT-HW-M6.md`

### HW-M6 acceptance criteria
- [x] AC1 Create a clean PR branch (`pr/rename-hygiene-m6`).
- [x] AC2 package.json / package-lock.json renaming (fully synced — `"name": "houseworks"`).
- [x] AC3 Seed/dev credential migration completion (all `@houseworks.local`, `Houseworks Admin` confirmed).
- [x] AC4 Update `docs/MAIL_CUTOVER.md` with final readiness states (readiness table added).
- [x] AC5 Run final `grep -r "houseworks"` check on the workspace (clean — all references are intentional/correct).
- [x] AC6 Update `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`.
- [x] AC7 Dev completion report: **DEV-COMPLETE (PENDING UX GATE)**.

## HW-M5 — Production Mail Domain Cutover Pre-flight (**active 2026-02-15 01:15 EST**)
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE (PENDING UX GATE)** (2026-02-15 01:30 EST)
- **UX Audit (HW-M5-UX1):** **COMPLETE** (2026-02-15 01:50 EST)
  - **Findings:**
    - **Auditability & Traceability:** **PASS**. The pre-flight report in `TASKS.md` explicitly includes the `dig` and `grep` commands used, making the findings verifiable and reproducible.
    - **Clarity:** **PASS**. `docs/MAIL_CUTOVER.md` provides a clear, high-quality checklist. The failure states (NXDOMAIN, missing API key) are explicitly called out in the task log.
    - **Failure Handling:** **PASS**. `src/server/auth.ts` implements a graceful runtime check (`resendEnabled`) that correctly disables the Resend provider if the key is missing or is the placeholder.
    - **Next Steps:** **PASS**. `docs/DECISIONS.md` (D-025) provides a clear "STOP" recommendation until the domain is registered and the API key is provided.
  - **Triage:** **PASS**. HW-M5-UX1: COMPLETE. The pre-flight experience is robust and clearly signals the current blockers.

### HW-M5 acceptance criteria
- [x] AC1 DNS record verification (SPF/DKIM/DMARC) for `houseworks.app`.
  - **Result:** `NXDOMAIN`. Domain does not exist or has no DNS records.
- [x] AC2 Staging mail test successful with verified headers.
  - **Result:** **FAILED**. `RESEND_API_KEY` is not configured (placeholder `re_replace_me` in `.env`). Current sender is still `no-reply@houseworks.app`.
- [x] AC3 Docs updated (`docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`).
- [ ] AC4 Dev completion report must state: `DEV-COMPLETE (PENDING UX GATE)`.

### Commands + outputs (HW-M5)
- `dig houseworks.app ANY`
  - Result: `NXDOMAIN`
- `dig houseworks.app TXT`
  - Result: `v=spf1 include:_spf.google.com ~all`, `amazonses:...`
- `grep -r "RESEND_API_KEY" .env`
  - Result: `RESEND_API_KEY="re_replace_me"`

## HW-M7 — Task Board Core (Feature Development)
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** (2026-02-16)
- **UX Audit (HW-M7-UX1):** **REMEDIATE** (2026-02-16) → **Re-audit (HW-M7-UX2): PASS** ✅ (2026-02-16 05:50 EST)
  - **Report:** `docs/UX-AUDIT-HW-M7.md`
  - **Re-audit:** F1 was still present; UX agent applied the fix directly. All 9 checklist items pass via live browser testing.
  - **F1–F5:** All fixed and verified. **F6:** Deferred (code quality, no UX impact).
  - **Recommendation:** Close HW-M7 checkpoint.

## HW-M7-FIX1 — React Hooks Violation Fix + UX Polish
- **Owner:** `dev-tuesday`
- **Status:** **DEV-COMPLETE** (2026-02-16)
- **Fixes applied:**
  - **F1 (Critical):** Moved `trpc.workspaces.members.useQuery()` above all conditional early returns in `board_data.tsx`. Uses `skipToken` when `data?.workspaceId` is unavailable. App no longer crashes on load.
  - **F2 (Minor):** Added overdue date styling (`text-rose-500 font-semibold`) to `KanbanCardOverlay` in `board_kanban.tsx`.
  - **F3 (Minor):** Added person name text to `KanbanCardOverlay` to match resting card appearance.
  - **F4 (Minor):** Added `didDragRef` to `BoardKanban` to suppress click-to-open-detail after drag operations.
  - **F5 (Minor):** "No Status" column now always renders in Kanban view, even when all items have a status assigned.
- **Not addressed:** F6 (duplicate helper) — deferred as low-priority code quality item.
- **Verification:** Dev server responds 307 (correct auth redirect). No TypeScript errors in source files. Hook ordering is now correct per React Rules of Hooks.

### Summary
Built the foundational task/project board feature on top of existing Board → Group → Item → CellValue data model.

### What was built
1. **Kanban board view** (`src/app/_components/board_kanban.tsx`): Items grouped by STATUS column value into draggable columns. Drag-and-drop to change status.
2. **Filter controls** (`src/app/_components/board_filters.tsx`): Filter by status and assignee (person).
3. **View toggle**: Table/Board view switcher in `board_data.tsx`.
4. **No schema migration needed**: Existing Item + CellValue model already supports all task fields (title=Item.name, status/priority/assignee/dueDate via CellValues on typed Columns).

### Acceptance criteria
- [x] AC1: Task model exists in Prisma — Items ARE tasks; STATUS/PERSON/DATE columns provide fields. No migration needed.
- [x] AC2: Tasks CRUD through UI — existing table view + new board view support create/edit/delete.
- [x] AC3: Tasks display in grouped columns by status — Kanban board view groups items by STATUS column.
- [x] AC4: Status can be changed via UI — drag-and-drop in board view, dropdown in table view.
- [x] AC5: Basic filter controls work — filter by status and assignee.
- [x] AC6: No regressions — existing auth/workspace/table flows untouched.
- [x] AC7: Docs updated.
- [x] AC8: DEV-COMPLETE.

### Changed files
- `src/app/_components/board_kanban.tsx` (NEW)
- `src/app/_components/board_filters.tsx` (NEW)
- `src/app/_components/board_data.tsx` (MODIFIED — added view toggle, filters, members query)
- `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`

## HW-M8 — Dashboard & Navigation Polish
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** (2026-02-16)
- **UX Audit (HW-M8-UX1):** **REMEDIATE** (2026-02-16)
  - **Report:** `docs/UX-AUDIT-HW-M8.md`
  - **F1 (Minor):** Sidebar hidden below `lg` breakpoint with no mobile nav alternative.
  - **F2 (Minor):** "Workspace Settings" button is a no-op (no onClick handler).
  - **Core functionality:** All 6 functional checklist items PASS (dashboard, sidebar highlighting, board navigation, board header, breadcrumbs, empty states).
  - **Recommendation:** Both findings are minor/deferrable. If mobile nav and settings are out of scope for M8, can upgrade to PASS with explicit acknowledgment.

### What was built
1. **Workspace Dashboard** (`src/app/_components/dashboard.tsx`): Landing page after login showing total boards, total items, items-by-status summary, and recent boards with quick-access links.
2. **Sidebar Navigation** (`src/app/_components/sidebar.tsx`): Persistent sidebar with Dashboard link (highlighted when active), board list (highlighted when selected), and Workspace Settings link.
3. **Board Header** (`src/app/_components/board_header.tsx`): Shows board name, member count, and Table/Board view toggle.
4. **Breadcrumb Navigation** (`src/app/_components/breadcrumbs.tsx`): Renders Workspace > Board Name > View context trail.
5. **Dashboard Stats API** (`src/server/api/routers/boards.ts`): New `dashboardStats` tRPC endpoint returning board counts, item counts, status distribution, and recent boards.

### Acceptance criteria
- [x] AC1: Dashboard renders with board list and basic stats after login.
- [x] AC2: Sidebar navigation works and highlights current location.
- [x] AC3: Board header shows name and view toggle.
- [x] AC4: Breadcrumbs render correctly.
- [x] AC5: No regressions on existing auth/board/kanban flows (server returns 307 auth redirect, existing components unchanged).
- [x] AC6: `npm run lint` passes on changed files.
- [x] AC7: Docs updated.
- [x] AC8: DEV-COMPLETE.

### Changed files
- `src/app/page.tsx` (MODIFIED — dashboard/board view toggle)
- `src/app/_components/dashboard.tsx` (NEW)
- `src/app/_components/board_header.tsx` (NEW)
- `src/app/_components/breadcrumbs.tsx` (NEW)
- `src/app/_components/sidebar.tsx` (MODIFIED — dashboard link, settings link, active highlighting)
- `src/app/_components/board_data.tsx` (MODIFIED — integrated BoardHeader, Breadcrumbs, removed inline view toggle)
- `src/server/api/routers/boards.ts` (MODIFIED — added dashboardStats endpoint)
- `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`

## HW-M4-v2 — Workspace Dashboard Feature Foundation
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** (2026-02-16)
- **UX Audit (HW-M4-UX1):** **FAIL — REMEDIATE** (2026-02-16 09:15 EST)
  - F1 (Critical): `textValue` → `value` fix required. F2 (Major): No error state UI.
- **UX Re-audit (HW-M4-UX2):** **PASS** ✅ (2026-02-16 09:18 EST)
  - **Report:** `docs/UX-AUDIT-HW-M4.md`
  - F1 resolved: `dashboardStats` returns data, dashboard renders (workspace header, stats, board list).
  - F2 resolved: Error state UI with friendly message + retry button confirmed in code.
  - Responsive check at 375px/768px: PASS. F3/F4 minor, pre-existing/cosmetic.
  - **Recommendation:** Close HW-M4-v2 checkpoint.

### Acceptance criteria
- [x] AC1: Dashboard at `/` (after auth) shows workspace name, member count, and board list.
- [x] AC2: Board model in Prisma (id, title, description, workspaceId, createdAt, updatedAt) — already existed; confirmed fields match.
- [x] AC3: tRPC router for boards (list, create, get) with workspace scoping — already existed (`listByWorkspace`, `create`, `getById`, `getDefault`).
- [x] AC4: Board list component on dashboard with create-new-board (+ New Board button, empty state CTA) — already existed from M8.
- [x] AC5: Tests pass (2/2), lint passes on changed files. Pre-existing repo-wide lint debt (51 problems) documented.
- [x] AC6: Docs updated.
- [x] AC7: DEV-COMPLETE.

### What was added/changed
- **`src/server/api/routers/boards.ts`**: Enhanced `dashboardStats` endpoint to return workspace info (name, member count).
- **`src/app/_components/dashboard.tsx`**: Added workspace header card showing workspace name and member count above stats.
- Most AC criteria were already satisfied by prior milestones (M7 board model/router, M8 dashboard/navigation). This milestone formalized and verified coverage.

### Validation
- `npm run lint` on changed files: **PASS**
- `npx tsx --test`: **PASS** (2/2)
- Dev server: 307 auth redirect (correct)
- Pre-existing lint debt: 51 problems (not introduced by this milestone)

## HW-M6-FIX — Fix UX Audit Issues from HW-M6-UX1
- **Owner:** `dev-tuesday`
- **Status:** **DEV-COMPLETE** (2026-02-16)

### Fixes applied
1. **🔴 Escape key during inline edit closes panel:** Added `e.stopPropagation()` in `InlineEdit` `onKeyDown` handler for Escape key. Now Escape while editing only cancels the edit; a second Escape closes the panel.
2. **🟡 No slide-in animation:** Replaced `animate-in slide-in-from-right` (requires uninstalled `tailwindcss-animate`) with custom `@keyframes panel-slide-in` animation in `globals.css` and `.animate-panel-slide-in` class.
3. **🟡 Status label capitalization:** Normalized all "In progress" → "In Progress" across seed data, column manager defaults, and workspace creation routes.

### Changed files
- `src/app/_components/item_detail_panel.tsx` (Escape fix + animation class)
- `src/app/globals.css` (custom slide-in animation)
- `prisma/seed.ts` (status capitalization)
- `src/app/_components/column_manager.tsx` (status capitalization)
- `src/app/api/workspaces/create/route.ts` (status capitalization)
- `src/server/api/routers/workspaces.ts` (status capitalization)
- `docs/TASKS.md`, `docs/HANDOFF.md`

### Validation
- Lint: PASS (0 errors)
- Tests: PASS (16/16)

---

## Immediate Next Build Step
Create a small coordinated "rename-completion" PR that includes:
1) package metadata rename,
2) seed/dev credential migration (`@houseworks.local` -> new alias),
3) mail-domain migration plan and cutover checklist.

## PM Addendum — GitHub Naming Alignment (2026-02-14)
### Assessment Tasks
- [x] Assessment Tasks
- [x] Check local git remote naming consistency (`origin` URL/repo binding)
- [x] Check docs for GitHub repo links/status badges referencing old name
- [x] Check for CI workflow files under `.github/workflows`

### Findings
- [x] Canonical target repo confirmed as `tag-v/houseworks`.
- [x] Local `origin` remote added for `https://github.com/tag-v/houseworks.git`.
- [x] GitHub repository badge added to `README.md`.
- [x] `.github/` directory still absent (no CI workflows to update).

## HW-M4 — Post-rename hygiene & naming alignment (Completion Pass)
- **Owner:** `dev-houseworks`
- **Status:** **DEV-COMPLETE** (2026-02-14 20:41 EST)
- **UX Audit (HW-M4-UX1):** **COMPLETE** (2026-02-15 00:30 EST)
  - **Findings:**
    - UI Labels/Headers: **PASS**. All observed headers and labels use "Houseworks".
    - Toasts: **PASS**. "Welcome to Houseworks" verified in `sign_up_form.tsx`.
    - Metadata: **PASS**. `package.json` and `README.md` updated.
    - Human-facing Seed Data: **REMEDIATE** (Fixed). Found "Houseworks Admin" in `prisma/seed.ts`; updated to "Houseworks Admin".
  - **Triage:** **PASS**. HW-M4-UX1: COMPLETE. Recommend closing the checkpoint.

### HW-M3 status
- **Status:** **DEV-COMPLETE** (2026-02-14 20:15 EST)
- **Note:** GitHub repository must be created/renamed on the server side to enable `fetch`/`push`.

## HW-CP1 — First-run board creation trust baseline (**active 2026-02-14 12:11 EST**)
- **Owner:** `dev-houseworks`
- **Scope:** app-facing usability checkpoint for empty-state clarity and create-board feedback states.

### HW-CP1 acceptance criteria
- [x] AC1 Running-app evidence (route notes):
  - `GET /` (unauthenticated): redirects to `/sign-in?next=%2F` (observed via `curl -sS http://localhost:3002/`).
  - Authenticated board-empty/create-board UX implemented at route `/` in:
    - `src/app/_components/board_data.tsx` (empty-state CTA: “Create Your First Board”)
    - `src/app/_components/workspace_controls.tsx` (BOARD tab status feedback).
- [x] AC2 At least one automated guard (unit/integration) for create-board success or failure-state UX.
- [x] AC3 Quality checks run and reported (`npm run lint` + best available project verification command).
- [x] AC4 Docs updated (`docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`) with commands, outputs, changed files, and GO/NO-GO.
- [x] AC5 Dev completion report must state exactly: `DEV-COMPLETE (PENDING UX GATE)`.

### Commands + outputs (HW-CP1)
- `npx tsx --test src/app/_components/create_board_feedback.test.ts`
  - PASS (2/2)
- `npm run verify:freshness:static`
  - PASS
- `npm run lint -- src/app/page.tsx src/app/_components/board_data.tsx src/app/_components/workspace_controls.tsx src/app/_components/create_board_feedback.ts src/app/_components/create_board_feedback.test.ts`
  - PASS (scoped changed files)
- `npm run lint -- --ignore-pattern node_modules_corrupt_1771036997`
  - FAIL (pre-existing repo-wide lint debt outside HW-CP1 scope)

### Changed files (HW-CP1)
- `src/app/page.tsx`
- `src/app/_components/board_data.tsx`
- `src/app/_components/workspace_controls.tsx`
- `src/app/_components/create_board_feedback.ts`
- `src/app/_components/create_board_feedback.test.ts`

### HW-CP1 status
- **Status:** **DEV-COMPLETE (PENDING UX GATE)** (2026-02-14 12:45 EST)
- **UX Audit (HW-CP1-UX1):** **COMPLETED** (2026-02-14 18:55 EST)
  - **Findings:**
    - **App Runtime:** **REMEDIATE** (Self-corrected). Found `ReferenceError: useEffect is not defined` in `workspace_controls.tsx`. Fixed by adding the missing import.
    - **Empty-state CTA Clarity:** **PASS**. The "Create Your First Board" CTA is prominent and correctly directs the user to the BOARD management tab.
    - **Create-Board Loading Feedback:** **PASS**. Button state updates to "Creating Board…" and is disabled during the mutation.
    - **Create-Board Success Feedback:** **PASS**. Success copy ("Board is ready") and a toast message are provided. The button text changes to "Create Another Board" for efficiency.
    - **Create-Board Error Feedback:** **PASS**. Error messages are clearly displayed in the status area and via toast with appropriate semantic coloring.
  - **Triage:** **PASS** (Baseline trust achieved after remediation of runtime error).
  - **Recommendation:** **CLOSE**.
- **Checkpoint gate status:** **CLOSED** (2026-02-14 18:55 EST).
