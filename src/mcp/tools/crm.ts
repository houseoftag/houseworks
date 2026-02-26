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
      type: z.enum(['NOTE', 'DOCUMENT', 'DELIVERABLE', 'EMAIL_IN', 'EMAIL_OUT', 'INVOICE', 'MEETING', 'CALL']).describe('Entry type'),
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
}
