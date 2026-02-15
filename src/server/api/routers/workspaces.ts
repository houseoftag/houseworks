import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { ColumnType, WorkspaceRole } from '@prisma/client';
import { TRPCError } from '@trpc/server';

export const workspacesRouter = router({
  listMine: protectedProcedure.query(({ ctx }) => {
    return prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: ctx.session.user.id },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }),
  members: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
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

      return prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }),
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        memberId: z.string().cuid(),
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!actor || actor.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      if (input.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const target = await prisma.workspaceMember.findFirst({
        where: {
          id: input.memberId,
          workspaceId: input.workspaceId,
        },
        select: { id: true },
      });

      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return prisma.workspaceMember.update({
        where: { id: input.memberId },
        data: { role: input.role },
      });
    }),
  removeMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        memberId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actor = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!actor || actor.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const target = await prisma.workspaceMember.findFirst({
        where: {
          id: input.memberId,
          workspaceId: input.workspaceId,
        },
        select: { userId: true, role: true },
      });

      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Owners cannot be removed easily, especially if they are the owner of the workspace record
      if (target.role === 'OWNER') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Owners cannot be removed.',
        });
      }

      return prisma.workspaceMember.delete({
        where: { id: input.memberId },
      });
    }),
  getDefault: protectedProcedure.query(({ ctx }) => {
    return prisma.workspace.findFirst({
      where: {
        members: {
          some: { userId: ctx.session.user.id },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }),
  create: protectedProcedure
    .input(
      z.object({
        // Accept missing/blank names to avoid hard-failing the UI if it ever
        // sends an empty payload; we still normalize to a non-empty name.
        name: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceName =
        input.name && input.name.length > 0 ? input.name : 'Untitled Workspace';

      return prisma.workspace.create({
        data: {
          name: workspaceName,
          ownerId: ctx.session.user.id,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: WorkspaceRole.OWNER,
            },
          },
          boards: {
            create: {
              ownerId: ctx.session.user.id,
              title: 'Show Tracking',
              description: 'Post-production workflow overview',
              groups: {
                create: [
                  {
                    title: 'In Edit',
                    color: '#22c55e',
                    position: 1,
                  },
                  {
                    title: 'Ready for Delivery',
                    color: '#38bdf8',
                    position: 2,
                  },
                ],
              },
              columns: {
                create: [
                  {
                    title: 'Item',
                    type: ColumnType.TEXT,
                    position: 1,
                  },
                  {
                    title: 'Status',
                    type: ColumnType.STATUS,
                    position: 2,
                    settings: {
                      options: {
                        'In progress': '#f97316',
                        Review: '#eab308',
                        Done: '#22c55e',
                        Blocked: '#ef4444',
                      },
                    },
                  },
                  {
                    title: 'Person',
                    type: ColumnType.PERSON,
                    position: 3,
                  },
                  {
                    title: 'Date',
                    type: ColumnType.DATE,
                    position: 4,
                  },
                ],
              },
            },
          },
        },
      });
    }),
});
