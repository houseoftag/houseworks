import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';

export const notificationsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }),
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    return prisma.notification.count({
      where: {
        userId: ctx.session.user.id,
        readAt: null,
      },
    });
  }),
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.notification.update({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
        },
        data: { readAt: new Date() },
      });
    }),
  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    return prisma.notification.updateMany({
      where: {
        userId: ctx.session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }),
});
