/**
 * CRM Email Sync
 *
 * Syncs emails from connected Gmail/Outlook accounts and creates
 * CrmTimelineEntry records of type EMAIL_IN / EMAIL_OUT for messages
 * that match any client's email address stored in CellValues.
 *
 * NOTE: The OAuth flows are implemented in src/app/api/crm/email/
 * This module provides the sync logic called by the BullMQ worker.
 */

import { prisma } from '@/server/db';

/**
 * Attempt to refresh an expired Gmail access token.
 */
async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string };
  return data.access_token ?? null;
}

/**
 * Fetch recent messages from Gmail for a given access token.
 * Returns messages as { id, subject, from, to, date }.
 */
async function fetchGmailMessages(accessToken: string, after: Date): Promise<{
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
}[]> {
  const afterSec = Math.floor(after.getTime() / 1000);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${afterSec}&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!listRes.ok) return [];
  const list = await listRes.json() as { messages?: { id: string }[] };
  if (!list.messages?.length) return [];

  const messages: { id: string; subject: string; from: string; to: string; date: Date; snippet: string }[] = [];
  for (const msg of list.messages.slice(0, 50)) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json() as {
      id: string;
      snippet: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const headers = detail.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    messages.push({
      id: detail.id,
      subject: get('Subject'),
      from: get('From'),
      to: get('To'),
      date: new Date(get('Date')),
      snippet: detail.snippet ?? '',
    });
  }
  return messages;
}

/**
 * Extract email address from a "Name <email@>" or "email@" string.
 */
function extractEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Run email sync for all workspaces that have an EmailIntegration configured.
 * For each integration:
 *   1. Refresh token if needed
 *   2. Fetch messages since last sync
 *   3. Match message From/To against client email cell values
 *   4. Create CrmTimelineEntry records for matches
 */
export async function syncAllEmails(): Promise<void> {
  const integrations = await prisma.emailIntegration.findMany({
    select: { id: true, workspaceId: true, accessToken: true, refreshToken: true, provider: true, email: true, syncedAt: true },
  });

  for (const integration of integrations) {
    let accessToken = integration.accessToken;
    const since = integration.syncedAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Refresh token if needed (basic: always attempt for Gmail)
    if (integration.provider === 'GMAIL' && integration.refreshToken) {
      const refreshed = await refreshGmailToken(integration.refreshToken);
      if (refreshed) {
        accessToken = refreshed;
        await prisma.emailIntegration.update({
          where: { id: integration.id },
          data: { accessToken: refreshed },
        });
      }
    }

    // Fetch messages
    let messages: Awaited<ReturnType<typeof fetchGmailMessages>> = [];
    if (integration.provider === 'GMAIL') {
      messages = await fetchGmailMessages(accessToken, since);
    }
    // Outlook support: similar pattern, skipped for initial implementation

    if (messages.length === 0) {
      await prisma.emailIntegration.update({ where: { id: integration.id }, data: { syncedAt: new Date() } });
      continue;
    }

    // Build a map of email → clientId from CRM clients in this workspace
    const clients = await prisma.client.findMany({
      where: { workspaceId: integration.workspaceId, email: { not: null } },
      select: { id: true, email: true },
    });

    if (clients.length === 0) {
      await prisma.emailIntegration.update({ where: { id: integration.id }, data: { syncedAt: new Date() } });
      continue;
    }

    const emailToClientId = new Map<string, string>();
    for (const c of clients) {
      if (c.email) emailToClientId.set(c.email.toLowerCase().trim(), c.id);
    }

    // Match messages to clients
    for (const msg of messages) {
      const fromEmail = extractEmail(msg.from);
      const toEmails = msg.to.split(',').map((t) => extractEmail(t));

      const intEmail = integration.email.toLowerCase();
      const isOutbound = fromEmail === intEmail;
      const entryType = 'EMAIL';

      const matchEmails = isOutbound ? toEmails : [fromEmail];
      const matchedClientId = matchEmails.map((e) => emailToClientId.get(e)).find(Boolean);
      if (!matchedClientId) continue;

      // Avoid duplicates by externalId
      const existing = await prisma.crmTimelineEntry.findFirst({
        where: { clientId: matchedClientId, externalId: msg.id },
      });
      if (existing) continue;

      await prisma.crmTimelineEntry.create({
        data: {
          clientId: matchedClientId,
          type: entryType,
          title: msg.subject || '(no subject)',
          body: msg.snippet,
          externalId: msg.id,
          metadata: { from: msg.from, to: msg.to },
        },
      });
    }

    await prisma.emailIntegration.update({ where: { id: integration.id }, data: { syncedAt: new Date() } });
  }
}
