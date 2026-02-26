import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient, DependencyType } from '@prisma/client';
import { z } from 'zod';

const dependencyTypeEnum = z.enum(['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES']);

export function registerDependencyTools(server: McpServer, prisma: PrismaClient, actorUserId: string) {
  /**
   * list_dependencies
   * Returns all dependencies for an item (both as source and as target).
   */
  server.tool(
    'list_dependencies',
    'List all dependencies for an item — both outgoing (this item → others) and incoming (others → this item).',
    { itemId: z.string().describe('The item ID') },
    async ({ itemId }) => {
      const [asSource, asTarget] = await Promise.all([
        prisma.itemDependency.findMany({
          where: { sourceItemId: itemId },
          include: { targetItem: { select: { id: true, name: true, group: { select: { boardId: true, board: { select: { title: true } } } } } } },
        }),
        prisma.itemDependency.findMany({
          where: { targetItemId: itemId },
          include: { sourceItem: { select: { id: true, name: true, group: { select: { boardId: true, board: { select: { title: true } } } } } } },
        }),
      ]);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ outgoing: asSource, incoming: asTarget }, null, 2),
        }],
      };
    },
  );

  /**
   * add_dependency
   * Creates a dependency between two items.
   */
  server.tool(
    'add_dependency',
    `Add a dependency between two items.
Types:
  BLOCKS     — sourceItem blocks targetItem
  BLOCKED_BY — sourceItem is blocked by targetItem
  RELATES_TO — general relation
  DUPLICATES — sourceItem duplicates targetItem`,
    {
      sourceItemId: z.string().describe('The source item ID'),
      targetItemId: z.string().describe('The target item ID'),
      type: dependencyTypeEnum.describe('Dependency type'),
    },
    async ({ sourceItemId, targetItemId, type }) => {
      const dep = await prisma.itemDependency.create({
        data: { sourceItemId, targetItemId, type: type as DependencyType, createdById: actorUserId },
        include: {
          sourceItem: { select: { id: true, name: true } },
          targetItem: { select: { id: true, name: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(dep, null, 2) }] };
    },
  );

  /**
   * remove_dependency
   * Removes a dependency by its ID.
   */
  server.tool(
    'remove_dependency',
    'Remove a dependency by its ID.',
    { dependencyId: z.string().describe('The dependency ID to remove') },
    async ({ dependencyId }) => {
      await prisma.itemDependency.delete({ where: { id: dependencyId } });
      return { content: [{ type: 'text' as const, text: `Dependency ${dependencyId} removed.` }] };
    },
  );
}
