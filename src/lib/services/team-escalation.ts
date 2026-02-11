import { getDb } from '@/db';
import { teamMembers, escalationClaims, leads, clients } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { eq, and } from 'drizzle-orm';
import { generateClaimToken } from '@/lib/utils/tokens';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface EscalationPayload {
  leadId: string;
  clientId: string;
  twilioNumber: string;
  reason: string;
  lastMessage: string;
}

/**
 * Notify team members about a high-intent lead escalation.
 * Sends SMS to all active escalation-enabled members (ordered by priority)
 * and email to those with an email address configured.
 * Creates an escalation claim record with a unique token so the first
 * team member to respond can claim ownership of the lead.
 *
 * @param payload - Escalation details including leadId, clientId, twilioNumber, reason, and lastMessage
 * @returns Object with `notified` count, `escalationId`, and `claimToken` on success
 */
export async function notifyTeamForEscalation(payload: EscalationPayload) {
  const { leadId, clientId, twilioNumber, reason, lastMessage } = payload;

  try {
    const db = getDb();

    // Get active team members who receive escalations, ordered by priority
    const members = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.clientId, clientId),
          eq(teamMembers.isActive, true),
          eq(teamMembers.receiveEscalations, true)
        )
      )
      .orderBy(teamMembers.priority);

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

    // Build notification message
    const leadDisplay = lead.name || formatPhoneNumber(lead.phone);
    const truncatedMessage =
      lastMessage.length > 80 ? lastMessage.substring(0, 80) + '...' : lastMessage;
    const smsBody = `🔥 ${leadDisplay} needs help!\n\n"${truncatedMessage}"\n\nReason: ${reason}\n\nClaim to respond: ${claimUrl}`;

    let notifiedCount = 0;

    for (const member of members) {
      // Send SMS notification
      try {
        const smsResult = await sendSMS(member.phone, twilioNumber, smsBody);
        if (smsResult.success) {
          notifiedCount++;
          console.log(`[Team Escalation] SMS sent to ${member.name}`);
        }
      } catch (error) {
        console.error(`[Team Escalation] Failed to SMS ${member.name}:`, error);
      }

      // Send email notification if member has email
      if (member.email) {
        try {
          const emailData = actionRequiredEmail({
            businessName: '',
            leadName: lead.name || undefined,
            leadPhone: formatPhoneNumber(lead.phone),
            reason,
            lastMessage,
            dashboardUrl: claimUrl,
          });
          await sendEmail({ to: member.email, ...emailData });
          console.log(`[Team Escalation] Email sent to ${member.name}`);
        } catch (error) {
          console.error(`[Team Escalation] Failed to email ${member.name}:`, error);
        }
      }
    }

    console.log(
      `[Team Escalation] Escalation created. Notified ${notifiedCount}/${members.length} team members`
    );

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
 * Claim an escalation by a team member.
 * Marks the escalation as claimed, clears the actionRequired flag on the lead,
 * and notifies remaining team members that someone has taken ownership.
 *
 * @param token        - The unique claim token from the escalation URL
 * @param teamMemberId - UUID of the team member claiming the escalation
 * @returns Object with `success`, `leadId`, and `leadPhone` on success; or `error` on failure
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
      // Look up who claimed it
      let claimedByName = 'Someone';
      if (escalation.claimedBy) {
        const [claimer] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, escalation.claimedBy))
          .limit(1);
        if (claimer) claimedByName = claimer.name;
      }

      console.log('[Team Escalation] Escalation already claimed:', escalation.id);
      return {
        success: false,
        error: 'Already claimed',
        claimedBy: claimedByName,
      };
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

    // Clear action required flag on the lead
    await db
      .update(leads)
      .set({
        actionRequired: false,
        actionRequiredReason: null,
      })
      .where(eq(leads.id, escalation.leadId));

    // Notify other team members that someone claimed it
    const otherMembers = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.clientId, escalation.clientId),
          eq(teamMembers.isActive, true),
          eq(teamMembers.receiveEscalations, true)
        )
      );

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, escalation.leadId))
      .limit(1);

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, escalation.clientId))
      .limit(1);

    if (client?.twilioNumber) {
      const leadDisplay = lead?.name || formatPhoneNumber(lead?.phone || '');

      for (const otherMember of otherMembers) {
        if (otherMember.id === teamMemberId) continue;

        try {
          await sendSMS(
            otherMember.phone,
            client.twilioNumber,
            `✓ ${member.name} is handling ${leadDisplay}`
          );
        } catch (error) {
          console.error(
            `[Team Escalation] Failed to notify ${otherMember.name} of claim:`,
            error
          );
        }
      }
    }

    console.log(`[Team Escalation] Escalation claimed by ${member.name}`);

    return {
      success: true,
      leadId: escalation.leadId,
      leadPhone: lead?.phone,
    };
  } catch (error) {
    console.error('[Team Escalation] Error claiming:', error);
    return { success: false, error: 'Failed to claim' };
  }
}

/**
 * Retrieve all pending (unclaimed) escalations for a client,
 * joined with lead details for display.
 *
 * @param clientId - UUID of the client
 * @returns Array of pending escalation records with lead name/phone, or empty array on error
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
