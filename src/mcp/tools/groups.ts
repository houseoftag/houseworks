import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerGroupTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_groups
   * Returns all groups on a board with item counts.
   */
  server.tool(
    'list_groups',
    'List all groups on a board with item counts.',
    { boardId: z.string().describe('The board ID') },
    async ({ boardId }) => {
      const groups = await prisma.group.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
        include: { _count: { select: { items: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(groups, null, 2) }] };
    },
  );

  /**
   * create_group
   * Creates a new group on a board.
   */
  server.tool(
    'create_group',
    'Create a new group on a board.',
    {
      boardId: z.string().describe('The board ID'),
      title: z.string().describe('Group title'),
      color: z.string().optional().describe('Optional group color (hex or CSS color)'),
    },
    async ({ boardId, title, color }) => {
      // Append after the last group
      const last = await prisma.group.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;
      const group = await prisma.group.create({
        data: { boardId, title, color, position },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(group, null, 2) }] };
    },
  );

  /**
   * update_group
   * Updates a group's title or color.
   */
  server.tool(
    'update_group',
    'Update a group title or color.',
    {
      groupId: z.string().describe('The group ID'),
      title: z.string().optional().describe('New title'),
      color: z.string().optional().describe('New color'),
    },
    async ({ groupId, title, color }) => {
      const group = await prisma.group.update({
        where: { id: groupId },
        data: { ...(title !== undefined && { title }), ...(color !== undefined && { color }) },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(group, null, 2) }] };
    },
  );

  /**
   * delete_group
   * Permanently deletes a group and all its items.
   */
  server.tool(
    'delete_group',
    'Permanently delete a group and all its items. This is irreversible.',
    { groupId: z.string().describe('The group ID to delete') },
    async ({ groupId }) => {
      await prisma.group.delete({ where: { id: groupId } });
      return { content: [{ type: 'text' as const, text: `Group ${groupId} deleted.` }] };
    },
  );
}
