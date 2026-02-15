import { z } from 'zod';
import { prisma } from '@/server/db';
import { automationQueue } from '@/server/queues/automation';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

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

      await automationQueue.add('cell.updated', {
        itemId: input.itemId,
        columnId: input.columnId,
        value: input.value,
        userId: ctx.session.user.id,
      });

      return cellValue;
    }),
});
