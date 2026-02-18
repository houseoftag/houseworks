# UX Audit — HW-M12: Global Search & Quick Actions

**Date:** 2026-02-17  
**Auditor:** UX Agent (automated)  
**Build:** localhost:3002 (Next.js dev, credentials auth)  
**Severity scale:** 🔴 Blocker · 🟡 Major · 🟢 Minor · ℹ️ Info

---

## Summary

The ⌘K command palette UI is well-structured and follows good patterns (dialog role, keyboard shortcuts, sectioned results). However, **the search API is completely non-functional** — every query returns a server error, making it impossible to verify result display, navigation, or keyboard selection end-to-end.

| Area | Verdict |
|---|---|
| Open / close | ✅ Pass |
| Search query → results | 🔴 Broken (API 500/401) |
| Keyboard navigation (↑↓ Enter) | ⚠️ Code looks correct, cannot verify (no results) |
| Result display (board context, status) | ⚠️ Code looks correct, cannot verify |
| Select → navigate | ⚠️ Wired correctly in code, cannot verify |
| Accessibility | 🟡 Partial — see findings |

---

## Findings

### 🔴 HW-M12-001: Search API returns 500 / 401 — search is non-functional

**Severity:** Blocker  
**Steps:** Open ⌘K → type "show" or "tracking" → observe "No results"  
**Expected:** "Show Tracking" board and its 3 items should appear  
**Actual:** `search.query` tRPC endpoint returns HTTP 500 (Prisma error) on first attempts, then 401 (UNAUTHORIZED) on subsequent calls. The error message references an invalid Prisma client import (`__TURBOPACK__imported__module__…`).  

**Root cause hypothesis:** The tRPC `protectedProcedure` session context is not resolving correctly for client-side API calls. The dashboard page renders server-side with a valid session (boards/items display), but client-side tRPC queries (search, notifications) fail auth. Likely a session cookie / NextAuth configuration mismatch in the tRPC context provider.

**Also affected:** `notifications.getUnreadCount` returns 401 continuously (same root cause).

**Evidence:** Browser console shows 40+ consecutive 500/401 errors on `search.query` and `notifications.getUnreadCount` endpoints.

---

### 🟡 HW-M12-002: No `aria-modal="true"` on search dialog

**Severity:** Major (a11y)  
**Location:** `search_command.tsx` — the dialog `<div>` has `role="dialog"` and `aria-label="Search"` ✅ but is missing `aria-modal="true"`.  
**Impact:** Screen readers may not correctly trap focus or announce the dialog as modal.  
**Fix:** Add `aria-modal="true"` to the dialog container.

---

### 🟡 HW-M12-003: No focus trap inside dialog

**Severity:** Major (a11y)  
**Location:** `search_command.tsx`  
**Detail:** When the dialog is open, Tab key can move focus to elements behind the backdrop (sidebar buttons, header links). A proper modal should trap focus within itself.  
**Fix:** Implement a focus trap (e.g., `@radix-ui/react-dialog` or a manual focus-trap hook).

---

### 🟢 HW-M12-004: Result list items lack `role="option"` / `aria-selected`

**Severity:** Minor (a11y)  
**Location:** `search_command.tsx` — result buttons  
**Detail:** The results list uses plain `<button>` elements with visual highlighting for the selected index, but no ARIA listbox/option pattern. Screen reader users cannot perceive which result is "selected" via ↑↓ keys.  
**Fix:** Wrap results in `role="listbox"`, give each result `role="option"` with `aria-selected={idx === clampedIndex}`, and set `aria-activedescendant` on the input.

---

### 🟢 HW-M12-005: No debounce on search input

**Severity:** Minor (perf)  
**Location:** `search_command.tsx` — `onChange` directly sets query, firing tRPC query on every keystroke  
**Impact:** Excessive API calls during typing; with the current 500/401 errors this generates a flood of failed requests.  
**Fix:** Add 200-300ms debounce on the query value before firing the tRPC call.

---

### 🟢 HW-M12-006: Error state not surfaced to user

