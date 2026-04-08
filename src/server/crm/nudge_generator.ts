/**
 * Nudge Generator
 *
 * For at-risk clients, generates draft check-in messages using Claude.
 * Creates draft NOTE timeline entries with nudgeDraft metadata.
 * NEVER auto-sends — draft only.
 */

import { prisma } from '@/server/db';

interface AtRiskClient {
  clientName: string;
  clientId: string;
  daysSinceActivity: number;
  lastSubject?: string;
}

/**
 * Generate nudge drafts for at-risk clients.
 * Creates draft NOTE timeline entries.
 */
export async function generateNudges(
  atRiskClients: AtRiskClient[],
): Promise<number> {
  if (atRiskClients.length === 0) return 0;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let generated = 0;

  for (const client of atRiskClients.slice(0, 5)) {
    // Check if we already have a pending nudge for this client
    const existingNudge = await prisma.crmTimelineEntry.findFirst({
      where: {
        clientId: client.clientId,
        type: 'NOTE',
        metadata: {
          path: ['nudgeDraft'],
          equals: true,
        },
      },
    });
    if (existingNudge) continue;

    let nudgeText: string;

    if (apiKey) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({ apiKey });

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `Write a brief, warm check-in message for a client named "${client.clientName}" who hasn't been in touch for ${client.daysSinceActivity} days.${client.lastSubject ? ` Their last conversation was about: "${client.lastSubject}".` : ''}

Rules:
- Casual, direct tone — like texting a colleague you respect
- 2-3 sentences max
- Don't be overly formal or salesy
- Reference the last topic if available
- End with a low-pressure question

Return ONLY the message text, no quotes or labels.`,
            },
          ],
        });

        nudgeText = response.content[0]?.type === 'text'
          ? response.content[0].text.trim()
          : `Hey — haven't heard from you in a while. Everything good on your end?`;
      } catch {
        nudgeText = `Hey ${client.clientName} — checking in. It's been about ${client.daysSinceActivity} days since we last connected. Anything I can help with?`;
      }
    } else {
      nudgeText = `Hey ${client.clientName} — checking in. It's been about ${client.daysSinceActivity} days since we last connected. Anything I can help with?`;
    }

    await prisma.crmTimelineEntry.create({
      data: {
        clientId: client.clientId,
        type: 'NOTE',
        title: `[Draft Nudge] Check-in with ${client.clientName}`,
        body: nudgeText,
        metadata: {
          nudgeDraft: true,
          status: 'pending',
          generatedAt: new Date().toISOString(),
        },
      },
    });

    generated++;
  }

  return generated;
}
