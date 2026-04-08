/**
 * Account Manager Briefing
 *
 * Generates a daily client briefing for a workspace:
 * - NEED REPLY: clients with unresolved NEED_REPLY emails
 * - AT RISK: clients with no activity in 14+ days
 * - DEALS: open deals with stage + last movement
 * - UPCOMING: calendar events (stubbed for now)
 */

import { prisma } from '@/server/db';

export interface BriefingData {
  date: string;
  needReply: {
    clientName: string;
    clientId: string;
    subject: string;
    from: string;
    ageHours: number;
  }[];
  atRisk: {
    clientName: string;
    clientId: string;
    daysSinceActivity: number;
    activeDeals: number;
  }[];
  deals: {
    clientName: string;
    clientId: string;
    dealTitle: string;
    stage: string;
    value: number | null;
    daysSinceUpdate: number;
  }[];
  upcoming: {
    clientName: string;
    description: string;
    date: string;
  }[];
}

/**
 * Generate briefing data for a workspace.
 */
export async function generateBriefing(workspaceId: string): Promise<BriefingData> {
  const now = new Date();

  const clients = await prisma.client.findMany({
    where: { workspaceId },
    include: {
      timeline: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, type: true, title: true, metadata: true, createdAt: true },
      },
      deals: {
        where: { stage: { notIn: ['WON', 'LOST'] } },
        select: { id: true, title: true, stage: true, value: true, updatedAt: true },
      },
    },
  });

  const needReply: BriefingData['needReply'] = [];
  const atRisk: BriefingData['atRisk'] = [];
  const deals: BriefingData['deals'] = [];

  for (const client of clients) {
    // NEED REPLY: emails with NEED_REPLY classification
    for (const entry of client.timeline) {
      if (entry.type !== 'EMAIL') continue;
      const meta = entry.metadata as Record<string, unknown> | null;
      if (meta?.classification !== 'NEED_REPLY') continue;

      const ageMs = now.getTime() - entry.createdAt.getTime();
      const ageHours = Math.round(ageMs / (1000 * 60 * 60));

      needReply.push({
        clientName: client.displayName,
        clientId: client.id,
        subject: entry.title,
        from: (meta.from as string) ?? '',
        ageHours,
      });
    }

    // AT RISK: no activity in 14+ days
    const lastActivity = client.timeline[0]?.createdAt;
    if (lastActivity) {
      const daysSince = Math.round((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 14) {
        atRisk.push({
          clientName: client.displayName,
          clientId: client.id,
          daysSinceActivity: daysSince,
          activeDeals: client.deals.length,
        });
      }
    }

    // DEALS: open deals
    for (const deal of client.deals) {
      const daysSinceUpdate = Math.round(
        (now.getTime() - deal.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      deals.push({
        clientName: client.displayName,
        clientId: client.id,
        dealTitle: deal.title,
        stage: deal.stage,
        value: deal.value,
        daysSinceUpdate,
      });
    }
  }

  // Sort: needReply by age desc, atRisk by days desc, deals by days since update desc
  needReply.sort((a, b) => b.ageHours - a.ageHours);
  atRisk.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
  deals.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);

  return {
    date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    needReply,
    atRisk,
    deals,
    upcoming: [], // Calendar integration stubbed
  };
}

/**
 * Format briefing data into readable markdown for Discord/Telegram.
 */
export function formatBriefingMarkdown(data: BriefingData): string {
  const lines: string[] = [];
  lines.push(`**Client Briefing — ${data.date}**`);
  lines.push('');

  // NEED REPLY
  if (data.needReply.length > 0) {
    lines.push(`**NEED REPLY (${data.needReply.length}):**`);
    for (const r of data.needReply) {
      const age = r.ageHours < 24
        ? `${r.ageHours}h ago`
        : `${Math.round(r.ageHours / 24)}d ago`;
      lines.push(`- ${r.clientName} — ${r.subject} (${age})`);
    }
    lines.push('');
  }

  // AT RISK
  if (data.atRisk.length > 0) {
    lines.push('**AT RISK:**');
    for (const r of data.atRisk) {
      const deals = r.activeDeals > 0 ? ` (${r.activeDeals} active deal${r.activeDeals > 1 ? 's' : ''})` : '';
      lines.push(`- ${r.clientName} — No activity in ${r.daysSinceActivity} days${deals}`);
    }
    lines.push('');
  }

  // DEALS
  if (data.deals.length > 0) {
    lines.push('**DEALS:**');
    for (const d of data.deals) {
      const val = d.value ? `, $${d.value.toLocaleString()}` : '';
      const stale = d.daysSinceUpdate > 7 ? ` (no movement in ${d.daysSinceUpdate}d)` : '';
      lines.push(`- ${d.dealTitle} — ${d.stage}${val}${stale}`);
    }
    lines.push('');
  }

  // UPCOMING
  if (data.upcoming.length > 0) {
    lines.push('**UPCOMING:**');
    for (const u of data.upcoming) {
      lines.push(`- ${u.clientName} — ${u.description} ${u.date}`);
    }
    lines.push('');
  }

  if (data.needReply.length === 0 && data.atRisk.length === 0 && data.deals.length === 0) {
    lines.push('All clear — no urgent items today.');
  }

  return lines.join('\n');
}
