# Project Specification: "Houseworks" (Work Management Platform)

## 1. Executive Summary
**Goal:** Build a high-fidelity clone of the Monday.com board interface to track workflows (Post-Production, Show Tracking). The system prioritizes visual status tracking, team collaboration, and event-driven automation.

**Scope:** Project Management features only (Boards, Groups, Items, Automations). CRM features are out of scope.

---

## 2. Tech Stack Architecture
**Decision:** We are committing to the **T3 Stack** philosophy for type safety and speed, with a dedicated worker process for the heavy automation logic.

* **Frontend Framework:** Next.js 14+ (App Router)
* **Language:** TypeScript (Strict mode)
* **Styling:** TailwindCSS + Shadcn/UI (for clean, component-based UI)
* **State/Drag-and-Drop:** `@dnd-kit/core` (modern, accessible drag-and-drop)
* **Database:** PostgreSQL
* **ORM:** Prisma (for type-safe database access)
* **Authentication:** Auth.js (NextAuth) v5
* **Async/Queue System:** Redis + BullMQ (Required for handling Automations, Email Notifications, and Calendar Syncs)
* **Email Provider:** Resend or SendGrid

---

## 3. Database Schema Strategy
We will use a **PostgreSQL** relational database. To handle the flexible nature of "Columns" (where user can add any type of column to a board), we will use a **EAV (Entity-Attribute-Value) hybrid approach** using JSONB.

### Core Tables
1.  **Users:** `id`, `email`, `name`, `avatar_url`, `role` (ADMIN, MEMBER).
2.  **Boards:** `id`, `title`, `description`, `owner_id`, `created_at`.
3.  **Groups:** `id`, `board_id`, `title`, `color`, `position` (float for sorting).
4.  **Items:** `id`, `group_id`, `name`, `created_at`, `updated_at`, `position`.
5.  **Columns:** `id`, `board_id`, `title`, `type`, `settings` (JSONB), `position`.
    * *Note:* `settings` stores column-specific config (e.g., for Status columns: `{ "options": { "done": "green", "stuck": "red" } }`).
6.  **CellValues:** `id`, `item_id`, `column_id`, `value` (JSONB).
    * *Note:* Stores the actual data. `value` might be `"2024-01-01"` (date) or `{"label": "Done"}` (status).

---

## 4. Development Stages

### Stage 1: The Skeleton (MVP)
**Focus:** Core CRUD, Board Structure, and Visuals. No automation yet.

#### 1.1 Authentication & Team
* **Auth:** Email/Password login + Invite System.
* **Team Management View:** Admin table to list users and "Deactivate" access.

#### 1.2 The Board Interface
* **View:** Replicate the "Table View" from Monday.com.
* **Hierarchy:** Board -> Groups -> Items.
* **Interactions:**
    * Create/Delete Boards.
    * Collapse/Expand Groups.
    * **Drag & Drop:** Move Items between Groups; Reorder Groups; Reorder Columns.

#### 1.3 Core Column Types
Implement the rendering logic for these 4 distinct types:
1.  **Text:** Standard input.
2.  **Status:** A custom dropdown component.
    * *Features:* Editable labels and hex colors. Visual "progress bar" summary at the bottom of the group (e.g., "50% Done").
3.  **Person:** Dropdown selecting from the `Users` table. Displays Avatar.
4.  **Date:** Date picker. Visual flag if date is in the past (Red text).

---

### Stage 2: Collaboration & Advanced Data
**Focus:** Communication tools and expanding the board capabilities.

#### 2.1 Contextual Communication
* **Item Detail View:** Clicking an item opens a generic "Side Panel" (Drawer).
* **Updates Feed:** Inside the panel, a "Updates" tab.
* **Features:**
    * Rich Text Editor.
    * `@Mention` logic (filters user list).
    * **Read Receipts:** Track who opened the update.

#### 2.2 Notifications System
* **In-App:** A "Bell" icon in the sidebar showing unread notifications.
* **Email:** Trigger transactional emails via **BullMQ** worker.
* **Triggers:**
    * User is mentioned (`@user`).
    * User is assigned to an item (Person column change).

