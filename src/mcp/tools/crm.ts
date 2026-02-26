import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerCrmTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_clients
   * Lists all CRM clients in a workspace.
   */
  server.tool(
    'list_clients',
    'List all CRM clients in a workspace.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const clients = await prisma.client.findMany({
        where: { workspaceId },
        orderBy: { displayName: 'asc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(clients, null, 2) }] };
    },
  );

  /**
   * get_client
   * Returns a single CRM client with their timeline and contacts.
   */
  server.tool(
    'get_client',
    'Get a CRM client by client ID, including their timeline entries and contacts.',
    { clientId: z.string().describe('The client ID (cuid)') },
    async ({ clientId }) => {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          timeline: {
            orderBy: { createdAt: 'desc' },
            include: { createdBy: { select: { id: true, name: true } } },
          },
          contacts: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!client) {
        return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(client, null, 2) }] };
    },
  );

  /**
   * create_client
   * Creates a new CRM client in a workspace.
   */
  server.tool(
    'create_client',
    'Create a new CRM client in a workspace.',
    {
      workspaceId: z.string().describe('The workspace ID (cuid)'),
      displayName: z.string().describe('Client display name'),
      company: z.string().optional().describe('Company name'),
      email: z.string().optional().describe('Email address'),
      website: z.string().optional().describe('Website URL'),
      phone: z.string().optional().describe('Phone number'),
    },
    async ({ workspaceId, displayName, company, email, website, phone }) => {
      const client = await prisma.client.create({
        data: { workspaceId, displayName, company, email, website, phone },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(client, null, 2) }] };
    },
  );

  /**
   * add_timeline_entry
   * Adds a timeline entry to a CRM client's timeline.
   */
  server.tool(
    'add_timeline_entry',
    'Add a timeline entry (note, call, meeting, invoice, etc.) to a CRM client.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      type: z.enum(['NOTE', 'DOCUMENT', 'DELIVERABLE', 'EMAIL', 'INVOICE', 'MEETING', 'CALL']).describe('Entry type'),
      title: z.string().describe('Entry title'),
      body: z.string().optional().describe('Entry body / notes'),
    },
    async ({ clientId, type, title, body }) => {
      const entry = await prisma.crmTimelineEntry.create({
        data: { clientId, type: type as Parameters<typeof prisma.crmTimelineEntry.create>[0]['data']['type'], title, body },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }] };
    },
  );

  /**
   * list_timeline
   * Lists all timeline entries for a CRM client.
   */
  server.tool(
    'list_timeline',
    'List all timeline entries for a CRM client, newest first.',
    { clientId: z.string().describe('The client ID (cuid)') },
    async ({ clientId }) => {
      const entries = await prisma.crmTimelineEntry.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
    },
  );

  /**
   * sync_quickbooks
   * Triggers a QuickBooks data sync for a workspace.
   */
  server.tool(
    'sync_quickbooks',
    'Trigger a QuickBooks sync for a workspace. Syncs customers and invoices.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const { syncQuickBooks } = await import('../../server/crm/quickbooks');
      await syncQuickBooks(workspaceId);
      return { content: [{ type: 'text' as const, text: `QuickBooks sync completed for workspace ${workspaceId}` }] };
    },
  );

  /**
   * update_client
   * Updates a CRM client's fields.
   */
  server.tool(
    'update_client',
    'Update a CRM client by client ID. Only provided fields are changed.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      displayName: z.string().optional().describe('New display name'),
      company: z.string().optional().describe('Company name'),
      email: z.string().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      website: z.string().optional().describe('Website URL'),
      address: z.string().optional().describe('Address'),
      tier: z.string().optional().describe('Client tier'),
      customFields: z.record(z.string(), z.unknown()).optional().describe('Custom fields object (merged with existing)'),
      tags: z.array(z.string()).optional().describe('Tags array (replaces existing)'),
    },
    async ({ clientId, displayName, company, email, phone, website, address, tier, customFields, tags }) => {
      const existing = await prisma.client.findUnique({ where: { id: clientId } });
      if (!existing) {
        return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      }

      const data: Record<string, unknown> = {};
      if (displayName !== undefined) data.displayName = displayName;
      if (company !== undefined) data.company = company;
      if (email !== undefined) data.email = email;
      if (phone !== undefined) data.phone = phone;
      if (website !== undefined) data.website = website;
      if (address !== undefined) data.address = address;
      if (tier !== undefined) data.tier = tier;
      if (customFields !== undefined) {
        const existingCustom = (existing.customFields as Record<string, unknown>) ?? {};
        data.customFields = { ...existingCustom, ...customFields };
      }

      const updated = await prisma.client.update({
        where: { id: clientId },
        data,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }] };
    },
  );

  /**
   * delete_client
   * Deletes a CRM client and all related data (timeline, deals, contacts).
   */
  server.tool(
    'delete_client',
    'Delete a CRM client by client ID. Cascades to timeline entries, deals, and contacts.',
    { clientId: z.string().describe('The client ID (cuid)') },
    async ({ clientId }) => {
      const existing = await prisma.client.findUnique({ where: { id: clientId } });
      if (!existing) {
        return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      }
      await prisma.client.delete({ where: { id: clientId } });
      return { content: [{ type: 'text' as const, text: `Deleted client ${clientId} (${existing.displayName})` }] };
    },
  );

  /**
   * list_invoices
   * Lists all invoice timeline entries for a CRM client.
   */
  server.tool(
    'list_invoices',
    'List all invoice timeline entries for a CRM client.',
    { clientId: z.string().describe('The client ID (cuid)') },
    async ({ clientId }) => {
      const invoices = await prisma.crmTimelineEntry.findMany({
        where: { clientId, type: 'INVOICE' },
        orderBy: { createdAt: 'desc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(invoices, null, 2) }] };
    },
  );

  // ─── Deal Tools ───────────────────────────────────────────────────────────────

  const dealStageEnum = z.enum(['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);

  /**
   * list_deals
   * Lists deals, optionally filtered by client.
   */
  server.tool(
    'list_deals',
    'List deals, optionally filtered by client ID.',
    {
      clientId: z.string().optional().describe('Filter by client ID (cuid). Omit to list all deals.'),
    },
    async ({ clientId }) => {
      const deals = await prisma.deal.findMany({
        where: clientId ? { clientId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { id: true, displayName: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(deals, null, 2) }] };
    },
  );

  /**
   * get_deal
   * Returns a single deal with its client info.
   */
  server.tool(
    'get_deal',
    'Get a single deal by ID, including client details.',
    { dealId: z.string().describe('The deal ID (cuid)') },
    async ({ dealId }) => {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { client: { select: { id: true, displayName: true, company: true } } },
      });
      if (!deal) {
        return { content: [{ type: 'text' as const, text: `Deal not found: ${dealId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(deal, null, 2) }] };
    },
  );

  /**
   * create_deal
   * Creates a new deal for a client.
   */
  server.tool(
    'create_deal',
    'Create a new deal for a CRM client.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      title: z.string().describe('Deal title'),
      value: z.number().optional().describe('Deal value (monetary amount)'),
      stage: dealStageEnum.optional().describe('Deal stage (defaults to LEAD)'),
      probability: z.number().int().min(0).max(100).optional().describe('Win probability 0-100'),
      notes: z.string().optional().describe('Additional notes'),
    },
    async ({ clientId, title, value, stage, probability, notes }) => {
      const deal = await prisma.deal.create({
        data: {
          clientId,
          title,
          value,
          stage: stage as Parameters<typeof prisma.deal.create>[0]['data']['stage'],
          probability,
          notes,
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(deal, null, 2) }] };
    },
  );

  /**
   * update_deal
   * Updates fields on an existing deal.
   */
  server.tool(
    'update_deal',
    'Update fields on an existing deal.',
    {
      dealId: z.string().describe('The deal ID (cuid)'),
      title: z.string().optional().describe('New deal title'),
      value: z.number().optional().describe('New deal value'),
      stage: dealStageEnum.optional().describe('New deal stage'),
      probability: z.number().int().min(0).max(100).optional().describe('New win probability 0-100'),
      closedAt: z.string().optional().describe('Closed date as ISO-8601 string (e.g. 2026-02-26T00:00:00Z)'),
      notes: z.string().optional().describe('Updated notes'),
    },
    async ({ dealId, title, value, stage, probability, closedAt, notes }) => {
      const deal = await prisma.deal.update({
        where: { id: dealId },
        data: {
          ...(title !== undefined && { title }),
          ...(value !== undefined && { value }),
          ...(stage !== undefined && { stage: stage as Parameters<typeof prisma.deal.update>[0]['data']['stage'] }),
          ...(probability !== undefined && { probability }),
          ...(closedAt !== undefined && { closedAt: new Date(closedAt) }),
          ...(notes !== undefined && { notes }),
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(deal, null, 2) }] };
    },
  );

  /**
   * delete_deal
   * Deletes a deal by ID.
   */
  server.tool(
    'delete_deal',
    'Delete a deal by ID.',
    { dealId: z.string().describe('The deal ID (cuid)') },
    async ({ dealId }) => {
      await prisma.deal.delete({ where: { id: dealId } });
      return { content: [{ type: 'text' as const, text: `Deal deleted: ${dealId}` }] };
    },
  );

  // ─── Dashboard & Integration Tools ────────────────────────────────────────────

  /**
   * get_crm_dashboard_stats
   * Aggregate CRM stats for a workspace: client count, deal totals, deals by stage, recent timeline.
   */
  server.tool(
    'get_crm_dashboard_stats',
    'Get aggregate CRM dashboard stats for a workspace: total clients, total deal value, deals grouped by stage, and recent timeline entries.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const clientIds = await prisma.client.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const clientIdList = clientIds.map((c) => c.id);

      const [totalClients, dealAgg, dealsByStage, recentTimeline] = await Promise.all([
        prisma.client.count({ where: { workspaceId } }),
        prisma.deal.aggregate({
          where: { clientId: { in: clientIdList } },
          _sum: { value: true },
          _count: true,
        }),
        prisma.deal.groupBy({
          by: ['stage'],
          where: { clientId: { in: clientIdList } },
          _count: true,
          _sum: { value: true },
        }),
        prisma.crmTimelineEntry.findMany({
          where: { clientId: { in: clientIdList } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            client: { select: { id: true, displayName: true } },
            createdBy: { select: { id: true, name: true } },
          },
        }),
      ]);

      const stats = {
        totalClients,
        totalDeals: dealAgg._count,
        totalDealValue: dealAgg._sum.value ?? 0,
        dealsByStage: dealsByStage.map((g) => ({
          stage: g.stage,
          count: g._count,
          totalValue: g._sum.value ?? 0,
        })),
        recentTimeline,
      };

      return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
    },
  );

  /**
   * list_email_integrations
   * Lists connected email integrations for a workspace.
   */
  server.tool(
    'list_email_integrations',
    'List all connected email integrations for a workspace.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const integrations = await prisma.emailIntegration.findMany({
        where: { workspaceId },
        select: {
          id: true,
          provider: true,
          email: true,
          syncedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(integrations, null, 2) }] };
    },
  );
}
