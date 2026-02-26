import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma, PrismaClient } from '@prisma/client';
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
      domains: z.array(z.string()).optional().describe('Domains array (replaces existing)'),
      customFields: z.record(z.string(), z.unknown()).optional().describe('Custom fields object (merged with existing)'),
      tags: z.array(z.string()).optional().describe('Tags array (replaces existing)'),
    },
    async ({ clientId, displayName, company, email, phone, website, address, tier, domains, customFields, tags }) => {
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
      if (domains !== undefined) data.domains = { set: domains.map((d: string) => d.toLowerCase().trim()) };
      if (tags !== undefined) data.tags = { set: tags };
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
    'Delete a CRM client by client ID. Cascades to timeline entries, pipeline items, and contacts.',
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

  // ─── Deal (Pipeline Item) Tools ─────────────────────────────────────────────
  // Deals are now Items on the CRM board. Stages = board groups.

  /**
   * list_deals
   * Lists CRM pipeline items, optionally filtered by client.
   */
  server.tool(
    'list_deals',
    'List CRM pipeline deals (board items), optionally filtered by client ID.',
    {
      clientId: z.string().optional().describe('Filter by client ID (cuid). Omit to list all deals.'),
      workspaceId: z.string().optional().describe('Filter by workspace ID (cuid). Required if no clientId.'),
    },
    async ({ clientId, workspaceId }) => {
      const items = await prisma.item.findMany({
        where: {
          ...(clientId ? { clientId } : {}),
          group: {
            board: {
              boardType: 'CRM',
              ...(workspaceId ? { workspaceId } : {}),
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, displayName: true } },
          group: { select: { id: true, title: true, color: true } },
          cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(items, null, 2) }] };
    },
  );

  /**
   * get_deal
   * Returns a single CRM pipeline item with its client and cell values.
   */
  server.tool(
    'get_deal',
    'Get a single deal (CRM board item) by ID, including client details and column values.',
    { itemId: z.string().describe('The item ID (cuid)') },
    async ({ itemId }) => {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          client: { select: { id: true, displayName: true, company: true } },
          group: { select: { id: true, title: true, color: true } },
          cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
        },
      });
      if (!item) {
        return { content: [{ type: 'text' as const, text: `Item not found: ${itemId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * create_deal
   * Creates a new deal (item) on the CRM board for a client.
   */
  server.tool(
    'create_deal',
    'Create a new deal (CRM board item) for a client.',
    {
      workspaceId: z.string().describe('The workspace ID (cuid)'),
      clientId: z.string().describe('The client ID (cuid)'),
      title: z.string().describe('Deal title'),
      stage: z.string().optional().describe('Stage name (group title, e.g. "Lead", "Proposal"). Defaults to first group.'),
    },
    async ({ workspaceId, clientId, title, stage }) => {
      const { ensureCrmBoard } = await import('../../server/crm/ensure_crm_board');
      const board = await ensureCrmBoard(workspaceId, '');

      const targetGroup = stage
        ? board.groups.find((g: { title: string }) => g.title.toLowerCase() === stage.toLowerCase()) ?? board.groups[0]
        : board.groups[0];

      if (!targetGroup) {
        return { content: [{ type: 'text' as const, text: 'No groups found on CRM board' }], isError: true };
      }

      const item = await prisma.item.create({
        data: {
          groupId: targetGroup.id,
          name: title,
          clientId,
          position: 0,
        },
        include: {
          client: { select: { id: true, displayName: true } },
          group: { select: { id: true, title: true, color: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(item, null, 2) }] };
    },
  );

  /**
   * update_deal
   * Updates a CRM pipeline item (name, stage, client).
   */
  server.tool(
    'update_deal',
    'Update a deal (CRM board item). Can change name, stage (group), or client.',
    {
      itemId: z.string().describe('The item ID (cuid)'),
      title: z.string().optional().describe('New deal title'),
      stage: z.string().optional().describe('Move to stage by group title (e.g. "Won", "Lost")'),
      clientId: z.string().optional().describe('Reassign to a different client'),
    },
    async ({ itemId, title, stage, clientId }) => {
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.name = title;
      if (clientId !== undefined) data.clientId = clientId;

      if (stage !== undefined) {
        const item = await prisma.item.findUnique({
          where: { id: itemId },
          include: { group: { include: { board: { include: { groups: true } } } } },
        });
        if (!item) {
          return { content: [{ type: 'text' as const, text: `Item not found: ${itemId}` }], isError: true };
        }
        const targetGroup = item.group.board.groups.find(
          (g) => g.title.toLowerCase() === stage.toLowerCase(),
        );
        if (targetGroup) data.groupId = targetGroup.id;
      }

      const updated = await prisma.item.update({
        where: { id: itemId },
        data,
        include: {
          client: { select: { id: true, displayName: true } },
          group: { select: { id: true, title: true, color: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }] };
    },
  );

  /**
   * delete_deal
   * Deletes a CRM pipeline item by ID.
   */
  server.tool(
    'delete_deal',
    'Delete a deal (CRM board item) by ID.',
    { itemId: z.string().describe('The item ID (cuid)') },
    async ({ itemId }) => {
      await prisma.item.delete({ where: { id: itemId } });
      return { content: [{ type: 'text' as const, text: `Deal deleted: ${itemId}` }] };
    },
  );

  // ─── Unmatched Emails & Domain Tools ──────────────────────────────────────────

  server.tool(
    'list_unmatched_emails',
    'List pending unmatched emails for a workspace.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const emails = await prisma.unmatchedEmail.findMany({
        where: { workspaceId, status: 'pending' },
        orderBy: { receivedAt: 'desc' },
        take: 100,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(emails, null, 2) }] };
    },
  );

  server.tool(
    'assign_unmatched_email',
    'Assign an unmatched email to a client, create a contact, and optionally learn the domain.',
    {
      id: z.string().describe('The unmatched email ID (cuid)'),
      clientId: z.string().describe('The client ID to assign to (cuid)'),
      addDomain: z.boolean().optional().describe('Also add the sender domain to the client (default false)'),
    },
    async ({ id, clientId, addDomain }) => {
      const unmatched = await prisma.unmatchedEmail.findUnique({ where: { id } });
      if (!unmatched) return { content: [{ type: 'text' as const, text: `Not found: ${id}` }], isError: true };

      await prisma.unmatchedEmail.update({
        where: { id },
        data: { status: 'assigned', assignedToId: clientId },
      });

      await prisma.crmTimelineEntry.create({
        data: {
          clientId,
          type: 'EMAIL',
          title: unmatched.subject,
          body: unmatched.bodyPreview,
          externalId: unmatched.messageId,
          metadata: { from: unmatched.fromEmail, fromName: unmatched.fromName, matchSource: 'manual' },
        },
      });

      // Create contact for the sender
      const existingContact = await prisma.contact.findFirst({
        where: { clientId, email: unmatched.fromEmail.toLowerCase() },
      });
      if (!existingContact) {
        await prisma.contact.create({
          data: {
            clientId,
            displayName: unmatched.fromName || unmatched.fromEmail.split('@')[0] || unmatched.fromEmail,
            email: unmatched.fromEmail.toLowerCase(),
          },
        });
      }

      if (addDomain && unmatched.fromDomain) {
        const domain = unmatched.fromDomain.toLowerCase();
        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { domains: true } });
        if (client && !client.domains.includes(domain)) {
          await prisma.client.update({ where: { id: clientId }, data: { domains: { push: domain } } });
        }
      }

      return { content: [{ type: 'text' as const, text: `Assigned email "${unmatched.subject}" → client ${clientId}` }] };
    },
  );

  server.tool(
    'dismiss_unmatched_email',
    'Dismiss an unmatched email (spam, irrelevant).',
    { id: z.string().describe('The unmatched email ID (cuid)') },
    async ({ id }) => {
      const unmatched = await prisma.unmatchedEmail.findUnique({ where: { id } });
      if (!unmatched) return { content: [{ type: 'text' as const, text: `Not found: ${id}` }], isError: true };
      await prisma.unmatchedEmail.update({ where: { id }, data: { status: 'dismissed' } });
      return { content: [{ type: 'text' as const, text: `Dismissed: "${unmatched.subject}"` }] };
    },
  );

  server.tool(
    'update_client_domains',
    'Set the domain list for a CRM client.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      domains: z.array(z.string()).describe('Array of domain strings (e.g. ["scaffold.com"])'),
    },
    async ({ clientId, domains }) => {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      const updated = await prisma.client.update({
        where: { id: clientId },
        data: { domains: { set: domains.map((d) => d.toLowerCase().trim()) } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }] };
    },
  );

  // ─── Search & Tags ──────────────────────────────────────────────────────────

  server.tool(
    'search_clients',
    'Search CRM clients by name, domain, tags, or staleness.',
    {
      workspaceId: z.string().describe('The workspace ID (cuid)'),
      query: z.string().optional().describe('Search by name/company/email'),
      tags: z.array(z.string()).optional().describe('Filter by tags (all must match)'),
      domain: z.string().optional().describe('Filter by domain'),
      staleAfterDays: z.number().optional().describe('Only return clients with no activity in N days'),
    },
    async ({ workspaceId, query, tags, domain, staleAfterDays }) => {
      const where: Prisma.ClientWhereInput = { workspaceId };

      if (query) {
        where.OR = [
          { displayName: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      }
      if (tags?.length) where.tags = { hasEvery: tags };
      if (domain) where.domains = { has: domain.toLowerCase() };

      let clients = await prisma.client.findMany({
        where,
        orderBy: { displayName: 'asc' },
        include: {
          timeline: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          items: { select: { id: true, name: true, group: { select: { title: true } }, cellValues: { where: { column: { type: 'NUMBER' } }, select: { value: true } } } },
        },
      });

      if (staleAfterDays) {
        const cutoff = new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000);
        clients = clients.filter((c) => {
          const last = c.timeline[0]?.createdAt;
          return !last || last < cutoff;
        });
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(clients, null, 2) }] };
    },
  );

  server.tool(
    'tag_client',
    'Add a tag to a CRM client.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      tag: z.string().describe('Tag to add'),
    },
    async ({ clientId, tag }) => {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { tags: true } });
      if (!client) return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      if (!client.tags.includes(tag)) {
        await prisma.client.update({ where: { id: clientId }, data: { tags: { push: tag } } });
      }
      return { content: [{ type: 'text' as const, text: `Tagged "${tag}" on ${clientId}` }] };
    },
  );

  server.tool(
    'untag_client',
    'Remove a tag from a CRM client.',
    {
      clientId: z.string().describe('The client ID (cuid)'),
      tag: z.string().describe('Tag to remove'),
    },
    async ({ clientId, tag }) => {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { tags: true } });
      if (!client) return { content: [{ type: 'text' as const, text: `Client not found: ${clientId}` }], isError: true };
      await prisma.client.update({
        where: { id: clientId },
        data: { tags: { set: client.tags.filter((t) => t !== tag) } },
      });
      return { content: [{ type: 'text' as const, text: `Removed tag "${tag}" from ${clientId}` }] };
    },
  );

  server.tool(
    'get_stale_clients',
    'Get clients with no activity in N days.',
    {
      workspaceId: z.string().describe('The workspace ID (cuid)'),
      days: z.number().optional().describe('Days of inactivity (default 14)'),
    },
    async ({ workspaceId, days }) => {
      const cutoff = new Date(Date.now() - (days ?? 14) * 24 * 60 * 60 * 1000);
      const clients = await prisma.client.findMany({
        where: { workspaceId },
        include: {
          timeline: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          items: { select: { id: true, name: true } },
        },
      });
      const stale = clients.filter((c) => {
        const last = c.timeline[0]?.createdAt;
        return !last || last < cutoff;
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(stale, null, 2) }] };
    },
  );

  // ─── Unclassified Entries ────────────────────────────────────────────────────

  server.tool(
    'get_unclassified_entries',
    'Get timeline entries where classification metadata is NULL (not yet classified by the external cron).',
    {
      workspaceId: z.string().describe('The workspace ID (cuid)'),
      limit: z.number().optional().describe('Max entries to return (default 50)'),
    },
    async ({ workspaceId, limit }) => {
      const clients = await prisma.client.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      const clientIds = clients.map((c) => c.id);

      const entries = await prisma.crmTimelineEntry.findMany({
        where: {
          clientId: { in: clientIds },
          type: 'EMAIL',
          OR: [
            { metadata: { equals: Prisma.DbNull } },
            { metadata: { path: ['classification'], equals: Prisma.DbNull } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit ?? 50,
        include: {
          client: { select: { id: true, displayName: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }] };
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

      const [totalClients, pipelineItems, recentTimeline] = await Promise.all([
        prisma.client.count({ where: { workspaceId } }),
        prisma.item.findMany({
          where: {
            clientId: { in: clientIdList },
            group: { board: { boardType: 'CRM' } },
          },
          include: {
            group: { select: { title: true } },
            cellValues: { where: { column: { type: 'NUMBER' } }, include: { column: { select: { title: true } } } },
          },
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

      // Aggregate deal values from cell values
      let totalDealValue = 0;
      const stageMap = new Map<string, { count: number; totalValue: number }>();
      for (const item of pipelineItems) {
        const stage = item.group.title;
        const entry = stageMap.get(stage) ?? { count: 0, totalValue: 0 };
        entry.count++;
        const valueCell = item.cellValues.find((cv) => cv.column.title.toLowerCase().includes('value'));
        const val = valueCell ? Number(valueCell.value) || 0 : 0;
        entry.totalValue += val;
        totalDealValue += val;
        stageMap.set(stage, entry);
      }

      const stats = {
        totalClients,
        totalDeals: pipelineItems.length,
        totalDealValue,
        dealsByStage: Array.from(stageMap.entries()).map(([stage, data]) => ({
          stage,
          count: data.count,
          totalValue: data.totalValue,
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