#### 2.3 Extended Column Types
1.  **Link:** Stores URL + Display Text.
2.  **Numbers:** Stores Integer/Float. Support Unit configuration ($, €, %, plain).
3.  **Timeline:** Stores `{ start: Date, end: Date }`. Renders a visual "pill" in the cell.

---

### Stage 3: The Automation Engine
**Focus:** The "Brain" of the app. This requires the Worker Service (Node.js/Redis).

#### 3.1 The Automation Builder
A logic builder UI where users create rules.
* **Structure:** `TRIGGER` -> `CONDITION` -> `ACTION`.
* **Supported Triggers:**
    * `WHEN Status Changes`
    * `WHEN Date Arrives`
    * `WHEN Item Created`
* **Supported Actions:**
    * `Move Item To Group`
    * `Notify [Person]`
    * `Create Item In Board [Name]`
    * `Set Column [Name] to [Value]`

#### 3.2 Google Calendar Two-Way Sync
* **Infrastructure:** OAuth2 connection to Google APIs.
* **Direction A (Import):**
    * Watch a specific GCal ID.
    * On `event.created` webhook -> Create Item in Board.
    * Map GCal fields (Title, Start, End, Desc) to Board Columns.
* **Direction B (Export):**
    * Watch Board Item changes.
    * If synced item changes Date/Title -> Update GCal Event.
* **Sync Logic:** Use `external_id` column on the Item table to store the Google Event ID to prevent duplicates.

---

## 5. API Routes & Endpoints Strategy
* `GET /api/boards/[id]`: Fetches board, groups, columns, and items (deeply nested) for initial render.
* `POST /api/items`: Create item.
* `PATCH /api/cells/update`: The most used endpoint. Optimistic UI updates on frontend, async save to DB.
    * *Payload:* `{ itemId, columnId, value }`
    * *Side Effect:* Pushes a job to **Redis** to check for Automation Triggers (e.g., "Did status change to Done?").

## 6. Implementation Order
1.  **Setup:** Next.js repo, Prisma init, Postgres DB setup.
2.  **Backend Core:** Define Schema, run migrations.
3.  **Frontend Core:** Auth pages + Board Layout (Sidebar + Main Area).
4.  **Feature:** Groups & Items CRUD.
5.  **Feature:** Columns engine (Dynamic rendering based on type).
6.  **Feature:** Drag and Drop.
7.  **Feature:** Cell Editing (Status/Date/Person).
8.  **Infra:** Redis/BullMQ setup.
9.  **Feature:** Notifications & Updates.
10. **Feature:** Automation Engine.
11. **Feature:** Google Integration.

## 7. Operational Details (Refined)

### 7.1 Worker Architecture
* **Location:** Inside the main Next.js repo (`src/worker/`).
* **Strategy:** Shares the `prisma` client with the web app.
* **Execution:** Runs as a separate process in production (`npm run worker`).
* **Tech:** BullMQ (Redis) for the queue; logic handles Cron jobs (GCal Sync) and Event triggers (Automations).

### 7.2 Communication Stack
* **Transactional Email:** **Resend** API.
* **Templating:** **React Email** (write emails as `.tsx` components).
* **Local Dev:** Mock the email sender to log to console in development to avoid API usage.

### 7.3 Tenancy & Auth Model
* **Hierarchy:** Workspace > Board > Group > Item.
* **Constraint:** For MVP, a User belongs to **one** Workspace.
* **Access Control:**
    * **Admins:** Can manage Workspace settings and all boards.
    * **Members:** Can create boards and edit items.
    * *Note:* All users in a workspace can see all public boards in that workspace (Open by default).

### 7.4 Coding Standards Update
* **File Naming:**
    * **Default:** `snake_case` (e.g., `user_card.tsx`, `date_helper.ts`).
    * **Exception:** Next.js App Router reserved files must remain `kebab-case` or specific names (`page.tsx`, `layout.tsx`, `global-error.tsx`).