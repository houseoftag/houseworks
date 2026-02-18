# UX Freeze Fix Log — 2026-02-17

Fixes for 4 issues from `docs/UX-FREEZE-AUDIT-REAL-2026-02-17.md`.

---

## 🔴 CRITICAL #1: "New Board" buttons navigate to /settings

**Root cause:** `page.tsx` passed `() => router.push('/settings')` as `onRequestCreateBoard`.

**Fix:** Added a `CreateBoardDialog` modal component to `page.tsx`. Both dashboard "New Board" buttons now open this dialog, which calls `trpc.boards.create` with the workspace ID and board title. On success, navigates to the new board.

**Files changed:** `src/app/page.tsx`

---

## 🔴 CRITICAL #2: Mobile 375px — notifications dropdown overlaps, header text clipped

**Root cause:** Notification dropdown used `absolute` positioning with fixed `w-96`, overflowing on small screens. Header title had no truncation or responsive sizing.

**Fix:**
- `notification_bell.tsx`: Changed dropdown to `fixed inset-x-2 top-14` on mobile with `max-h-[70vh]`, reverting to `absolute right-0` on `sm:` breakpoint.
- `header.tsx`: Added `truncate`, responsive text sizing (`text-lg sm:text-2xl`), tighter gap on mobile (`gap-2 sm:gap-4`), and `overflow-hidden` on the header container.

**Files changed:** `src/app/_components/notification_bell.tsx`, `src/app/_components/header.tsx`

---

## 🟡 MAJOR #3: Search results show `[object Object]` in metadata

**Root cause:** `search_command.tsx` rendered status cell value with `String(statusCell.value)`. The value is a `{label, color}` object, so `String()` produces `[object Object]`.

**Fix:** Extract `.label` from the object when value is an object: `(statusCell.value as {label?: string}).label`.

**Files changed:** `src/app/_components/search_command.tsx`

---

## 🟡 MAJOR #4: "+ Add Item" creates duplicate items on Enter

**Root cause:** No guard against rapid/double submission. The `onKeyDown` handler fired `createItem.mutate()` on every Enter press without checking if a mutation was already in flight.

**Fix:** Added `!createItem.isPending` guard and `event.preventDefault()` to the Enter handler to prevent double-submit.

**Files changed:** `src/app/_components/board_table.tsx`
