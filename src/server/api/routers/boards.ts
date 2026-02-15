import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

const boardSelect = {
  include: {
    workspace: {
      select: {
        id: true,
        name: true,
      },
    },
    columns: {
      orderBy: { position: 'asc' },
    },
    groups: {
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            cellValues: {
              include: {
                column: true,
              },
            },
          },
        },
      },
    },
  },
} as const;

export const boardsRouter = router({
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    return prisma.board.findFirst({
      where: {
        workspace: {
          members: { some: { userId: ctx.session.user.id } },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: boardSelect.include,
    });
  }),
  listByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.board.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
        },
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(({ ctx, input }) => {
      return prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
        include: boardSelect.include,
      });
    }),
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.board.create({
        data: {
          workspaceId: input.workspaceId,
          ownerId: ctx.session.user.id,
          title: input.title,
          description: input.description,
        },
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.board.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
        },
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await prisma.board.delete({
        where: { id: input.id },
      });

      return { ok: true };
    }),
});
