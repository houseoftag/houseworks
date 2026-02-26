import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const conditionSchema = z.object({
  columnId: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'is_empty']),
  value: z.string().optional(),
});

const triggerSchema = z.object({
  type: z.enum([
    'STATUS_CHANGED',
    'PRIORITY_CHANGED',
    'ASSIGNEE_CHANGED',
    'ITEM_CREATED',
    'DATE_ARRIVES',
    'COLUMN_CHANGED',
    'CRON_INTERVAL',
    'CRON_DAILY',
    'CRON_WEEKLY',
  ]),
  columnId: z.string().cuid().optional(),
  to: z.string().optional(),
  from: z.string().optional(),
  // CRON_INTERVAL
  intervalHours: z.number().int().min(1).max(168).optional(),
  // CRON_DAILY / CRON_WEEKLY
  time: z.string().optional(),
  // CRON_WEEKLY
  dayOfWeek: z.string().optional(),
  // AND/OR conditions
  logic: z.enum(['AND', 'OR']).optional(),
  conditions: z.array(conditionSchema).optional(),
});

const actionSchema = z.object({
  type: z.enum([
    'LOG',
    'NOTIFY',
    'MOVE_TO_GROUP',
    'SET_PERSON',
    'SET_STATUS',
    'SET_COLUMN',
    'CREATE_ITEM',
    'MOVE_ITEM',
    'IF_ELSE',
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  // IF_ELSE fields
  condition: z
    .object({
      columnId: z.string(),
      operator: z.enum(['equals', 'not_equals', 'contains', 'is_empty']),
      value: z.string().optional(),
    })
    .optional(),
  thenActions: z.array(z.record(z.string(), z.unknown())).optional(),
  elseActions: z.array(z.record(z.string(), z.unknown())).optional(),
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
          trigger: input.trigger as unknown as Prisma.InputJsonValue,
          actions: input.actions as unknown as Prisma.InputJsonValue,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).optional(),
        trigger: triggerSchema.optional(),
        actions: z.array(actionSchema).min(1).optional(),
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
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.trigger !== undefined && { trigger: input.trigger as unknown as Prisma.InputJsonValue }),
          ...(input.actions !== undefined && { actions: input.actions as unknown as Prisma.InputJsonValue }),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
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

      await prisma.automation.delete({ where: { id: input.id } });
      return { ok: true };
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
