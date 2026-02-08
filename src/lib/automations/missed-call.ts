import { getDb, clients, leads, conversations, blockedNumbers, dailyStats } from '@/db';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and, sql } from 'drizzle-orm';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';
import { renderTemplate } from '@/lib/utils/templates';

interface MissedCallPayload {
  To: string;
  From: string;
  CallStatus: string;
  CallSid: string;
  answered?: boolean; // For polling-based detection
}

export async function handleMissedCall(payload: MissedCallPayload) {
  const db = getDb();
  const { To, From, CallStatus } = payload;

  console.log('[Missed Call Handler] Processing:', { From, To, CallStatus, answered: payload.answered, CallSid: payload.CallSid });

  // Accept missed statuses from direct webhooks OR completed calls from polling (when not answered)
  const missedStatuses = ['no-answer', 'busy', 'failed', 'canceled'];
  const isMissed = missedStatuses.includes(CallStatus) || (CallStatus === 'completed' && payload.answered !== true);

  if (!isMissed) {
    console.log('[Missed Call Handler] Not a missed call - status:', CallStatus, '- answered:', payload.answered);
    return { processed: false, reason: 'Not a missed call' };
  }

  const callerPhone = normalizePhoneNumber(From);
  const twilioNumber = normalizePhoneNumber(To);

  // 1. Find client by Twilio number
  const client = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.twilioNumber, twilioNumber),
      eq(clients.status, 'active')
    ))
    .limit(1);

  if (!client.length) {
    console.log('No client found for Twilio number:', twilioNumber);
    return { processed: false, reason: 'No active client for this number' };
  }

  const clientData = client[0];

  // 1.5 DEDUPLICATION: Check if we've already sent SMS for this call (prevent double-sending)
  const recentSMS = await db
    .select()
    .from(conversations)
    .where(and(
      eq(conversations.twilioSid, payload.CallSid),
      eq(conversations.messageType, 'sms'),
      eq(conversations.direction, 'outbound')
    ))
    .limit(1);

  if (recentSMS.length) {
    console.log('[Missed Call Handler] Deduplication: SMS already sent for this call:', payload.CallSid);
    return { processed: false, reason: 'SMS already sent for this call' };
  }

  // 2. Check if number is blocked
  const blocked = await db
    .select()
    .from(blockedNumbers)
    .where(and(
      eq(blockedNumbers.clientId, clientData.id),
      eq(blockedNumbers.phone, callerPhone)
    ))
    .limit(1);

  if (blocked.length) {
    return { processed: false, reason: 'Number is blocked' };
  }

  // 3. Create or update lead
  const existingLead = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, clientData.id),
      eq(leads.phone, callerPhone)
    ))
    .limit(1);

  let lead;
  const isNewLead = !existingLead.length;

  if (existingLead.length) {
    const updated = await db
      .update(leads)
      .set({ updatedAt: new Date() })
      .where(eq(leads.id, existingLead[0].id))
      .returning();
    lead = updated[0];
  } else {
    const created = await db
      .insert(leads)
      .values({
        clientId: clientData.id,
        phone: callerPhone,
        source: 'missed_call',
        status: 'new',
      })
      .returning();
    lead = created[0];
  }

  // 4. Render message
  const messageContent = renderTemplate('missed_call', {
    ownerName: clientData.ownerName,
    businessName: clientData.businessName,
  });

  // 5. Send SMS
  console.log('[Missed Call Handler] Sending SMS to', callerPhone, 'from', clientData.twilioNumber);
  const smsResult = await sendSMS(callerPhone, clientData.twilioNumber!, messageContent);

  if (!smsResult.success) {
    console.error('[Missed Call Handler] Failed to send missed call SMS:', smsResult.error);
    return { processed: false, reason: 'Failed to send SMS', error: smsResult.error };
  }

  console.log('[Missed Call Handler] SMS sent successfully:', smsResult.sid);

  // 6. Log conversation
  // Store CallSid in twilioSid for deduplication purposes
  await db.insert(conversations).values({
    leadId: lead.id,
    clientId: clientData.id,
    direction: 'outbound',
    messageType: 'sms',
    content: messageContent,
    twilioSid: payload.CallSid, // Store CallSid for deduplication, not SMS SID
  });

  console.log('[Missed Call Handler] Conversation logged with CallSid for deduplication:', payload.CallSid);

  // 7. Update daily stats
  const today = new Date().toISOString().split('T')[0];
  await db
    .insert(dailyStats)
    .values({
      clientId: clientData.id,
      date: today,
      missedCallsCaptured: 1,
      messagesSent: 1,
      conversationsStarted: isNewLead ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [dailyStats.clientId, dailyStats.date],
      set: {
        missedCallsCaptured: sql`${dailyStats.missedCallsCaptured} + 1`,
        messagesSent: sql`${dailyStats.messagesSent} + 1`,
        conversationsStarted: isNewLead
          ? sql`${dailyStats.conversationsStarted} + 1`
          : dailyStats.conversationsStarted,
      },
    });

  // 8. Increment monthly message count
  await db
    .update(clients)
    .set({
      messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1`,
    })
    .where(eq(clients.id, clientData.id));

  return {
    processed: true,
    leadId: lead.id,
    clientId: clientData.id,
    isNewLead,
  };
}
