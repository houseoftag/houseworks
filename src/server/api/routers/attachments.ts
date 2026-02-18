import { z } from 'zod';
import { prisma } from '@/server/db';
import { logActivity } from '@/server/services/activity';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const attachmentsRouter = router({
  list: protectedProcedure
    .input(z.object({ itemId: z.string().cuid() }))
    .query(async ({ input }) => {
      return prisma.attachment.findMany({
        where: { itemId: input.itemId },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true, image: true } } },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        itemId: z.string().cuid(),
        fileName: z.string().min(1),
        fileType: z.string().min(1),
        fileSize: z.number().int().positive(),
        url: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const attachment = await prisma.attachment.create({
        data: {
          itemId: input.itemId,
          fileName: input.fileName,
          fileType: input.fileType,
          fileSize: input.fileSize,
          url: input.url,
          uploadedById: ctx.session.user.id,
        },
      });

      // Log activity
      const item = await prisma.item.findUnique({
        where: { id: input.itemId },
        select: { group: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
      });
      if (item) {
        await logActivity({
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          itemId: input.itemId,
          userId: ctx.session.user.id,
          type: 'ATTACHMENT_ADDED',
          entityType: 'ATTACHMENT',
          entityId: attachment.id,
          metadata: { fileName: input.fileName, fileType: input.fileType },
        });
      }

      return attachment;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await prisma.attachment.findUnique({ where: { id: input.id } });
      if (!attachment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Attachment not found' });
      }
      if (attachment.uploadedById !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own attachments' });
      }

      // Log activity before deletion
      const item = await prisma.item.findUnique({
        where: { id: attachment.itemId },
        select: { group: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
      });
      if (item) {
        await logActivity({
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          itemId: attachment.itemId,
          userId: ctx.session.user.id,
          type: 'ATTACHMENT_DELETED',
          entityType: 'ATTACHMENT',
          entityId: input.id,
          metadata: { fileName: attachment.fileName },
        });
      }

      return prisma.attachment.delete({ where: { id: input.id } });
    }),
});
