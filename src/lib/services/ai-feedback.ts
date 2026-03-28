import { getDb } from '@/db';
import { conversations, dailyStats } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * Valid reasons for flagging an AI message.
 * Kept as a const array so it can be reused in Zod validation.
 */
export const FLAG_REASONS = [
  'wrong_tone',
  'inaccurate',
  'too_pushy',
  'hallucinated',
  'off_topic',
  'other',
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

/**
 * Flag an AI-generated message as problematic.
 *
 * Only AI messages (messageType = 'ai_response') can be flagged.
 * Flagging an already-flagged message updates the flag in place.
 *
 * @returns The updated message, or null if not found or not an AI message
 */
export async function flagMessage(params: {
  messageId: string;
  clientId: string;
  flaggedBy: string;
  reason: FlagReason;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Verify message exists, belongs to client, and is AI-generated
  const [message] = await db
    .select({
      id: conversations.id,
      messageType: conversations.messageType,
      clientId: conversations.clientId,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, params.messageId),
        eq(conversations.clientId, params.clientId)
      )
    )
    .limit(1);

  if (!message) {
    return { success: false, error: 'Message not found' };
  }

  if (message.messageType !== 'ai_response') {
    return { success: false, error: 'Only AI-generated messages can be flagged' };
  }

  await db
    .update(conversations)
    .set({
      flagged: true,
      flagReason: params.reason,
      flagNote: params.note ?? null,
      flaggedBy: params.flaggedBy,
      flaggedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, params.messageId));

  // Increment daily flag counter (best-effort)
  try {
    const today = new Date().toISOString().split('T')[0];
    await db
      .insert(dailyStats)
      .values({
        clientId: params.clientId,
        date: today,
        aiMessagesFlagged: 1,
      })
      .onConflictDoUpdate({
        target: [dailyStats.clientId, dailyStats.date],
        set: {
          aiMessagesFlagged: sql`coalesce(${dailyStats.aiMessagesFlagged}, 0) + 1`,
        },
      });
  } catch {
    // Never block flagging on stats failure
  }

  return { success: true };
}

/**
 * Remove the flag from a message.
 */
export async function unflagMessage(params: {
  messageId: string;
  clientId: string;
}): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  const [message] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, params.messageId),
        eq(conversations.clientId, params.clientId)
      )
    )
    .limit(1);

  if (!message) {
    return { success: false, error: 'Message not found' };
  }

  await db
    .update(conversations)
    .set({
      flagged: false,
      flagReason: null,
      flagNote: null,
      flaggedBy: null,
      flaggedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, params.messageId));

  return { success: true };
}

/**
 * Get flagged AI messages for a client, most recent first.
 */
export async function getFlaggedMessages(
  clientId: string,
  options?: { limit?: number; offset?: number }
) {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return db
    .select({
      id: conversations.id,
      leadId: conversations.leadId,
      content: conversations.content,
      aiConfidence: conversations.aiConfidence,
      flagReason: conversations.flagReason,
      flagNote: conversations.flagNote,
      flaggedBy: conversations.flaggedBy,
      flaggedAt: conversations.flaggedAt,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(
      and(eq(conversations.clientId, clientId), eq(conversations.flagged, true))
    )
    .orderBy(desc(conversations.flaggedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get flagged messages across all clients (admin-wide view).
 */
export async function getAllFlaggedMessages(options?: {
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return db
    .select({
      id: conversations.id,
      clientId: conversations.clientId,
      leadId: conversations.leadId,
      content: conversations.content,
      aiConfidence: conversations.aiConfidence,
      flagReason: conversations.flagReason,
      flagNote: conversations.flagNote,
      flaggedBy: conversations.flaggedBy,
      flaggedAt: conversations.flaggedAt,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(eq(conversations.flagged, true))
    .orderBy(desc(conversations.flaggedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get flag summary stats for a client.
 */
export async function getFlagStats(clientId: string) {
  const db = getDb();

  const [stats] = await db
    .select({
      totalFlagged: sql<number>`count(*)::int`,
      wrongTone: sql<number>`count(*) filter (where ${conversations.flagReason} = 'wrong_tone')::int`,
      inaccurate: sql<number>`count(*) filter (where ${conversations.flagReason} = 'inaccurate')::int`,
      tooPushy: sql<number>`count(*) filter (where ${conversations.flagReason} = 'too_pushy')::int`,
      hallucinated: sql<number>`count(*) filter (where ${conversations.flagReason} = 'hallucinated')::int`,
      offTopic: sql<number>`count(*) filter (where ${conversations.flagReason} = 'off_topic')::int`,
      other: sql<number>`count(*) filter (where ${conversations.flagReason} = 'other')::int`,
    })
    .from(conversations)
    .where(
      and(eq(conversations.clientId, clientId), eq(conversations.flagged, true))
    );

  return stats;
}