**Severity:** Minor (UX)  
**Location:** `search_command.tsx`  
**Detail:** When the API returns an error, the component shows "No results for …" rather than an error message. The user has no indication that search is broken vs. genuinely no results.  
**Fix:** Check `trpc.search.query`'s `isError` state and display an appropriate message (e.g., "Search unavailable — please try again").

---

### ℹ️ HW-M12-007: ⌘K toggles (open/close) — standard is open-only

**Severity:** Info  
**Detail:** Pressing ⌘K when the palette is already open closes it. Most implementations (VS Code, Linear, Notion) keep ⌘K as open-only and rely on Esc to close. Current behavior isn't wrong but is non-standard.

---

### ℹ️ HW-M12-008: Search only matches `name`/`title` — no full-text

**Severity:** Info  
**Location:** `search.ts` router  
**Detail:** Search uses Prisma `contains` (case-insensitive) on `item.name` and `board.title` only. Cell values, descriptions, and other fields are not searched. This is fine for M12 scope but worth noting for future iterations.

---

## What Works Well

- **⌘K / Ctrl+K shortcut** opens the palette correctly ✅
- **Esc key** closes the palette ✅
- **Click on backdrop** closes the palette ✅
- **Click on Search button** in header opens the palette ✅
- **`role="dialog"` with `aria-label="Search"`** present ✅
- **Input auto-focuses** on open ✅
- **Query resets** on reopen ✅
- **Footer shows keyboard hints** (↑↓ navigate, ↵ select, esc close) when results exist ✅
- **Code structure** for results display is well-organized: boards and items in separate sections, items show board context (`board › group`) and status cell value ✅
- **`onSelectBoard` / `onSelectItem` callbacks** correctly wired to `handleSelectBoard` in `page.tsx` ✅

---

## Recommended Priority

1. **Fix tRPC client-side auth** (HW-M12-001) — blocker, nothing else can be verified without it
2. **Add error state UI** (HW-M12-006) — quick win
3. **Add `aria-modal` + focus trap** (HW-M12-002, 003) — a11y compliance
4. **Add listbox/option ARIA pattern** (HW-M12-004) — a11y polish
5. **Add debounce** (HW-M12-005) — perf improvement

---

## Re-Audit — 2026-02-17 (Post "Blocker Fix")

**Re-auditor:** UX Agent (automated)  
**Date:** 2026-02-17 15:48 EST  
**Trigger:** Re-audit after reported blocker fix for HW-M12-001

### Re-Audit Summary

The UI-side fixes (HW-M12-002 through 006) have been **implemented correctly in code**. However, **HW-M12-001 (the blocker) is NOT fixed** — the tRPC client-side auth issue persists. All `search.query`, `notifications.getUnreadCount`, `workspaces.listMine`, and `boards.dashboardStats` client-side tRPC calls return **401 UNAUTHORIZED**. The dashboard shows "Unable to load dashboard data" and search shows "Search unavailable — please try again."

### Finding-by-Finding Status

| ID | Original Finding | Status | Evidence |
|---|---|---|---|
| HW-M12-001 | Search API returns 500/401 | 🔴 **STILL BROKEN** | `search.query` returns 401; console shows 100+ errors across all tRPC endpoints. Error now consistently 401 (no more 500s with Prisma import errors — that sub-issue may be fixed, but auth still fails). |
| HW-M12-002 | No `aria-modal="true"` | ✅ **FIXED** | `aria-modal="true"` confirmed on dialog element via DOM inspection. |
| HW-M12-003 | No focus trap | ✅ **FIXED** (code) | Focus trap logic implemented at line 74 of `search_command.tsx` — cycles Tab within dialog. Cannot fully verify behavior without working search results to Tab between. |
| HW-M12-004 | No `role="option"` / `aria-selected` | ✅ **FIXED** (code) | `role="listbox"` on container, `role="option"` + `aria-selected` on each result, `aria-activedescendant` on input — all present in code. Confirmed `listbox` role visible in accessibility tree. Cannot verify `option` elements since no results render. |
| HW-M12-005 | No debounce | ✅ **FIXED** (code) | `useDebouncedValue` hook implemented (250ms). `debouncedQuery` used as tRPC input. |
| HW-M12-006 | Error state not surfaced | ✅ **FIXED** | "Search unavailable — please try again" displays when API returns error. Verified visually in browser. |
| HW-M12-007 | ⌘K toggle behavior | ℹ️ Unchanged (info-only) | — |
| HW-M12-008 | Search limited to name/title | ℹ️ Unchanged (info-only) | — |

