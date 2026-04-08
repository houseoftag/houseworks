/**
 * CRM Email Classifier
 *
 * AI-classifies emails into: NEED_REPLY, FYI, LEAD, VENDOR, IGNORE.
 * Uses Claude Haiku via @anthropic-ai/sdk.
 *
 * Exclusion filter runs BEFORE classification — excluded emails never
 * enter the CRM timeline at all.
 */

import { prisma } from '@/server/db';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Email Classifications ──────────────────────────────────────────────────────

export type EmailClassification = 'NEED_REPLY' | 'FYI' | 'LEAD' | 'VENDOR' | 'IGNORE';

const VALID_CLASSIFICATIONS: EmailClassification[] = ['NEED_REPLY', 'FYI', 'LEAD', 'VENDOR', 'IGNORE'];

// ─── Exclusion Filter ───────────────────────────────────────────────────────────

let exclusionList: string[] | null = null;

function loadExclusions(): string[] {
  if (exclusionList !== null) return exclusionList;
  try {
    const raw = readFileSync(
      join(process.cwd(), 'src/server/crm/email-exclusions.json'),
      'utf-8',
    );
    exclusionList = (JSON.parse(raw) as string[]).map((e) => e.toLowerCase().trim());
  } catch {
    exclusionList = [];
  }
  return exclusionList;
}

/**
 * Check if an email should be excluded from CRM processing.
 * Returns true if any address in from/to matches the exclusion list
 * or matches Jaci (Tag's ex-wife) — any address with "jaci" in the local part.
 */
export function isExcluded(fromEmail: string, toEmails: string[]): boolean {
  const exclusions = loadExclusions();
  const allAddresses = [fromEmail, ...toEmails].map((e) => e.toLowerCase().trim());

  for (const addr of allAddresses) {
    // Check explicit exclusion list
    if (exclusions.includes(addr)) return true;

    // Check for Jaci — any email with "jaci" in the local part
    const localPart = addr.split('@')[0] ?? '';
    if (localPart.includes('jaci')) return true;
  }
  return false;
}

// ─── Classification ─────────────────────────────────────────────────────────────

let rubricCache: string | null = null;

function loadRubric(): string {
  if (rubricCache !== null) return rubricCache;
  try {
    rubricCache = readFileSync(
      join(process.cwd(), 'src/server/crm/classification-rubric.md'),
      'utf-8',
    );
  } catch {
    rubricCache = 'Classify emails as: NEED_REPLY, FYI, LEAD, VENDOR, or IGNORE.';
  }
  return rubricCache;
}

/**
 * Classify a single email using Claude Haiku.
 * Returns the classification and confidence.
 */
export async function classifyEmail(email: {
  from: string;
  to: string;
  subject: string;
  snippet: string;
}): Promise<{ classification: EmailClassification; confidence: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { classification: 'FYI', confidence: 0 };
  }

  const rubric = loadRubric();

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `${rubric}\n\n---\n\nClassify this email. Return ONLY the label (one of: NEED_REPLY, FYI, LEAD, VENDOR, IGNORE).\n\nFrom: ${email.from}\nTo: ${email.to}\nSubject: ${email.subject}\nBody: ${email.snippet}`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text.trim().toUpperCase() : '';
    const classification = VALID_CLASSIFICATIONS.includes(text as EmailClassification)
      ? (text as EmailClassification)
      : 'FYI';

    // Use stop_reason as a rough confidence proxy
    const confidence = response.stop_reason === 'end_turn' ? 0.85 : 0.5;

    return { classification, confidence };
  } catch (err) {
    console.error('[email_classifier] Classification failed:', err);
    return { classification: 'FYI', confidence: 0 };
  }
}

/**
 * Batch-classify unclassified email timeline entries.
 * Called by the worker cron job.
 */
export async function classifyUnclassifiedEmails(): Promise<number> {
  // Find EMAIL entries without classification in metadata
  const entries = await prisma.crmTimelineEntry.findMany({
    where: {
      type: 'EMAIL',
      // Find entries where metadata doesn't have classification
      // We'll check in code since JSON filtering varies by DB
    },
    select: {
      id: true,
      title: true,
      body: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  let classified = 0;

  for (const entry of entries) {
    const meta = (entry.metadata as Record<string, unknown>) ?? {};
    if (meta.classification) continue; // Already classified

    const result = await classifyEmail({
      from: (meta.from as string) ?? '',
      to: (meta.to as string) ?? '',
      subject: entry.title,
      snippet: entry.body ?? '',
    });

    await prisma.crmTimelineEntry.update({
      where: { id: entry.id },
      data: {
        metadata: {
          ...meta,
          classification: result.classification,
          confidence: result.confidence,
          classifiedAt: new Date().toISOString(),
        },
      },
    });

    classified++;
  }

  return classified;
}

/**
 * Reset rubric cache — call when rubric file is updated.
 */
export function resetRubricCache(): void {
  rubricCache = null;
}

/**
 * Reset exclusion cache — call when exclusions file is updated.
 */
export function resetExclusionCache(): void {
  exclusionList = null;
}
