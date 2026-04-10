import { getDb } from '@/db';
import { escalationClaims, leads, clients } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { generateClaimToken } from '@/lib/utils/tokens';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { getEscalationMembers, getTeamMemberById } from '@/lib/services/team-bridge';

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
    const members = await getEscalationMembers(clientId);

    // Get lead info
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (!lead) {
      console.log('[Team Escalation] Lead not found:', leadId);
      return { notified: 0, error: 'Lead not found' };
    }

    if (members.length === 0) {
      // Fallback path: notify business owner directly when no escalation team is configured.
      const [client] = await db
        .select({
          businessName: clients.businessName,
          ownerName: clients.ownerName,
          ownerPhone: clients.phone,
          ownerEmail: clients.email,
        })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client) {
        console.log('[Team Escalation] Client not found for fallback:', clientId);
        return { notified: 0, error: 'Client not found' };
      }

      const leadDisplay = lead.name || formatPhoneNumber(lead.phone);
      const truncatedMessage =
        lastMessage.length > 80 ? `${lastMessage.substring(0, 80)}...` : lastMessage;
      const smsBody = `URGENT: ${leadDisplay} needs a response.\n\n"${truncatedMessage}"\n\nReason: ${reason}\n\nOpen dashboard to respond.`;

      let notified = 0;

      if (client.ownerPhone) {
        try {
          await sendSMS(client.ownerPhone, smsBody, twilioNumber);
          notified++;
        } catch (error) {
          console.error('[Team Escalation] Owner fallback SMS failed:', error);
        }
      }

      if (client.ownerEmail) {
        try {
          const emailData = actionRequiredEmail({
            businessName: client.businessName,
            leadName: lead.name || undefined,
            leadPhone: formatPhoneNumber(lead.phone),
            reason,
            lastMessage,
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/leads/${lead.id}`,
          });
          await sendEmail({ to: client.ownerEmail, ...emailData });
          notified++;
        } catch (error) {
          console.error('[Team Escalation] Owner fallback email failed:', error);
        }
      }

      console.log('[Team Escalation] No team members configured, used owner fallback', {
        clientId,
        notified,
      });
      return { notified };
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
    const smsBody = `URGENT: ${leadDisplay} needs a response.\n\n"${truncatedMessage}"\n\nReason: ${reason}\n\nClaim to respond: ${claimUrl}`;

    let notifiedCount = 0;

    for (const member of members) {
      // Send SMS notification with retry (EC-17: single retry with 1-second delay)
      let smsSent = false;
      try {
        await sendSMS(member.phone, smsBody, twilioNumber);
        smsSent = true;
        notifiedCount++;
        console.log(`[Team Escalation] SMS sent to ${member.name}`);
      } catch (error) {
        console.error(`[Team Escalation] Failed to SMS ${member.name} (first attempt):`, error);
        // Single retry after 1 second
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sendSMS(member.phone, smsBody, twilioNumber);
          smsSent = true;
          notifiedCount++;
          console.log(`[Team Escalation] SMS sent to ${member.name} (retry)`);
        } catch (retryError) {
          console.error(`[Team Escalation] Failed to SMS ${member.name} (retry):`, retryError);
        }
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

    // Verify team member exists first (before attempting claim)
    const member = await getTeamMemberById(teamMemberId);

    if (!member) {
      console.log('[Team Escalation] Team member not found:', teamMemberId);
      return { success: false, error: 'Team member not found' };
    }

    // Atomic claim: UPDATE only if status is still 'pending'
    // This prevents the TOCTOU race where two team members both read 'pending'
    // and then both write 'claimed'. Only one UPDATE will match the WHERE clause.
    const [claimed] = await db
      .update(escalationClaims)
      .set({
        claimedBy: teamMemberId,
        claimedAt: new Date(),
        status: 'claimed',
      })
      .where(
        and(
          eq(escalationClaims.claimToken, token),
          eq(escalationClaims.status, 'pending'),
          eq(escalationClaims.clientId, member.clientId)
        )
      )
      .returning();

    if (!claimed) {
      // Either invalid token, already claimed, or cross-client attempt.
      // Look up the escalation to provide a better error message.
      const [escalation] = await db
        .select()
        .from(escalationClaims)
        .where(eq(escalationClaims.claimToken, token))
        .limit(1);

      if (!escalation) {
        console.log('[Team Escalation] Invalid claim token:', token);
        return { success: false, error: 'Invalid claim link' };
      }

      if (escalation.clientId !== member.clientId) {
        console.log('[Team Escalation] Cross-client claim attempt:', { teamMemberId, escalationClient: escalation.clientId, memberClient: member.clientId });
        return { success: false, error: 'Team member not found' };
      }

      // Already claimed — look up who claimed it
      let claimedByName = 'Someone';
      if (escalation.claimedBy) {
        const claimer = await getTeamMemberById(escalation.claimedBy);
        if (claimer) claimedByName = claimer.name;
      }

      console.log('[Team Escalation] Escalation already claimed:', escalation.id);
      return {
        success: false,
        error: 'Already claimed',
        claimedBy: claimedByName,
      };
    }

    const escalation = claimed;

    // Clear action required flag on the lead
    await db
      .update(leads)
      .set({
        actionRequired: false,
        actionRequiredReason: null,
      })
      .where(eq(leads.id, escalation.leadId));

    // Notify other team members that someone claimed it
    const otherMembers = await getEscalationMembers(escalation.clientId);

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
            `Claimed: ${member.name} is handling ${leadDisplay}.`,
            client.twilioNumber
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

/**
 * Re-notify team for escalation claims that remain unclaimed.
 * Called by cron every 5 minutes.
 *
 * Re-notification schedule (capped at 3 total):
 *   - Stage 1 (15 min): first re-notify to all team members
 *   - Stage 2 (30 min): second re-notify to all team members
 *   - Stage 3 (60 min): final re-notify + escalate directly to business owner if not already notified
 *
 * Stage is inferred from elapsed time since notifiedAt and the reNotifiedAt timestamp:
 *   - Stage 1: 15+ min since notifiedAt, reNotifiedAt is null
 *   - Stage 2: 30+ min since notifiedAt, reNotifiedAt < 29 min ago (i.e. stage-1 already done)
 *   - Stage 3: 60+ min since notifiedAt, reNotifiedAt < 59 min ago (i.e. stage-2 already done)
 */
export async function reNotifyPendingEscalations(): Promise<{ reNotified: number }> {
  const db = getDb();
  const now = Date.now();
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000);

  // Fetch all pending claims that have been waiting at least 15 minutes
  const staleClaims = await db
    .select()
    .from(escalationClaims)
    .where(and(
      eq(escalationClaims.status, 'pending'),
      lt(escalationClaims.notifiedAt, fifteenMinutesAgo)
    ));

  let reNotified = 0;

  for (const claim of staleClaims) {
    const elapsedMs = now - new Date(claim.notifiedAt).getTime();
    const elapsedMin = elapsedMs / 60_000;
    const reNotifiedMs = claim.reNotifiedAt
      ? now - new Date(claim.reNotifiedAt).getTime()
      : null;
    const reNotifiedMin = reNotifiedMs !== null ? reNotifiedMs / 60_000 : null;

    // Determine which re-notification stage this claim is at:
    // Stage 1: 15+ min elapsed, never re-notified yet
    // Stage 2: 30+ min elapsed, stage-1 done (reNotifiedAt exists and is at least 14 min old, meaning we haven't done stage-2 yet)
    // Stage 3: 60+ min elapsed, stage-2 done (reNotifiedAt is at least 14 min old)
    // Cap at 3 re-notifications: if reNotifiedAt is recent (< 14 min), skip — already handled this cycle
    const isStage1 = elapsedMin >= 15 && reNotifiedMin === null;
    const isStage2 = elapsedMin >= 30 && reNotifiedMin !== null && reNotifiedMin >= 14 && elapsedMin < 60;
    const isStage3 = elapsedMin >= 60 && reNotifiedMin !== null && reNotifiedMin >= 14;

    if (!isStage1 && !isStage2 && !isStage3) continue;

    const [client] = await db
      .select({
        id: clients.id,
        businessName: clients.businessName,
        twilioNumber: clients.twilioNumber,
        ownerPhone: clients.phone,
        ownerEmail: clients.email,
        ownerName: clients.ownerName,
      })
      .from(clients)
      .where(eq(clients.id, claim.clientId))
      .limit(1);

    if (!client?.twilioNumber) continue;

    const [lead] = await db
      .select({ name: leads.name, phone: leads.phone })
      .from(leads)
      .where(eq(leads.id, claim.leadId))
      .limit(1);

    // EC-08: Skip if lead was deleted
    if (!lead) {
      console.warn(`[Team Escalation] Lead not found for claim ${claim.id}, skipping re-notification`);
      continue;
    }

    const leadDisplay = lead.name || formatPhoneNumber(lead.phone);
    const members = await getEscalationMembers(claim.clientId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const claimUrl = `${appUrl}/claims?token=${claim.claimToken}`;
    const truncatedMessage = claim.lastLeadMessage
      ? claim.lastLeadMessage.length > 60
        ? `"${claim.lastLeadMessage.substring(0, 60)}..."`
        : `"${claim.lastLeadMessage}"`
      : '';

    let stageLabel: string;
    if (isStage1) stageLabel = '15+ min';
    else if (isStage2) stageLabel = '30+ min';
    else stageLabel = '60+ min';

    const smsBody = `REMINDER: ${leadDisplay} still needs a response (${stageLabel} unclaimed).\n\n${truncatedMessage}\n\nClaim: ${claimUrl}`;

    // EC-09: Track if at least one SMS was sent successfully
    let sentCount = 0;

    for (const member of members) {
      try {
        await sendSMS(member.phone, smsBody, client.twilioNumber);
        sentCount++;
      } catch (error) {
        console.error(`[Team Escalation] Re-notify SMS failed for ${member.name}:`, error);
      }
    }

    // Stage 3 (60 min): escalate directly to business owner if no team or as additional escalation
    if (isStage3) {
      const ownerAlreadyInTeam = members.some(
        (m) => formatPhoneNumber(m.phone) === formatPhoneNumber(client.ownerPhone || '')
      );

      if (!ownerAlreadyInTeam && client.ownerPhone) {
        const ownerSmsBody = `URGENT: ${leadDisplay} has been waiting 60+ minutes for a response. No team member has claimed this lead yet.\n\n${truncatedMessage}\n\nDashboard: ${appUrl}/leads/${lead.phone}`;

        try {
          await sendSMS(client.ownerPhone, ownerSmsBody, client.twilioNumber);
          sentCount++;
          console.log(`[Team Escalation] Stage-3 owner escalation sent to ${client.ownerName}`);
        } catch (error) {
          console.error(`[Team Escalation] Stage-3 owner SMS failed:`, error);
        }
      }

      if (!ownerAlreadyInTeam && client.ownerEmail) {
        try {
          const emailData = actionRequiredEmail({
            businessName: client.businessName,
            leadName: lead.name || undefined,
            leadPhone: formatPhoneNumber(lead.phone),
            reason: '60+ minutes unclaimed — no team member has responded',
            lastMessage: claim.lastLeadMessage || '',
            dashboardUrl: claimUrl,
          });
          await sendEmail({ to: client.ownerEmail, ...emailData });
          console.log(`[Team Escalation] Stage-3 owner escalation email sent`);
        } catch (error) {
          console.error(`[Team Escalation] Stage-3 owner email failed:`, error);
        }
      }
    }

    // EC-09: Only mark re-notified if at least one SMS succeeded
    if (sentCount > 0) {
      await db
        .update(escalationClaims)
        .set({ reNotifiedAt: new Date() })
        .where(eq(escalationClaims.id, claim.id));

      reNotified++;
      console.log(`[Team Escalation] Stage-${isStage1 ? 1 : isStage2 ? 2 : 3} re-notification sent for claim ${claim.id}`);
    } else {
      console.warn(`[Team Escalation] No SMS sent for claim ${claim.id}, will retry next cycle`);
    }
  }

  console.log(`[Team Escalation] Re-notification check: ${reNotified} claims re-notified`);
  return { reNotified };
}
