import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';

export const searchRouter = router({
  query: protectedProcedure
    .input(
      z.object({
        q: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input.limit;

      // Search items the user has access to (via workspace membership)
      const items = await prisma.item.findMany({
        where: {
          name: { contains: input.q, mode: 'insensitive' },
          group: {
            board: {
              workspace: {
                members: { some: { userId } },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          group: {
            select: {
              id: true,
              title: true,
              board: {
                select: {
                  id: true,
                  title: true,
                  workspaceId: true,
                },
              },
            },
          },
          cellValues: {
            select: {
              value: true,
              column: { select: { type: true, title: true } },
            },
            take: 5,
          },
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      });

      // Search boards
      const boards = await prisma.board.findMany({
        where: {
          title: { contains: input.q, mode: 'insensitive' },
          workspace: {
            members: { some: { userId } },
          },
        },
        select: {
          id: true,
          title: true,
          workspaceId: true,
          _count: { select: { groups: true } },
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      return { items, boards };
    }),
});
