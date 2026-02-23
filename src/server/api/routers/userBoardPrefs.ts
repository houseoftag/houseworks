import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const userBoardPrefsRouter = router({
  get: protectedProcedure
    .input(z.object({ boardId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      return prisma.userBoardPrefs.findUnique({
        where: {
          userId_boardId: {
            userId: ctx.session.user.id,
            boardId: input.boardId,
          },
        },
      });
    }),

  setColumnWidths: protectedProcedure
    .input(z.object({
      boardId: z.string().cuid(),
      widths: z.record(z.string(), z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to the board
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
        select: { id: true },
      });
      if (!board) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.userBoardPrefs.upsert({
        where: {
          userId_boardId: {
            userId: ctx.session.user.id,
            boardId: input.boardId,
          },
        },
        create: {
          userId: ctx.session.user.id,
          boardId: input.boardId,
          columnWidths: input.widths,
        },
        update: {
          columnWidths: input.widths,
        },
      });
    }),
});
