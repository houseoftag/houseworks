/**
 * QuickBooks Integration
 *
 * Handles QB OAuth connect flow and data sync.
 * OAuth routes live in src/app/api/crm/quickbooks/
 * This module provides sync logic called by the BullMQ worker.
 */

import { prisma } from '@/server/db';

const QB_BASE_URL = 'https://quickbooks.api.intuit.com/v3';

async function qbApiGet(
  realmId: string,
  accessToken: string,
  path: string,
): Promise<unknown> {
  const res = await fetch(`${QB_BASE_URL}/company/${realmId}/${path}?minorversion=65`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`QB API error: ${res.status} ${path}`);
  }
  return res.json();
}

async function refreshQBToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; refresh_token?: string };
  if (!data.access_token) return null;
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken };
}

/**
 * Sync a workspace's QuickBooks data:
 * - Customers → match to CRM clients by email or company name
 * - Invoices → create/update CrmTimelineEntry records of type INVOICE
 */
export async function syncQuickBooks(workspaceId: string): Promise<void> {
  const integration = await prisma.quickBooksIntegration.findUnique({ where: { workspaceId } });
  if (!integration) throw new Error('No QuickBooks integration for this workspace');

  let { accessToken, refreshToken, realmId } = integration;

  // Try token refresh
  const refreshed = await refreshQBToken(refreshToken);
  if (refreshed) {
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    await prisma.quickBooksIntegration.update({
      where: { workspaceId },
      data: { accessToken, refreshToken },
    });
  }

  // Fetch customers from QB
  const customersResp = await qbApiGet(realmId, accessToken, 'query?query=SELECT * FROM Customer MAXRESULTS 1000') as {
    QueryResponse?: { Customer?: { Id: string; DisplayName: string; PrimaryEmailAddr?: { Address: string }; CompanyName?: string }[] };
  };
  const customers = customersResp.QueryResponse?.Customer ?? [];

  // Build email→clientId and company→clientId maps from CRM clients
  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: { id: true, email: true, company: true },
  });
  const emailToClientId = new Map<string, string>();
  const companyToClientId = new Map<string, string>();
  for (const c of clients) {
    if (c.email) emailToClientId.set(c.email.toLowerCase().trim(), c.id);
    if (c.company) companyToClientId.set(c.company.toLowerCase().trim(), c.id);
  }

  // Fetch invoices from QB
  const currentYear = new Date().getFullYear();
  const invoicesResp = await qbApiGet(
    realmId,
    accessToken,
    `query?query=SELECT * FROM Invoice WHERE TxnDate >= '${currentYear}-01-01' MAXRESULTS 1000`,
  ) as {
    QueryResponse?: {
      Invoice?: {
        Id: string;
        DocNumber?: string;
        CustomerRef: { value: string; name: string };
        TotalAmt: number;
        Balance: number;
        DueDate?: string;
        TxnDate: string;
        EmailStatus?: string;
        MetaData?: { LastUpdatedTime: string };
      }[];
    };
  };
  const invoices = invoicesResp.QueryResponse?.Invoice ?? [];

  // Group invoices by QB customer ID
  const invoicesByCustomer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const key = inv.CustomerRef.value;
    invoicesByCustomer.set(key, [...(invoicesByCustomer.get(key) ?? []), inv]);
  }

  // For each QB customer, find the matching CRM client and sync invoices
  for (const customer of customers) {
    const email = customer.PrimaryEmailAddr?.Address?.toLowerCase().trim() ?? '';
    const company = customer.CompanyName?.toLowerCase().trim() ?? customer.DisplayName.toLowerCase().trim();

    const clientId = emailToClientId.get(email) ?? companyToClientId.get(company);
    if (!clientId) continue;

    const custInvoices = invoicesByCustomer.get(customer.Id) ?? [];

    // Sync invoice timeline entries
    for (const inv of custInvoices) {
      const existing = await prisma.crmTimelineEntry.findFirst({
        where: { clientId, externalId: `qb-inv-${inv.Id}` },
      });
      const isPaid = inv.Balance === 0;
      const isOverdue = !isPaid && inv.DueDate ? new Date(inv.DueDate) < new Date() : false;
      const status = isPaid ? 'paid' : isOverdue ? 'overdue' : 'outstanding';
      const title = `Invoice #${inv.DocNumber ?? inv.Id} — $${inv.TotalAmt.toFixed(2)} (${status})`;

      if (existing) {
        await prisma.crmTimelineEntry.update({
          where: { id: existing.id },
          data: { title, metadata: { invoiceId: inv.Id, amount: inv.TotalAmt, balance: inv.Balance, dueDate: inv.DueDate, status } },
        });
      } else {
        await prisma.crmTimelineEntry.create({
          data: {
            clientId,
            type: 'INVOICE',
            title,
            externalId: `qb-inv-${inv.Id}`,
            metadata: { invoiceId: inv.Id, amount: inv.TotalAmt, balance: inv.Balance, dueDate: inv.DueDate, status, realmId },
            createdAt: new Date(inv.TxnDate),
          },
        });
      }
    }
  }

  await prisma.quickBooksIntegration.update({ where: { workspaceId }, data: { syncedAt: new Date() } });
}

/**
 * Create a QB invoice and log it to the CRM timeline.
 */
export async function createQBInvoice(
  workspaceId: string,
  clientId: string,
  invoice: { customerRef: string; lineItems: { amount: number; description: string }[]; dueDate?: string },
): Promise<{ invoiceId: string; docNumber: string }> {
  const integration = await prisma.quickBooksIntegration.findUnique({ where: { workspaceId } });
  if (!integration) throw new Error('No QuickBooks integration');

  const { accessToken, realmId } = integration;
  const res = await fetch(`${QB_BASE_URL}/company/${realmId}/invoice?minorversion=65`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      CustomerRef: { value: invoice.customerRef },
      DueDate: invoice.dueDate,
      Line: invoice.lineItems.map((l, i) => ({
        LineNum: i + 1,
        Amount: l.amount,
        DetailType: 'SalesItemLineDetail',
        Description: l.description,
        SalesItemLineDetail: { Qty: 1, UnitPrice: l.amount },
      })),
    }),
  });
  if (!res.ok) throw new Error(`QB create invoice failed: ${res.status}`);
  const data = await res.json() as { Invoice: { Id: string; DocNumber: string; TotalAmt: number } };
  const created = data.Invoice;

  await prisma.crmTimelineEntry.create({
    data: {
      clientId,
      type: 'INVOICE',
      title: `Invoice #${created.DocNumber} — $${created.TotalAmt.toFixed(2)} (outstanding)`,
      externalId: `qb-inv-${created.Id}`,
      metadata: { invoiceId: created.Id, amount: created.TotalAmt, status: 'outstanding', realmId },
    },
  });

  return { invoiceId: created.Id, docNumber: created.DocNumber };
}
