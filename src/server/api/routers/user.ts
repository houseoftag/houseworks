import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { id: true, name: true, email: true, image: true },
    });
  }),
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        image: z.string().url().optional().or(z.literal('')),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { name: input.name, image: input.image ?? null },
      });
    }),
});
