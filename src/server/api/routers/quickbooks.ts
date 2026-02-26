import { z } from 'zod';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { syncQuickBooks, createQBInvoice } from '@/server/crm/quickbooks';

export const quickbooksRouter = router({
  /** Get QB integration status for a workspace */
  getIntegration: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      return prisma.quickBooksIntegration.findUnique({
        where: { workspaceId: input.workspaceId },
        select: { id: true, realmId: true, syncedAt: true, createdAt: true },
      });
    }),

  /** Trigger a QB sync */
  sync: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      await syncQuickBooks(input.workspaceId);
      return { success: true };
    }),

  /** Create an invoice in QB and log to CRM timeline */
  createInvoice: protectedProcedure
    .input(z.object({
      workspaceId: z.string().cuid(),
      clientId: z.string().cuid(),
      customerRef: z.string(),
      lineItems: z.array(z.object({
        description: z.string(),
        amount: z.number().positive(),
      })),
      dueDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      return createQBInvoice(input.workspaceId, input.clientId, {
        customerRef: input.customerRef,
        lineItems: input.lineItems,
        dueDate: input.dueDate,
      });
    }),

  /** Disconnect QB integration */
  disconnect: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      await prisma.quickBooksIntegration.delete({ where: { workspaceId: input.workspaceId } }).catch(() => null);
      return { success: true };
    }),
});
