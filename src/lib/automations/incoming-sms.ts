import { getDb, clients, leads, conversations, blockedNumbers, scheduledMessages, dailyStats } from '@/db';
import { sendSMS } from '@/lib/services/twilio';
import { generateAIResponse } from '@/lib/services/openai';
import { eq, and, sql } from 'drizzle-orm';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';
import { renderTemplate } from '@/lib/utils/templates';

interface IncomingSMSPayload {
  To: string;
  From: string;
  Body: string;
  MessageSid: string;
}

const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];

export async function handleIncomingSMS(payload: IncomingSMSPayload) {
  const db = getDb();
  const { To, From, Body, MessageSid } = payload;

  const senderPhone = normalizePhoneNumber(From);
  const twilioNumber = normalizePhoneNumber(To);
  const messageBody = Body.trim();

  // 1. Find client
  const clientResult = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.twilioNumber, twilioNumber),
      eq(clients.status, 'active')
    ))
    .limit(1);

  if (!clientResult.length) {
    console.log('No client found for Twilio number:', twilioNumber);
    return { processed: false, reason: 'No client for this number' };
  }

  const client = clientResult[0];

  // 2. Handle STOP/opt-out
  if (STOP_WORDS.includes(messageBody.toLowerCase())) {
    return await handleOptOut(db, client, senderPhone);
  }

  // 3. Check if blocked
  const blockedResult = await db
    .select()
    .from(blockedNumbers)
    .where(and(
      eq(blockedNumbers.clientId, client.id),
      eq(blockedNumbers.phone, senderPhone)
    ))
    .limit(1);

  if (blockedResult.length) {
    return { processed: false, reason: 'Number is blocked' };
  }

  // 4. Find or create lead
  const leadResult = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, client.id),
      eq(leads.phone, senderPhone)
    ))
    .limit(1);

  let lead;
  const isNewLead = !leadResult.length;

  if (isNewLead) {
    const created = await db
      .insert(leads)
      .values({
        clientId: client.id,
        phone: senderPhone,
        source: 'sms',
        status: 'new',
      })
      .returning();
    lead = created[0];
  } else {
    lead = leadResult[0];
  }

  // 5. Log incoming message
  await db.insert(conversations).values({
    leadId: lead.id,
    clientId: client.id,
    direction: 'inbound',
    messageType: 'sms',
    content: messageBody,
    twilioSid: MessageSid,
  });

  // 6. Pause any active sequences (lead replied)
  await db
    .update(scheduledMessages)
    .set({
      cancelled: true,
      cancelledAt: new Date(),
      cancelledReason: 'Lead replied',
    })
    .where(and(
      eq(scheduledMessages.leadId, lead.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ));

  // 7. Get conversation history
  const history = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(conversations.createdAt);

  const conversationHistory = history.map(msg => ({
    role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  // 8. Generate AI response
  const aiResult = await generateAIResponse(
    messageBody,
    client.businessName,
    client.ownerName,
    conversationHistory
  );

  // 9. Handle escalation
  if (aiResult.shouldEscalate) {
    // Mark lead as action required
    await db
      .update(leads)
      .set({
        actionRequired: true,
        actionRequiredReason: aiResult.escalationReason,
        status: 'action_required',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    // Send acknowledgment to lead
    const ackMessage = renderTemplate('escalation_ack', {
      ownerName: client.ownerName,
    });

    await sendSMS(senderPhone, client.twilioNumber!, ackMessage);

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'escalation',
      content: ackMessage,
    });

    return {
      processed: true,
      leadId: lead.id,
      escalated: true,
      reason: aiResult.escalationReason,
    };
  }

  // 10. Send AI response
  const smsResult = await sendSMS(senderPhone, client.twilioNumber!, aiResult.response);

  if (smsResult.success) {
    // Log outbound message
    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'ai_response',
      content: aiResult.response,
      twilioSid: smsResult.sid,
      aiConfidence: String(aiResult.confidence),
    });

    // Update stats
    const today = new Date().toISOString().split('T')[0];
    await db
      .insert(dailyStats)
      .values({
        clientId: client.id,
        date: today,
        messagesSent: 1,
        conversationsStarted: isNewLead ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [dailyStats.clientId, dailyStats.date],
        set: {
          messagesSent: sql`${dailyStats.messagesSent} + 1`,
          conversationsStarted: isNewLead
            ? sql`${dailyStats.conversationsStarted} + 1`
            : dailyStats.conversationsStarted,
        },
      });

    // Increment monthly count
    await db
      .update(clients)
      .set({
        messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1`,
      })
      .where(eq(clients.id, client.id));
  }

  return {
    processed: true,
    leadId: lead.id,
    aiResponse: aiResult.response,
    confidence: aiResult.confidence,
  };
}

async function handleOptOut(db: any, client: typeof clients.$inferSelect, phone: string) {
  // 1. Add to blocked list
  await db
    .insert(blockedNumbers)
    .values({
      clientId: client.id,
      phone,
      reason: 'opt_out',
    })
    .onConflictDoNothing();

  // 2. Update lead
  const leadResult = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clientId, client.id),
      eq(leads.phone, phone)
    ))
    .limit(1);

  if (leadResult.length) {
    const lead = leadResult[0];
    await db
      .update(leads)
      .set({
        optedOut: true,
        optedOutAt: new Date(),
        status: 'opted_out',
      })
      .where(eq(leads.id, lead.id));

    // Cancel all scheduled messages
    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Opted out',
      })
      .where(and(
        eq(scheduledMessages.leadId, lead.id),
        eq(scheduledMessages.sent, false),
        eq(scheduledMessages.cancelled, false)
      ));
  }

  // 3. Send confirmation
  const confirmMessage = renderTemplate('opt_out_confirmation', {
    businessName: client.businessName,
  });

  await sendSMS(phone, client.twilioNumber!, confirmMessage);

  return {
    processed: true,
    optedOut: true,
  };
}
