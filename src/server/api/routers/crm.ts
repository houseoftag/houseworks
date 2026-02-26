import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
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

  /** Delete a client (cascades timeline, items, contacts) */
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

  // ─── Unmatched Emails ────────────────────────────────────────────────────────

  /** List unmatched emails for a workspace (pending only) */
  listUnmatchedEmails: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);
      return prisma.unmatchedEmail.findMany({
        where: { workspaceId: input.workspaceId, status: 'pending' },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      });
    }),

  /** Assign an unmatched email to a client + optionally learn domain */
  assignUnmatchedEmail: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      clientId: z.string().cuid(),
      addDomain: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const unmatched = await prisma.unmatchedEmail.findUnique({ where: { id: input.id } });
      if (!unmatched) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertWorkspaceAccess(ctx.session.user.id, unmatched.workspaceId);

      // Mark as assigned
      await prisma.unmatchedEmail.update({
        where: { id: input.id },
        data: { status: 'assigned', assignedToId: input.clientId },
      });

      // Create timeline entry for the now-matched email
      await prisma.crmTimelineEntry.create({
        data: {
          clientId: input.clientId,
          type: 'EMAIL',
          title: unmatched.subject,
          body: unmatched.bodyPreview,
          externalId: unmatched.messageId,
          metadata: { from: unmatched.fromEmail, fromName: unmatched.fromName, matchSource: 'manual' },
        },
      });

      // Create contact for the sender
      const existingContact = await prisma.contact.findFirst({
        where: { clientId: input.clientId, email: unmatched.fromEmail.toLowerCase() },
      });
      if (!existingContact) {
        await prisma.contact.create({
          data: {
            clientId: input.clientId,
            displayName: unmatched.fromName || unmatched.fromEmail.split('@')[0] || unmatched.fromEmail,
            email: unmatched.fromEmail.toLowerCase(),
          },
        });
      }

      // Learn domain if requested — add to client's domains[]
      if (input.addDomain && unmatched.fromDomain) {
        const domain = unmatched.fromDomain.toLowerCase();
        const client = await prisma.client.findUnique({
          where: { id: input.clientId },
          select: { domains: true },
        });
        if (client && !client.domains.includes(domain)) {
          await prisma.client.update({
            where: { id: input.clientId },
            data: { domains: { push: domain } },
          });
        }
      }

      return { success: true };
    }),

  /** Dismiss an unmatched email */
  dismissUnmatchedEmail: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const unmatched = await prisma.unmatchedEmail.findUnique({ where: { id: input.id } });
      if (!unmatched) throw new TRPCError({ code: 'NOT_FOUND' });
      await assertWorkspaceAccess(ctx.session.user.id, unmatched.workspaceId);

      await prisma.unmatchedEmail.update({
        where: { id: input.id },
        data: { status: 'dismissed' },
      });

      return { success: true };
    }),

  /** Update client domains */
  updateClientDomains: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      domains: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      return prisma.client.update({
        where: { id: input.clientId },
        data: { domains: { set: input.domains.map((d) => d.toLowerCase().trim()) } },
      });
    }),

  // ─── Client Search & Tags ──────────────────────────────────────────────────

  /** Multi-filter client search */
  searchClients: protectedProcedure
    .input(z.object({
      workspaceId: z.string().cuid(),
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      domain: z.string().optional(),
      staleAfterDays: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);

      const where: Prisma.ClientWhereInput = { workspaceId: input.workspaceId };

      if (input.query) {
        const q = input.query.toLowerCase();
        where.OR = [
          { displayName: { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      if (input.tags?.length) {
        where.tags = { hasEvery: input.tags };
      }

      if (input.domain) {
        where.domains = { has: input.domain.toLowerCase() };
      }

      let clients = await prisma.client.findMany({
        where,
        orderBy: { displayName: 'asc' },
        include: {
          _count: { select: { timeline: true, items: true } },
          timeline: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      });

      // Filter by staleness if requested
      if (input.staleAfterDays) {
        const cutoff = new Date(Date.now() - input.staleAfterDays * 24 * 60 * 60 * 1000);
        clients = clients.filter((c) => {
          const lastActivity = c.timeline[0]?.createdAt;
          return !lastActivity || lastActivity < cutoff;
        });
      }

      return clients;
    }),

  /** Add a tag to a client */
  tagClient: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      tag: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { tags: true },
      });
      if (client && !client.tags.includes(input.tag)) {
        return prisma.client.update({
          where: { id: input.clientId },
          data: { tags: { push: input.tag } },
        });
      }
      return prisma.client.findUnique({ where: { id: input.clientId } });
    }),

  /** Remove a tag from a client */
  untagClient: protectedProcedure
    .input(z.object({
      clientId: z.string().cuid(),
      tag: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertClientAccess(ctx.session.user.id, input.clientId);
      const client = await prisma.client.findUnique({
        where: { id: input.clientId },
        select: { tags: true },
      });
      if (client) {
        return prisma.client.update({
          where: { id: input.clientId },
          data: { tags: { set: client.tags.filter((t) => t !== input.tag) } },
        });
      }
      return null;
    }),

  /** Get stale clients — no timeline entry in N days */
  getStaleClients: protectedProcedure
    .input(z.object({
      workspaceId: z.string().cuid(),
      days: z.number().int().positive().default(14),
    }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);
      const cutoff = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const clients = await prisma.client.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          timeline: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          items: { select: { id: true } },
        },
      });

      return clients.filter((c) => {
        const lastActivity = c.timeline[0]?.createdAt;
        return !lastActivity || lastActivity < cutoff;
      });
    }),

  /** Dashboard stats for a workspace */
  dashboardStats: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertWorkspaceAccess(ctx.session.user.id, input.workspaceId);

      const totalClients = await prisma.client.count({
        where: { workspaceId: input.workspaceId },
      });

      // Pipeline items from the CRM board
      const pipelineItems = await prisma.item.findMany({
        where: {
          group: { board: { workspaceId: input.workspaceId, boardType: 'CRM' } },
        },
        include: {
          group: { select: { title: true } },
          cellValues: {
            where: { column: { type: 'NUMBER' } },
            include: { column: { select: { title: true } } },
          },
          client: { select: { id: true, displayName: true, company: true } },
        },
      });

      const dealsTotal = pipelineItems.length;
      const closedStages = ['Won', 'Lost'];
      const dealsOpen = pipelineItems.filter((i) => !closedStages.includes(i.group.title)).length;
      const dealsWon = pipelineItems.filter((i) => i.group.title === 'Won').length;
      const dealsLost = pipelineItems.filter((i) => i.group.title === 'Lost').length;

      const getValue = (item: typeof pipelineItems[0]) => {
        const valueCell = item.cellValues.find((cv) => cv.column.title.toLowerCase().includes('value'));
        return valueCell ? Number(valueCell.value) || 0 : 0;
      };

      const pipelineValue = pipelineItems
        .filter((i) => !closedStages.includes(i.group.title))
        .reduce((sum, i) => sum + getValue(i), 0);

      const dealsByStage: Record<string, number> = {};
      for (const item of pipelineItems) {
        dealsByStage[item.group.title] = (dealsByStage[item.group.title] ?? 0) + 1;
      }

      const recentActivity = await prisma.crmTimelineEntry.findMany({
        where: { client: { workspaceId: input.workspaceId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          client: { select: { id: true, displayName: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      // Top clients by won deal value
      const clientValueMap = new Map<string, { name: string; company: string | null; value: number; openDeals: number }>();
      for (const item of pipelineItems) {
        if (!item.clientId || !item.client) continue;
        if (item.group.title === 'Won') {
          const existing = clientValueMap.get(item.clientId);
          clientValueMap.set(item.clientId, {
            name: item.client.displayName,
            company: item.client.company ?? null,
            value: (existing?.value ?? 0) + getValue(item),
            openDeals: existing?.openDeals ?? 0,
          });
        }
      }
      for (const item of pipelineItems) {
        if (!item.clientId || closedStages.includes(item.group.title)) continue;
        const existing = clientValueMap.get(item.clientId);
        if (existing) existing.openDeals++;
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
