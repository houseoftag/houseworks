import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerItemTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_items
   * Returns items in a group with their cell values.
   */
  server.tool(
    'list_items',
    'List all items in a group with their cell values.',
    { groupId: z.string().describe('The group ID') },
    async ({ groupId }) => {
      const items = await prisma.item.findMany({
        where: { groupId },
        orderBy: { position: 'asc' },
        include: {
          cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
          _count: { select: { updates: true, attachments: true, dependenciesAsSource: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
    },
  );

  /**
   * get_item
   * Returns full item detail: cell values, comments, attachments, dependencies.
   */
  server.tool(
    'get_item',
    'Get an item by ID with full detail: cell values, comments (updates), attachment list, and dependencies.',
    { itemId: z.string().describe('The item ID') },
    async ({ itemId }) => {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          group: { select: { id: true, title: true, boardId: true } },
          cellValues: { include: { column: true } },
          updates: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          attachments: {
            orderBy: { createdAt: 'asc' },
            include: { uploadedBy: { select: { id: true, name: true } } },
          },
          dependenciesAsSource: {
            include: { targetItem: { select: { id: true, name: true } } },
          },
          dependenciesAsTarget: {
            include: { sourceItem: { select: { id: true, name: true } } },
          },
        },
      });
      if (!item) {
        return { content: [{ type: 'text' as const, text: `Item not found: ${itemId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * create_item
   * Creates a new item in a group.
   */
  server.tool(
    'create_item',
    'Create a new item in a group.',
    {
      groupId: z.string().describe('The group ID to add the item to'),
      name: z.string().describe('Item name'),
      description: z.string().optional().describe('Optional item description'),
    },
    async ({ groupId, name, description }) => {
      const last = await prisma.item.findFirst({
        where: { groupId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;
      const item = await prisma.item.create({
        data: { groupId, name, description, position },
        include: { cellValues: true },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * update_item
   * Updates an item's name or description.
   */
  server.tool(
    'update_item',
    'Update an item name or description.',
    {
      itemId: z.string().describe('The item ID'),
      name: z.string().optional().describe('New item name'),
      description: z.string().optional().describe('New description'),
    },
    async ({ itemId, name, description }) => {
      const item = await prisma.item.update({
        where: { id: itemId },
        data: { ...(name !== undefined && { name }), ...(description !== undefined && { description }) },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * move_item
   * Moves an item to a different group.
   */
  server.tool(
    'move_item',
    'Move an item to a different group (within the same board).',
    {
      itemId: z.string().describe('The item ID'),
      targetGroupId: z.string().describe('The destination group ID'),
    },
    async ({ itemId, targetGroupId }) => {
      const last = await prisma.item.findFirst({
        where: { groupId: targetGroupId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;
      const item = await prisma.item.update({
        where: { id: itemId },
        data: { groupId: targetGroupId, position },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * delete_item
   * Permanently deletes an item and all its data.
   */
  server.tool(
    'delete_item',
    'Permanently delete an item and all its cell values, comments, and attachments. This is irreversible.',
    { itemId: z.string().describe('The item ID to delete') },
    async ({ itemId }) => {
      await prisma.item.delete({ where: { id: itemId } });
      return { content: [{ type: 'text' as const, text: `Item ${itemId} deleted.` }] };
    },
  );
}
