import { z } from 'zod';
import { prisma } from '@/server/db';
import { automationQueue } from '@/server/queues/automation';
import { createNotification, logActivity } from '@/server/notifications';
import { evaluateAutomations } from '@/server/automations/evaluate';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import type { RecurrenceRule } from './items';

/* ------------------------------------------------------------------ */
/*  Recurrence: advance due date helper (duplicated for inline use)    */
/* ------------------------------------------------------------------ */
function advanceDueDate(fromDate: Date, rule: RecurrenceRule): Date {
  const d = new Date(fromDate);
  switch (rule.type) {
    case 'daily': d.setDate(d.getDate() + (rule.interval || 1)); break;
    case 'weekly': d.setDate(d.getDate() + 7 * (rule.interval || 1)); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + (rule.interval || 1)); break;
    case 'custom': d.setDate(d.getDate() + (rule.interval || 1)); break;
  }
  return d;
}

export const cellsRouter = router({
  update: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        columnId: z.string().cuid(),
        value: z.unknown(),
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
        select: {
          id: true,
          group: {
            select: {
              boardId: true,
              board: {
                select: { workspaceId: true },
              },
            },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const column = await prisma.column.findFirst({
        where: {
          id: input.columnId,
          board: {
            workspace: {
              members: { some: { userId: ctx.session.user.id } },
            },
          },
        },
        select: { id: true, type: true, boardId: true, settings: true },
      });

      if (!column) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (item.group.boardId !== column.boardId) {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }

      const value = input.value;
      const allowNull = value === null || value === undefined;

      if (column.type === 'TEXT') {
        if (!allowNull && typeof value !== 'string') {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      if (column.type === 'DATE') {
        if (!allowNull && typeof value !== 'string') {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
        if (typeof value === 'string' && Number.isNaN(Date.parse(value))) {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      if (column.type === 'STATUS') {
        if (
          !allowNull &&
          (!value ||
            typeof value !== 'object' ||
            typeof (value as { label?: string }).label !== 'string' ||
            typeof (value as { color?: string }).color !== 'string')
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      if (column.type === 'PERSON') {
        if (
          !allowNull &&
          (!value ||
            typeof value !== 'object' ||
            typeof (value as { userId?: string }).userId !== 'string')
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
        if (!allowNull) {
          const userId = (value as { userId?: string }).userId;
          const membership = await prisma.workspaceMember.findFirst({
            where: {
              workspaceId: item.group.board.workspaceId,
              userId,
            },
            select: { id: true },
          });
          if (!membership) {
            throw new TRPCError({ code: 'BAD_REQUEST' });
          }
        }
      }

      if (column.type === 'LINK') {
        if (
          !allowNull &&
          (!value ||
            typeof value !== 'object' ||
            typeof (value as { url?: string }).url !== 'string')
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      if (column.type === 'NUMBER') {
        if (!allowNull && typeof value !== 'number') {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      if (column.type === 'TIMELINE') {
        if (
          !allowNull &&
          (!value ||
            typeof value !== 'object' ||
            typeof (value as { start?: string }).start !== 'string' ||
            typeof (value as { end?: string }).end !== 'string')
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST' });
        }
      }

      // Get old value for activity log
      const existingCell = await prisma.cellValue.findUnique({
        where: { itemId_columnId: { itemId: input.itemId, columnId: input.columnId } },
        select: { value: true },
      });
      const oldValue = existingCell?.value ?? null;

      const cellValue = await prisma.cellValue.upsert({
        where: {
          itemId_columnId: {
            itemId: input.itemId,
            columnId: input.columnId,
          },
        },
        update: {
          value: input.value as any,
        },
        create: {
          itemId: input.itemId,
          columnId: input.columnId,
          value: input.value as any,
        },
      });

      // Get item name for notification messages
      const itemForNotif = await prisma.item.findUnique({
        where: { id: input.itemId },
        select: { name: true },
      });
      const itemName = itemForNotif?.name ?? 'Item';
      const boardId = item.group.boardId;
      const workspaceId = item.group.board.workspaceId;

      // Activity log + notifications for PERSON changes
      if (column.type === 'PERSON') {
        await logActivity({
          workspaceId,
          boardId,
          itemId: input.itemId,
          userId: ctx.session.user.id,
          type: 'ASSIGNMENT',
          field: 'Person',
          oldValue,
          newValue: input.value,
        });

        const newPerson = input.value as { userId?: string; name?: string } | null;
        if (newPerson?.userId && newPerson.userId !== ctx.session.user.id) {
          await createNotification({
            userId: newPerson.userId,
            type: 'ASSIGNMENT',
            title: 'You were assigned',
            message: `You were assigned to "${itemName}"`,
            itemId: input.itemId,
            boardId,
            link: `/workspace/${workspaceId}/board?item=${input.itemId}`,
          });
        }
      }

      // Activity log + notifications for STATUS changes
      if (column.type === 'STATUS') {
        const oldLabel = (oldValue as { label?: string } | null)?.label ?? 'None';
        const newLabel = (input.value as { label?: string } | null)?.label ?? 'None';
        await logActivity({
          workspaceId,
          boardId,
          itemId: input.itemId,
          userId: ctx.session.user.id,
          type: 'STATUS_CHANGE',
          field: 'Status',
          oldValue,
          newValue: input.value,
        });

        // Notify all users who have updates on this item (followers)
        if (oldLabel !== newLabel) {
          const followers = await prisma.update.findMany({
            where: { itemId: input.itemId },
            select: { userId: true },
            distinct: ['userId'],
          });
          const uniqueFollowers = [...new Set(followers.map(f => f.userId))].filter(
            id => id !== ctx.session.user.id
          );
          await Promise.all(
            uniqueFollowers.map(uid =>
              createNotification({
                userId: uid,
                type: 'STATUS_CHANGE',
                title: 'Status changed',
                message: `"${itemName}" status: ${oldLabel} → ${newLabel}`,
                itemId: input.itemId,
                boardId,
                link: `/workspace/${workspaceId}/board?item=${input.itemId}`,
              })
            )
          );
        }
      }

      // Activity log for other field types
      if (column.type !== 'PERSON' && column.type !== 'STATUS') {
        await logActivity({
          workspaceId,
          boardId,
          itemId: input.itemId,
          userId: ctx.session.user.id,
          type: 'FIELD_EDIT',
          field: column.type,
          oldValue,
          newValue: input.value,
        });
      }

      void automationQueue.add('cell.updated', {
        itemId: input.itemId,
        columnId: input.columnId,
        value: input.value,
        userId: ctx.session.user.id,
      }).catch(() => { /* Redis may be unavailable */ });

      // HW-M11: Inline rule evaluation for immediate automation processing
      const triggerType =
        column.type === 'STATUS'
          ? 'STATUS_CHANGED' as const
          : column.type === 'PERSON'
            ? 'ASSIGNEE_CHANGED' as const
            : null;

      // Detect priority columns by title convention
      const isPriority =
        !triggerType &&
        (await prisma.column.findUnique({
          where: { id: input.columnId },
          select: { title: true },
        }).then((c) => /priority/i.test(c?.title ?? '')));

      const resolvedTrigger = triggerType ?? (isPriority ? 'PRIORITY_CHANGED' as const : null);

      if (resolvedTrigger) {
        void evaluateAutomations({
          type: resolvedTrigger,
          itemId: input.itemId,
          columnId: input.columnId,
          oldValue: oldValue,
          newValue: input.value,
          userId: ctx.session.user.id,
          boardId: boardId,
          workspaceId: workspaceId,
        });
      }

      // HW-M16: Auto-generate next recurring instance when status → Done/Complete
      if (column.type === 'STATUS') {
        const newLabel = (input.value as { label?: string } | null)?.label?.toLowerCase() ?? '';
        if (newLabel === 'done' || newLabel === 'complete') {
          const fullItem = await prisma.item.findUnique({
            where: { id: input.itemId },
            include: { cellValues: { include: { column: true } } },
          });
          const recurrence = fullItem?.recurrence as RecurrenceRule | null;
          if (fullItem && recurrence) {
            // Find the date cell for this item
            const dateCell = fullItem.cellValues.find((cv) => cv.column.type === 'DATE');
            const currentDue = dateCell?.value && typeof dateCell.value === 'string'
              ? new Date(dateCell.value)
              : new Date();
            const nextDue = advanceDueDate(currentDue, recurrence);
            const nextDueStr = nextDue.toISOString().slice(0, 10);

            // Find the first status option to reset to
            const statusCol = fullItem.cellValues.find((cv) => cv.column.type === 'STATUS');
            const statusSettings = statusCol?.column.settings as { options?: Record<string, string> } | null;
            const allOptions = statusSettings?.options ? Object.entries(statusSettings.options) : [];
            const firstStatus = allOptions.length > 0
              ? { label: allOptions[0]![0], color: allOptions[0]![1] }
              : null;

            // Create the next instance
            const newItem = await prisma.item.create({
              data: {
                groupId: fullItem.groupId,
                name: fullItem.name.replace(/ \(recurring\)$/, '') + ' (recurring)',
                position: fullItem.position + 0.01,
                recurrence: recurrence as object,
                nextDueDate: advanceDueDate(nextDue, recurrence),
              },
            });

            // Copy cell values, resetting status and advancing date
            for (const cv of fullItem.cellValues) {
              let newValue = cv.value;
              if (cv.column.type === 'STATUS' && firstStatus) {
                newValue = firstStatus;
              } else if (cv.column.type === 'DATE') {
                newValue = nextDueStr;
              }
              await prisma.cellValue.create({
                data: {
                  itemId: newItem.id,
                  columnId: cv.columnId,
                  value: newValue ?? undefined,
                },
              });
            }

            // Clear recurrence from the completed item
            await prisma.item.update({
              where: { id: fullItem.id },
              data: { recurrence: null, nextDueDate: null },
            });
          }
        }
      }

      // HW-M16: DUE_DATE_APPROACHING - check when date is set/changed
      if (column.type === 'DATE' && input.value && typeof input.value === 'string') {
        const dueDate = new Date(input.value);
        const now = new Date();
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
          // Notify assigned user
          const personCells = await prisma.cellValue.findMany({
            where: { itemId: input.itemId, column: { type: 'PERSON' } },
            select: { value: true },
          });
          const assignees = personCells
            .map((c) => (c.value as { userId?: string } | null)?.userId)
            .filter((id): id is string => !!id && id !== ctx.session.user.id);

          await Promise.all(
            assignees.map((uid) =>
              createNotification({
                userId: uid,
                type: 'DUE_DATE',
                title: 'Due date approaching',
                message: `"${itemName}" is due ${dueDate.toLocaleDateString()}`,
                itemId: input.itemId,
                boardId,
                link: `/workspace/${workspaceId}/board?item=${input.itemId}`,
              }),
            ),
          );

          // Also fire automation evaluation
          void evaluateAutomations({
            type: 'DUE_DATE_APPROACHING',
            itemId: input.itemId,
            columnId: input.columnId,
            newValue: input.value,
            userId: ctx.session.user.id,
            boardId,
            workspaceId,
          });
        }
      }

      return cellValue;
    }),
});
