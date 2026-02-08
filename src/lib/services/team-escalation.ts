import { getDb } from '@/db';
import { teamMembers, escalationClaims, leads } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and } from 'drizzle-orm';
import { generateClaimToken } from '@/lib/utils/tokens';

interface EscalationPayload {
  leadId: string;
  clientId: string;
  twilioNumber: string;
  reason: string;
  lastMessage: string;
}

/**
 * Notify team members about a high-intent lead escalation
 */
export async function notifyTeamForEscalation(payload: EscalationPayload) {
  const { leadId, clientId, twilioNumber, reason, lastMessage } = payload;

  try {
    const db = getDb();

    // Get active team members who receive escalations
    const members = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.clientId, clientId),
          eq(teamMembers.isActive, true),
          eq(teamMembers.receiveEscalations, true)
        )
      );

    if (members.length === 0) {
      console.log('[Team Escalation] No team members configured for escalations');
      return { notified: 0 };
    }

    // Get lead info
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      console.log('[Team Escalation] Lead not found:', leadId);
      return { notified: 0, error: 'Lead not found' };
    }

    // Create claim token and escalation record
    const claimToken = generateClaimToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const claimUrl = `${appUrl}/claims?token=${claimToken}`;

    const [escalation] = await db
      .insert(escalationClaims)
      .values({
        leadId,
        clientId,
        claimToken,
        escalationReason: reason,
        lastLeadMessage: lastMessage,
        status: 'pending',
      })
      .returning();

    if (!escalation) {
      console.log('[Team Escalation] Failed to create escalation claim');
      return { notified: 0, error: 'Failed to create claim' };
    }

    // Notify each team member
    let notifiedCount = 0;
    const leadName = lead.name || lead.phone || 'New Lead';
    const truncatedMessage = lastMessage.length > 80 ? lastMessage.substring(0, 80) + '...' : lastMessage;
    const smsBody = `🔥 ${leadName} needs help!\n\n"${truncatedMessage}"\n\nClaim to respond: ${claimUrl}`;

    for (const member of members) {
      try {
        const smsResult = await sendSMS(member.phone, twilioNumber, smsBody);
        if (smsResult.success) {
          notifiedCount++;
          console.log(`[Team Escalation] SMS sent to ${member.name}`);
        }
      } catch (error) {
        console.error(`[Team Escalation] Failed to notify ${member.name}:`, error);
      }
    }

    console.log(`[Team Escalation] Escalation created. Notified ${notifiedCount}/${members.length} team members`);

    return {
      notified: notifiedCount,
      escalationId: escalation.id,
      claimToken,
    };
  } catch (error) {
    console.error('[Team Escalation] Error:', error);
    return { notified: 0, error: 'Failed to escalate' };
  }
}

/**
 * Claim an escalation by a team member
 */
export async function claimEscalation(token: string, teamMemberId: string) {
  try {
    const db = getDb();

    // Find the escalation claim
    const [escalation] = await db
      .select()
      .from(escalationClaims)
      .where(eq(escalationClaims.claimToken, token))
      .limit(1);

    if (!escalation) {
      console.log('[Team Escalation] Invalid claim token:', token);
      return { success: false, error: 'Invalid claim link' };
    }

    if (escalation.status !== 'pending') {
      console.log('[Team Escalation] Escalation already claimed:', escalation.id);
      return { success: false, error: 'Already claimed' };
    }

    // Verify team member exists
    const [member] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, teamMemberId))
      .limit(1);

    if (!member) {
      console.log('[Team Escalation] Team member not found:', teamMemberId);
      return { success: false, error: 'Team member not found' };
    }

    // Claim the escalation
    await db
      .update(escalationClaims)
      .set({
        claimedBy: teamMemberId,
        claimedAt: new Date(),
        status: 'claimed',
      })
      .where(eq(escalationClaims.id, escalation.id));

    console.log(`[Team Escalation] Escalation claimed by ${member.name}`);

    return {
      success: true,
      leadId: escalation.leadId,
      escalationId: escalation.id,
      claimedBy: member.name,
    };
  } catch (error) {
    console.error('[Team Escalation] Error claiming:', error);
    return { success: false, error: 'Failed to claim' };
  }
}

/**
 * Get pending escalations for a client
 */
export async function getPendingEscalations(clientId: string) {
  try {
    const db = getDb();

    const pendingClaims = await db
      .select({
        id: escalationClaims.id,
        claimToken: escalationClaims.claimToken,
        escalationReason: escalationClaims.escalationReason,
        lastLeadMessage: escalationClaims.lastLeadMessage,
        notifiedAt: escalationClaims.notifiedAt,
        leadId: escalationClaims.leadId,
        leadName: leads.name,
        leadPhone: leads.phone,
      })
      .from(escalationClaims)
      .innerJoin(leads, eq(escalationClaims.leadId, leads.id))
      .where(
        and(eq(escalationClaims.clientId, clientId), eq(escalationClaims.status, 'pending'))
      );

    return pendingClaims;
  } catch (error) {
    console.error('[Team Escalation] Error fetching pending escalations:', error);
    return [];
  }
}
