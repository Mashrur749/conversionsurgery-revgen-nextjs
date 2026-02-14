import { getDb, clients, leads, conversations, blockedNumbers, scheduledMessages, dailyStats, clientAgentSettings } from '@/db';
import { sendSMS } from '@/lib/services/twilio';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { generateAIResponse, detectHotIntent } from '@/lib/services/openai';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { initiateRingGroup } from '@/lib/services/ring-group';
import { notifyTeamForEscalation } from '@/lib/services/team-escalation';
import { checkAndSuggestFlows, handleApprovalResponse } from '@/lib/services/flow-suggestions';
import { scoreLead, quickScore } from '@/lib/services/lead-scoring';
import { processIncomingMedia, generatePhotoAcknowledgment } from '@/lib/services/media';
import { processIncomingMessage } from '@/lib/agent/orchestrator';
import { detectBookingIntent, handleBookingConversation } from '@/lib/services/booking-conversation';
import { eq, and, sql } from 'drizzle-orm';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';
import { renderTemplate } from '@/lib/utils/templates';
import type { MediaAttachment } from '@/db/schema/media-attachments';

interface IncomingSMSPayload {
  To: string;
  From: string;
  Body: string;
  MessageSid: string;
  NumMedia?: number;
  MediaItems?: { url: string; contentType: string; sid?: string }[];
}

const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];

