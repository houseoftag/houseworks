# Account Manager — Build Scope (Corrected)

_Houseworks owns the schema, UI, and MCP tools. An external OpenClaw cron handles discovery, classification, and briefings — no API keys needed._

## Architecture

```
Gmail ──→ [OpenClaw cron via gog] ──→ discovers contacts ──→ writes to Houseworks DB
                                  ──→ classifies emails  ──→ writes metadata to timeline entries
                                  ──→ backfills history   ──→ for newly discovered contacts

Houseworks email_sync ──→ deep sync for KNOWN contacts only (threading, attachments, ongoing)
```

**Why this split:** Houseworks email sync only pulls for contacts already in the DB. If someone new emails Tag, their message gets missed until they're added as a contact. The external cron scans ALL email, discovers contacts first, then Houseworks sync picks them up on its next run.

**No API keys required.** Classification happens inside the OpenClaw agent session (the LLM IS the classifier). No Anthropic API key, no Haiku calls, no external AI billing.

---

## What Houseworks Builds (schema + UI + MCP)

### 1. Schema Changes

**Client model — add:**
```prisma
domains   String[]  @default([])
tags      String[]  @default([])
```

**New model — UnmatchedEmail:**
```prisma
model UnmatchedEmail {
  id            String   @id @default(cuid())
  workspaceId   String
  threadId      String   @unique
  messageId     String?
  fromEmail     String
  fromName      String?
  fromDomain    String
  subject       String
  bodyPreview   String?
  receivedAt    DateTime
  status        String   @default("pending")  // pending | assigned | dismissed
  assignedToId  String?  // client ID if resolved
  createdAt     DateTime @default(now())
  
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
  assignedTo    Client?   @relation(fields: [assignedToId], references: [id])
}
```

**CrmTimelineEntry.metadata** — no schema change needed. The external cron writes classification data to the existing jsonb field:
```json
{
  "classification": "NEED_REPLY",
  "confidence": 0.95,
  "reason": "Client asked for QR codes",
  "threadId": "...",
  "from": "...",
  "date": "..."
}
```

### 2. MCP Tools (new)

Add to `src/mcp/tools/crm.ts`:

- `search_clients` — filter by: query (name/company), tags[], domain, staleDays (no activity in N days), classification (has NEED_REPLY entries)
- `tag_client` / `untag_client` — add/remove tags on a client
- `get_stale_clients` — shortcut: clients with no timeline entry in N days
- `list_unmatched_emails` — return pending UnmatchedEmail records
- `assign_unmatched_email` — assign to a client (creates contact, adds domain to client's domains[], moves email to timeline)
- `dismiss_unmatched_email` — mark as dismissed (spam, irrelevant)
- `get_unclassified_entries` — timeline entries where `metadata->>'classification'` IS NULL

### 3. tRPC Endpoints

Mirror the MCP tools above for UI access:
- `crm.searchClients`
- `crm.tagClient` / `crm.untagClient`
- `crm.listUnmatchedEmails`
- `crm.assignUnmatchedEmail`
- `crm.dismissUnmatchedEmail`

### 4. UI

**Client list/detail:**
- Tag badges (color-coded chips): `needs-reply` (red), `at-risk` (orange), `recurring` (blue), `upsell-candidate` (green)
- Domain list on client detail page
- Filter by tag in client list

**Unmatched email review queue:**
- Table: from, domain, subject, date, [Assign to Client] [Dismiss]
- Assign flow: pick existing client OR create new → auto-adds domain to client's domains[]
- Badge count in sidebar nav

**Timeline entries:**
- Classification badge on email entries (NEED_REPLY = red, FYI = gray, LEAD = blue, VENDOR = yellow, IGNORE = muted)
- Filter timeline by classification

### 5. Domain Learning

When a user assigns an unmatched email to a client:
1. Add the sender's domain to that client's `domains[]` array
2. Create a contact record for the sender
3. Move the UnmatchedEmail record's content to a CrmTimelineEntry
4. Future emails from that domain auto-match to the client

This is Houseworks-internal logic — no external cron involved.

---

## What Houseworks Does NOT Build

These belong in the external OpenClaw cron and should be REMOVED if already implemented:

- ❌ **Email classifier module** (`email_classifier.ts`) — no Haiku calls, no API key. Classification is done by the OpenClaw cron agent.
- ❌ **Auto-tagger worker** (`auto_tagger.ts`) — tagging logic runs in the OpenClaw cron, writes tags via MCP/psql.
- ❌ **Account manager briefing cron** — briefing generation happens in OpenClaw, delivered via OpenClaw's Discord integration.
- ❌ **Nudge generator** — runs in OpenClaw cron, uses existing gog/calendar tools for context.
- ❌ **Discord webhook delivery** — OpenClaw handles all outbound messaging. No `DISCORD_ALERTS_WEBHOOK_URL` env var needed.
- ❌ **Any dependency on `ANTHROPIC_API_KEY`** — Houseworks should not call any LLM API directly for this feature.
- ❌ **Domain matching inside `email_sync.ts`** — email_sync pulls for known contacts. Domain matching for discovery happens in the external cron.

---

## What the External OpenClaw Cron Does

_(This is NOT Houseworks code. It lives in `~/.openclaw/workspace/crm/` and runs as an OpenClaw scheduled agent.)_

1. **Scan all recent email** via `gog gmail search` + `gog gmail get`
2. **Filter exclusions** (Jaci, Margaret Tribert)
3. **Match sender domains** against `client-domains.json` and Houseworks `clients.domains[]`
4. **Discover new contacts** — if domain matches a client but sender isn't a known contact, create the contact via psql/MCP
5. **Flag unmatched domains** — write to `unmatched_emails` table for Tag to review in UI
6. **Classify every email** — the agent IS the classifier (no API key needed)
7. **Write classifications** to `crm_timeline_entries.metadata`
8. **Apply auto-tags** to clients: `needs-reply`, `at-risk`, `recurring`, `upsell-candidate`
9. **Backfill** — when a new contact is discovered, pull their recent email history
10. **Generate daily briefing** and send via Discord

---

## Clients to Seed

| Client | Company | Domain | Key Contact | Recurring |
|--------|---------|--------|-------------|-----------|
| BETCO Scaffolds | BETCO | scaffold.com | Melissa Rodriguez | Fri 9 AM |
| Mary McEachern | merry design | merryonedesign.com | Mary McEachern | As needed |
| Augusta Locally Grown | ALG | augustalocallygrown.org | Janette Metz | — |
| Athenry | Athenry | — | — | Phase 3: Feb 27–Mar 4 |
| Following Him | — | belonginaugusta.com | Sam Haymond, Corbin Jones | 2nd Mon (paused) |
| Sign Painter Podcast | — | — | — | — |
| P_ISO Topics | — | — | — | — |

## Reference Materials

- **Email rules (Tag's voice):** `~/.openclaw/workspace/pm/research/account-manager-email-rules.md`
- **Classification rubric:** `~/.openclaw/workspace/crm/classification-rubric.md`
- **Domain config:** `~/.openclaw/workspace/crm/client-domains.json`
- **Communication style audit:** `~/.openclaw/workspace/pm/research/tag-communication-style-audit.md`
