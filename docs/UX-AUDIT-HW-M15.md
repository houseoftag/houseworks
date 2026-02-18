# UX Audit: HW-M15 — File Attachments & Rich Content

**Date:** 2026-02-17  
**Auditor:** UX Agent (automated)  
**App Version:** HW-M15 (localhost:3002, dev build)  
**Standards:** Nielsen's 10 Heuristics · WCAG 2.2 AA · Atlassian Design System  

---

## Summary Verdict: CONDITIONAL PASS ⚠️

The M15 file attachment feature is functionally complete with a clean implementation that follows basic usability patterns. The code is well-structured with appropriate file type validation, size limits, and visual feedback. However, several accessibility gaps and missing UX safeguards prevent a full pass.

**What works well:**
- Clean attachment section design with emoji file-type icons, file size display, and dates
- Proper upload validation (10MB limit, allowed MIME types)
- Attachment count badge (📎 N) in board table provides useful at-a-glance info
- Delete confirmation via `window.confirm()` prevents accidental deletion
- Hidden file input with proper `accept` attribute filters file picker

**What needs work:**
- Multiple accessibility issues (missing ARIA labels, no keyboard focus management)
- No drag-and-drop upload
- No upload progress indicator
- Error handling uses `alert()` instead of inline/toast messages
- No image preview/thumbnail for image attachments
- Delete restricted to uploader only — no admin override

---

## Audit Scope

| Feature | Location | Status |
|---|---|---|
| Attachments section (list, icons, download, delete, "Attach file" button) | `item_detail_panel.tsx` → `AttachmentsSection` | ✅ Implemented |
| Attachment count badge (📎 N) | `board_table.tsx` line 156–159 | ✅ Implemented |
| Upload API (max 10MB, type validation) | `api/upload/route.ts` | ✅ Implemented |
| Attachments CRUD API | `routers/attachments.ts` | ✅ Implemented |

---

## Screenshots

> **Note:** The development environment exhibited instability (Next.js HMR causing tab crashes in the controlled browser), which limited live UI screenshot capture. The dashboard post-login screenshot was captured successfully. Code-based analysis supplements the visual audit.

| Screenshot | Description |
|---|---|
| `screenshots/m15-dashboard-signed-in.jpg` | Dashboard after sign-in (confirms auth flow works) |
| `screenshots/m15-dashboard-post-login.jpg` | Post-Production Hub with sidebar navigation |

---

## Findings (Prioritized)

### 🔴 P1 — Critical / Must Fix

#### F1: Upload errors use `alert()` instead of contextual feedback
- **Heuristic:** H9 (Help users recognize, diagnose, and recover from errors)
- **WCAG:** 4.1.3 (Status Messages)
- **Location:** `AttachmentsSection.handleFileChange` — lines using `alert(err.error || 'Upload failed')`
- **Issue:** Native `alert()` blocks the UI thread, is not announced by screen readers as a status message, and provides poor UX. The app already has a `useToast()` hook used elsewhere.
- **Fix:** Replace `alert()` calls with `pushToast({ title: '...', tone: 'error' })` for consistency and accessibility.

#### F2: No accessible labels on attachment action buttons  
- **Heuristic:** H4 (Consistency and standards)
- **WCAG:** 1.1.1 (Non-text Content), 4.1.2 (Name, Role, Value)
- **Location:** Delete button uses `✕` character with no `aria-label`; "Attach file" button text is `+ Attach file` (acceptable but the `+` adds noise)
- **Issue:** The delete button (`✕`) has no accessible name. Screen readers will announce it as an unknown button or read the Unicode character.
- **Fix:** Add `aria-label="Delete attachment {fileName}"` to the delete button.

#### F3: Download link lacks explicit download indication
- **Heuristic:** H6 (Recognition rather than recall)
- **WCAG:** 2.4.4 (Link Purpose)
- **Location:** File name link in attachment row opens in new tab with `target="_blank"` and `download` attribute
- **Issue:** The file name is styled as a clickable link but there's no visible download icon or "Download" label. Users must infer the action from the link styling. The `download` attribute combined with `target="_blank"` may also cause inconsistent behavior across browsers (some will open, others download).
- **Fix:** Add a visible download icon (⬇️ or SVG) next to the filename, or add a separate "Download" button. Choose either `download` or `target="_blank"`, not both.

---

### 🟡 P2 — Major / Should Fix

#### F4: No upload progress indicator
- **Heuristic:** H1 (Visibility of system status)
- **Location:** `handleFileChange` — sets `uploading` state but only changes button text to "Uploading…"
- **Issue:** For large files (up to 10MB), users have no progress feedback beyond the button text change. No progress bar, spinner, or percentage.
- **Fix:** Add a progress bar or spinner within the attachments section during upload. Consider using `XMLHttpRequest` or a fetch wrapper that reports upload progress.

#### F5: No drag-and-drop upload support
- **Heuristic:** H7 (Flexibility and efficiency of use)
- **Atlassian DS:** File upload patterns typically support drag-and-drop as a primary interaction
- **Issue:** Upload is only possible via the hidden file input triggered by the "+ Attach file" button. No drop zone exists.
- **Fix:** Add a drop zone (at minimum, make the entire attachments section a drop target with visual feedback on dragover).