export async function handleIncomingSMS(payload: IncomingSMSPayload) {
  const db = getDb();
  const { To, From, Body, MessageSid, NumMedia = 0, MediaItems = [] } = payload;

  const senderPhone = normalizePhoneNumber(From);
  const twilioNumber = normalizePhoneNumber(To);
  const messageBody = (Body || '').trim();

  // 1. Find client by Twilio number
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

  // Handle DASHBOARD request
  if (messageBody.toUpperCase() === 'DASHBOARD') {
    const { sendDashboardLink } = await import('@/lib/services/magic-link');
    await sendDashboardLink(client.id, senderPhone, client.twilioNumber!);
    return { processed: true, action: 'dashboard_link_sent' };
  }

  // 1b. Check for flow approval responses from client owner
  if (normalizePhoneNumber(client.phone) === senderPhone) {
    const approvalCheck = await handleApprovalResponse(client.id, messageBody);
    if (approvalCheck.handled) {
      return { processed: true, action: approvalCheck.action };
    }
  }

  // 2. Handle opt-out
  if (STOP_WORDS.includes(messageBody.toLowerCase())) {
    return await handleOptOut(db, client, senderPhone);
  }

  // 3. Check blocked
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

  // 5. Log inbound message
  const messageContent = NumMedia > 0 && !messageBody
    ? `[${NumMedia} media attachment${NumMedia > 1 ? 's' : ''}]`
    : messageBody || '[empty message]';

  const [inboundMsg] = await db.insert(conversations).values({
    leadId: lead.id,
    clientId: client.id,
    direction: 'inbound',
    messageType: NumMedia > 0 ? 'mms' : 'sms',
    content: messageContent,
    twilioSid: MessageSid,
  }).returning();

  // 5.1 Process media attachments from MMS
  const savedMedia: MediaAttachment[] = [];
  if (NumMedia > 0 && MediaItems.length > 0) {
    for (const item of MediaItems) {
      try {
        const saved = await processIncomingMedia({
          clientId: client.id,
          leadId: lead.id,
          messageId: inboundMsg.id,
          twilioMediaSid: item.sid,
          twilioMediaUrl: item.url,
          mimeType: item.contentType,
        });
        savedMedia.push(saved);
      } catch (err) {
        console.error('[MMS] Failed to process media:', err);
      }
    }
    console.log(`[MMS] Processed ${savedMedia.length}/${NumMedia} media items for lead ${lead.id}`);
  }

  // 5a. Update lead score (quick mode for speed)
  scoreLead(lead.id, { useAI: false }).catch(console.error);

  // If high-value signals detected, do full AI scoring async
  const quickFactors = quickScore(messageBody);
  if (
    quickFactors.signals?.includes('high_urgency') ||
    quickFactors.signals?.includes('high_intent') ||
    quickFactors.signals?.includes('budget_ready')
  ) {
    scoreLead(lead.id, { useAI: true }).catch(console.error);
  }

  // 5b. Check conversation mode - skip AI if human has taken over
  if (lead.conversationMode === 'human') {
    return { processed: true, action: 'human_mode_saved' };
  }

  // 6. Pause active sequences
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

  // 6.5 Check for hot intent BEFORE AI processing
  const isHotIntent = detectHotIntent(messageBody);

  if (isHotIntent) {
    const withinHours = await isWithinBusinessHours(client.id, client.timezone || 'America/Edmonton');

    if (withinHours) {
      const ringResult = await initiateRingGroup({
        leadId: lead.id,
        clientId: client.id,
        leadPhone: senderPhone,
        twilioNumber: client.twilioNumber!,
      });

      if (ringResult.initiated) {
        await sendCompliantMessage({
          clientId: client.id,
          to: senderPhone,
          from: client.twilioNumber!,
          body: `Great! We're calling you right now. Please pick up!`,
          messageCategory: 'transactional',
          consentBasis: { type: 'lead_reply', messageId: MessageSid },
          leadId: lead.id,
          queueOnQuietHours: false,
          metadata: { source: 'hot_intent_ack' },
        });

        await db.insert(conversations).values({
          leadId: lead.id,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'hot_transfer',
          content: 'Initiated hot transfer call',
        });

        return {
          processed: true,
          leadId: lead.id,
          hotTransfer: true,
          callSid: ringResult.callSid,
        };
      }
    } else {
      await sendCompliantMessage({
        clientId: client.id,
        to: senderPhone,
        from: client.twilioNumber!,
        body: `Thanks for your interest! We're currently outside business hours, but someone will call you first thing tomorrow morning.`,
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply', messageId: MessageSid },
        leadId: lead.id,
        queueOnQuietHours: false,
        metadata: { source: 'outside_hours_ack' },
      });

      await notifyTeamForEscalation({
        leadId: lead.id,
        clientId: client.id,
        twilioNumber: client.twilioNumber!,
        reason: 'Hot intent - outside business hours',
        lastMessage: messageBody,
      });

      return {
        processed: true,
        leadId: lead.id,
        hotTransfer: false,
        outsideHours: true,
      };
    }
  }

  // 6.6 Fetch conversation history once (reused by booking, agent, and AI response)
  const conversationHistory = (await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(conversations.createdAt)
    .limit(20)
  ).map(msg => ({
    role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  // 6.6a Check for booking intent (works for all clients, not just autonomous)
  const bookingIntent = await detectBookingIntent(messageBody, conversationHistory);

  if (bookingIntent !== 'none') {
    try {
      const bookingResult = await handleBookingConversation(
        client.id,
        lead.id,
        lead.name || '',
        messageBody,
        conversationHistory,
        client.businessName,
        client.ownerName,
        bookingIntent
      );

      if (bookingResult.responseMessage) {
        const sendResult = await sendCompliantMessage({
          clientId: client.id,
          to: senderPhone,
          from: client.twilioNumber!,
          body: bookingResult.responseMessage,
          messageCategory: 'transactional',
          consentBasis: { type: 'lead_reply', messageId: MessageSid },
          leadId: lead.id,
          queueOnQuietHours: false,
          metadata: { source: 'booking_conversation', intent: bookingIntent },
        });

        if (sendResult.sent) {
          await db.insert(conversations).values({
            leadId: lead.id,
            clientId: client.id,
            direction: 'outbound',
            messageType: 'ai_response',
            content: bookingResult.responseMessage,
            twilioSid: sendResult.messageSid || undefined,
          });
        }

        return {
          processed: true,
          leadId: lead.id,
          bookingIntent,
          appointmentCreated: bookingResult.appointmentCreated,
          appointmentId: bookingResult.appointmentId,
        };
      }
    } catch (err) {
      console.error('[Booking] Conversation handling failed, falling back:', err);
    }
  }

  // 6.7 Check if LangGraph conversation agent is enabled
  if (client.aiAgentMode === 'autonomous') {
    const [agentSettings] = await db
      .select()
      .from(clientAgentSettings)
      .where(eq(clientAgentSettings.clientId, client.id))
      .limit(1);

    if (agentSettings?.autoRespond !== false) {
      try {
        const agentResult = await processIncomingMessage(
          lead.id,
          inboundMsg.id,
          messageBody
        );

        console.log('[Agent] Result:', agentResult);

        return {
          processed: true,
          leadId: lead.id,
          agentMode: true,
          ...agentResult,
        };
      } catch (err) {
        console.error('[Agent] Processing failed, falling back to legacy:', err);
        // Fall through to legacy AI response
      }
    }
  }

  // 7. Generate AI response (with knowledge base context, using history from step 6.6)
  // If media-only message (no text), send photo acknowledgment instead of AI response
  if (savedMedia.length > 0 && !messageBody) {
    const firstMedia = savedMedia[0];
    const ackMessage = generatePhotoAcknowledgment(
      firstMedia.aiDescription,
      firstMedia.aiTags as string[] | null
    );

    try {
      const sendResult = await sendCompliantMessage({
        clientId: client.id,
        to: senderPhone,
        from: client.twilioNumber!,
        body: ackMessage,
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply', messageId: MessageSid },
        leadId: lead.id,
        queueOnQuietHours: false,
        metadata: { source: 'photo_ack' },
      });
      if (sendResult.sent) {
        await db.insert(conversations).values({
          leadId: lead.id,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'ai_response',
          content: ackMessage,
          twilioSid: sendResult.messageSid || undefined,
        });
      }
    } catch (error) {
      console.error('[IncomingSMS] Failed to send photo acknowledgment:', error);
    }

    return {
      processed: true,
      leadId: lead.id,
      mediaProcessed: savedMedia.length,
      aiResponse: ackMessage,
    };
  }

  // Build additional context if media was included with text
  let mediaContext = '';
  if (savedMedia.length > 0) {
    const photoDescriptions = savedMedia
      .filter(m => m.type === 'image')
      .map(m => m.aiDescription || 'a photo')
      .join(', ');
    if (photoDescriptions) {
      mediaContext = `\nThe customer also sent ${savedMedia.length} photo(s) showing: ${photoDescriptions}`;
    }
  }

  const aiResult = await generateAIResponse(
    messageBody + mediaContext,
    client.businessName,
    client.ownerName,
    conversationHistory,
    client.id
  );

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/leads/${lead.id}`;

  // 9. Handle escalation
  if (aiResult.shouldEscalate) {
    await db
      .update(leads)
      .set({
        actionRequired: true,
        actionRequiredReason: aiResult.escalationReason,
        status: 'action_required',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id));

    const ackMessage = renderTemplate('escalation_ack', {
      ownerName: client.ownerName,
    });

    const escalationSendResult = await sendCompliantMessage({
      clientId: client.id,
      to: senderPhone,
      from: client.twilioNumber!,
      body: ackMessage,
      messageCategory: 'transactional',
      consentBasis: { type: 'lead_reply', messageId: MessageSid },
      leadId: lead.id,
      queueOnQuietHours: false,
      metadata: { source: 'escalation_ack' },
    });

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'escalation',
      content: ackMessage,
      twilioSid: escalationSendResult.messageSid || undefined,
    });

    // Notify team (new behavior)
    const escalationResult = await notifyTeamForEscalation({
      leadId: lead.id,
      clientId: client.id,
      twilioNumber: client.twilioNumber!,
      reason: aiResult.escalationReason || 'Needs human response',
      lastMessage: messageBody,
    });

    // Fallback to single contractor if no team members
    if (escalationResult.notified === 0) {
      if (client.notificationSms) {
        await sendSMS(
          client.phone,
          `⚠️ ${lead.name || formatPhoneNumber(senderPhone)} needs you: "${messageBody.substring(0, 80)}..." ${dashboardUrl}`,
          client.twilioNumber!
        );
      }
      if (client.notificationEmail) {
        const emailData = actionRequiredEmail({
          businessName: client.businessName,
          leadName: lead.name || undefined,
          leadPhone: formatPhoneNumber(senderPhone),
          reason: aiResult.escalationReason || 'Needs human response',
          lastMessage: messageBody,
          dashboardUrl,
        });
        await sendEmail({ to: client.email, ...emailData });
      }
    }

    return {
      processed: true,
      leadId: lead.id,
      escalated: true,
      reason: aiResult.escalationReason,
      teamNotified: escalationResult.notified,
    };
  }

  // 10. Send AI response via compliance gateway
  try {
    const sendResult = await sendCompliantMessage({
      clientId: client.id,
      to: senderPhone,
      from: client.twilioNumber!,
      body: aiResult.response,
      messageCategory: 'marketing',
      consentBasis: { type: 'lead_reply', messageId: MessageSid },
      leadId: lead.id,
      queueOnQuietHours: false, // Responding to inbound message
      metadata: { source: 'ai_response', confidence: aiResult.confidence },
    });

    if (sendResult.sent) {
      await db.insert(conversations).values({
        leadId: lead.id,
        clientId: client.id,
        direction: 'outbound',
        messageType: 'ai_response',
        content: aiResult.response,
        twilioSid: sendResult.messageSid || undefined,
        aiConfidence: String(aiResult.confidence),
      });

      // Update daily stats (monthly count handled by gateway)
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
    }
  } catch (error) {
    console.error('[IncomingSMS] Failed to send AI response:', error);
  }

  // 10b. After AI responds, check for flow suggestions (async, don't wait)
  checkAndSuggestFlows(lead.id, client.id, conversationHistory).catch(console.error);

  // 11. Notify contractor of activity
  if (client.notificationSms) {
    await sendSMS(
      client.phone,
      `💬 ${lead.name || formatPhoneNumber(senderPhone)}: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}" — AI replied. ${dashboardUrl}`,
      client.twilioNumber!
    );
  }

  return {
    processed: true,
    leadId: lead.id,
    aiResponse: aiResult.response,
    confidence: aiResult.confidence,
  };
}

async function handleOptOut(db: ReturnType<typeof getDb>, client: typeof clients.$inferSelect, phone: string) {
  await db
    .insert(blockedNumbers)
    .values({
      clientId: client.id,
      phone,
      reason: 'opt_out',
    })
    .onConflictDoNothing();

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

  const confirmMessage = renderTemplate('opt_out_confirmation', {
    businessName: client.businessName,
  });

  await sendSMS(phone, confirmMessage, client.twilioNumber!);

  return { processed: true, optedOut: true };
}
