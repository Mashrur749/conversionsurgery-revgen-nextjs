import twilio from 'twilio';
import { getDb } from '@/db';
import { teamMembers, callAttempts, leads } from '@/db/schema';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and } from 'drizzle-orm';
import { formatPhoneNumber } from '@/lib/utils/phone';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

interface RingGroupPayload {
  leadId: string;
  clientId: string;
  leadPhone: string;
  twilioNumber: string;
}

interface RingGroupResult {
  initiated: boolean;
  callSid?: string;
  attemptId?: string;
  membersToRing?: number;
  reason?: string;
  error?: unknown;
}

/**
 * [Voice] Initiate a ring group call to team members for a high-intent lead
 * @param payload - The ring group configuration
 */
export async function initiateRingGroup(payload: RingGroupPayload): Promise<RingGroupResult> {
  const { leadId, clientId, leadPhone, twilioNumber } = payload;
  const db = getDb();

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ))
    .orderBy(teamMembers.priority);

  if (members.length === 0) {
    console.log('[Voice] No team members configured for hot transfers');
    return { initiated: false, reason: 'No team members' };
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const leadDisplay = lead?.name || formatPhoneNumber(leadPhone);

  const [callAttempt] = await db
    .insert(callAttempts)
    .values({
      leadId,
      clientId,
      status: 'initiated',
    })
    .returning();

  const connectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-connect?attemptId=${callAttempt.id}&leadPhone=${encodeURIComponent(leadPhone)}`;
  const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/ring-status?attemptId=${callAttempt.id}`;

  try {
    const call = await twilioClient.calls.create({
      to: leadPhone,
      from: twilioNumber,
      url: connectUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      timeout: 30,
    });

    await db
      .update(callAttempts)
      .set({ callSid: call.sid, status: 'ringing' })
      .where(eq(callAttempts.id, callAttempt.id));

    for (const member of members) {
      await sendSMS(
        member.phone,
        twilioNumber,
        `Hot lead calling! ${leadDisplay} wants to talk NOW. Your phone will ring shortly.`
      );
    }

    console.log(`[Voice] Initiated call ${call.sid} for lead ${leadId}, ${members.length} members to ring`);

    return {
      initiated: true,
      callSid: call.sid,
      attemptId: callAttempt.id,
      membersToRing: members.length,
    };
  } catch (error) {
    console.error('[Voice] Failed to initiate:', error);

    await db
      .update(callAttempts)
      .set({ status: 'failed' })
      .where(eq(callAttempts.id, callAttempt.id));

    return { initiated: false, error };
  }
}

/**
 * [Voice] Handle when a ring group call receives no answer
 * Notifies team members and updates lead status
 * @param payload - The ring group configuration
 */
export async function handleNoAnswer(payload: RingGroupPayload): Promise<void> {
  const { leadId, clientId, leadPhone, twilioNumber } = payload;
  const db = getDb();

  const members = await db
    .select()
    .from(teamMembers)
    .where(and(
      eq(teamMembers.clientId, clientId),
      eq(teamMembers.isActive, true),
      eq(teamMembers.receiveHotTransfers, true)
    ));

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const leadDisplay = lead?.name || formatPhoneNumber(leadPhone);

  for (const member of members) {
    await sendSMS(
      member.phone,
      twilioNumber,
      `Missed hot transfer! ${leadDisplay} wanted to talk but no one answered. Call them back ASAP: ${formatPhoneNumber(leadPhone)}`
    );
  }

  await sendSMS(
    leadPhone,
    twilioNumber,
    `Sorry we missed you! We'll call you right back. If urgent, you can also call us directly at this number.`
  );

  await db
    .update(leads)
    .set({
      actionRequired: true,
      actionRequiredReason: 'Hot transfer - no answer',
    })
    .where(eq(leads.id, leadId));

  console.log(`[Voice] No answer for lead ${leadId}, team notified`);
}
