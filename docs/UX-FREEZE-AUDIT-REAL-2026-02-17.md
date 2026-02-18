# UX Quality Freeze — Full Browser Audit

**Date:** 2026-02-17 22:44 EST  
**Auditor:** OpenClaw automated browser audit  
**App URL:** http://localhost:3002  
**Auth:** DEV_BYPASS_AUTH=true (admin@houseworks.local)

---

## Results Summary

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Dashboard loads with boards list | **PASS** ✅ | "Show Tracking" board visible, stats cards render (1 board, 3→5 items after test), status breakdown works |
| 2 | "New Board" button works | **FAIL** 🔴 | Both "+ New Board" buttons (header and boards section) navigate to `/settings` instead of creating a board |
| 3 | Board → columns/items render | **PASS** ✅ | Table view loads with 2 groups ("In Edit", "Ready for Delivery"), items render with status/person/date columns. No crash. Prior board_filters.tsx:176 crash appears fixed |
| 4 | Create new item → appears in column | **PASS** ✅ | Typed "Audit Test Item" in "+ Add Item" field, pressed Enter, item appeared in "In Edit" group |
| 5 | Drag item between columns | **SKIP** ⚠️ | Drag handles (⠿) present on all items, groups, and columns. Cannot physically test drag-and-drop via automated browser. Infrastructure exists |
| 6 | Click item → detail panel opens | **PASS** ✅ | "Open" button opens right-side detail panel with: title, fields (Status, Person, Date), Repeat, Dependencies, Attachments, Activity & Comments |
| 7 | Edit item title → persists after refresh | **PASS** ✅ | Renamed "Audit Test Item" → "Renamed Audit Item" in detail panel, refreshed page, title persisted. Activity feed shows edit event |
| 8 | Search (⌘K) → results appear | **PASS** ✅ | Search dialog opens, typed "Trailer", got result "Trailer v2" with board/group context. **Bug:** `[object Object]` renders in search result metadata |
| 9 | Notifications bell → opens | **PASS** ✅ | Notifications dropdown opens showing "No notifications yet" with 🔔 icon |
| 10 | Settings → all 3 tabs load | **PASS** ✅ | Workspace tab: create/rename/delete workspace. Team tab: members list, invite form. Boards tab: board list with rename/delete |
| 11 | Keyboard shortcuts overlay | **PASS** ✅ | Pressing "?" opens full overlay: Global (⌘N, ⌘K, ?), Navigation (Esc), Board Table View (↑↓←→, ↵, Esc), Editing (⌘Z, ⌘⇧Z, ⇧Click) |
| 12 | File attachment upload | **SKIP** ⚠️ | "Attach file" button present in detail panel with drop zone ("Max 10 MB · Images, PDFs, documents"). Cannot test actual upload via automation |
| 13 | Mobile viewport 375px → no overlap/clipping | **FAIL** 🔴 | Notifications dropdown overlaps main content area. Workspace header text is clipped. "Post-Production" heading partially hidden behind notification panel |
| 14 | All nav links work | **PASS** ✅ | Dashboard ✓, Activity (sidebar + tab) ✓, Settings ✓, Post-Production workspace ✓, "Back to dashboard" from settings ✓ |

---

## Score: 10 PASS / 2 FAIL / 2 SKIP

---

## Critical Bugs Found

### 🔴 BUG-1: "New Board" buttons navigate to Settings (REGRESSION)
- **Severity:** High — core feature broken
- **Location:** Both `+ New Board` buttons on dashboard (header action bar + boards section)
- **Expected:** Open a "create board" dialog or form
- **Actual:** Navigates to `/settings` page (Workspace tab)
- **Repro:** Click either "+ New Board" button on dashboard

### 🔴 BUG-2: Mobile viewport overlap/clipping (375px)
- **Severity:** Medium — mobile unusable in current state
- **Location:** Dashboard at 375px width
- **Expected:** Responsive layout, no overlapping elements
- **Actual:** Notifications dropdown overlaps main content; workspace header text clipped behind sidebar/notification panel
- **Screenshot:** Captured during audit

### 🟡 BUG-3: `[object Object]` in search results
- **Severity:** Low — cosmetic but unprofessional
- **Location:** Search dialog (⌘K) → result metadata area
- **Expected:** Formatted person/assignee name
- **Actual:** Shows literal `[object Object]` string after board/group path
- **Repro:** Open search, type any item name, observe result row metadata

### 🟡 BUG-4: Double item creation on Enter
- **Severity:** Low-Medium — data integrity
- **Location:** "+ Add Item" textbox in board table view
- **Expected:** Single item created on Enter
- **Actual:** Two identical items created (observed "Audit Test Item" appearing twice after single Enter press)
- **Repro:** Type item name in "+ Add Item" field, press Enter

---

## What's Working Well

- ✅ Auth bypass functions correctly — no sign-in friction
- ✅ Board table view is feature-rich: filters, sorts, inline editing, group management
- ✅ Detail panel is comprehensive: fields, repeat, dependencies, attachments, comments
- ✅ Activity feed with filtering by board and event type
- ✅ Keyboard shortcuts are well-documented and functional
- ✅ Settings page is clean with all CRUD operations for workspaces, teams, boards
- ✅ tRPC data loading works reliably
- ✅ Prior crash in board_filters.tsx:176 appears resolved
