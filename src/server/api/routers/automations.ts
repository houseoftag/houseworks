import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const triggerSchema = z.object({
  type: z.enum(['STATUS_CHANGED', 'DATE_ARRIVES', 'ITEM_CREATED']),
  columnId: z.string().cuid().optional(),
  to: z.string().optional(),
});

const actionSchema = z.object({
  type: z.enum(['LOG', 'NOTIFY', 'MOVE_ITEM', 'CREATE_ITEM', 'SET_COLUMN', 'SET_STATUS']),
  payload: z.record(z.unknown()).optional(),
});

export const automationsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        boardId: z.string().cuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.automation.findMany({
        where: {
          workspaceId: input.workspaceId,
          boardId: input.boardId,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        boardId: z.string().cuid().optional(),
        name: z.string().min(1),
        trigger: triggerSchema,
        actions: z.array(actionSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!membership || membership.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.automation.create({
        data: {
          workspaceId: input.workspaceId,
          boardId: input.boardId,
          name: input.name,
          trigger: input.trigger,
          actions: input.actions,
        },
      });
    }),
  toggle: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const automation = await prisma.automation.findUnique({
        where: { id: input.id },
      });

      if (!automation) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: automation.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!membership || membership.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.automation.update({
        where: { id: input.id },
        data: { enabled: input.enabled },
      });
    }),
  logs: protectedProcedure
    .input(z.object({ automationId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const automation = await prisma.automation.findUnique({
        where: { id: input.automationId },
      });

      if (!automation) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: automation.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { id: true },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.automationLog.findMany({
        where: { automationId: input.automationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),
});
