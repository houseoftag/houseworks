# Houseworks — Lessons Learned

_Append after every correction: `## [YYYY-MM-DD] — [what went wrong] → [what to do instead]`_

## [2026-02-22] — `overflow: clip` on a section clips sticky children → use no overflow on the section

`[overflow:clip]` was added to a `<section>` to clip border-radius overflow without breaking sticky positioning (since `overflow: hidden` makes the element a sticky containing block). However, `overflow: clip` still clips sticky children when the section scrolls above the viewport — the sticky header gets clipped by the section's top edge.

**Fix**: Remove the overflow property from the section entirely (`overflow: visible`). The horizontal scroll is contained in the child `bodyScrollRef` div (`overflow-x-auto`), so rows don't visually escape the section. Border-radius continues to clip the background/border correctly.

## [2026-02-22] — `sticky top-0` sticks at scroll container's content edge, not border edge → use `-top-{padding}` to cover padding zone

When a sticky element is inside a scroll container with top padding (e.g. `<main className="py-6">`), `top: 0` sticks at the container's CONTENT edge (border + padding from viewport top), not the border edge. This leaves a dead zone equal to the padding height where body rows scroll through without being covered by the sticky header.

**Fix**: Use `sticky -top-6` (negative value matching the scroll container's padding-top) so the sticky element sticks at the container's border edge. Verified: `stickyTop === mainTop` confirms correct placement. The dead zone disappears.


## [2026-02-25] — `z.nativeEnum(PrismaEnum)` crashes the entire TRPC module in Next.js App Router (Turbopack ESM) → use `z.enum([...values])`

When Next.js App Router loads TRPC route handlers with Turbopack, it uses ESM module evaluation. During this phase, `z.nativeEnum(SomePrismaEnum)` calls `Object.values(SomePrismaEnum)` at module initialization time. In Turbopack's ESM context, Prisma client enum exports may be undefined during module graph initialization, causing `TypeError: Cannot convert undefined or null to object`. This crashes the ENTIRE TRPC module — ALL API calls return 500, not just the one using the enum.

**Symptom**: Every TRPC call returns 500 with the error at module evaluation. Workspace creation, CRM, everything fails.

**Fix**: Replace every `z.nativeEnum(PrismaEnum)` in router files with `z.enum(['VALUE_A', 'VALUE_B', ...])` using hardcoded string arrays. Files to check: `notificationPrefs.ts`, `activity.ts`, `crm.ts`, `deals.ts`.

**Note**: After fixing, run `npx prisma generate` and verify `curl http://localhost:3002/api/trpc/health.ping` returns JSON (not an HTML error page).

## [2026-02-25] — Removing a Tailwind `uppercase` class from a child element does NOT remove uppercase if a parent still has `uppercase` → fix the parent too

When a parent `<div className="... uppercase ...">` applies `text-transform: uppercase`, removing `uppercase` from a child `<span>` doesn't help — the computed value is still `uppercase` via CSS inheritance. `<button>` elements happen to have a UA stylesheet rule of `text-transform: none` which accidentally overrides it (so sortable column header buttons appeared in sentence case while non-sortable spans did not). Always check for `uppercase` in ancestor elements when a text-transform fix doesn't take effect.

## [2026-02-25] — Turbopack caches node_modules at build time → after `prisma generate`, must restart dev server

After running `prisma migrate dev` or `prisma generate`, Turbopack's dev server caches the old compiled Prisma client from `node_modules`. New models (e.g. `prisma.client`) return `undefined` at runtime even though TypeScript types are correct. `prisma generate` alone doesn't fix it.

**Fix**: Stop the dev server, delete `.next/`, then restart. Per the lesson below, always stop first before deleting `.next/`.

## [2026-02-26] — Prisma `Parameters<typeof prisma.model.findMany>[0]['where']` fails in MCP tools → use `Prisma.ModelWhereInput`

When building dynamic `where` objects in MCP tool handlers, using `Parameters<typeof prisma.client.findMany>[0]['where']` as a type assertion fails because Prisma's type util resolves `[0]` to the full options object, not the `where` property. Use `Prisma.ClientWhereInput` (imported from `@prisma/client`) instead.

## [2026-02-26] — PostgreSQL `String[]` columns require `push`/`set` syntax in Prisma → not direct assignment

When adding to a PostgreSQL array column (like `tags String[]`), use `data: { tags: { push: value } }` to append, and `data: { tags: { set: [...] } }` to replace the entire array. Direct assignment like `data: { tags: newArray }` won't work correctly.

## [2026-02-23] — Deleting .next while dev server is running causes it to hang → clear cache differently

Deleting `.next/` with `rm -rf` while `next dev` (Turbopack) is running causes the process to accept connections but never respond to requests. The server doesn't crash, it just hangs indefinitely on all requests.

**Fix**: Either (a) stop the dev server before clearing cache, or (b) only delete specific stale chunks rather than the whole `.next/` dir. If the server ends up in this hung state, it must be killed and restarted.

## [2026-02-26] — Prisma migration that DROPs a table fails on fresh DB reset → delete the migration before reset

When a migration was created to reshape a table (e.g., DROP TABLE domain_approvals, ALTER TABLE unmatched_emails), running `prisma migrate reset` fails because on a fresh DB the table being dropped was never created by earlier migrations. The migration SQL tries to DROP a non-existent table.

**Fix**: Delete the stale migration directory entirely, run `prisma migrate reset --force`, then `prisma migrate dev --name <new-name>` to generate a clean migration that CREATEs the table from scratch based on the current schema.prisma.
