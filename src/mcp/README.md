# Houseworks MCP Server

The Houseworks MCP (Model Context Protocol) server gives AI agents (Claude Code, Claude Desktop, etc.) **direct, structured access** to the Houseworks platform — no HTTP sessions, no cookie auth, no output parsing.

## Quick Start

### 1. Find your user ID

```bash
# Run list_users via the MCP server or query the DB directly:
npx tsx -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { id: true, name: true, email: true } })
  .then(u => { console.log(JSON.stringify(u, null, 2)); process.exit(0); });
"
```

### 2. Start the server

```bash
HOUSEWORKS_MCP_USER_ID=<your-user-id> npm run mcp
```

### 3. Register with Claude Code

Add to `~/.claude.json` (Claude Code MCP settings) or your client's config:

```json
{
  "mcpServers": {
    "houseworks": {
      "command": "npm",
      "args": ["--prefix", "/Users/tvinzant/Library/CloudStorage/Dropbox/Development/houseworks", "run", "mcp"],
      "env": {
        "DATABASE_URL": "<your-postgres-url>",
        "HOUSEWORKS_MCP_USER_ID": "<your-user-id>"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (same as app) |
| `HOUSEWORKS_MCP_USER_ID` | Yes | User ID attributed to all mutating ops (comments, dependencies, etc.) |

---

## Tools Reference

### Workspaces

| Tool | Description |
|---|---|
| `list_workspaces` | All workspaces with member/board counts |
| `get_workspace` | Workspace details with members and boards |
| `list_users` | All users — useful for finding IDs for assignment |

### Boards

| Tool | Params | Description |
|---|---|---|
| `list_boards` | `workspaceId` | Boards in a workspace (summary) |
| `get_board` | `boardId` | Full board: columns, groups, items, cell values |
| `create_board` | `workspaceId, title, description?, ownerId?, withDefaultColumns?` | Create board; seeds Status/Owner/Due Date columns by default |
| `update_board` | `boardId, title?, description?` | Update title or description |
| `delete_board` | `boardId` | ⚠️ Permanently delete board and all contents |

### Groups

| Tool | Params | Description |
|---|---|---|
| `list_groups` | `boardId` | Groups on a board with item counts |
| `create_group` | `boardId, title, color?` | Add a group |
| `update_group` | `groupId, title?, color?` | Rename/recolor |
| `delete_group` | `groupId` | ⚠️ Delete group and all items |

### Columns

| Tool | Params | Description |
|---|---|---|
| `list_columns` | `boardId` | Columns in position order |
| `create_column` | `boardId, title, type, settings?` | Add a column |
| `update_column` | `columnId, title?, settings?` | Update title or settings |
| `delete_column` | `columnId` | ⚠️ Delete column and all cell values |

**Column types:** `TEXT` `STATUS` `PERSON` `DATE` `LINK` `NUMBER` `TIMELINE`

For STATUS columns, pass `settings.options`:
```json
{ "options": [{ "label": "Not Started", "color": "#c4c4c4" }, { "label": "Done", "color": "#00c875" }] }
```

### Items

| Tool | Params | Description |
|---|---|---|
| `list_items` | `groupId` | Items in a group with cell values |
| `get_item` | `itemId` | Full detail: cells, comments, attachments, dependencies |
| `create_item` | `groupId, name, description?` | Create item |
| `update_item` | `itemId, name?, description?` | Update name or description |
| `move_item` | `itemId, targetGroupId` | Move to a different group |
| `delete_item` | `itemId` | ⚠️ Delete item and all data |

### Cell Values

| Tool | Params | Description |
|---|---|---|
| `get_cell_values` | `itemId` | All cell values for an item |
| `set_cell_value` | `itemId, columnId, value` | Upsert a cell value |
| `clear_cell_value` | `itemId, columnId` | Reset cell to empty |

**Value format by column type:**

| Type | Value format |
|---|---|
| TEXT | `"string"` |
| STATUS | `"In Progress"` (must match a status option label) |
| PERSON | `"userId"` (cuid string) |
| DATE | `"2026-03-01"` (ISO date) |
| LINK | `"https://example.com"` |
| NUMBER | `42` |
| TIMELINE | `{ "start": "2026-03-01", "end": "2026-03-15" }` |

### Comments

| Tool | Params | Description |
|---|---|---|
| `list_comments` | `itemId` | Comments on an item (chronological) |
| `add_comment` | `itemId, content` | Add a comment (as `HOUSEWORKS_MCP_USER_ID`) |
| `delete_comment` | `commentId` | Delete a comment |

### Activity

| Tool | Params | Description |
|---|---|---|
| `list_activity` | `workspaceId?, boardId?, itemId?, limit?, cursor?` | Paginated activity feed |

### Search

| Tool | Params | Description |
|---|---|---|
| `search` | `workspaceId, query, limit?` | Search item names/descriptions |
| `search_boards` | `workspaceId, query` | Search board titles |

### Dependencies

| Tool | Params | Description |
|---|---|---|
| `list_dependencies` | `itemId` | All dependencies (in + out) |
| `add_dependency` | `sourceItemId, targetItemId, type` | Create dependency link |
| `remove_dependency` | `dependencyId` | Remove dependency |

**Dependency types:** `BLOCKS` `BLOCKED_BY` `RELATES_TO` `DUPLICATES`

---

## Resources

Resources expose live data as readable context (no tool call needed — the AI can include them in its context window).

| Resource URI | Description |
|---|---|
| `houseworks://workspaces` | Live workspace list |
| `houseworks://workspace/{id}/boards` | Boards in a workspace |
| `houseworks://board/{id}` | Full board snapshot |

