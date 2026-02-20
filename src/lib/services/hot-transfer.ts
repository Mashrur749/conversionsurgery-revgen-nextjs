import { getDb } from '@/db';
import { callAttempts } from '@/db/schema';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { notifyTeamForEscalation } from '@/lib/services/team-escalation';
import { eq } from 'drizzle-orm';
import { getHotTransferMembers } from '@/lib/services/team-bridge';

interface HotTransferPayload {
  leadId: string;
  clientId: string;
  leadPhone: string;
  twilioNumber: string;
  leadMessage: string;
  timezone?: string;
}

interface HotTransferResult {
  success?: boolean;
  method?: string;
  callId?: string;
  ringing?: string[];
  teamMemberCount?: number;
  notified?: number;
  escalationId?: string;
  claimToken?: string;
  error?: string;
}

/**
 * [Voice] Determine if a lead should be routed to ring group or escalation
 * Based on business hours and team availability
 */
export async function routeHighIntentLead(payload: HotTransferPayload): Promise<HotTransferResult> {
  const { leadId, clientId, twilioNumber, leadMessage, timezone = 'America/Edmonton' } = payload;

  try {
    const db = getDb();

    // Check if currently within business hours
    const withinHours = await isWithinBusinessHours(clientId, timezone);

    console.log(`[Voice] Routing decision - within_hours=${withinHours}`);

    if (!withinHours) {
      // Use escalation outside business hours
      console.log('[Voice] Outside business hours, using escalation');
      return await notifyTeamForEscalation({
        leadId,
        clientId,
        twilioNumber,
        reason: 'High-intent lead (outside business hours)',
        lastMessage: leadMessage,
      });
    }

    // Get available team members for ring group
    const members = await getHotTransferMembers(clientId);

    if (members.length === 0) {
      console.log('[Voice] No team members available, using escalation');
      return await notifyTeamForEscalation({
        leadId,
        clientId,
        twilioNumber,
        reason: 'High-intent lead (no team available)',
        lastMessage: leadMessage,
      });
    }

    // Log call attempt
    const [callAttempt] = await db
      .insert(callAttempts)
      .values({
        leadId,
        clientId,
        status: 'ringing',
        createdAt: new Date(),
      })
      .returning();

    console.log('[Voice] Initiating ring group to', members.length, 'team members');

    return {
      success: true,
      method: 'ring-group',
      callId: callAttempt?.id,
      ringing: members.map((m) => m.phone),
      teamMemberCount: members.length,
    };
  } catch (error) {
    console.error('[Voice] Error routing:', error);
    return {
      success: false,
      error: 'Failed to route lead',
      method: 'error',
    };
  }
}

/**
 * [Voice] Record a team member answering a ring group call
 * @param callId - The call attempt ID
 * @param teamMemberId - The team member who answered
 * @param duration - Call duration in seconds
 */
export async function recordCallAnswered(
  callId: string,
  teamMemberId: string,
  duration: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();

    await db
      .update(callAttempts)
      .set({
        answeredBy: teamMemberId,
        answeredAt: new Date(),
        status: 'answered',
        duration,
      })
      .where(eq(callAttempts.id, callId));

    console.log('[Voice] Call answered by team member:', teamMemberId);

    return { success: true };
  } catch (error) {
    console.error('[Voice] Error recording answer:', error);
    return { success: false, error: 'Failed to record answer' };
  }
}

/**
 * [Voice] Record a call that was missed (no answer)
 * @param callId - The call attempt ID
 */
export async function recordCallMissed(callId: string): Promise<{ success: boolean; error?: string; leadId?: string; clientId?: string }> {
  try {
    const db = getDb();

    const [call] = await db.select().from(callAttempts).where(eq(callAttempts.id, callId));

    if (!call) {
      return { success: false, error: 'Call not found' };
    }

    // Update call status
    await db
      .update(callAttempts)
      .set({
        status: 'no-answer',
        endedAt: new Date(),
      })
      .where(eq(callAttempts.id, callId));

    console.log('[Voice] Call missed for lead:', call.leadId);

    return {
      success: true,
      leadId: call.leadId,
      clientId: call.clientId,
    };
  } catch (error) {
    console.error('[Voice] Error recording missed call:', error);
    return { success: false, error: 'Failed to record missed call' };
  }
}

interface CallAttemptHistory {
  id: string;
  status: string | null;
  answeredBy: string | null;
  duration: number | null;
  createdAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;
}

/**
 * [Voice] Get ring group history for a lead
 * @param leadId - The lead ID to get call attempts for
 */
export async function getCallAttempts(leadId: string): Promise<CallAttemptHistory[]> {
  try {
    const db = getDb();

    const attempts = await db
      .select({
        id: callAttempts.id,
        status: callAttempts.status,
        answeredBy: callAttempts.answeredBy,
        duration: callAttempts.duration,
        createdAt: callAttempts.createdAt,
        answeredAt: callAttempts.answeredAt,
        endedAt: callAttempts.endedAt,
      })
      .from(callAttempts)
      .where(eq(callAttempts.leadId, leadId));

    return attempts;
  } catch (error) {
    console.error('[Voice] Error fetching call attempts:', error);
    return [];
  }
}

/**
 * [Voice] Detect if a message indicates high intent (needs immediate routing)
 * @param message - The message to analyze
 */
export function detectHighIntent(message: string): boolean {
  const highIntentPatterns = [
    /\bcallback\b/i,
    /\bcall\s+me\s+(back|asap)\b/i,
    /\bspeak\s+to\b/i,
    /\btalk\s+to\b/i,
    /\bur gent\b/i,
    /\bASAP\b/,
    /\bimmediately\b/i,
    /\bright\s+now\b/i,
    /\bhow\s+much/i,
    /\bquote\b/i,
    /\bestimate\b/i,
  ];

  return highIntentPatterns.some((pattern) => pattern.test(message));
}
