import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const columnsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        boardId: z.string().cuid(),
        title: z.string().min(1),
        type: z.enum(['TEXT', 'STATUS', 'PERSON', 'DATE', 'LINK', 'NUMBER', 'TIMELINE']),
        settings: z.unknown().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
        select: { id: true },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const lastColumn = await prisma.column.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const position =
        input.position ?? (lastColumn?.position ? lastColumn.position + 1 : 1);

      return prisma.column.create({
        data: {
          boardId: input.boardId,
          title: input.title,
          type: input.type,
          settings: (input.settings ?? {}) as any,
          position,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        settings: z.unknown().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const column = await prisma.column.findFirst({
        where: {
          id: input.id,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
        select: { id: true },
      });

      if (!column) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.column.update({
        where: { id: input.id },
        data: {
          title: input.title,
          settings: input.settings as any,
          position: input.position,
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const column = await prisma.column.findFirst({
        where: {
          id: input.id,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
        select: { id: true },
      });

      if (!column) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.column.delete({
        where: { id: input.id },
      });

      return { ok: true };
    }),
  reorder: protectedProcedure
    .input(
      z.object({
        boardId: z.string().cuid(),
        columnIds: z.array(z.string().cuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
        select: { id: true },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.$transaction(
        input.columnIds.map((id, index) =>
          prisma.column.update({
            where: { id },
            data: { position: index + 1 },
          }),
        ),
      );

      return { ok: true };
    }),
});
