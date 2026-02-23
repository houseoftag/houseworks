# Houseworks — Claude Code Context

## Project
Houseworks is a workspace/dashboard platform. Primary dev project.

## Stack
- **Framework:** Next.js 14, App Router, TypeScript
- **Auth:** NextAuth (custom setup)
- **DB:** Prisma + SQLite
- **Styling:** Tailwind CSS
- **Worker:** `npm run worker` (separate process — `src/worker/index.ts`)

## Dev Server
```bash
cd /Users/tvinzant/Library/CloudStorage/Dropbox/Development/houseworks
npm run dev        # starts on port 3002
npm run worker     # start worker separately if needed
```
URL: http://localhost:3002

## Key Files
- `src/app/` — App Router pages and layouts
- `src/app/api/` — API routes
- `src/app/_components/` — shared components
- `prisma/schema.prisma` — database schema
- `prisma/seed.ts` — seed data
- `src/worker/index.ts` — background worker

## DB Commands
```bash
npm run db:migrate    # run migrations
npm run db:seed       # seed database
npm run db:studio     # open Prisma Studio
```

## Known Gotchas
- Always use real Dropbox path, NOT `~/Dropbox` symlink — symlink serves stale cache to Node processes.
- Use real path: `/Users/tvinzant/Library/CloudStorage/Dropbox/Development/houseworks/`

## Scope Boundaries
Do NOT touch without explicit instruction:
- `prisma/migrations/` — never hand-edit migrations
- `src/worker/` — unless the task specifically involves the worker

## Self-Improvement
Review `lessons.md` at session start. Append lessons after any correction.
