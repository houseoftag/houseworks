import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerActivityTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_activity
   * Returns paginated activity logs. Filter by workspace, board, or item.
   */
  server.tool(
    'list_activity',
    `List activity logs (changes, comments, assignments, etc.).
Filter by workspaceId, boardId, or itemId. Returns the 50 most recent events by default.
Paginate with cursor (pass the ID of the last event you received).`,
    {
      workspaceId: z.string().optional().describe('Filter to a specific workspace'),
      boardId: z.string().optional().describe('Filter to a specific board'),
      itemId: z.string().optional().describe('Filter to a specific item'),
      limit: z.number().int().min(1).max(200).optional().describe('Max events to return (default: 50)'),
      cursor: z.string().optional().describe('Pagination: ID of the last event from previous page'),
    },
    async ({ workspaceId, boardId, itemId, limit = 50, cursor }) => {
      const logs = await prisma.activityLog.findMany({
        where: {
          ...(workspaceId && { workspaceId }),
          ...(boardId && { boardId }),
          ...(itemId && { itemId }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor && { skip: 1, cursor: { id: cursor } }),
        include: {
          user: { select: { id: true, name: true, email: true } },
          board: { select: { id: true, title: true } },
          item: { select: { id: true, name: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(logs, null, 2) }] };
    },
  );
}
