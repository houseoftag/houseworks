import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerSearchTools(server: McpServer, prisma: PrismaClient) {
  /**
   * search
   * Full-text search across item names and descriptions within a workspace.
   */
  server.tool(
    'search',
    'Search items by name or description within a workspace. Returns matching items with their board and group context.',
    {
      workspaceId: z.string().describe('The workspace ID to search within'),
      query: z.string().min(1).describe('Search query (matches item names and descriptions)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 20)'),
    },
    async ({ workspaceId, query, limit = 20 }) => {
      const items = await prisma.item.findMany({
        where: {
          group: { board: { workspaceId } },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          group: {
            select: {
              id: true,
              title: true,
              board: { select: { id: true, title: true } },
            },
          },
          cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
    },
  );

  /**
   * search_boards
   * Searches board titles within a workspace.
   */
  server.tool(
    'search_boards',
    'Search boards by title within a workspace.',
    {
      workspaceId: z.string().describe('The workspace ID'),
      query: z.string().min(1).describe('Search query'),
    },
    async ({ workspaceId, query }) => {
      const boards = await prisma.board.findMany({
        where: {
          workspaceId,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, title: true, description: true, createdAt: true, updatedAt: true,
          _count: { select: { groups: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(boards, null, 2) }] };
    },
  );
}