---

## Architecture

```
src/mcp/
  server.ts             # Entry point — registers tools + resources, connects via stdio
  tools/
    workspaces.ts       # list_workspaces, get_workspace, list_users
    boards.ts           # list_boards, get_board, create_board, update_board, delete_board
    groups.ts           # list_groups, create_group, update_group, delete_group
    columns.ts          # list_columns, create_column, update_column, delete_column
    items.ts            # list_items, get_item, create_item, update_item, move_item, delete_item
    cells.ts            # get_cell_values, set_cell_value, clear_cell_value
    comments.ts         # list_comments, add_comment, delete_comment
    activity.ts         # list_activity
    search.ts           # search, search_boards
    dependencies.ts     # list_dependencies, add_dependency, remove_dependency
  README.md             # This file
```

The MCP server connects directly to Postgres via Prisma (same `DATABASE_URL` as the app). It does **not** go through the tRPC/Next.js stack, so:
- No auth middleware — it's a local admin tool; protect access at the OS/network level
- All mutations are attributed to `HOUSEWORKS_MCP_USER_ID`

---

## Maintenance Policy

> **When a new Houseworks feature adds or changes data models, the MCP server must be updated.**

### Rule

Every new feature milestone (`HW-Mxx`) that changes the Prisma schema or adds significant new functionality **must** include a queued MCP task in `docs/TASKS.md`. The task should be added to the milestone's deliverables list.

### Checklist for updating the MCP server

When a new feature lands:

- [ ] **New model?** → Add CRUD tools in a new `src/mcp/tools/<model>.ts` file and register in `server.ts`
- [ ] **New enum/column type?** → Update the corresponding tool's description and zod schema
- [ ] **New relationship?** → Update `get_board` / `get_item` includes as appropriate
- [ ] **New tRPC router?** → Mirror its core operations as MCP tools
- [ ] **Update this README** → Add the new tools to the Tools Reference table
- [ ] **Update the server.ts header comment** — `TOOLS REGISTERED` section

### Example task entry in docs/TASKS.md

```markdown
- [ ] **MCP Update** — Add `list_automations`, `create_automation`, `toggle_automation` tools for HW-Mxx automation feature
```
