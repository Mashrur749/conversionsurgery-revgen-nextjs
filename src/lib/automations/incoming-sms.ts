import { getDb, clients, leads, conversations, blockedNumbers, scheduledMessages, dailyStats, clientAgentSettings } from '@/db';
import { sendSMS } from '@/lib/services/twilio';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { sendEmail, actionRequiredEmail } from '@/lib/services/resend';
import { generateAIResponse, detectHotIntent } from '@/lib/services/ai-response';
import { trackKnowledgeGap } from '@/lib/agent/context-builder';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { initiateRingGroup } from '@/lib/services/ring-group';
import { notifyTeamForEscalation } from '@/lib/services/team-escalation';
import { checkAndSuggestFlows, handleApprovalResponse } from '@/lib/services/flow-suggestions';
import { triggerEstimateFollowupFromSmsCommand } from '@/lib/services/estimate-triggers';
import { AI_ASSIST_CATEGORY, resolveAiSendPolicy } from '@/lib/services/ai-send-policy';
import { handleSmartAssistOwnerCommand, queueSmartAssistDraft } from '@/lib/services/smart-assist-lifecycle';
import { scoreLead, quickScore } from '@/lib/services/lead-scoring';
import { processIncomingMedia, generatePhotoAcknowledgment } from '@/lib/services/media';
import { processIncomingMessage } from '@/lib/agent/orchestrator';
import { detectBookingIntent, handleBookingConversation } from '@/lib/services/booking-conversation';
import { isOpsKillSwitchEnabled, OPS_KILL_SWITCH_KEYS } from '@/lib/services/ops-kill-switches';
import { ComplianceService } from '@/lib/compliance/compliance-service';
import { recordLeadResponse } from '@/lib/services/flow-metrics';
import { appointments, flowExecutions, flows } from '@/db/schema';
import { eq, and, sql, desc, inArray, isNull, not } from 'drizzle-orm';
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

