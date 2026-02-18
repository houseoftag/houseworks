# UX Audit — HW-M13 Fixes

**Date:** 2026-02-17
**Status:** ✅ Complete

## Critical Issues

### 1. templates.list API returns 500
**Root cause:** Prisma Client was out of sync after migration `20260217210234_add_board_templates`. The `BoardTemplate` model existed in `schema.prisma` and the migration had been applied to the database, but the generated Prisma Client didn't include the model.

**Fix:** Ran `npx prisma db push` to regenerate the Prisma Client. The tRPC router (`src/server/api/routers/templates.ts`) and root router wiring were already correct.

### 2. Auth session expires during navigation (401 loops)
**Status:** Already fixed in M12. The `getToken()` call in `src/server/api/trpc.ts` correctly passes `secret: process.env.AUTH_SECRET`. No additional changes needed.

## Medium Issues

### 3. Empty state masking API errors
**File:** `src/app/_components/template_gallery.tsx`
**Fix:** Added explicit error state rendering. When the API returns an error, the gallery now shows a red error banner with the error message instead of the misleading "No templates yet" empty state.

### 4. Confirmation dialogs for destructive actions
- **Delete template:** Already had `window.confirm()` — no change needed.
- **Duplicate board:** Already uses a dedicated dialog (`DuplicateBoardDialog`) — no change needed.
- **Duplicate item:** Added `window.confirm()` before cloning in `item_detail_panel.tsx`.

### 5. Terminology alignment: "Clone" → "Duplicate"
**Files:** `src/app/_components/item_detail_panel.tsx`
**Fix:** Renamed all user-facing "Clone" labels to "Duplicate" for consistency with the board duplication feature. The tRPC mutation name (`items.clone`) remains unchanged as it's an internal API name.

## Verification
- ✅ Prisma migration applied, client regenerated
- ✅ Auth fix from M12 confirmed in place
- ✅ Lint passes (eslint)
- ✅ Tests pass (6/6)
