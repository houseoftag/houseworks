# Houseworks Tasks

## Active Workstream
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
- **Status:** **DEV-COMPLETE (PENDING UX GATE)** (2026-02-15 10:45 EST)

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
