# Houseworks Decisions

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
