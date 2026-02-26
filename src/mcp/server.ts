#!/usr/bin/env node
/**
 * Houseworks MCP Server
 *
 * Provides AI agents (Claude Code, etc.) with direct, structured access to the
 * Houseworks platform via the Model Context Protocol (MCP).
 *
 * ──────────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────────
 *
 *   # 1. Run directly:
 *   HOUSEWORKS_MCP_USER_ID=<userId> npm run mcp
 *
 *   # 2. Register in Claude Code (~/.claude/claude_desktop_config.json or
 *   #    Claude Code MCP settings):
 *   {
 *     "mcpServers": {
 *       "houseworks": {
 *         "command": "npm",
 *         "args": ["--prefix", "/path/to/houseworks", "run", "mcp"],
 *         "env": {
 *           "DATABASE_URL": "postgresql://...",
 *           "HOUSEWORKS_MCP_USER_ID": "<userId>"
 *         }
 *       }
 *     }
 *   }
 *
 * ──────────────────────────────────────────────────────────────────────
 * ENVIRONMENT VARIABLES
 * ──────────────────────────────────────────────────────────────────────
 *
 *   DATABASE_URL              (required) PostgreSQL connection string.
 *   HOUSEWORKS_MCP_USER_ID    (required) User ID that all mutating operations
 *                             are attributed to (comments, dependencies, etc.).
 *                             Run `list_users` to find valid IDs.
 *
 * ──────────────────────────────────────────────────────────────────────
 * TOOLS REGISTERED
 * ──────────────────────────────────────────────────────────────────────
 *
 *   Workspaces  list_workspaces, get_workspace, list_users
 *   Boards      list_boards, get_board, create_board, update_board, delete_board
 *   Groups      list_groups, create_group, update_group, delete_group
 *   Columns     list_columns, create_column, update_column, delete_column
 *   Items       list_items, get_item, create_item, update_item, move_item, delete_item
 *   Cells       get_cell_values, set_cell_value, clear_cell_value
 *   Comments    list_comments, add_comment, delete_comment
 *   Activity    list_activity
 *   Search      search, search_boards
 *   Dependencies list_dependencies, add_dependency, remove_dependency
 *
 * ──────────────────────────────────────────────────────────────────────
 * RESOURCES REGISTERED
 * ──────────────────────────────────────────────────────────────────────
 *
 *   houseworks://workspaces              — live workspace list
 *   houseworks://workspace/{id}/boards  — boards in a workspace
 *   houseworks://board/{id}             — full board snapshot
 *
 * ──────────────────────────────────────────────────────────────────────
 * MAINTENANCE
 * ──────────────────────────────────────────────────────────────────────
 *
 *   When new Houseworks features are added, a corresponding MCP update task
 *   MUST be queued in docs/TASKS.md (see "MCP Maintenance Policy" section).
 *   See src/mcp/README.md for the full maintenance guide.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PrismaClient } from '@prisma/client';

import { registerWorkspaceTools } from './tools/workspaces.js';
import { registerBoardTools } from './tools/boards.js';
import { registerGroupTools } from './tools/groups.js';
import { registerColumnTools } from './tools/columns.js';
import { registerItemTools } from './tools/items.js';
import { registerCellTools } from './tools/cells.js';
import { registerCommentTools } from './tools/comments.js';
import { registerActivityTools } from './tools/activity.js';
import { registerSearchTools } from './tools/search.js';
import { registerDependencyTools } from './tools/dependencies.js';
import { registerAutomationTools } from './tools/automations.js';
import { registerCrmTools } from './tools/crm.js';

async function main() {
  // ── Validate environment ─────────────────────────────────────────────
  const actorUserId = process.env.HOUSEWORKS_MCP_USER_ID;
  if (!actorUserId) {
    console.error(
      '[houseworks-mcp] ERROR: HOUSEWORKS_MCP_USER_ID is not set.\n' +
      'Set it to the user ID that mutating operations should be attributed to.\n' +
      'Run the list_users tool to find valid IDs.',
    );
    process.exit(1);
  }

  // ── Database ─────────────────────────────────────────────────────────
  const prisma = new PrismaClient({ log: ['error'] });

  // Verify the actor user exists
  const actor = await prisma.user.findUnique({ where: { id: actorUserId }, select: { id: true, name: true } });
  if (!actor) {
    console.error(`[houseworks-mcp] ERROR: User not found: ${actorUserId}`);
    process.exit(1);
  }
  console.error(`[houseworks-mcp] Starting as user: ${actor.name ?? actorUserId}`);

  // ── MCP Server ───────────────────────────────────────────────────────
  const server = new McpServer({
    name: 'houseworks',
    version: '1.0.0',
  });

  // ── Register tools ───────────────────────────────────────────────────
  registerWorkspaceTools(server, prisma);
  registerBoardTools(server, prisma);
  registerGroupTools(server, prisma);
  registerColumnTools(server, prisma);
  registerItemTools(server, prisma);
  registerCellTools(server, prisma);
  registerCommentTools(server, prisma, actorUserId);
  registerActivityTools(server, prisma);
  registerSearchTools(server, prisma);
  registerDependencyTools(server, prisma, actorUserId);
  registerAutomationTools(server, prisma);
  registerCrmTools(server, prisma);

  // ── Register resources ───────────────────────────────────────────────

  // houseworks://workspaces — live workspace list
  server.resource(
    'workspaces',
    'houseworks://workspaces',
    { description: 'Live list of all Houseworks workspaces with member and board counts.' },
    async () => {
      const workspaces = await prisma.workspace.findMany({
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { members: true, boards: true } } },
      });
      return {
        contents: [{
          uri: 'houseworks://workspaces',
          mimeType: 'application/json',
          text: JSON.stringify(workspaces, null, 2),
        }],
      };
    },
  );

  // houseworks://workspace/{id}/boards — boards in a workspace
  server.resource(
    'workspace-boards',
    new ResourceTemplate('houseworks://workspace/{workspaceId}/boards', { list: undefined }),
    { description: 'Live list of boards in a workspace.' },
    async (uri, { workspaceId }) => {
      const boards = await prisma.board.findMany({
        where: { workspaceId: workspaceId as string },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, description: true, createdAt: true, updatedAt: true },
      });
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(boards, null, 2),
        }],
      };
    },
  );

  // houseworks://board/{id} — full board snapshot
  server.resource(
    'board',
    new ResourceTemplate('houseworks://board/{boardId}', { list: undefined }),
    { description: 'Full board snapshot: columns, groups, items, and cell values.' },
    async (uri, { boardId }) => {
      const board = await prisma.board.findUnique({
        where: { id: boardId as string },
        include: {
          columns: { orderBy: { position: 'asc' } },
          groups: {
            orderBy: { position: 'asc' },
            include: {
              items: {
                orderBy: { position: 'asc' },
                include: {
                  cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
                },
              },
            },
          },
        },
      });
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(board, null, 2),
        }],
      };
    },
  );

  // ── Connect ──────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[houseworks-mcp] Server connected and ready.');
}

main().catch((err) => {
  console.error('[houseworks-mcp] Fatal error:', err);
  process.exit(1);
});
