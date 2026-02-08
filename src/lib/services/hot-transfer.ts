import { getDb } from '@/db';
import { callAttempts, teamMembers, escalationClaims } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { notifyTeamForEscalation } from '@/lib/services/team-escalation';
import { eq, and } from 'drizzle-orm';

interface HotTransferPayload {
  leadId: string;
  clientId: string;
  leadPhone: string;
  twilioNumber: string;
  leadMessage: string;
  timezone?: string;
}

/**
 * Determine if a lead should be routed to ring group or escalation
 * Based on business hours and team availability
 */
export async function routeHighIntentLead(payload: HotTransferPayload) {
  const { leadId, clientId, twilioNumber, leadMessage, timezone = 'America/Edmonton' } = payload;

  try {
    const db = getDb();

    // Check if currently within business hours
    const withinHours = await isWithinBusinessHours(clientId, timezone);

    console.log(`[Hot Transfer] Routing decision - within_hours=${withinHours}`);

    if (!withinHours) {
      // Use escalation outside business hours
      console.log('[Hot Transfer] Outside business hours, using escalation');
      return await notifyTeamForEscalation({
        leadId,
        clientId,
        twilioNumber,
        reason: 'High-intent lead (outside business hours)',
        lastMessage: leadMessage,
      });
    }

    // Get available team members for ring group
    const members = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.clientId, clientId),
          eq(teamMembers.isActive, true),
          eq(teamMembers.receiveHotTransfers, true)
        )
      );

    if (members.length === 0) {
      console.log('[Hot Transfer] No team members available, using escalation');
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

    console.log('[Hot Transfer] Initiating ring group to', members.length, 'team members');

    return {
      success: true,
      method: 'ring-group',
      callId: callAttempt?.id,
      ringing: members.map((m) => m.phone),
      teamMemberCount: members.length,
    };
  } catch (error) {
    console.error('[Hot Transfer] Error routing:', error);
    return {
      success: false,
      error: 'Failed to route lead',
      method: 'error',
    };
  }
}

/**
 * Record a team member answering a ring group call
 */
export async function recordCallAnswered(
  callId: string,
  teamMemberId: string,
  duration: number = 0
) {
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

    console.log('[Hot Transfer] Call answered by team member:', teamMemberId);

    return { success: true };
  } catch (error) {
    console.error('[Hot Transfer] Error recording answer:', error);
    return { success: false, error: 'Failed to record answer' };
  }
}

/**
 * Record a call that was missed (no answer)
 */
export async function recordCallMissed(callId: string) {
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

    console.log('[Hot Transfer] Call missed for lead:', call.leadId);

    return {
      success: true,
      leadId: call.leadId,
      clientId: call.clientId,
    };
  } catch (error) {
    console.error('[Hot Transfer] Error recording missed call:', error);
    return { success: false, error: 'Failed to record missed call' };
  }
}

/**
 * Get ring group history for a lead
 */
export async function getCallAttempts(leadId: string) {
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
    console.error('[Hot Transfer] Error fetching call attempts:', error);
    return [];
  }
}

/**
 * Detect if a message indicates high intent (needs immediate routing)
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
