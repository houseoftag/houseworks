/**
 * CRM Email Sync
 *
 * Syncs emails from connected Gmail/Outlook accounts and creates
 * CrmTimelineEntry records for messages that match KNOWN clients via:
 *   1. Exact email address match (client.email)
 *   2. Contact email match (contacts table)
 *
 * Unmatched emails are stored in UnmatchedEmail for manual review.
 * Domain-based discovery happens in the external OpenClaw cron, not here.
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
 */
async function fetchGmailMessages(accessToken: string, after: Date): Promise<{
  id: string;
  threadId: string;
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
  const list = await listRes.json() as { messages?: { id: string; threadId: string }[] };
  if (!list.messages?.length) return [];

  const messages: { id: string; threadId: string; subject: string; from: string; to: string; date: Date; snippet: string }[] = [];
  for (const msg of list.messages.slice(0, 50)) {
    const detailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!detailRes.ok) continue;
    const detail = await detailRes.json() as {
      id: string;
      threadId: string;
      snippet: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const headers = detail.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    messages.push({
      id: detail.id,
      threadId: detail.threadId,
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
export function extractEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Extract display name from "Name <email@>" format.
 */
function extractName(raw: string): string | null {
  const m = raw.match(/^(.+?)\s*<[^>]+>/);
  if (m?.[1]) {
    const name = m[1].replace(/^["']|["']$/g, '').trim();
    return name || null;
  }
  return null;
}

/**
 * Extract domain from email address.
 */
function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

/**
 * Run email sync for all workspaces that have an EmailIntegration configured.
 * For each integration:
 *   1. Refresh token if needed
 *   2. Fetch messages since last sync
 *   3. Match message From/To via: exact email → contact email
 *   4. On no match: insert UnmatchedEmail record for review
 *   5. Create CrmTimelineEntry records for matches
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

    if (messages.length === 0) {
      await prisma.emailIntegration.update({ where: { id: integration.id }, data: { syncedAt: new Date() } });
      continue;
    }

    // Build matching maps for this workspace (known contacts only)
    const clients = await prisma.client.findMany({
      where: { workspaceId: integration.workspaceId },
      select: { id: true, email: true },
    });

    const contacts = await prisma.contact.findMany({
      where: { client: { workspaceId: integration.workspaceId }, email: { not: null } },
      select: { email: true, clientId: true },
    });

    // Map 1: exact client email → clientId
    const exactEmailMap = new Map<string, string>();
    for (const c of clients) {
      if (c.email) exactEmailMap.set(c.email.toLowerCase().trim(), c.id);
    }

    // Map 2: contact email → clientId
    const contactEmailMap = new Map<string, string>();
    for (const ct of contacts) {
      if (ct.email) contactEmailMap.set(ct.email.toLowerCase().trim(), ct.clientId);
    }

    const intEmail = integration.email.toLowerCase();

    // Match messages to clients
    for (const msg of messages) {
      const fromEmail = extractEmail(msg.from);
      const toEmails = msg.to.split(',').map((t) => extractEmail(t));

      const isOutbound = fromEmail === intEmail;
      const matchEmails = isOutbound ? toEmails : [fromEmail];

      // Try matching in priority order: exact → contact
      let matchedClientId: string | undefined;
      let matchSource: 'exact' | 'contact' | undefined;

      for (const email of matchEmails) {
        // 1. Exact client email match
        const exactMatch = exactEmailMap.get(email);
        if (exactMatch) {
          matchedClientId = exactMatch;
          matchSource = 'exact';
          break;
        }

        // 2. Contact email match
        const contactMatch = contactEmailMap.get(email);
        if (contactMatch) {
          matchedClientId = contactMatch;
          matchSource = 'contact';
          break;
        }
      }

      if (!matchedClientId) {
        // No match — store as unmatched email for manual review
        const senderEmail = isOutbound ? toEmails[0] : fromEmail;
        const senderName = extractName(isOutbound ? msg.to : msg.from);
        const senderDomain = extractDomain(senderEmail ?? '');
        if (senderEmail && senderDomain) {
          await prisma.unmatchedEmail.upsert({
            where: { threadId: msg.threadId },
            update: {},
            create: {
              workspaceId: integration.workspaceId,
              threadId: msg.threadId,
              messageId: msg.id,
              fromEmail: senderEmail,
              fromName: senderName,
              fromDomain: senderDomain,
              subject: msg.subject || '(no subject)',
              bodyPreview: msg.snippet,
              receivedAt: msg.date,
            },
          });
        }
        continue;
      }

      // Avoid duplicates by externalId
      const existing = await prisma.crmTimelineEntry.findFirst({
        where: { clientId: matchedClientId, externalId: msg.id },
      });
      if (existing) continue;

      await prisma.crmTimelineEntry.create({
        data: {
          clientId: matchedClientId,
          type: 'EMAIL',
          title: msg.subject || '(no subject)',
          body: msg.snippet,
          externalId: msg.id,
          metadata: {
            from: msg.from,
            to: msg.to,
            matchSource,
          },
        },
      });
    }

    await prisma.emailIntegration.update({ where: { id: integration.id }, data: { syncedAt: new Date() } });
  }
}
