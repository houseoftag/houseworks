import { z } from 'zod';
import { prisma } from '@/server/db';
import { automationQueue } from '@/server/queues/automation';
import { createNotification, logActivity } from '@/server/notifications';
import { evaluateAutomations } from '@/server/automations/evaluate';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

/* ------------------------------------------------------------------ */
/*  Recurrence helpers                                                  */
/* ------------------------------------------------------------------ */

type RecurrenceRule = {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  interval: number;
  dayOfWeek?: number; // 0=Sun, 1=Mon, ...
  dayOfMonth?: number;
};

function advanceDueDate(fromDate: Date, rule: RecurrenceRule): Date {
  const d = new Date(fromDate);
  switch (rule.type) {
    case 'daily':
      d.setDate(d.getDate() + (rule.interval || 1));
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7 * (rule.interval || 1));
      break;
    case 'biweekly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + (rule.interval || 1));
      break;
    case 'custom':
      d.setDate(d.getDate() + (rule.interval || 1));
      break;
  }
  return d;
}

function recurrenceToText(rule: RecurrenceRule): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (rule.type) {
    case 'daily':
      return rule.interval === 1 ? 'Every day' : `Every ${rule.interval} days`;
    case 'weekly':
      return rule.dayOfWeek != null
        ? `Every ${days[rule.dayOfWeek]}`
        : rule.interval === 1 ? 'Every week' : `Every ${rule.interval} weeks`;
    case 'biweekly':
      return rule.dayOfWeek != null ? `Every other ${days[rule.dayOfWeek]}` : 'Every 2 weeks';
    case 'monthly':
      return rule.interval === 1 ? 'Every month' : `Every ${rule.interval} months`;
    case 'custom':
      return `Every ${rule.interval} days`;
    default:
      return 'Recurring';
  }
}

export { recurrenceToText, type RecurrenceRule };

