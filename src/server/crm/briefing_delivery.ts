/**
 * Briefing Delivery
 *
 * Sends formatted briefing to Discord via webhook.
 */

/**
 * Send a markdown-formatted briefing to Discord via webhook.
 */
export async function sendToDiscord(
  markdown: string,
  webhookUrl?: string,
): Promise<boolean> {
  const url = webhookUrl ?? process.env.DISCORD_ALERTS_WEBHOOK_URL;
  if (!url) {
    console.log('[briefing_delivery] No Discord webhook URL configured, skipping delivery');
    return false;
  }

  try {
    // Discord has a 2000 char limit per message
    const chunks = splitMessage(markdown, 1900);

    for (const chunk of chunks) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk }),
      });

      if (!res.ok) {
        console.error(`[briefing_delivery] Discord webhook failed: ${res.status} ${res.statusText}`);
        return false;
      }

      // Rate limit: wait 500ms between chunks
      if (chunks.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log('[briefing_delivery] Briefing delivered to Discord');
    return true;
  } catch (err) {
    console.error('[briefing_delivery] Discord delivery failed:', err);
    return false;
  }
}

/**
 * Split a message into chunks that fit within Discord's character limit.
 */
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
