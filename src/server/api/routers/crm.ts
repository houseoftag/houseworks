import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { DealStage } from '@prisma/client';
import { syncAllEmails } from '@/server/crm/email_sync';

async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId },
  });
  if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
  return member;
}

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

export const crmRouter = router({
  /** List all clients in a workspace */
  listClients: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);
      return prisma.client.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { displayName: 'asc' },
      });
    }),

  /** Get a single client with timeline and contacts */
  getClient: protectedProcedure
    .input(z.object({ clientId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.client.findUniqueOrThrow({
        where: { id: input.clientId },
        include: {
          timeline: {
            orderBy: { createdAt: 'desc' },
            include: { createdBy: { select: { id: true, name: true, image: true } } },
          },
          contacts: { orderBy: { createdAt: 'asc' } },
        },
      });
    }),

  /** Create a new client in a workspace */
  createClient: protectedProcedure
    .input(z.object({
      workspaceId: z.string().cuid(),
      displayName: z.string().min(1).max(255),
      company: z.string().optional(),
      website: z.string().optional(),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);
      const { workspaceId, ...data } = input;
      return prisma.client.create({ data: { workspaceId, ...data } });
    }),

  /** Update client profile fields */
  updateProfile: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      displayName: z.string().min(1).max(255).optional(),
      company: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      tier: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      const { clientId, tags, ...profileData } = input;
      const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { customFields: true } });
      const existingCustomFields = (existing?.customFields as Record<string, unknown>) ?? {};
      const customFields: Prisma.InputJsonValue = tags !== undefined
        ? { ...existingCustomFields, tags }
        : (existingCustomFields as Prisma.InputJsonValue);
      return prisma.client.update({
        where: { id: clientId },
        data: { ...profileData, customFields },
      });
    }),

  /** Delete a client (cascades timeline, deals, contacts) */
  deleteClient: protectedProcedure
    .input(z.object({ clientId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      await prisma.client.delete({ where: { id: input.clientId } });
    }),

  /** Add a timeline entry */
  addTimelineEntry: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      type: z.enum(['NOTE', 'DOCUMENT', 'DELIVERABLE', 'EMAIL', 'INVOICE', 'MEETING', 'CALL']),
      title: z.string().min(1).max(500),
      body: z.string().optional(),
      entryDate: z.string().optional(),
      entryTime: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.crmTimelineEntry.create({
        data: {
          clientId: input.clientId,
          type: input.type,
          title: input.title,
          body: input.body,
          entryDate: input.entryDate ?? null,
          entryTime: input.entryTime ?? null,
          createdById: ctx.session.user.id,
        },
        include: { createdBy: { select: { id: true, name: true, image: true } } },
      });
    }),

  /** List timeline entries for a client */
  listTimeline: protectedProcedure
    .input(z.object({ clientId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.crmTimelineEntry.findMany({
        where: { clientId: input.clientId },
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true, image: true } } },
      });
    }),

  /** Get email integration status for a workspace */
  getEmailIntegration: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
      return prisma.emailIntegration.findFirst({
        where: { workspaceId: input.workspaceId },
        select: { id: true, provider: true, email: true, syncedAt: true, createdAt: true },
      });
    }),

  /** Disconnect email integration */
  disconnectEmail: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
      await prisma.emailIntegration.deleteMany({ where: { workspaceId: input.workspaceId } });
    }),

  /** Manually trigger email sync */
  syncEmailNow: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
      await syncAllEmails();
      return { success: true };
    }),

  /** List contacts for a client */
  listContacts: protectedProcedure
    .input(z.object({ clientId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.contact.findMany({
        where: { clientId: input.clientId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  /** Add a contact to a client */
  addContact: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      displayName: z.string().min(1).max(255),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().optional(),
      role: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      const { clientId, email, ...rest } = input;
      return prisma.contact.create({
        data: { clientId, ...rest, email: email || null },
      });
    }),

  /** Update a contact */
  updateContact: protectedProcedure
    .input(z.object({
      contactId: z.string().cuid(),
      displayName: z.string().min(1).max(255).optional(),
      email: z.string().email().optional().or(z.literal('')).nullable(),
      phone: z.string().optional().nullable(),
      role: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId },
        select: { clientId: true },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertClientAccess(ctx.session.user.id, contact.clientId);
      const { contactId, ...data } = input;
      return prisma.contact.update({ where: { id: contactId }, data });
    }),

  /** Delete a contact */
  deleteContact: protectedProcedure
    .input(z.object({ contactId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId },
        select: { clientId: true },
      });
      if (!contact) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertClientAccess(ctx.session.user.id, contact.clientId);
      await prisma.contact.delete({ where: { id: input.contactId } });
    }),

  /** Dashboard stats for a workspace */
  dashboardStats: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);

      const totalClients = await prisma.client.count({
        where: { workspaceId: input.workspaceId },
      });

      const deals = await prisma.deal.findMany({
        where: { client: { workspaceId: input.workspaceId } },
        select: { id: true, stage: true, value: true, createdAt: true },
      });
      const dealsTotal = deals.length;
      const dealsOpen = deals.filter((d) => !['WON', 'LOST'].includes(d.stage)).length;
      const dealsWon = deals.filter((d) => d.stage === 'WON').length;
      const dealsLost = deals.filter((d) => d.stage === 'LOST').length;
      const pipelineValue = deals
        .filter((d) => !['WON', 'LOST'].includes(d.stage))
        .reduce((sum, d) => sum + (d.value ?? 0), 0);

      const dealsByStage = Object.fromEntries(
        (['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as DealStage[]).map((stage) => [
          stage,
          deals.filter((d) => d.stage === stage).length,
        ]),
      ) as Record<DealStage, number>;

      const recentActivity = await prisma.crmTimelineEntry.findMany({
        where: { client: { workspaceId: input.workspaceId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          client: { select: { id: true, displayName: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      const wonDeals = await prisma.deal.findMany({
        where: { client: { workspaceId: input.workspaceId }, stage: 'WON' },
        select: { clientId: true, value: true, client: { select: { displayName: true, company: true } } },
      });
      const clientValueMap = new Map<string, { name: string; company: string | null; value: number; openDeals: number }>();
      for (const deal of wonDeals) {
        const existing = clientValueMap.get(deal.clientId);
        clientValueMap.set(deal.clientId, {
          name: deal.client.displayName,
          company: deal.client.company ?? null,
          value: (existing?.value ?? 0) + (deal.value ?? 0),
          openDeals: existing?.openDeals ?? 0,
        });
      }
      const openDealCounts = await prisma.deal.groupBy({
        by: ['clientId'],
        where: { client: { workspaceId: input.workspaceId }, stage: { notIn: ['WON', 'LOST'] } },
        _count: { id: true },
      });
      for (const { clientId, _count } of openDealCounts) {
        const existing = clientValueMap.get(clientId);
        if (existing) existing.openDeals = _count.id;
      }
      const topClients = [...clientValueMap.entries()]
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 5)
        .map(([clientId, data]) => ({ clientId, ...data }));

      return {
        totalClients,
        dealsTotal,
        dealsOpen,
        dealsWon,
        dealsLost,
        pipelineValue,
        dealsByStage,
        recentActivity,
        topClients,
      };
    }),
});
