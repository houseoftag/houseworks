import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const DependencyTypeEnum = z.enum(['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES']);

/**
 * Check for circular dependency chains in BLOCKS/BLOCKED_BY relationships.
 * Returns true if adding sourceItemId → targetItemId would create a cycle.
 */
async function wouldCreateCycle(
  sourceItemId: string,
  targetItemId: string,
): Promise<boolean> {
  // BFS from targetItemId following BLOCKS edges to see if we reach sourceItemId
  const visited = new Set<string>();
  const queue = [targetItemId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceItemId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find all items that `current` blocks (current is source, type BLOCKS)
    // AND all items where current is target of BLOCKED_BY (equivalent direction)
    const deps = await prisma.itemDependency.findMany({
      where: {
        OR: [
          { sourceItemId: current, type: 'BLOCKS' },
          { targetItemId: current, type: 'BLOCKED_BY' },
        ],
      },
      select: { sourceItemId: true, targetItemId: true, type: true },
    });

    for (const dep of deps) {
      const next = dep.type === 'BLOCKS' ? dep.targetItemId : dep.sourceItemId;
      if (!visited.has(next)) queue.push(next);
    }
  }

  return false;
}

export const dependenciesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        sourceItemId: z.string().cuid(),
        targetItemId: z.string().cuid(),
        type: DependencyTypeEnum,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (input.sourceItemId === input.targetItemId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link an item to itself' });
      }

      // Verify both items exist and user has workspace access
      const [source, target] = await Promise.all([
        prisma.item.findFirst({
          where: {
            id: input.sourceItemId,
            group: { board: { workspace: { members: { some: { userId } } } } },
          },
          select: { id: true },
        }),
        prisma.item.findFirst({
          where: {
            id: input.targetItemId,
            group: { board: { workspace: { members: { some: { userId } } } } },
          },
          select: { id: true },
        }),
      ]);

      if (!source || !target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found or no access' });
      }

      // Circular dependency check for BLOCKS/BLOCKED_BY
      if (input.type === 'BLOCKS' || input.type === 'BLOCKED_BY') {
        const hasCycle = await wouldCreateCycle(input.sourceItemId, input.targetItemId);
        if (hasCycle) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This dependency would create a circular chain',
          });
        }
      }

      return prisma.itemDependency.create({
        data: {
          sourceItemId: input.sourceItemId,
          targetItemId: input.targetItemId,
          type: input.type,
          createdById: userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const dep = await prisma.itemDependency.findFirst({
        where: {
          id: input.id,
          sourceItem: {
            group: { board: { workspace: { members: { some: { userId } } } } },
          },
        },
      });

      if (!dep) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.itemDependency.delete({ where: { id: input.id } });
    }),

  listByItem: protectedProcedure
    .input(z.object({ itemId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify access
      const item = await prisma.item.findFirst({
        where: {
          id: input.itemId,
          group: { board: { workspace: { members: { some: { userId } } } } },
        },
        select: { id: true },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const [asSource, asTarget] = await Promise.all([
        prisma.itemDependency.findMany({
          where: { sourceItemId: input.itemId },
          include: {
            targetItem: {
              select: {
                id: true,
                name: true,
                group: {
                  select: {
                    board: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.itemDependency.findMany({
          where: { targetItemId: input.itemId },
          include: {
            sourceItem: {
              select: {
                id: true,
                name: true,
                group: {
                  select: {
                    board: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return { asSource, asTarget };
    }),

  listByBoard: protectedProcedure
    .input(z.object({ boardId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: { members: { some: { userId } } },
        },
        select: { id: true },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.itemDependency.findMany({
        where: {
          type: { in: ['BLOCKS', 'BLOCKED_BY'] },
          sourceItem: { group: { boardId: input.boardId } },
          targetItem: { group: { boardId: input.boardId } },
        },
        select: {
          id: true,
          sourceItemId: true,
          targetItemId: true,
          type: true,
        },
      });
    }),
});