export const itemsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string().cuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findFirst({
        where: {
          id: input.groupId,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
        select: {
          id: true,
          boardId: true,
          board: { select: { workspaceId: true } },
        },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const lastItem = await prisma.item.findFirst({
        where: { groupId: input.groupId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const position =
        input.position ?? (lastItem?.position ? lastItem.position + 1 : 1);

      const item = await prisma.item.create({
        data: {
          groupId: input.groupId,
          name: input.name,
          description: input.description,
          position,
        },
      });

      void automationQueue.add('item.created', {
        itemId: item.id,
        groupId: input.groupId,
        userId: ctx.session.user.id,
      }).catch(() => { /* Redis may be unavailable */ });

      await logActivity({
        workspaceId: group.board.workspaceId,
        boardId: group.boardId,
        itemId: item.id,
        userId: ctx.session.user.id,
        type: 'ITEM_CREATED',
        entityType: 'ITEM',
        entityId: item.id,
        metadata: { name: input.name, groupId: input.groupId },
      });

      // HW-M11: Inline rule evaluation for ITEM_CREATED
      void evaluateAutomations({
        type: 'ITEM_CREATED',
        itemId: item.id,
        userId: ctx.session.user.id,
        boardId: group.boardId,
        workspaceId: group.board.workspaceId,
      });

      return item;
    }),
  clone: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.item.findFirst({
        where: {
          id: input.id,
          group: {
            board: { workspace: { members: { some: { userId: ctx.session.user.id } } } },
          },
        },
        include: { cellValues: true },
      });
      if (!source) throw new TRPCError({ code: 'NOT_FOUND' });

      // Place clone right after the source item
      const newItem = await prisma.item.create({
        data: {
          groupId: source.groupId,
          name: `${source.name} (copy)`,
          position: source.position + 0.5,
        },
      });

      // Copy all cell values
      if (source.cellValues.length > 0) {
        await prisma.$transaction(
          source.cellValues.map(cv =>
            prisma.cellValue.create({
              data: {
                itemId: newItem.id,
                columnId: cv.columnId,
                value: cv.value ?? undefined,
              },
            })
          )
        );
      }

      return newItem;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        groupId: z.string().cuid().optional(),
        position: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.item.findFirst({
        where: {
          id: input.id,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        include: { group: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const isMoved = input.groupId && input.groupId !== item.groupId;

      const updated = await prisma.item.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          groupId: input.groupId,
          position: input.position,
        },
      });

      if (isMoved) {
        await logActivity({
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          itemId: item.id,
          userId: ctx.session.user.id,
          type: 'ITEM_MOVED',
          entityType: 'ITEM',
          entityId: item.id,
          oldValue: { groupId: item.groupId },
          newValue: { groupId: input.groupId },
        });
      } else if (input.name && input.name !== item.name) {
        await logActivity({
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          itemId: item.id,
          userId: ctx.session.user.id,
          type: 'FIELD_EDIT',
          entityType: 'ITEM',
          entityId: item.id,
          field: 'name',
          oldValue: { name: item.name },
          newValue: { name: input.name },
        });
      }

      return updated;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.item.findFirst({
        where: {
          id: input.id,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        include: { group: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await logActivity({
        workspaceId: item.group.board.workspaceId,
        boardId: item.group.boardId,
        itemId: item.id,
        userId: ctx.session.user.id,
        type: 'ITEM_DELETED',
        entityType: 'ITEM',
        entityId: item.id,
        metadata: { name: item.name },
      });

      await prisma.item.delete({
        where: { id: input.id },
      });

      return { ok: true };
    }),
  reorder: protectedProcedure
    .input(
      z.object({
        groupId: z.string().cuid(),
        itemIds: z.array(z.string().cuid()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findFirst({
        where: {
          id: input.groupId,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
        select: { id: true },
      });

      if (!group) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.$transaction(
        input.itemIds.map((id, index) =>
          prisma.item.update({
            where: { id },
            data: {
              groupId: input.groupId,
              position: index + 1,
            },
          }),
        ),
      );

      return { ok: true };
    }),
  getOne: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.item.findUnique({
        where: {
          id: input.id,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        include: {
          updates: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return item;
    }),
  getDetail: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.item.findUnique({
        where: {
          id: input.id,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        include: {
          group: {
            select: {
              id: true,
              title: true,
              board: {
                select: {
                  id: true,
                  title: true,
                  workspaceId: true,
                  columns: {
                    orderBy: { position: 'asc' as const },
                  },
                },
              },
            },
          },
          cellValues: {
            include: {
              column: true,
            },
          },
          updates: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc' as const,
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return item;
    }),
  getActivity: protectedProcedure
    .input(z.object({ itemId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const item = await prisma.item.findFirst({
        where: {
          id: input.itemId,
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

      return prisma.activityLog.findMany({
        where: { itemId: input.itemId },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }),
  createUpdate: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.item.findFirst({
        where: {
          id: input.itemId,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const update = await prisma.update.create({
        data: {
          itemId: input.itemId,
          userId: ctx.session.user.id,
          content: input.content,
        },
      });

      // Fetch item detail for activity log + notifications
      const itemDetail = await prisma.item.findUnique({
        where: { id: input.itemId },
        select: {
          name: true,
          group: { select: { boardId: true, board: { select: { workspaceId: true } } } },
        },
      });

      // Log activity
      await logActivity({
        workspaceId: itemDetail?.group.board.workspaceId ?? '',
        boardId: itemDetail?.group.boardId,
        itemId: input.itemId,
        userId: ctx.session.user.id,
        type: 'COMMENT',
        metadata: { content: input.content },
      });

      // Notify followers (users who have previously commented)
      const followers = await prisma.update.findMany({
        where: { itemId: input.itemId },
        select: { userId: true },
        distinct: ['userId'],
      });
      // Also notify assigned person
      const personCells = await prisma.cellValue.findMany({
        where: {
          itemId: input.itemId,
          column: { type: 'PERSON' },
        },
        select: { value: true },
      });
      const assignedUserIds = personCells
        .map(c => (c.value as { userId?: string } | null)?.userId)
        .filter((id): id is string => !!id);

      const allRecipients = [...new Set([
        ...followers.map(f => f.userId),
        ...assignedUserIds,
      ])].filter(id => id !== ctx.session.user.id);

      const userName = ctx.session.user.name ?? 'Someone';
      const itemName = itemDetail?.name ?? 'Item';
      const boardId = itemDetail?.group.boardId;
      const wsId = itemDetail?.group.board.workspaceId;

      await Promise.all(
        allRecipients.map(uid =>
          createNotification({
            userId: uid,
            type: 'COMMENT',
            title: 'New comment',
            message: `${userName} commented on "${itemName}"`,
            itemId: input.itemId,
            boardId: boardId ?? undefined,
            link: wsId ? `/workspace/${wsId}/board?item=${input.itemId}` : undefined,
          })
        )
      );

      return update;
    }),
  setRecurrence: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        recurrence: z
          .object({
            type: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']),
            interval: z.number().int().min(1),
            dayOfWeek: z.number().int().min(0).max(6).optional(),
            dayOfMonth: z.number().int().min(1).max(31).optional(),
          })
          .nullable(),
        startDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.item.findFirst({
        where: {
          id: input.itemId,
          group: {
            board: {
              workspace: {
                members: { some: { userId: ctx.session.user.id } },
              },
            },
          },
        },
        include: {
          cellValues: { include: { column: true } },
          group: { select: { boardId: true, board: { select: { workspaceId: true } } } },
        },
      });
      if (!item) throw new TRPCError({ code: 'NOT_FOUND' });

      let nextDueDate: Date | null = null;
      if (input.recurrence) {
        // Use startDate or existing date cell, or today
        const dateCell = item.cellValues.find((cv) => cv.column.type === 'DATE');
        const base = input.startDate
          ? new Date(input.startDate)
          : dateCell?.value && typeof dateCell.value === 'string'
            ? new Date(dateCell.value)
            : new Date();
        nextDueDate = advanceDueDate(base, input.recurrence as RecurrenceRule);

        // If startDate provided and no date cell exists, set it
        if (input.startDate && dateCell) {
          await prisma.cellValue.update({
            where: { id: dateCell.id },
            data: { value: input.startDate },
          });
        }
      }

      return prisma.item.update({
        where: { id: input.itemId },
        data: {
          recurrence: input.recurrence as object | null,
          nextDueDate,
        },
      });
    }),
});
