import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const templatesRouter = router({
  /** List all templates in the user's workspaces */
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });

      return prisma.boardTemplate.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    }),

  /** Create a template from an existing board */
  createFromBoard: protectedProcedure
    .input(z.object({
      boardId: z.string().cuid(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.boardId,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
        include: {
          columns: { orderBy: { position: 'asc' } },
          groups: { orderBy: { position: 'asc' } },
        },
      });
      if (!board) throw new TRPCError({ code: 'NOT_FOUND' });

      const columnConfig = board.columns.map(c => ({
        title: c.title,
        type: c.type,
        settings: c.settings,
        position: c.position,
      }));

      const groupConfig = board.groups.map(g => ({
        title: g.title,
        color: g.color,
        position: g.position,
      }));

      return prisma.boardTemplate.create({
        data: {
          workspaceId: board.workspaceId,
          name: input.name,
          description: input.description,
          columnConfig,
          groupConfig,
          createdById: ctx.session.user.id,
        },
      });
    }),

  /** Create a new board from a template */
  createBoardFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string().cuid(),
      workspaceId: z.string().cuid(),
      title: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!membership) throw new TRPCError({ code: 'FORBIDDEN' });

      const template = await prisma.boardTemplate.findFirst({
        where: {
          id: input.templateId,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      const columnConfig = template.columnConfig as Array<{ title: string; type: string; settings: unknown; position: number }>;
      const groupConfig = template.groupConfig as Array<{ title: string; color: string | null; position: number }>;

      const board = await prisma.board.create({
        data: {
          workspaceId: input.workspaceId,
          ownerId: ctx.session.user.id,
          title: input.title,
        },
      });

      // Create columns
      if (columnConfig.length > 0) {
        await prisma.$transaction(
          columnConfig.map(col =>
            prisma.column.create({
              data: {
                boardId: board.id,
                title: col.title,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: col.type as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                settings: (col.settings ?? {}) as any,
                position: col.position,
              },
            })
          )
        );
      }

      // Create groups
      if (groupConfig.length > 0) {
        await prisma.$transaction(
          groupConfig.map(grp =>
            prisma.group.create({
              data: {
                boardId: board.id,
                title: grp.title,
                color: grp.color,
                position: grp.position,
              },
            })
          )
        );
      }

      return board;
    }),

  /** Delete a template */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.boardTemplate.findFirst({
        where: {
          id: input.id,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
      });
      if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

      await prisma.boardTemplate.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
