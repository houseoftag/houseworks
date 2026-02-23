import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const filtersSchema = z.object({
  status: z.string().nullable().optional(),
  person: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  dueDateFrom: z.string().nullable().optional(),
  dueDateTo: z.string().nullable().optional(),
});

const sortSchema = z.object({
  field: z.string(),
  dir: z.enum(['asc', 'desc']),
});

export const boardViewsRouter = router({
  list: protectedProcedure
    .input(z.object({ boardId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
        select: { id: true },
      });
      if (!board) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.boardView.findMany({
        where: { boardId: input.boardId },
        orderBy: { position: 'asc' },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      boardId: z.string().cuid(),
      name: z.string().min(1),
      filters: filtersSchema,
      sort: sortSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
        select: { id: true },
      });
      if (!board) throw new TRPCError({ code: 'NOT_FOUND' });

      const last = await prisma.boardView.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      return prisma.boardView.create({
        data: {
          boardId: input.boardId,
          name: input.name,
          filters: input.filters as object,
          sort: input.sort as object,
          position: (last?.position ?? 0) + 1,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      name: z.string().min(1).optional(),
      filters: filtersSchema.optional(),
      sort: sortSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const view = await prisma.boardView.findFirst({
        where: {
          id: input.id,
          board: { workspace: { members: { some: { userId: ctx.session.user.id } } } },
        },
        select: { id: true },
      });
      if (!view) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.boardView.update({
        where: { id: input.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.filters ? { filters: input.filters as object } : {}),
          ...(input.sort ? { sort: input.sort as object } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const view = await prisma.boardView.findFirst({
        where: {
          id: input.id,
          board: { workspace: { members: { some: { userId: ctx.session.user.id } } } },
        },
        select: { id: true },
      });
      if (!view) throw new TRPCError({ code: 'NOT_FOUND' });

      await prisma.boardView.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
