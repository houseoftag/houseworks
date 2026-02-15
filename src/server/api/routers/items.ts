import { z } from 'zod';
import { prisma } from '@/server/db';
import { automationQueue } from '@/server/queues/automation';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const itemsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        groupId: z.string().cuid(),
        name: z.string().min(1),
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
          position,
        },
      });

      await automationQueue.add('item.created', {
        itemId: item.id,
        groupId: input.groupId,
        userId: ctx.session.user.id,
      });

      return item;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).optional(),
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
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.item.update({
        where: { id: input.id },
        data: {
          name: input.name,
          groupId: input.groupId,
          position: input.position,
        },
      });
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
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

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

      return prisma.update.create({
        data: {
          itemId: input.itemId,
          userId: ctx.session.user.id,
          content: input.content,
        },
      });
    }),
});
