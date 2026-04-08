/**
 * CRM Auto-Tagger
 *
 * Applies/removes automated tags based on client state:
 * - needs-reply: has NEED_REPLY classified email >24h old
 * - at-risk: no activity in 14+ days with active deals
 * - upsell-candidate: recent FYI emails (lightweight heuristic)
 */

import { prisma } from '@/server/db';

const AUTO_TAGS = ['needs-reply', 'at-risk', 'upsell-candidate'] as const;

/**
 * Run auto-tagging for all clients in a workspace.
 * Called by the daily briefing cron before generating the briefing.
 */
export async function runAutoTags(workspaceId: string): Promise<void> {
  const clients = await prisma.client.findMany({
    where: { workspaceId },
    include: {
      timeline: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, metadata: true, createdAt: true },
      },
      deals: {
        where: { stage: { notIn: ['WON', 'LOST'] } },
        select: { id: true },
      },
      tags: false, // We'll get tags from the client itself
    },
  });

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (const client of clients) {
    const currentTags = new Set(client.tags);
    const newTags = new Set(client.tags.filter((t) => !AUTO_TAGS.includes(t as typeof AUTO_TAGS[number])));

    // needs-reply: has NEED_REPLY classified email >24h old
    const hasNeedReply = client.timeline.some((entry) => {
      if (entry.type !== 'EMAIL') return false;
      const meta = entry.metadata as Record<string, unknown> | null;
      if (meta?.classification !== 'NEED_REPLY') return false;
      return entry.createdAt.getTime() < twentyFourHoursAgo;
    });
    if (hasNeedReply) newTags.add('needs-reply');

    // at-risk: no activity in 14+ days AND has active deals
    const lastActivity = client.timeline[0]?.createdAt;
    const isStale = !lastActivity || lastActivity.getTime() < fourteenDaysAgo;
    const hasActiveDeals = client.deals.length > 0;
    if (isStale && hasActiveDeals) newTags.add('at-risk');

    // upsell-candidate: recent FYI emails in last 7 days
    const recentFyi = client.timeline.filter((entry) => {
      if (entry.type !== 'EMAIL') return false;
      const meta = entry.metadata as Record<string, unknown> | null;
      if (meta?.classification !== 'FYI') return false;
      return entry.createdAt.getTime() > sevenDaysAgo;
    });
    if (recentFyi.length >= 2) newTags.add('upsell-candidate');

    // Only update if tags changed
    const tagsArray = [...newTags];
    const changed = tagsArray.length !== currentTags.size ||
      tagsArray.some((t) => !currentTags.has(t));

    if (changed) {
      await prisma.client.update({
        where: { id: client.id },
        data: { tags: { set: tagsArray } },
      });
    }
  }
}