const SOFT_REJECTION_PHRASES = [
  'not interested',
  'went with someone else',
  'found another',
  'no longer interested',
  'already hired',
  'chose another',
  'going with another',
  'decided not to',
  'no thanks',
  'pass on this',
  'we are good',
  "we're good",
  'already got someone',
];

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

  // Client was looked up by twilioNumber, so it's guaranteed non-null
  const client = { ...clientResult[0], twilioNumber: clientResult[0].twilioNumber as string };

  // Handle DASHBOARD request
  if (messageBody.toUpperCase() === 'DASHBOARD') {
    const { sendDashboardLink } = await import('@/lib/services/magic-link');
    await sendDashboardLink(client.id, senderPhone, client.twilioNumber);
    return { processed: true, action: 'dashboard_link_sent' };
  }

  // 1b. Check for flow approval responses from client owner or operator
  const { getAgencyField } = await import('@/lib/services/agency-settings');
  const rawOpPhone = await getAgencyField('operatorPhone');
  const operatorPhone = rawOpPhone ? normalizePhoneNumber(rawOpPhone) : null;
  const isOwnerOrOperator =
    normalizePhoneNumber(client.phone) === senderPhone ||
    (operatorPhone !== null && operatorPhone === senderPhone);

  if (isOwnerOrOperator) {
    const approvalCheck = await handleApprovalResponse(client.id, messageBody);
    if (approvalCheck.handled) {
      return { processed: true, action: approvalCheck.action };
    }

    const estimateCommandResult = await triggerEstimateFollowupFromSmsCommand({
      clientId: client.id,
      messageBody,
    });
    if (estimateCommandResult.handled) {
      await sendSMS(senderPhone, estimateCommandResult.message, client.twilioNumber);
      return {
        processed: true,
        action: estimateCommandResult.success
          ? 'estimate_sequence_triggered_sms'
          : 'estimate_sequence_command_error',
        leadId: estimateCommandResult.leadId,
      };
    }

    const smartAssistCommandResult = await handleSmartAssistOwnerCommand({
      clientId: client.id,
      fromPhone: senderPhone,
      fromTwilioNumber: client.twilioNumber,
      messageBody,
    });
    if (smartAssistCommandResult.handled) {
      return {
        processed: true,
        action: smartAssistCommandResult.action,
      };
    }
  }

  // 2. Handle opt-out
  if (STOP_WORDS.includes(messageBody.toLowerCase())) {
    return await handleOptOut(db, client, senderPhone);
  }

  // 2a. Soft rejection detection — lead has declined the service (not opted out)
  const lowerBody = messageBody.toLowerCase();
  if (SOFT_REJECTION_PHRASES.some((phrase) => lowerBody.includes(phrase))) {
    // Find lead first (may not exist yet if this is the very first message)
    const softRejLeadResult = await db
      .select()
      .from(leads)
      .where(and(eq(leads.clientId, client.id), eq(leads.phone, senderPhone)))
      .limit(1);

    if (softRejLeadResult.length) {
      const softRejLead = softRejLeadResult[0];

      // Mark lead as lost
      await db
        .update(leads)
        .set({
          status: 'lost',
          actionRequiredReason: 'Soft rejection via SMS',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, softRejLead.id));

      // Cancel ALL unsent sequences — when a lead says "not interested",
      // every pending automated message should stop immediately.
      await db
        .update(scheduledMessages)
        .set({
          cancelled: true,
          cancelledAt: new Date(),
          cancelledReason: 'Soft rejection',
        })
        .where(
          and(
            eq(scheduledMessages.leadId, softRejLead.id),
            eq(scheduledMessages.sent, false),
            eq(scheduledMessages.cancelled, false)
          )
        );

      console.log(
        `[IncomingSMS] Soft rejection detected for lead ${softRejLead.id}. Status set to lost, sequences cancelled.`
      );

      // Send polite acknowledgment
      await sendCompliantMessage({
        clientId: client.id,
        to: senderPhone,
        from: client.twilioNumber,
        body: "No worries at all! If you ever need anything in the future, don't hesitate to reach out.",
        messageClassification: 'inbound_reply',
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply', messageId: MessageSid },
        leadId: softRejLead.id,
        queueOnQuietHours: false,
        metadata: { source: 'soft_rejection_ack' },
      });
    }

    return { processed: true, action: 'soft_rejection', leadId: softRejLeadResult[0]?.id };
  }

  // 2b. Handle HELP keyword (CTIA requirement — must work even for opted-out leads)
  if (ComplianceService.isHelpMessage(messageBody)) {
    const helpMessage = renderTemplate('help_response', {
      businessName: client.businessName,
      ownerPhone: formatPhoneNumber(client.phone),
    });
    await sendSMS(senderPhone, helpMessage, client.twilioNumber);
    await ComplianceService.logComplianceEvent(client.id, 'compliance_exempt_send', {
      phoneNumber: senderPhone,
      phoneHash: ComplianceService.hashPhoneNumber(senderPhone),
      reason: 'help_keyword_response',
    });
    return { processed: true, action: 'help_response' };
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

    // Check for opt-in request from opted-out lead
    const optInWords = ['start', 'unstop', 'subscribe', 'yes'];
    if (lead.optedOut && optInWords.includes(messageBody.toLowerCase())) {
      await db
        .update(leads)
        .set({ optedOut: false, optedOutAt: null, status: 'contacted' })
        .where(eq(leads.id, lead.id));
      lead = { ...lead, optedOut: false };

      // Clear platform DNC entry so other clients can also message this number
      await db.delete(blockedNumbers)
        .where(eq(blockedNumbers.phone, senderPhone));

      await sendSMS(
        senderPhone,
        `You've been re-subscribed to messages from ${client.businessName}. Reply STOP at any time to opt out.`,
        client.twilioNumber
      );
      await ComplianceService.logComplianceEvent(client.id, 'compliance_exempt_send', {
        phoneNumber: senderPhone,
        phoneHash: ComplianceService.hashPhoneNumber(senderPhone),
        reason: 'opt_in_confirmation',
        leadId: lead.id,
      });
      return { processed: true, action: 'opted_in' };
    }

    // Promote dormant leads back to active pipeline on inbound reply
    if (lead.status === 'dormant') {
      await db
        .update(leads)
        .set({
          status: 'contacted',
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
      lead.status = 'contacted'; // Update local reference
      console.log(`[SMS] Promoted dormant lead ${lead.id} back to contacted`);
    }

    // Skip automated processing for opted-out leads
    if (lead.optedOut) {
      console.log(`[SMS] Skipping processing for opted-out lead ${lead.id}`);
      return { processed: false, reason: 'Lead opted out' };
    }
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

  // 5a. Record reply-rate metrics for any active flow execution (fire-and-forget)
  try {
    const db2 = getDb();
    const [activeFlow] = await db2
      .select({
        templateId: flows.templateId,
        currentStep: flowExecutions.currentStep,
        startedAt: flowExecutions.startedAt,
      })
      .from(flowExecutions)
      .innerJoin(flows, eq(flows.id, flowExecutions.flowId))
      .where(
        and(
          eq(flowExecutions.leadId, lead.id),
          eq(flowExecutions.status, 'active')
        )
      )
      .orderBy(desc(flowExecutions.startedAt))
      .limit(1);

    if (activeFlow?.templateId) {
      const refTime = activeFlow.startedAt ?? new Date();
      const responseTimeMinutes = Math.round(
        (Date.now() - new Date(refTime).getTime()) / 60000
      );
      await recordLeadResponse(
        activeFlow.templateId,
        activeFlow.currentStep ?? 1,
        responseTimeMinutes
      );
    }
  } catch (err) {
    console.error('[FlowMetrics] Failed to record lead response:', err);
  }

  // 5b. Update lead score (quick mode for speed)
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

  // 6. Handle re-engagement sequences on reply.
  //
  // Only touch sequences whose purpose is to re-engage a silent lead — once the
  // lead replies, these sequences need to react.
  //
  // Do NOT touch on a generic reply:
  //   - payment_reminder  → only cancelled by Stripe payment confirmation
  //   - review_request    → only cancelled by explicit opt-out
  //   - referral_request  → same as review_request
  //   - appointment_reminder / appointment_reminder_contractor
  //                       → only cancelled when the appointment is cancelled
  //   - no_show_followup  → managed by appointment lifecycle
  //   - quiet_hours_queue → compliance gateway internal
  //   - smart_assist      → managed by its own lifecycle
  //
  // win_back: cancel entirely on reply (lead is re-engaged, sequence is done).
  //
  // estimate_followup: pause-and-resume behaviour —
  //   - Cancel the NEXT unsent step (earliest sendAt) so we don't interrupt the
  //     conversation immediately.
  //   - Delay all remaining unsent steps by 3 days so the sequence resumes after
  //     the lead has had time to think.

  // 6a. Cancel all unsent win_back steps — lead re-engaged, no further nudging needed.
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
      eq(scheduledMessages.cancelled, false),
      eq(scheduledMessages.sequenceType, 'win_back')
    ));

  // 6b. Pause-and-resume for estimate_followup sequences.
  //   Step 1: find all unsent steps ordered by sendAt ascending.
  const unsentEstimateSteps = await db
    .select({ id: scheduledMessages.id })
    .from(scheduledMessages)
    .where(and(
      eq(scheduledMessages.leadId, lead.id),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false),
      eq(scheduledMessages.sequenceType, 'estimate_followup')
    ))
    .orderBy(scheduledMessages.sendAt);

  if (unsentEstimateSteps.length > 0) {
    const [nextStep, ...remainingSteps] = unsentEstimateSteps;

    // Cancel the very next step — don't interrupt the active conversation.
    await db
      .update(scheduledMessages)
      .set({
        cancelled: true,
        cancelledAt: new Date(),
        cancelledReason: 'Lead replied — paused',
      })
      .where(eq(scheduledMessages.id, nextStep.id));

    // Delay all remaining steps by 3 days so the sequence resumes later.
    if (remainingSteps.length > 0) {
      await db
        .update(scheduledMessages)
        .set({ sendAt: sql`${scheduledMessages.sendAt} + interval '3 days'` })
        .where(and(
          inArray(scheduledMessages.id, remainingSteps.map((s) => s.id)),
          eq(scheduledMessages.sent, false),
          eq(scheduledMessages.cancelled, false)
        ));
    }
  }

  // 6.5 Check for hot intent BEFORE AI processing
  const isHotIntent = detectHotIntent(messageBody);

  if (isHotIntent) {
    const withinHours = await isWithinBusinessHours(client.id, client.timezone || 'America/New_York');

    if (withinHours) {
      const ringResult = await initiateRingGroup({
        leadId: lead.id,
        clientId: client.id,
        leadPhone: senderPhone,
        twilioNumber: client.twilioNumber,
      });

      if (ringResult.initiated) {
        await sendCompliantMessage({
          clientId: client.id,
          to: senderPhone,
          from: client.twilioNumber,
          body: `Great! We're calling you right now. Please pick up!`,
          messageClassification: 'inbound_reply',
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
        from: client.twilioNumber,
        body: `Thanks for your interest! We're currently outside business hours, but someone will call you first thing tomorrow morning.`,
        messageClassification: 'inbound_reply',
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply', messageId: MessageSid },
        leadId: lead.id,
        queueOnQuietHours: false,
        metadata: { source: 'outside_hours_ack' },
      });

      await notifyTeamForEscalation({
        leadId: lead.id,
        clientId: client.id,
        twilioNumber: client.twilioNumber,
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

  // 6.6a Check if this is an address reply for a pending appointment that has no address.
  // The last outbound message would have asked "what is the address for the visit?"
  const lastOutbound = conversationHistory.filter(m => m.role === 'assistant').slice(-1)[0];
  const isAddressReply =
    lastOutbound?.content.includes('what is the address for the visit') &&
    messageBody.length > 0 &&
    !messageBody.toLowerCase().startsWith('stop') &&
    !messageBody.toLowerCase().startsWith('help');

  if (isAddressReply) {
    // Find the most recent scheduled appointment for this lead with no address
    const [pendingAppt] = await db
      .select()
      .from(appointments)
      .where(and(
        eq(appointments.leadId, lead.id),
        eq(appointments.clientId, client.id),
        eq(appointments.status, 'scheduled'),
        isNull(appointments.address)
      ))
      .orderBy(desc(appointments.createdAt))
      .limit(1);

    if (pendingAppt) {
      // Store the address on the appointment and the lead
      await db
        .update(appointments)
        .set({ address: messageBody, updatedAt: new Date() })
        .where(eq(appointments.id, pendingAppt.id));
      await db
        .update(leads)
        .set({ address: messageBody, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));

      const ackResult = await sendCompliantMessage({
        clientId: client.id,
        to: senderPhone,
        from: client.twilioNumber,
        body: `Got it, thanks! We have your address on file for the visit.`,
        messageClassification: 'inbound_reply',
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply', messageId: MessageSid },
        leadId: lead.id,
        queueOnQuietHours: false,
        metadata: { source: 'address_capture', appointmentId: pendingAppt.id },
      });

      if (ackResult.sent) {
        await db.insert(conversations).values({
          leadId: lead.id,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'ai_response',
          content: `Got it, thanks! We have your address on file for the visit.`,
          twilioSid: ackResult.messageSid || undefined,
        });
      }

      return { processed: true, leadId: lead.id, action: 'address_captured' };
    }
    // No pending appointment found — fall through to normal processing
  }

  // 6.6b Check for booking intent (works for all clients, not just autonomous)
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
        bookingIntent,
        lead.address
      );

      if (bookingResult.responseMessage) {
        const sendResult = await sendCompliantMessage({
          clientId: client.id,
          to: senderPhone,
          from: client.twilioNumber,
          body: bookingResult.responseMessage,
          messageClassification: 'inbound_reply',
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
        from: client.twilioNumber,
        body: ackMessage,
        messageClassification: 'inbound_reply',
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

  // 9. Track knowledge gap when AI is uncertain
  if (aiResult.shouldEscalate || (aiResult.confidence !== undefined && aiResult.confidence < 0.7)) {
    trackKnowledgeGap(
      client.id,
      messageBody,
      aiResult.confidence !== undefined && aiResult.confidence < 0.5 ? 'low' : 'medium'
    ).catch(err => console.error('[IncomingSMS] Knowledge gap tracking failed:', err));
  }

  // 9b. Handle escalation
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
      from: client.twilioNumber,
      body: ackMessage,
      messageClassification: 'inbound_reply',
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
      twilioNumber: client.twilioNumber,
      reason: aiResult.escalationReason || 'Needs human response',
      lastMessage: messageBody,
    });

    // Fallback to single contractor if no team members
    if (escalationResult.notified === 0) {
      if (client.notificationSms) {
        await sendSMS(
          client.phone,
          `URGENT: ${lead.name || formatPhoneNumber(senderPhone)} needs you: "${messageBody.substring(0, 80)}..." ${dashboardUrl}`,
          client.twilioNumber
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
  const assistCategory = isNewLead
    ? AI_ASSIST_CATEGORY.FIRST_RESPONSE
    : AI_ASSIST_CATEGORY.FOLLOW_UP;
  const smartAssistAutoSendKillSwitchEnabled = await isOpsKillSwitchEnabled(
    OPS_KILL_SWITCH_KEYS.SMART_ASSIST_AUTO_SEND
  );
  const sendPolicy = resolveAiSendPolicy(
    {
      ...client,
      smartAssistAutoSendKillSwitchEnabled,
    },
    assistCategory
  );

  if (sendPolicy.mode === 'disabled') {
    return {
      processed: true,
      leadId: lead.id,
      aiResponseDisabled: true,
      policyReason: sendPolicy.reason,
    };
  }

  if (sendPolicy.mode === 'delayed_auto_send' || sendPolicy.mode === 'pending_manual') {
    const queued = await queueSmartAssistDraft({
      clientId: client.id,
      leadId: lead.id,
      leadPhone: senderPhone,
      leadName: lead.name,
      ownerPhone: operatorPhone ?? client.phone,
      fromTwilioNumber: client.twilioNumber,
      content: aiResult.response,
      category: assistCategory,
      delayMinutes: sendPolicy.delayMinutes,
      requiresManualApproval: sendPolicy.requiresManualApproval,
    });

    checkAndSuggestFlows(lead.id, client.id, conversationHistory).catch(console.error);

    return {
      processed: true,
      leadId: lead.id,
      smartAssistPending: true,
      smartAssistReferenceCode: queued.referenceCode,
      smartAssistSendAt: queued.sendAt.toISOString(),
      smartAssistRequiresManualApproval: sendPolicy.requiresManualApproval,
      category: assistCategory,
    };
  }

  try {
    const sendResult = await sendCompliantMessage({
      clientId: client.id,
      to: senderPhone,
      from: client.twilioNumber,
      body: aiResult.response,
      messageClassification: 'inbound_reply',
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
      `${lead.name || formatPhoneNumber(senderPhone)}: "${messageBody.substring(0, 50)}${messageBody.length > 50 ? '...' : ''}" — AI replied. ${dashboardUrl}`,
      client.twilioNumber
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

  await sendSMS(phone, confirmMessage, client.twilioNumber as string);
  await ComplianceService.logComplianceEvent(client.id, 'compliance_exempt_send', {
    phoneNumber: phone,
    phoneHash: ComplianceService.hashPhoneNumber(phone),
    reason: 'opt_out_confirmation',
    leadId: leadResult.length ? leadResult[0].id : undefined,
  });

  return { processed: true, optedOut: true };
}