### Tests Not Completable (Blocked by HW-M12-001)

The following audit checks **cannot be performed** until the tRPC auth blocker is resolved:

1. ❌ Search returns actual results (boards + items)
2. ❌ Keyboard navigation (↑↓) moves between results
3. ❌ Enter key selects a result and navigates to the correct page
4. ❌ `role="option"` elements appear in the live accessibility tree with results
5. ❌ `aria-selected` toggles correctly as ↑↓ is pressed
6. ❌ Focus trap behavior with multiple focusable elements (results)

### New Observations

- **Broader auth failure:** The 401 issue affects ALL client-side tRPC calls, not just search. `workspaces.listMine`, `boards.dashboardStats`, and `notifications.getUnreadCount` all fail. The dashboard shows "Unable to load dashboard data" with a Retry button. Server-side rendering still works (page loads, sidebar shows "Post-Production Hub"), but all client-side hydration queries fail auth.
- **No retry backoff:** Failed tRPC queries retry aggressively with exponential backoff but generate 100+ error entries in the console within minutes. Consider adding a max retry limit or circuit breaker.
- **Error previously was 500 (Prisma import):** The original audit saw HTTP 500 with a Turbopack module resolution error. That specific error appears resolved — it's now consistently 401. This suggests the Prisma import was fixed but the session context is still not being passed to client-side tRPC calls.

### Verdict

**🔴 FAIL — Blocker remains.** HW-M12-001 is still active. UI-side fixes (002–006) are confirmed in code and partially verified, but end-to-end search functionality cannot be validated until client-side tRPC auth works. **This is not a search-specific bug; it's a systemic client-side auth failure affecting the entire app.**

### Recommended Next Steps

1. **Debug tRPC context provider** — the session cookie is set (login works, SSR data loads), but the client-side tRPC caller is not sending it. Check `src/trpc/react.tsx` or equivalent for cookie/header forwarding.
2. **Verify `getSession()` in tRPC context** — ensure the tRPC API route handler (`/api/trpc/[trpc]`) correctly reads the NextAuth session from the request cookies.
3. **Test with `curl`** — `curl -b <session-cookie> http://localhost:3002/api/trpc/search.query?input=...` to isolate whether the issue is cookie transmission or session resolution.

---

## Resolution — 2026-02-17 15:55 EST

### Root Cause

`getToken()` from `next-auth/jwt` (v5 beta.30) **requires the `secret` parameter explicitly** — it does NOT auto-read `AUTH_SECRET` from the environment. The call in `src/server/api/trpc.ts` was:

```ts
const token = await getToken({ req: opts.req });
```

This threw `MissingSecret("Must pass 'secret' if not set to JWT getToken()")`, which was silently swallowed by the `catch` block, leaving `session = null` → every `protectedProcedure` returned 401.

### Fix

Added `secret: process.env.AUTH_SECRET` to the `getToken()` call:

```ts
const token = await getToken({
  req: opts.req,
  secret: process.env.AUTH_SECRET,
});
```

**File:** `src/server/api/trpc.ts`, line ~19

### Why the Previous Fix (auth → getToken) Didn't Work

The switch from `auth()` to `getToken()` was the right direction — `auth()` depends on Next.js async request context that doesn't propagate into tRPC's fetch adapter. But the `secret` parameter was omitted, so `getToken()` failed silently.

### Status: ✅ RESOLVED — HW-M12-001 should now be fixed. Re-audit recommended to verify end-to-end.
