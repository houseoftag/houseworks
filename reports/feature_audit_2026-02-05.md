# Tuesday — Feature/Function Audit Report

Date: 2026-02-05  
Scope: Intended features from `SPEC.md` + observed implementation in `src/` (UI, tRPC API, Prisma schema, worker).

## Executive Summary
- **Core app is present and mostly functional**: auth (credentials), workspaces, boards, groups, items, columns, cell editing, basic notifications, basic automations (limited), and a worker.
- **Several “Stage 2/3” features are only partially implemented or mismatch between UI/API/worker** (notably Automations action types and cross-group drag & drop in the main table).
- **Workspace creation error**: the UI toast is generic; server logs show at least one `workspaces.create` request returning **401 UNAUTHORIZED**, which points to a session/auth propagation issue or a user not actually being authenticated when the mutation fired.

## System Inventory (What exists)

### Frontend (Next.js App Router)
Pages:
- `/` — main workspace + board view (`src/app/page.tsx`)
- `/sign-in` — credentials + (disabled) magic link + placeholder OAuth (`src/app/sign-in/page.tsx`)
- `/sign-up` — creates user via `/api/auth/signup` then signs in (`src/app/sign-up/page.tsx`)
- `/invite/[token]` — accept invite and set password (`src/app/invite/[token]/page.tsx`)

Key UI components:
- Workspaces + invites UI: `src/app/_components/workspace_controls.tsx`, `src/app/_components/workspace_access.tsx`, `src/app/_components/sidebar.tsx`
- Board UI: `src/app/_components/board_table.tsx`, `src/app/_components/board_controls.tsx`, `src/app/_components/column_manager.tsx`, `src/app/_components/reorder_panel.tsx`
- Automations UI: `src/app/_components/automation_panel.tsx`
- Updates UI (item side panel): `src/app/_components/item_detail_panel.tsx`
- Notifications UI: `src/app/_components/notification_bell.tsx`
- API liveness indicator: `src/app/_components/health_status.tsx` (now backed by `/api/health`)

### Backend (tRPC + NextAuth + Prisma)
tRPC router: `src/server/api/root.ts`
- `health.ping` (public)
- `workspaces.*` (listMine, create, members, updateMemberRole, removeMember, getDefault)
- `boards.*` (getDefault, getById, listByWorkspace, create, update, delete)
- `groups.*` (create, update, delete, reorder)
- `items.*` (create, update, delete, reorder, getOne, createUpdate)
- `columns.*` (create, update, delete, reorder)
- `cells.update`
- `invites.*` (create, list, revoke, accept)
- `automations.*` (list, create, toggle, logs)
- `notifications.*` (getAll, getUnreadCount, markAsRead, markAllAsRead)

Auth:
- Credentials provider implemented (`src/server/auth.ts`)
- Resend provider **conditionally enabled** (disabled when `RESEND_API_KEY` is empty or placeholder)
- Middleware redirects non-auth users for non-API pages (`src/middleware.ts`)

Database:
- Full tenancy chain exists: Workspace → Board → Group → Item (+ Columns & CellValues) (`prisma/schema.prisma`)
- Automations + AutomationLogs exist
- Notifications + Updates exist

### Worker / Async
- BullMQ worker consumes queue `automation` (`src/worker/index.ts`)
- Enqueue points:
  - `cells.update` → `automationQueue.add('cell.updated', ...)` (`src/server/api/routers/cells.ts`)
  - `items.create` → `automationQueue.add('item.created', ...)` (`src/server/api/routers/items.ts`)

## Feature Matrix (Intended vs Actual)

Legend:
- ✅ Complete (works end-to-end)
- 🟡 Partial (works but limited / mismatched)
- 🔴 Missing (not implemented)
- ⚠️ Risk/Bug (present but likely broken or misleading)

### Stage 1 — Authentication & Team
- Credentials sign-in (email/password): ✅ (`src/server/auth.ts`, `src/app/sign-in/sign_in_form.tsx`)
- Sign-up: 🟡 (creates a user, but **does not** create a default workspace/board) (`src/app/api/auth/signup/route.ts`)
- Invite system (create/list/revoke/accept): ✅ (tRPC + invite accept page) (`src/server/api/routers/invites.ts`, `src/app/invite/[token]/*`)
- Team management (roles, remove member): ✅ for WorkspaceMember roles (`src/server/api/routers/workspaces.ts`, `src/app/_components/workspace_access.tsx`)
- “Deactivate user” admin view: 🔴 (no users admin router/UI found; no “deactivated” field in schema)
- Magic link email auth: 🟡 (UI exists, provider is gated; with placeholder `RESEND_API_KEY` this will fail) (`src/app/sign-in/sign_in_form.tsx`, `src/server/auth.ts`)
- OAuth (Google): 🔴 (explicitly “Coming Soon”)

