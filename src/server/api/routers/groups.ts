import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const groupsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        boardId: z.string().cuid(),
        title: z.string().min(1),
        color: z.string().optional(),
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
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const lastGroup = await prisma.group.findFirst({
        where: { boardId: input.boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const position =
        input.position ?? (lastGroup?.position ? lastGroup.position + 1 : 1);

      return prisma.group.create({
        data: {
          boardId: input.boardId,
          title: input.title,
          color: input.color,
          position,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        color: z.string().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findFirst({
        where: {
          id: input.id,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.group.update({
        where: { id: input.id },
        data: {
          title: input.title,
          color: input.color,
          position: input.position,
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findFirst({
        where: {
          id: input.id,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.group.delete({
        where: { id: input.id },
      });

      return { ok: true };
    }),
  reorder: protectedProcedure
    .input(
      z.object({
        boardId: z.string().cuid(),
        groupIds: z.array(z.string().cuid()),
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
        input.groupIds.map((id, index) =>
          prisma.group.update({
            where: { id },
            data: { position: index + 1 },
          }),
        ),
      );

      return { ok: true };
    }),
});
