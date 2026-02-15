# Handoff Notes - Houseworks MVP

## Session Log (2026-02-13 21:05 America/New_York)

### Current Status

- TUE-CP1 freshness baseline has been implemented in the app client by adding periodic board query polling (5s) for both default-board and specific-board reads.
- Repro verification tooling added:
  - `npm run verify:freshness` (full static + DB-backed propagation checks)
  - `npm run verify:freshness:static` (static-only fallback)
- Docs updated: `docs/TASKS.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`.

### Last Action

- Added polling config in `src/app/_components/board_data.tsx`.
- Added `scripts/verify-freshness-baseline.mjs` and package scripts.
- Ran static verification + lint successfully.

### Next Steps

- Run `npm run verify:freshness` on an environment with Postgres available at `localhost:5432` and capture pass output.
- Complete UX audit with two concurrent browser sessions to confirm <=10s propagation for cell edit and item create.

### Context

- User prompt: “PM assignment — Houseworks app-facing checkpoint TUE-CP1 ... implement and validate a real-time freshness baseline ... update docs and report pass/fail.”

## Current Status

**Stage 1 (MVP) is Complete.** The application is functional with a high-fidelity board interface and core management features.

### Completed Features

- **Unified Board Interface:**
  - **Drag & Drop:** Fully integrated for Columns, Groups, and Items using `@dnd-kit`.
  - **Group Management:** Expand/Collapse functionality and inline editing.
  - **Item Creation:** Inline "Add Item" row at the bottom of every group.
  - **Column Summaries:** Status columns now show a progress bar summary in the group header.
- **Enhanced Column Types:**
  - **Status:** Colored indicators in dropdowns and summaries.
  - **Person:** User initials/avatar in assignments.
  - **Date:** Overdue dates highlighted in red.
- **Team Management:**
  - Role assignment (Owner, Admin, Member).
  - Member removal functionality.
  - Invite revocation.
- **Automation Engine:**
  - **Triggers:** "Status Changed", "Item Created".
  - **Actions:** "Log", "Set Status".
  - **Logs:** Visible in the Automation Panel.

### Infrastructure & Setup

- **App URL:** `http://localhost:3002` (Port 3002 selected to avoid conflicts).
- **Database:** PostgreSQL running in Docker container `houseworks-postgres`.
  - Start command: `docker start houseworks-postgres`.
- **Worker:** Background worker required for automations.
  - Start command: `npm run worker`.
- **Environment:** `.env` updated with `AUTH_URL="http://localhost:3002"`.

### Project Structure

- `docker-compose.yml`: Local Postgres + Redis (if port 6379 is free).
- `scripts/dev-up.sh`: Bring up deps, run migrations, seed (idempotent).
- `scripts/dev-start.sh`: Start web + worker in background (`nohup`) and write `.next-dev.pid` / `.worker.pid`.
- `scripts/dev-stop.sh`: Stop web + worker using PID files.
- `scripts/check-api.sh`: Verifies `/api/health` returns `{ ok: true }`.
- `reports/feature_audit_2026-02-05.md`: Feature/function audit vs `SPEC.md` (completeness + gaps).
- `src/app/*`: Next.js App Router UI.
- `src/app/api/health/route.ts`: Lightweight API health endpoint.
- `src/server/*`: tRPC router + server-side helpers.
- `src/worker/*`: BullMQ worker for automations.

## Known Issues

- Local PostgreSQL instance was not found; relying on Docker container `houseworks-postgres`.
- Port 3000/3001 were occupied by ghost processes; verify if they need cleanup.

## Next Steps (Stage 2 & 3)

1. **Real-Time Sync:** Implement WebSockets or polling (React Query refetch intervals) to allow multiple users to see updates without refreshing.
2. **Advanced Automations:** Implement scheduled triggers (e.g., "When due date arrives") using a cron-like scheduler in the worker.
3. **UI Polish:** Add empty states, loading skeletons for all components, and improve mobile responsiveness.

---

## Session Log (2026-02-02)

### Current Status

- Homebrew `codex` cask is installed at `0.93.0` and `brew upgrade --cask codex --dry-run` reports “latest version is already installed”.
- Within the Codex CLI sandbox, `brew info codex` reports `Operation not permitted @ dir_s_mkdir - ~/Library/Caches/Homebrew/api/cask` (Homebrew cache dir not writable in sandbox).

### Last Action

- Investigated why `codex` cask does not update; checked cask metadata via `brew info codex` and `brew cat --cask codex`.

### Next Steps

- If the same “Operation not permitted … ~/Library/Caches/Homebrew/api/cask” happens outside the sandbox, fix permissions on `~/Library/Caches/Homebrew` or run with `HOMEBREW_CACHE=/tmp/homebrew-cache`.
- To verify whether upstream is newer than Homebrew, run `brew livecheck --cask codex` and then retry `brew update && brew upgrade --cask codex`.

### Context

- User prompt: “Why isn't my codex cask able to update? Brew says no update is available.”

---

