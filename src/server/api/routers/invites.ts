import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, publicProcedure, router } from '../trpc';
import { randomBytes } from 'crypto';
import { TRPCError } from '@trpc/server';
import { hash } from 'bcryptjs';

const inviteInput = z.object({
  workspaceId: z.string().cuid(),
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
});

export const invitesRouter = router({
  create: protectedProcedure
    .input(inviteInput)
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
      });

      if (!membership || membership.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return prisma.workspaceInvite.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email.toLowerCase(),
          role: input.role ?? 'MEMBER',
          token,
          expiresAt,
          createdById: ctx.session.user.id,
        },
      });
    }),
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: input.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!membership || membership.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.workspaceInvite.findMany({
        where: {
          workspaceId: input.workspaceId,
          acceptedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }),
  revoke: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await prisma.workspaceInvite.findUnique({
        where: { id: input.id },
      });

      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const membership = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: invite.workspaceId,
          userId: ctx.session.user.id,
        },
        select: { role: true },
      });

      if (!membership || membership.role === 'MEMBER') {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      await prisma.workspaceInvite.delete({
        where: { id: invite.id },
      });

      return { ok: true };
    }),
  accept: publicProcedure
    .input(
      z.object({
        token: z.string(),
        name: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const invite = await prisma.workspaceInvite.findUnique({
        where: { token: input.token },
      });

      if (!invite) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (invite.acceptedAt) {
        throw new TRPCError({ code: 'CONFLICT' });
      }

      if (invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: 'BAD_REQUEST' });
      }

      const passwordHash = await hash(input.password, 10);

      const user = await prisma.user.upsert({
        where: { email: invite.email },
        update: {
          name: input.name,
          passwordHash,
        },
        create: {
          email: invite.email,
          name: input.name,
          passwordHash,
        },
      });

      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: user.id,
          },
        },
        update: {
          role: invite.role,
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: user.id,
          role: invite.role,
        },
      });

      await prisma.workspaceInvite.update({
        where: { token: invite.token },
        data: {
          acceptedAt: new Date(),
        },
      });

      return { ok: true };
    }),
});
