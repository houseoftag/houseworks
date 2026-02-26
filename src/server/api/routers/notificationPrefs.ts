import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
export const notificationPrefsRouter = router({
  /** Get all preferences for the current user */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notificationPreference.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: 'asc' },
    });
  }),

  /** Upsert a single preference (type and/or boardId may be null for global defaults) */
  set: protectedProcedure
    .input(z.object({
      type: z.enum(['ASSIGNMENT', 'COMMENT', 'STATUS_CHANGE', 'MENTION', 'DUE_DATE']).nullable(),
      boardId: z.string().cuid().nullable(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // findFirst since boardId can be null (Prisma unique constraint on nullable)
      const existing = await prisma.notificationPreference.findFirst({
        where: { userId, type: input.type, boardId: input.boardId },
      });
      if (existing) {
        return prisma.notificationPreference.update({
          where: { id: existing.id },
          data: { enabled: input.enabled },
        });
      }
      return prisma.notificationPreference.create({
        data: {
          userId,
          type: input.type,
          boardId: input.boardId,
          enabled: input.enabled,
        },
      });
    }),

  /** Delete a preference (reverts to default behaviour) */
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const pref = await prisma.notificationPreference.findFirst({
        where: { id: input.id, userId: ctx.session.user.id },
      });
      if (!pref) return null;
      return prisma.notificationPreference.delete({ where: { id: input.id } });
    }),
});
