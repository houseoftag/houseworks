# Handoff Notes - Houseworks

## Session Log (2026-02-26 — Account Manager: Scope Correction)

### What Changed
The original Account Manager implementation overbuilt — it included email classification, auto-tagging, briefing generation, nudge creation, and Discord delivery that belong in the external OpenClaw cron, not Houseworks. This session corrected the scope per the updated `docs/ACCOUNT-MANAGER-SCOPE.md`.

### Architecture (Corrected)
- **Houseworks owns:** Schema, UI, MCP tools for reading/writing CRM data
- **OpenClaw cron owns:** Email discovery, classification, auto-tagging, briefings, nudges, Discord delivery
- **No API keys needed in Houseworks** — no `ANTHROPIC_API_KEY`, no `DISCORD_ALERTS_WEBHOOK_URL`

### What Was Removed
- **7 files deleted:** `email_classifier.ts`, `classification-rubric.md`, `email-exclusions.json`, `auto_tagger.ts`, `account_briefing.ts`, `nudge_generator.ts`, `briefing_delivery.ts`
- **Dependency removed:** `@anthropic-ai/sdk` uninstalled
- **Worker jobs removed:** `crm.classify_emails` and `crm.daily_briefing` cron schedules
- **tRPC removed:** `generateBriefing` procedure
- **MCP removed:** `generate_client_briefing` tool
- **Schema removed:** `DomainApproval` model (domain learning is simpler now)

### What Was Reshaped
- **`UnmatchedEmail` model** — reshaped to match scope doc: `threadId` (unique), `fromEmail`, `fromName`, `fromDomain`, `bodyPreview`, `status` (pending/assigned/dismissed), `assignedToId`
- **`email_sync.ts`** — reverted to 2-tier matching only (exact email + contact email). Domain discovery is OpenClaw's job. Unmatched emails use new schema fields.
- **tRPC** — `resolveUnmatchedEmail` renamed to `assignUnmatchedEmail`, uses new schema, creates contacts on assign, no DomainApproval tracking
- **MCP** — `resolve_unmatched_email` renamed to `assign_unmatched_email`, added `get_unclassified_entries` tool
- **UI** — Updated field references (`fromEmail`/`fromName`/`bodyPreview` instead of `from`/`snippet`)

### What Stays
- `domains String[]` and `tags String[]` on Client model
- `UnmatchedEmail` model (reshaped)
- MCP tools: `list_unmatched_emails`, `assign_unmatched_email`, `dismiss_unmatched_email`, `update_client_domains`, `search_clients`, `tag_client`, `untag_client`, `get_stale_clients`, `get_unclassified_entries`
- tRPC: `listUnmatchedEmails`, `assignUnmatchedEmail`, `dismissUnmatchedEmail`, `updateClientDomains`, `searchClients`, `tagClient`, `untagClient`, `getStaleClients`
- UI: Unmatched emails tab, tag filter chips, tag badges, domain badges, classification badges (read from metadata that OpenClaw writes)

### Migration
- `20260226204558_acct_mgr_domains_tags_unmatched` — adds `domains[]`, `tags[]` to Client, creates `UnmatchedEmail` table

### Build Status
- Pre-existing TS errors in `middleware.ts`, `boards.ts`, `cells.ts`, `items.ts`, `auth.ts`, `worker/index.ts` — none from this session
- All Account Manager files compile cleanly

### Post-Deploy Steps
1. PM2 restart worker after deploying
2. PM2 restart dev server after migration (stale .next/ cache)
3. Seed clients with domains from the scope doc table
