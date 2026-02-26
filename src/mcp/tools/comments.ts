import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerCommentTools(server: McpServer, prisma: PrismaClient, actorUserId: string) {
  /**
   * list_comments
   * Returns all comments (updates) on an item in chronological order.
   */
  server.tool(
    'list_comments',
    'List all comments (updates) on an item in chronological order.',
    { itemId: z.string().describe('The item ID') },
    async ({ itemId }) => {
      const updates = await prisma.update.findMany({
        where: { itemId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(updates, null, 2) }] };
    },
  );

  /**
   * add_comment
   * Adds a comment to an item. Uses the MCP actor user.
   */
  server.tool(
    'add_comment',
    'Add a comment to an item. Uses the HOUSEWORKS_MCP_USER_ID as the comment author.',
    {
      itemId: z.string().describe('The item ID'),
      content: z.string().min(1).describe('Comment text (markdown supported)'),
    },
    async ({ itemId, content }) => {
      const update = await prisma.update.create({
        data: { itemId, userId: actorUserId, content },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(update, null, 2) }] };
    },
  );

  /**
   * delete_comment
   * Deletes a comment by ID.
   */
  server.tool(
    'delete_comment',
    'Delete a comment by its ID.',
    { commentId: z.string().describe('The comment (update) ID') },
    async ({ commentId }) => {
      await prisma.update.delete({ where: { id: commentId } });
      return { content: [{ type: 'text' as const, text: `Comment ${commentId} deleted.` }] };
    },
  );
}
