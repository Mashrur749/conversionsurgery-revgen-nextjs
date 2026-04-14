import { getDb } from '@/db';
import { conversations, leadContext } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { getTrackedAI } from '@/lib/ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUMMARY_THRESHOLD = 20;
export const REGAP_HOURS = 24;
export const RESUMMARIZE_DELTA = 10;

const SUMMARY_KEEP_RECENT = 15; // always keep the last N messages unsummarized

const SYSTEM_PROMPT = `Summarize this conversation between a customer and a home services business.
Include:
- What the customer needs (service type, project details)
- Any pricing discussed or quotes given
- Objections or concerns raised
- Appointments discussed or scheduled
- Current status (waiting for quote, scheduled, thinking about it, etc.)
- Key facts about the property (age, type, location mentions)

Keep it under 200 words. Facts only, no interpretation. Write in present tense.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SummaryCheck {
  totalMessages: number;
  lastMessageAt: Date;
  existingSummary: string | null;
  /** Message count at the time the last summary was generated */
  summaryMessageCount?: number;
}

// ---------------------------------------------------------------------------
// Trigger logic (pure, testable)
// ---------------------------------------------------------------------------

/**
 * Determines whether a conversation summary should be created or refreshed.
 *
 * Rules (first match wins):
 * 1. Re-engagement: last message is older than REGAP_HOURS — always summarize
 *    regardless of count (helps the agent quickly re-orient).
 * 2. First summary: no existing summary and totalMessages > SUMMARY_THRESHOLD.
 * 3. Stale summary: existing summary exists but at least RESUMMARIZE_DELTA new
 *    messages have arrived since it was generated.
 */
export function shouldUpdateSummary(check: SummaryCheck): boolean {
  const { totalMessages, lastMessageAt, existingSummary, summaryMessageCount } = check;

  // Rule 1 — re-engagement gap
  const hoursSinceLast = (Date.now() - lastMessageAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLast >= REGAP_HOURS) {
    return true;
  }

  // Rule 2 — first-time summary threshold
  if (!existingSummary && totalMessages > SUMMARY_THRESHOLD) {
    return true;
  }

  // Rule 3 — stale summary (needs summaryMessageCount to be meaningful)
  if (
    existingSummary !== null &&
    summaryMessageCount !== undefined &&
    totalMessages - summaryMessageCount >= RESUMMARIZE_DELTA
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Summary generation (async, uses AI)
// ---------------------------------------------------------------------------

/**
 * Generates (or refreshes) a conversation summary for a lead and persists it
 * to `lead_context.conversation_summary`.
 *
 * Returns the new summary string, or null if there are not enough messages to
 * warrant summarization (≤ SUMMARY_KEEP_RECENT messages total).
 */
export async function updateConversationSummary(
  clientId: string,
  leadId: string
): Promise<string | null> {
  const db = getDb();

  // 1. Fetch full conversation history ordered oldest-first
  const msgs = await db
    .select({
      direction: conversations.direction,
      content: conversations.content,
    })
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(asc(conversations.createdAt));

  // 2. Not enough messages to summarize
  if (msgs.length <= SUMMARY_KEEP_RECENT) {
    return null;
  }

  // 3. Summarize everything except the last SUMMARY_KEEP_RECENT messages
  const toSummarize = msgs.slice(0, msgs.length - SUMMARY_KEEP_RECENT);

  // 4. Format as readable transcript
  const transcript = toSummarize
    .map((m) => {
      const speaker = m.direction === 'inbound' ? 'Customer' : 'Business';
      return `${speaker}: ${m.content}`;
    })
    .join('\n');

  // 5. Call AI (fast tier — Haiku, low temperature for factual summary)
  const ai = getTrackedAI({ clientId, operation: 'conversation_summary', leadId });

  let summary: string;
  try {
    const result = await ai.chat(
      [{ role: 'user', content: transcript }],
      {
        model: 'fast',
        temperature: 0.3,
        maxTokens: 300,
        systemPrompt: SYSTEM_PROMPT,
      }
    );
    summary = result.content.trim();
  } catch (err) {
    console.error('[ConversationSummary] AI call failed, keeping existing summary:', err);
    return null;
  }

  // 6. Persist to lead_context
  await db
    .update(leadContext)
    .set({ conversationSummary: summary, updatedAt: new Date() })
    .where(eq(leadContext.leadId, leadId));

  return summary;
}