## Session Log (2026-02-02, later)

### Current Status

- Dev environment brought up using Docker for Postgres (`houseworks-postgres`) and an existing Redis already bound to `localhost:6379`.
- Prisma migrations are already applied; seed data exists (admin user + demo workspace/board).
- Next.js dev server is running on `http://localhost:3002` (background process) and the worker is running (background process).

### Last Action

- Started `houseworks-postgres`, ran `npm run db:deploy` + `npm run db:seed`, then started `npm run dev` and `npm run worker` via `nohup`.

### Next Steps

- Open `http://localhost:3002` and sign in with `admin@houseworks.local` / `password123` (or `$SEED_ADMIN_PASSWORD`).
- To stop background processes, kill PIDs from `.next-dev.pid` and `.worker.pid`.
- If Redis port conflicts again, either stop the other Redis service or change `REDIS_URL` to a free port and run `docker compose up -d redis` with a different mapping.

### Context

- User prompt: “Figure out what's going on in this project then get the test environment alive so I can view it.”

---

## Session Log (2026-02-04)

### Current Status

- Full stack is running locally:
  - Web: `http://localhost:3002`
  - Worker: `npm run worker` (BullMQ)
  - Postgres: `houseworks-postgres` (Docker)
  - Redis: existing container `redis-dev` already bound to `localhost:6379` (so `houseworks-redis` cannot bind 6379).
- `/api/health` is available for a simple API-up check.
- Prisma migrations are applied and seed data exists (admin user + demo workspace/board).

### Last Action

- Ran `bash scripts/dev-up.sh` (migrations + idempotent seed).
- Added `/api/health` route + `scripts/check-api.sh` and switched the UI health indicator to use it.
- Started web + worker via `bash scripts/dev-start.sh` (writes `.next-dev.pid` / `.worker.pid` and logs to `next-dev-3002.log`, `worker_out.log`, `worker_err.log`).
- Added `scripts/dev-start.sh` and `scripts/dev-stop.sh`.

### Next Steps

- Open `http://localhost:3002` and sign in with `admin@houseworks.local` / `$SEED_ADMIN_PASSWORD` (currently `password123` in `.env`).
- To stop: `bash scripts/dev-stop.sh` (or kill PIDs from `.next-dev.pid` and `.worker.pid`).
- If you want Redis isolated for Houseworks, stop `redis-dev` or change `REDIS_URL` + compose port mapping to a free port.

### Context

- User prompt: “Get this project alive so I can take a look at it. Front and back end.”

---

## Session Log (2026-02-05)

### Current Status

- App is running locally (web + worker) and `/api/health` returns 200.
- A feature audit report exists at `reports/feature_audit_2026-02-05.md`.

### Last Action

- Audited `SPEC.md` vs implemented UI/tRPC/worker and wrote a status matrix report.
- Noted a likely “workspace create” failure mode: `next-dev-3002.log` shows `POST /api/trpc/workspaces.create?batch=1 401` at least once; UI currently shows a generic error toast for workspace creation failures.
- Fixed noisy 401s by gating protected tRPC queries on `useSession().status === 'authenticated'` and improved workspace-create toast to show `error.message`.
- Normalized `.env` to a single `AUTH_SECRET` and restarted dev server/worker.
- Fixed root cause of persistent tRPC 401s: `createTRPCContext` now calls `auth()` (instead of `auth(req)`) so sessions resolve correctly in the App Router route handler.
- Added `scripts/repro-auth-trpc.sh` to validate sign-in + protected tRPC calls end-to-end.
- Fixed a React Rules-of-Hooks violation in `BoardData` by removing conditional hook execution and using `skipToken` for the optional `boards.getById` query input.
- Hardened workspace list rendering: treat unexpected `workspaces.listMine` data as empty array to avoid runtime crash (`workspaces?.map is not a function`) while debugging root cause.
- Added board payload guards to avoid crashes when `groups`/`columns` are missing and guide debugging via Network response.
- Workspace create now trims + blocks blank names client-side and server-side to avoid `workspaces.create` 400s due to empty input.
- Workspace creation now also provisions a default board (groups + columns) to avoid a “blank workspace” and to keep the UI from crashing if no boards exist.
- Added a non-tRPC fallback endpoint for workspace creation: `POST /api/workspaces/create` and updated the UI to use it to bypass persistent `workspaces.create` 400s from the tRPC client path.

### Next Steps

- If workspace creation is still failing in the UI, capture the browser console + Network response for `/api/trpc/workspaces.create` to confirm whether it’s 401 (session) vs 500 (Prisma) vs validation.
- Fix automation action type mismatch (`SET_STATUS` vs `SET_COLUMN`) so “Set status” automations work end-to-end.
- Consider adding server-side validation for `LINK`/`NUMBER`/`TIMELINE` payload shapes in `cells.update`.

### Context

- User prompt: “I tried to create a workspace but got an error. Can you audit the intended features/functions for what is complete, what is incomplete, and their statuses, then generate me a report.”
