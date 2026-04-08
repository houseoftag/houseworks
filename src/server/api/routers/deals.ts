import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

async function assertClientAccess(userId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      workspace: { members: { some: { userId } } },
    },
    select: { id: true, workspaceId: true },
  });
  if (!client) throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
  return client;
}

async function assertDealAccess(userId: string, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      client: { workspace: { members: { some: { userId } } } },
    },
    select: { id: true, clientId: true },
  });
  if (!deal) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deal not found' });
  return deal;
}

async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
}

export const dealsRouter = router({
  /** List all deals for a client */
  list: protectedProcedure
    .input(z.object({ clientId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.deal.findMany({
        where: { clientId: input.clientId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /** List all deals in a workspace (for pipeline + dashboard) */
  listByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);
      return prisma.deal.findMany({
        where: { client: { workspaceId: input.workspaceId } },
        include: {
          client: { select: { id: true, displayName: true, company: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /** Create a deal */
  create: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      title: z.string().min(1).max(255),
      value: z.number().optional(),
      stage: z.enum(['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
      probability: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.deal.create({ data: input });
    }),

  /** Update a deal */
  update: protectedProcedure
    .input(z.object({
      dealId: z.string().cuid(),
      title: z.string().min(1).max(255).optional(),
      value: z.number().nullable().optional(),
      stage: z.enum(['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
      probability: z.number().min(0).max(100).nullable().optional(),
      closedAt: z.date().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertDealAccess(ctx.session.user.id, input.dealId);
      const { dealId, ...data } = input;
      return prisma.deal.update({ where: { id: dealId }, data });
    }),

  /** Delete a deal */
  delete: protectedProcedure
    .input(z.object({ dealId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertDealAccess(ctx.session.user.id, input.dealId);
      await prisma.deal.delete({ where: { id: input.dealId } });
    }),
});