### Stage 1 — Board Interface (Board → Groups → Items)
- Read board with nested groups/items/columns/cellValues: ✅ (`boards.getDefault`, `boards.getById`)
- Create/update/delete board: ✅ (`boards.create/update/delete` + UI in `BoardControls`)
- Create/update/delete group: ✅ (`groups.create/update/delete` + UI)
- Create/update/delete item: ✅ (`items.create/update/delete` + UI)
- Collapse/expand groups: ✅ (`BoardTable` state)
- Drag & drop:
  - Reorder columns: ✅ (`columns.reorder` + `BoardTable` DnD)
  - Reorder groups: ✅ (`groups.reorder` + `BoardTable` DnD)
  - Reorder items **within** a group: ✅ (`items.reorder` + `BoardTable` DnD)
  - Move items **between** groups: 🟡 **only implemented in** `ReorderPanel`, not in `BoardTable` (explicit TODO comment in `BoardTable`)

### Stage 1 — Column Types (Core + Extended)
Implemented rendering/editing in `BoardTable`:
- Text: ✅
- Status: ✅ (dropdown, color indicator)
- Person: ✅ (select user from workspace membership)
- Date: ✅ (date input + overdue styling)
- Link: 🟡 (UI editing exists; server does not validate shape)
- Number: 🟡 (UI editing exists; server does not validate numeric type; allows null)
- Timeline: 🟡 (UI editing exists; server does not validate shape)

Backend validation in `cells.update`:
- TEXT/STATUS/PERSON/DATE: ✅ validated (`src/server/api/routers/cells.ts`)
- LINK/NUMBER/TIMELINE: 🟡 accepted but **not validated** (risk of inconsistent JSON shapes)

Status options config:
- Status column settings editor: ✅ (`ColumnManager`, stored in `Column.settings`)
- Group header status summary bar: ✅ (`BoardTable`)

### Stage 2 — Collaboration & Advanced Data
- Item side panel: ✅ (`ItemDetailPanel`)
- Updates feed (plain text): ✅ (`items.getOne`, `items.createUpdate`)
- Rich text editor: 🔴
- @mentions: 🔴
- Read receipts: 🔴
- Real-time sync (websockets/polling for board data): 🔴 (only periodic polling for unread notifications)

### Stage 2 — Notifications
- In-app notifications UI: ✅ (`NotificationBell`)
- Unread count polling: ✅ (`notifications.getUnreadCount` every 10s)
- Mark as read / mark all as read: 🟡 (API supports both; UI only uses mark-as-read on click)
- Email notifications (BullMQ + provider): 🔴 (no worker email sender found; Resend auth provider ≠ notification delivery)
- Triggers:
  - Mention notification: 🔴
  - Assignment notification: 🟡/**ad-hoc** (worker emits a notification when an automation “sets status” and it finds a person cell; not tied to direct person assignment changes)

### Stage 3 — Automation Engine
Data model + UI + worker exist, but are currently **mismatched**:
- Persist automations in DB: ✅ (`Automation` model + `automations.*` routers)
- Automation builder UI (basic): 🟡 (`AutomationPanel` supports limited trigger/action combos)
- Triggers in API schema: 🟡 (`STATUS_CHANGED`, `ITEM_CREATED`, `DATE_ARRIVES` accepted by API schema)
- Triggers in worker: 🟡 (`STATUS_CHANGED`, `ITEM_CREATED` only; no scheduler for `DATE_ARRIVES`)
- Actions in API schema: 🟡 (`LOG`, `NOTIFY`, `MOVE_ITEM`, `CREATE_ITEM`, `SET_COLUMN`)
- Actions in worker: ⚠️ expects `LOG` and `SET_STATUS` (note naming mismatch)
- Action naming mismatch: ⚠️
  - UI uses `SET_STATUS`
  - Worker implements `SET_STATUS`
  - API schema does **not** accept `SET_STATUS` (expects `SET_COLUMN`)
  → Result: “Set status” automations likely fail creation unless using `LOG` only.

### Stage 3 — Google Calendar Sync
- 🔴 Missing (no OAuth flow, no sync jobs, no webhooks)

## Workspace Creation Error — Current Evidence
- UI mutation: `trpc.workspaces.create` in `src/app/_components/workspace_controls.tsx` shows a generic toast on failure (does not surface server error details).
- Server log evidence: `next-dev-3002.log` contains `POST /api/trpc/workspaces.create?batch=1 401 ...`, indicating the mutation ran without a valid session at least once.
- Likely causes (to confirm with a targeted repro + browser console):
  - User not actually authenticated when clicking (session expired / sign-in not completed).
  - Cookie/session not being sent for the tRPC request (host mismatch, browser context, or auth cookie issues).
  - Less likely: session exists but missing `user.id` (auth callbacks should set it; credentials authorize returns `id`).

## Priority Fixes (Stability/Correctness)
1. Automations action type alignment (UI/API/worker) to prevent silent broken “Set status” flows.
2. Implement cross-group item drag-and-drop in `BoardTable` (or clearly scope it to `ReorderPanel`).
3. Add server-side validation for LINK/NUMBER/TIMELINE shapes in `cells.update` (avoid inconsistent JSON).
4. Improve error surfacing in `WorkspaceControls` (include `error.message` in toast) and add a small server-side log for `workspaces.create` failures.

