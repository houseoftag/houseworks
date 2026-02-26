import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const activityRouter = router({
  getRecent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        limit: z.number().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, limit } = input;

      // Verify membership
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (!membership) {
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (!workspace || workspace.ownerId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
      }

      return prisma.activityLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: { select: { id: true, name: true, image: true } },
          board: { select: { id: true, title: true } },
          item: { select: { id: true, name: true } },
        },
      });
    }),

  getForItem: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        cursor: z.string().cuid().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { itemId, cursor, limit } = input;

      // Verify access
      const item = await prisma.item.findFirst({
        where: {
          id: itemId,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        select: { id: true },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      const items = await prisma.activityLog.findMany({
        where: {
          itemId,
          ...(cursor && { id: { lt: cursor } }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        boardId: z.string().cuid().optional(),
        itemId: z.string().cuid().optional(),
        userId: z.string().cuid().optional(),
        type: z.enum(['COMMENT', 'STATUS_CHANGE', 'ASSIGNMENT', 'FIELD_EDIT', 'ITEM_CREATED', 'ITEM_DELETED', 'ITEM_MOVED', 'BOARD_CREATED', 'BOARD_UPDATED', 'BOARD_DELETED', 'BOARD_DUPLICATED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'AUTOMATION_TRIGGERED', 'ATTACHMENT_ADDED', 'ATTACHMENT_DELETED']).optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        cursor: z.string().cuid().optional(),
        limit: z.number().min(1).max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, boardId, itemId, userId, type, dateFrom, dateTo, cursor, limit } = input;

      // Verify the user is a member of this workspace
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: ctx.session.user.id,
          },
        },
      });
      if (!membership) {
        // Also allow workspace owner
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });
        if (!workspace || workspace.ownerId !== ctx.session.user.id) {
          throw new Error('Not a member of this workspace');
        }
      }

      const where = {
        workspaceId,
        ...(boardId && { boardId }),
        ...(itemId && { itemId }),
        ...(userId && { userId }),
        ...(type && { type }),
        ...((dateFrom || dateTo) && {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }),
        ...(cursor && { id: { lt: cursor } }),
      };

      const items = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        include: {
          user: { select: { id: true, name: true, image: true } },
          board: { select: { id: true, title: true } },
          item: { select: { id: true, name: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),
});
