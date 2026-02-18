import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logActivity } from '@/server/services/activity';

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
        select: { id: true, workspaceId: true },
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

      const group = await prisma.group.create({
        data: {
          boardId: input.boardId,
          title: input.title,
          color: input.color,
          position,
        },
      });

      await logActivity({
        workspaceId: board.workspaceId,
        boardId: board.id,
        userId: ctx.session.user.id,
        type: 'BOARD_UPDATED',
        entityType: 'GROUP',
        entityId: group.id,
        metadata: { action: 'group_created', title: input.title },
      });

      return group;
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
        include: { board: { select: { workspaceId: true } } },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const updated = await prisma.group.update({
        where: { id: input.id },
        data: {
          title: input.title,
          color: input.color,
          position: input.position,
        },
      });

      await logActivity({
        workspaceId: group.board.workspaceId,
        boardId: group.boardId,
        userId: ctx.session.user.id,
        type: 'BOARD_UPDATED',
        entityType: 'GROUP',
        entityId: group.id,
        field: input.title !== undefined ? 'title' : input.color !== undefined ? 'color' : 'position',
        oldValue: { title: group.title, color: group.color },
        newValue: { title: input.title, color: input.color },
      });

      return updated;
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
        include: { board: { select: { workspaceId: true } } },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.group.delete({
        where: { id: input.id },
      });

      await logActivity({
        workspaceId: group.board.workspaceId,
        boardId: group.boardId,
        userId: ctx.session.user.id,
        type: 'BOARD_UPDATED',
        entityType: 'GROUP',
        entityId: group.id,
        metadata: { action: 'group_deleted', title: group.title },
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