#### F6: No image preview/thumbnails
- **Heuristic:** H2 (Match between system and the real world)
- **Location:** `AttachmentsSection` renders emoji icons (🖼️) for all images
- **Issue:** Image attachments show a generic emoji icon instead of a thumbnail preview. Users can't visually confirm they uploaded the correct image without clicking to download.
- **Fix:** For image/* types, render an `<img>` thumbnail (the URL is already a local path to `/uploads/`). Use `object-fit: cover` with a small fixed size.

#### F7: Single-file upload only
- **Heuristic:** H7 (Flexibility and efficiency of use)
- **Location:** `<input type="file">` without `multiple` attribute
- **Issue:** Users can only upload one file at a time. For batch workflows (e.g., attaching multiple reference images), this requires repeated clicks.
- **Fix:** Add `multiple` to the file input and handle array iteration in `handleFileChange`.

---

### 🟢 P3 — Minor / Nice to Have

#### F8: Delete permission model too restrictive (no admin override)
- **Heuristic:** H7 (Flexibility and efficiency of use)
- **Location:** `attachments.ts` delete mutation checks `uploadedById !== ctx.session.user.id`
- **Issue:** Only the original uploader can delete their attachments. Workspace admins or board owners cannot clean up misplaced files.
- **Fix:** Add role-based permission check — allow workspace admins to delete any attachment.

#### F9: No file size limit feedback before upload attempt
- **Heuristic:** H5 (Error prevention)
- **Location:** Size validation only happens server-side in `api/upload/route.ts`
- **Issue:** Users don't know the 10MB limit until they attempt upload and get an error. No client-side pre-validation.
- **Fix:** Add client-side size check in `handleFileChange` before the fetch call, and display the max size limit near the upload button (e.g., "Max 10MB · Images, PDFs, documents").

#### F10: Attachment count badge has no ARIA semantics
- **WCAG:** 4.1.2 (Name, Role, Value)
- **Location:** `board_table.tsx` line 157 — `<span>` with `title` attribute only
- **Issue:** The `📎 N` badge uses a `title` attribute for tooltip but has no `aria-label`. Screen readers may not convey meaning.
- **Fix:** Add `aria-label="${count} attachments"` and consider `role="status"`.

#### F11: Empty state could be more inviting
- **Heuristic:** H8 (Aesthetic and minimalist design)
- **Location:** Empty attachments renders `<p>No attachments yet.</p>`
- **Issue:** The empty state is minimal text with no visual affordance. A small illustration or a dashed drop-zone border would better communicate the upload capability.
- **Fix:** Replace with a dashed-border drop zone that says "Drop files here or click to attach" with accepted file type hints.

#### F12: No confirmation or undo for successful upload
- **Heuristic:** H1 (Visibility of system status)
- **Location:** `createAttachment.onSuccess` only invalidates queries
- **Issue:** After successful upload, no toast or visual confirmation is shown. The file just appears in the list. Users familiar with the pattern may expect a success toast.
- **Fix:** Add `pushToast({ title: 'File attached', tone: 'success' })` in the `onSuccess` callback.

#### F13: Keyboard navigation — no focus management after upload
- **WCAG:** 2.4.3 (Focus Order)
- **Issue:** After file upload completes, focus is not moved to the newly added attachment row. Focus stays wherever it was (likely the hidden input or nowhere).
- **Fix:** After successful upload, set focus to the new attachment row or back to the "Attach file" button.

---

## Accessibility Summary (WCAG 2.2 AA)

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text Content | ⚠️ PARTIAL | Emoji icons lack alt text; delete button has no label |
| 1.3.1 Info and Relationships | ✅ PASS | Semantic heading hierarchy used |
| 2.1.1 Keyboard | ⚠️ PARTIAL | Upload button is keyboard accessible; delete button is `<button>` (good); no focus management post-upload |
| 2.4.3 Focus Order | ⚠️ FAIL | No focus management after upload or delete |
| 2.4.4 Link Purpose | ⚠️ PARTIAL | Filename links could benefit from explicit "download" context |
| 4.1.2 Name, Role, Value | ⚠️ FAIL | Delete button missing aria-label; badge missing aria-label |
| 4.1.3 Status Messages | ❌ FAIL | Errors use `alert()` instead of ARIA live region / toast |

---

## Atlassian Design System Alignment

| Pattern | Compliance | Notes |
|---|---|---|
| File upload with drag-and-drop | ❌ Missing | ADS recommends drag-and-drop as primary upload pattern |
| Upload progress indicator | ❌ Missing | ADS file upload shows progress bar |
| Inline error messages | ❌ Uses alert() | ADS uses inline flag/banner for errors |
| Empty state with illustration | ⚠️ Minimal | ADS empty states use illustrations + CTA |
| Icon usage | ⚠️ Emoji | ADS uses SVG icon set, not emoji |

---

## Recommended Fix Priority

| Priority | Fixes | Effort |
|---|---|---|
| **Sprint (P1)** | F1 (alert→toast), F2 (aria-labels), F3 (download clarity) | ~2h |
| **Next sprint (P2)** | F4 (progress), F6 (thumbnails), F7 (multi-upload), F9 (client validation) | ~4-6h |
| **Backlog (P3)** | F5 (drag-drop), F8 (admin delete), F10-F13 | ~4-8h |

---

*Report generated 2026-02-17T18:01 EST. Browser session exhibited Next.js dev-mode HMR instability causing controlled-browser tab crashes; code review supplemented where live UI screenshots were not obtainable.*
