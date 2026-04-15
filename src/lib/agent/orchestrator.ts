import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { conversationAgent } from './graph';
import type { ConversationStateType } from './state';
import { getDb } from '@/db';
import {
  leadContext,
  agentDecisions,
  auditLog,
  escalationQueue,
  clientAgentSettings,
  conversations,
  leads,
  clients,
  voiceCalls,
} from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { trackUsage } from '@/lib/services/usage-tracking';
import { getActiveProviderName } from '@/lib/ai';
import { startFlowExecution } from '@/lib/services/flow-execution';
import { buildSmartKnowledgeContext } from '@/lib/services/knowledge-base';
import { buildGuardrailPrompt } from './guardrails';
import { checkOutputGuardrails } from './output-guard';
import { truncateAtSentence } from '@/lib/utils/text';
import { classifyService, updateLeadServiceMatch } from '@/lib/services/service-classification';
import { detectBookingIntent, handleBookingConversation } from '@/lib/services/booking-conversation';
import { selectModelTier } from '@/lib/ai/model-routing';
import { trackKnowledgeGap } from '@/lib/agent/context-builder';
import type { AgentAction, EscalationReason, LeadStage, LeadSignals } from '@/lib/types/agent';
import { getOnboardingQualityReadiness } from '@/lib/services/onboarding-quality';
import { maybeAutoTriggerEstimateFollowup } from '@/lib/automations/estimate-auto-trigger';
import { shouldUpdateSummary, updateConversationSummary } from '@/lib/services/conversation-summary';
import { syncLeadStatusFromStage } from '@/lib/services/lead-state-sync';
import { resolveStrategy } from './strategy-resolver';
import { composeAgentPrompt } from './prompt-composer';
import { resolveEntryContext } from './entry-context';
import { CA_AB_LOCALE } from './locales/ca-ab';
import { BASEMENT_DEVELOPMENT_PLAYBOOK } from './playbooks/basement-development';
import { getChannelConfig } from './channels';

interface ProcessMessageResult {
  action: AgentAction;
  responseSent: boolean;
  responseText?: string;
  escalated: boolean;
  flowTriggered?: string;
  newStage: string;
}

/**
 * Main entry point for processing incoming messages
 */
export async function processIncomingMessage(
  leadId: string,
  messageId: string,
  messageText: string
): Promise<ProcessMessageResult> {
  const db = getDb();
  const startTime = Date.now();

  // Load lead and client data
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const [client] = await db.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1);
  if (!client) throw new Error(`Client not found: ${lead.clientId}`);

  if (!client.twilioNumber) {
    console.warn(`[Agent] Client ${client.id} has no Twilio number — cannot respond to lead ${leadId}`);
    return {
      action: 'no_action' as AgentAction,
      responseSent: false,
      escalated: false,
      newStage: 'new',
    };
  }

  // Load agent settings
  const [settings] = await db
    .select()
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, client.id))
    .limit(1);

  // Quality gate guard — block AI when critical onboarding gates are failing in enforce mode.
  // This prevents the AI from responding when the KB is empty or other critical setup is missing.
  try {
    const { decision, evaluation } = await getOnboardingQualityReadiness({
      clientId: client.id,
      source: 'ai_orchestrator',
      persistSnapshot: false,
    });
    if (decision.mode === 'enforce' && !decision.allowed) {
      console.warn(
        `[Agent] AI response blocked for client ${client.id} — critical quality gates failing: ${evaluation.criticalFailures.join(', ')}`
      );
      return {
        action: 'no_action' as AgentAction,
        responseSent: false,
        escalated: false,
        newStage: 'new',
      };
    }
  } catch (err) {
    // Non-fatal — if quality check fails, allow AI to proceed rather than silently drop responses
    console.error('[Agent] Quality gate check failed, proceeding without gate enforcement:', err);
  }

  // Load or create lead context
  let [context] = await db
    .select()
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  if (!context) {
    [context] = await db.insert(leadContext).values({
      leadId,
      clientId: client.id,
      stage: 'new',
    }).returning();
  }

  // Load conversation history
  const conversationHistory = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(desc(conversations.createdAt))
    .limit(20);

  // SIM-06: Load voice call context for cross-channel handoff
  try {
    const [recentVoiceCall] = await db
      .select({
        id: voiceCalls.id,
        aiSummary: voiceCalls.aiSummary,
        createdAt: voiceCalls.createdAt,
      })
      .from(voiceCalls)
      .where(eq(voiceCalls.leadId, leadId))
      .orderBy(desc(voiceCalls.createdAt))
      .limit(1);

    if (recentVoiceCall?.aiSummary) {
      // Check if voice call is already represented in conversation history
      const voiceAlreadyInHistory = conversationHistory.some(
        m => m.messageType === 'voice_summary'
      );

      if (!voiceAlreadyInHistory) {
        // Insert synthetic conversation record so the agent sees the voice context
        await db.insert(conversations).values({
          leadId,
          clientId: client.id,
          direction: 'inbound',
          messageType: 'voice_summary',
          content: `[Prior voice call summary] ${recentVoiceCall.aiSummary}`,
          createdAt: recentVoiceCall.createdAt,
        });

        // Prepend to conversation history so it appears in context
        conversationHistory.push({
          direction: 'inbound',
          messageType: 'voice_summary',
          content: `[Prior voice call summary] ${recentVoiceCall.aiSummary}`,
          createdAt: recentVoiceCall.createdAt,
        } as typeof conversationHistory[0]);
      }
    }
  } catch (err) {
    console.error('[Agent] Voice context loading failed:', err);
    // Non-blocking — continue without voice context
  }

  // Check if conversation summary needs updating before processing
  const lastConvMessage = conversationHistory[conversationHistory.length - 1];
  if (lastConvMessage && shouldUpdateSummary({
    totalMessages: context.totalMessages || 0,
    lastMessageAt: lastConvMessage.createdAt!,
    existingSummary: context.conversationSummary ?? null,
  })) {
    try {
      const summary = await updateConversationSummary(client.id, leadId);
      if (summary) {
        context.conversationSummary = summary;
      }
    } catch (err) {
      console.error('[Agent] Summary update failed:', err);
      // Non-blocking — continue without updated summary
    }
  }

  // GAP-S5: Reset stage for returning leads after a significant gap
  const lastConvTime = conversationHistory[0]?.createdAt; // Most recent message (ordered desc)
  if (lastConvTime) {
    const daysSinceLastMessage = Math.floor(
      (Date.now() - lastConvTime.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastMessage > 7 && context.conversationStage !== 'greeting') {
      console.log(`[Agent] Returning lead after ${daysSinceLastMessage} days — resetting stage to greeting`);
      context.conversationStage = 'greeting';
      context.stageTurnCount = 0;
      // Ensure summary is fresh for the returning conversation
      if (!context.conversationSummary && (context.totalMessages ?? 0) > 5) {
        try {
          const summary = await updateConversationSummary(client.id, leadId);
          if (summary) {
            context.conversationSummary = summary;
          }
        } catch (err) {
          console.error('[Agent] Summary refresh for returning lead failed:', err);
        }
      }
    }
  }

  // Convert to LangChain messages
  const langChainMessages = conversationHistory
    .reverse()
    .map(m => {
      if (m.direction === 'inbound') {
        return new HumanMessage(m.content);
      } else {
        return new AIMessage(m.content);
      }
    });

  // Add the new message
  langChainMessages.push(new HumanMessage(messageText));

  // Check for booking intent before running the full agent graph
  const chatHistory = conversationHistory
    .slice()
    .reverse()
    .map(m => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

  const bookingIntent = await detectBookingIntent(messageText, chatHistory);

  if (bookingIntent !== 'none') {
    const bookingResult = await handleBookingConversation(
      client.id,
      leadId,
      lead.name || 'there',
      messageText,
      chatHistory,
      client.businessName,
      client.ownerName,
      bookingIntent,
      undefined,
      client.twilioNumber
    );

    if (bookingResult.responseMessage) {
      // Send the booking response via compliance gateway
      const sendResult = await sendCompliantMessage({
        clientId: client.id,
        to: lead.phone,
        from: client.twilioNumber,
        body: bookingResult.responseMessage,
        messageClassification: 'inbound_reply',
        messageCategory: 'transactional',
        consentBasis: { type: 'lead_reply' },
        leadId,
        queueOnQuietHours: false,
        metadata: { source: 'booking_conversation', intent: bookingIntent },
      });

      let responseSent = false;
      if (sendResult.sent) {
        await db.insert(conversations).values({
          leadId,
          clientId: client.id,
          direction: 'outbound',
          messageType: 'ai_response',
          content: bookingResult.responseMessage,
          twilioSid: sendResult.messageSid || undefined,
        });
        responseSent = true;
      }

      // Update lead context stage if appointment was created
      if (bookingResult.appointmentCreated) {
        await db.update(leadContext).set({
          stage: 'booked',
          updatedAt: new Date(),
        }).where(eq(leadContext.id, context.id));
      }

      // Log the booking decision
      const bookingDecisionValues: typeof agentDecisions.$inferInsert = {
        leadId,
        clientId: client.id,
        messageId,
        triggerType: 'inbound_message',
        stageAtDecision: context.stage,
        contextSnapshot: {
          urgencyScore: context.urgencyScore || 50,
          budgetScore: context.budgetScore || 50,
          intentScore: context.intentScore || 50,
          sentiment: context.currentSentiment || 'neutral',
          recentObjections: [],
        },
        action: 'book_appointment' as AgentAction,
        actionDetails: {
          responseText: bookingResult.responseMessage,
        },
        reasoning: `Booking intent detected: ${bookingIntent}`,
        confidence: 90,
        processingTimeMs: Date.now() - startTime,
      };
      await db.insert(agentDecisions).values(bookingDecisionValues);

      return {
        action: 'book_appointment' as AgentAction,
        responseSent,
        responseText: bookingResult.responseMessage,
        escalated: false,
        newStage: bookingResult.appointmentCreated ? 'booked' : context.stage,
      };
    }
  }

  // Retrieve relevant knowledge (two-tier: structural + search-matched)
  let knowledge: string | null = null;
  try {
    const smartContext = await buildSmartKnowledgeContext(client.id, messageText);
    knowledge = smartContext.full;
  } catch (err) {
    console.error('[Agent] Knowledge retrieval failed:', err);
  }

  // Count consecutive outbound messages (messages without response)
  const outboundStreak = conversationHistory
    .slice()
    .reverse()
    .findIndex(m => m.direction === 'inbound');
  const messagesWithoutResponse = outboundStreak === -1 ? conversationHistory.length : outboundStreak;

  // Build guardrails
  const guardrailText = buildGuardrailPrompt({
    ownerName: client.ownerName,
    businessName: client.businessName,
    agentTone: (settings?.agentTone || 'professional') as 'professional' | 'friendly' | 'casual',
    messagesWithoutResponse,
    canDiscussPricing: settings?.canDiscussPricing || false,
    activePricingObjection: (context.objections as Array<{ detail: string }>)?.some(o =>
      ['price_comparison', 'competing_quote', 'too_expensive', 'cost'].includes(o.detail)
    ) ?? false,
  });

  // --- 6-LAYER ORCHESTRATION ---

  // Load locale and playbook configs
  // For now, use hardcoded defaults. When clients.localeId and clients.playbookId
  // are populated via admin UI, load from DB instead.
  const locale = CA_AB_LOCALE;
  const playbook = BASEMENT_DEVELOPMENT_PLAYBOOK;
  const channelConfig = getChannelConfig('sms');

  // Resolve entry context (Layer 5)
  const entryContext = resolveEntryContext({
    leadSource: lead.source,
    isReturningLead: (context.totalMessages ?? 0) > 0,
    daysSinceLastContact: context.updatedAt
      ? Math.floor((Date.now() - context.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    existingProjectInfo: context.projectType ? {
      projectType: context.projectType,
      projectSize: context.projectSize,
      preferredTimeframe: context.preferredTimeframe,
    } : null,
    timezone: locale.timezone,
  });

  // Resolve conversation strategy (Layer 1 + 3)
  const conversationStrategy = resolveStrategy({
    currentStage: context.conversationStage ?? 'greeting',
    stageTurnCount: context.stageTurnCount ?? 0,
    signals: {
      urgency: context.urgencyScore || 50,
      budget: context.budgetScore || 50,
      intent: context.intentScore || 50,
      sentiment: (context.currentSentiment as string) || 'neutral',
    },
    extractedInfo: {
      projectType: context.projectType,
      projectSize: context.projectSize,
      preferredTimeframe: context.preferredTimeframe,
      estimatedValue: context.estimatedValue,
    },
    objections: (context.objections as Array<{ detail: string }>)?.map(o => o.detail) || [],
    bookingAttempts: context.bookingAttempts || 0,
    entryContext,
    isFirstMessage: (context.totalMessages ?? 0) === 0,
    playbook,
    maxBookingAttempts: settings?.maxBookingAttempts || 3,
  });

  // Compose the 6-layer prompt (replaces the simple RESPONSE_PROMPT template)
  const composedPrompt = composeAgentPrompt({
    agentName: settings?.agentName || 'Assistant',
    businessName: client.businessName,
    ownerName: client.ownerName,
    agentTone: settings?.agentTone || 'professional',
    strategy: conversationStrategy,
    locale,
    playbook,
    channel: channelConfig,
    entryContext: (context.totalMessages ?? 0) === 0 ? entryContext : null,
    guardrailText,
    knowledgeContext: knowledge,
    conversationSummary: context.conversationSummary ?? undefined,
  });

  // Build initial state
  const initialState = {
    leadId,
    clientId: client.id,
    messages: langChainMessages,
    stage: (context.stage as LeadStage) || 'new',
    signals: {
      urgency: context.urgencyScore || 50,
      budget: context.budgetScore || 50,
      intent: context.intentScore || 50,
      sentiment: (context.currentSentiment as LeadSignals['sentiment']) || 'neutral',
    },
    extractedInfo: {
      projectType: context.projectType,
      projectSize: context.projectSize,
      estimatedValue: context.estimatedValue,
      preferredTimeframe: context.preferredTimeframe,
    },
    objections: (context.objections as Array<{ detail: string }>)?.map(o => o.detail) || [],
    bookingAttempts: context.bookingAttempts || 0,
    clientSettings: {
      businessName: client.businessName,
      ownerName: client.ownerName,
      services: ((client as Record<string, unknown>).metadata as Record<string, unknown>)?.services as string[] || [],
      agentName: settings?.agentName || 'Assistant',
      agentTone: settings?.agentTone || 'professional',
      maxResponseLength: settings?.maxResponseLength || 300,
      primaryGoal: settings?.primaryGoal || 'book_appointment',
      bookingAggressiveness: settings?.bookingAggressiveness || 5,
      maxBookingAttempts: settings?.maxBookingAttempts || 3,
      canDiscussPricing: settings?.canDiscussPricing || false,
      canScheduleAppointments: settings?.canScheduleAppointments ?? true,
    },
    knowledgeContext: knowledge,   // Keep for now — respond.ts still reads this
    guardrailText,                 // Keep for now — respond.ts still reads this
    // Conversation summary for returning leads (populated by conversation-summary service)
    conversationSummary: context.conversationSummary ?? undefined,
    // 6-layer orchestration: resolved strategy for this turn
    conversationStrategy,
  } satisfies Partial<ConversationStateType>;

  // Run the agent graph
  const finalState = await conversationAgent.invoke(initialState);

  const processingTime = Date.now() - startTime;

  // Compute model routing decision for logging
  const effectiveLeadScore = Math.round(
    (finalState.signals.urgency + finalState.signals.budget + finalState.signals.intent) / 3
  );
  const routingDecision = selectModelTier({
    leadScore: effectiveLeadScore,
    signals: finalState.signals,
    decisionConfidence: finalState.decisionConfidence,
  });

  // Log the decision
  const decisionValues: typeof agentDecisions.$inferInsert = {
    leadId,
    clientId: client.id,
    messageId,
    triggerType: 'inbound_message',
    stageAtDecision: context.stage,
    contextSnapshot: {
      urgencyScore: finalState.signals.urgency,
      budgetScore: finalState.signals.budget,
      intentScore: finalState.signals.intent,
      sentiment: finalState.signals.sentiment,
      recentObjections: finalState.objections.slice(-3),
    },
    analysisSnapshot: {
      sentiment: finalState.signals.sentiment,
      sentimentConfidence: finalState.signals.urgency, // proxy — real sentimentConfidence comes from analyzeAndDecide
      urgencyScore: finalState.signals.urgency,
      budgetScore: finalState.signals.budget,
      intentScore: finalState.signals.intent,
      detectedObjections: finalState.objections,
      suggestedStage: finalState.stage,
      keyInsights: [], // populated when analyzeAndDecide exposes keyInsights
      extractedInfo: finalState.extractedInfo as Record<string, unknown>,
    },
    action: finalState.lastAction as AgentAction,
    actionDetails: {
      responseText: finalState.responseToSend ?? undefined,
      flowId: finalState.flowToTrigger ?? undefined,
      escalationReason: finalState.escalationReason ?? undefined,
      modelTier: routingDecision.tier,
      modelRoutingReason: routingDecision.reason,
      promptVersion: composedPrompt.version,
    },
    reasoning: finalState.decisionReasoning ?? undefined,
    confidence: finalState.decisionConfidence,
    processingTimeMs: processingTime,
  };
  await db.insert(agentDecisions).values(decisionValues);

  // Track knowledge gaps when AI confidence is low or it defers to owner
  if (finalState.decisionConfidence !== undefined && finalState.decisionConfidence < 60) {
    trackKnowledgeGap(
      client.id,
      messageText,
      finalState.decisionConfidence < 40 ? 'low' : 'medium'
    ).catch(err => console.error('[Agent] Knowledge gap tracking failed:', err));
  }

  // Classify service from extracted projectType
  let matchedServiceId: string | undefined;
  const extractedProjectType = finalState.extractedInfo.projectType;
  if (extractedProjectType && extractedProjectType !== context.projectType) {
    const classified = await classifyService(client.id, extractedProjectType);
    if (classified) {
      matchedServiceId = classified.serviceId;
      // Set estimatedValue from service catalog if AI didn't extract one
      if (!finalState.extractedInfo.estimatedValue && classified.avgValueCents) {
        finalState.extractedInfo.estimatedValue = classified.avgValueCents;
      }
    }
  }

  // Build decision-maker update if AI detected a partner mention (SIM-03)
  const aiDecisionMakers = finalState.extractedInfo.decisionMakers as {
    partnerMentioned?: boolean;
    partnerName?: string;
  } | undefined;

  let decisionMakersUpdate: {
    primary?: string;
    secondary?: string;
    secondaryConsulted: boolean;
    partnerApprovalNeeded: boolean;
  } | undefined;

  if (aiDecisionMakers?.partnerMentioned) {
    const currentDM = (context.decisionMakers as {
      primary?: string;
      secondary?: string;
      secondaryConsulted: boolean;
      partnerApprovalNeeded: boolean;
    } | null) ?? { secondaryConsulted: false, partnerApprovalNeeded: false };

    decisionMakersUpdate = {
      ...currentDM,
      partnerApprovalNeeded: true,
      secondary: aiDecisionMakers.partnerName ?? currentDM.secondary,
    };
  }

  // Update lead context (including 6-layer strategy state)
  await db.update(leadContext).set({
    stage: finalState.stage as LeadStage,
    urgencyScore: finalState.signals.urgency,
    budgetScore: finalState.signals.budget,
    intentScore: finalState.signals.intent,
    currentSentiment: finalState.signals.sentiment as LeadSignals['sentiment'],
    projectType: finalState.extractedInfo.projectType,
    projectSize: finalState.extractedInfo.projectSize,
    estimatedValue: finalState.extractedInfo.estimatedValue,
    preferredTimeframe: finalState.extractedInfo.preferredTimeframe,
    ...(matchedServiceId ? { matchedServiceId } : {}),
    ...(decisionMakersUpdate ? { decisionMakers: decisionMakersUpdate } : {}),
    bookingAttempts: finalState.bookingAttempts,
    totalMessages: (context.totalMessages || 0) + 1,
    leadMessages: (context.leadMessages || 0) + 1,
    conversationStage: conversationStrategy.currentStage,
    stageTurnCount: (context.stageTurnCount ?? 0) + 1,
    strategyState: {
      currentObjective: conversationStrategy.currentObjective,
      requiredInfo: conversationStrategy.requiredInfo,
      suggestedAction: conversationStrategy.suggestedAction,
      nextMoveIfSuccessful: conversationStrategy.nextMoveIfSuccessful,
      constraints: conversationStrategy.constraints,
      maxTurnsRemaining: conversationStrategy.maxTurnsRemaining,
    },
    updatedAt: new Date(),
  }).where(eq(leadContext.id, context.id));

  // SIM-02: Sync leads.status from the updated conversationStage (fire-and-forget)
  syncLeadStatusFromStage(leadId, conversationStrategy.currentStage).catch(
    err => console.error('[Agent] Status sync failed:', err)
  );

  // Track AI usage
  trackUsage({
    clientId: client.id,
    service: getActiveProviderName(),
    operation: 'conversation_agent',
    leadId,
    metadata: {
      action: finalState.lastAction,
      processingTimeMs: processingTime,
    },
  }).catch(err => console.error('[Agent] Usage tracking error:', err));

  // Execute action
  let responseSent = false;
  let escalated = false;

  // Handle response via compliance gateway
  if (finalState.responseToSend && !finalState.needsEscalation) {
    const responseToSend = finalState.responseToSend;

    // Run output guard
    const guardResult = checkOutputGuardrails(responseToSend, messageText, {
      canDiscussPricing: settings?.canDiscussPricing || false,
    });

    let messageToSend = responseToSend;

    if (!guardResult.passed) {
      // Log blocked response
      console.warn(`[Agent] Output guard blocked: ${guardResult.violation}`);

      // Log a separate agent decision for the blocked response
      await db.insert(agentDecisions).values({
        leadId,
        clientId: client.id,
        messageId,
        triggerType: 'inbound_message',
        stageAtDecision: context.stage,
        contextSnapshot: {
          urgencyScore: finalState.signals.urgency,
          budgetScore: finalState.signals.budget,
          intentScore: finalState.signals.intent,
          sentiment: finalState.signals.sentiment,
          recentObjections: finalState.objections.slice(-3),
        },
        action: 'respond' as AgentAction,
        actionDetails: {
          blockedResponse: responseToSend,
          violation: guardResult.violation,
          violationDetail: guardResult.detail,
        },
        reasoning: `Output guard blocked: ${guardResult.violation}`,
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      });

      // Write audit log entry for quality degradation monitoring
      await db.insert(auditLog).values({
        action: 'output_guard_blocked',
        clientId: client.id,
        metadata: {
          leadId,
          violation: guardResult.violation,
          violationDetail: guardResult.detail,
        } as Record<string, unknown>,
      });

      // Use safe fallback
      messageToSend = `Thanks for your message! I'll have ${client.ownerName} get back to you shortly.`;
    }

    // Apply safe truncation
    messageToSend = truncateAtSentence(messageToSend, settings?.maxResponseLength || 300);

    const sendResult = await sendCompliantMessage({
      clientId: client.id,
      to: lead.phone,
      from: client.twilioNumber,
      body: messageToSend,
      messageClassification: 'inbound_reply',
      messageCategory: 'marketing',
      consentBasis: { type: 'lead_reply' },
      leadId,
      queueOnQuietHours: false,
      metadata: { source: 'conversation_agent', action: finalState.lastAction },
    });

    if (sendResult.sent) {
      await db.insert(conversations).values({
        leadId,
        clientId: client.id,
        direction: 'outbound',
        messageType: 'ai_response',
        content: messageToSend,
        twilioSid: sendResult.messageSid || undefined,
      });
      responseSent = true;

      // SIM-01: Update leads.status to 'contacted' on first AI response
      if (lead.status === 'new') {
        await db
          .update(leads)
          .set({ status: 'contacted', updatedAt: new Date() })
          .where(and(eq(leads.id, leadId), eq(leads.status, 'new')));
      }

      // Fire-and-forget: check if conversation signals an estimate was sent
      maybeAutoTriggerEstimateFollowup(leadId, client.id, messageText).catch(
        err => console.error('[Agent] Estimate auto-trigger error:', err)
      );
    } else {
      console.log('[Agent] Message blocked by compliance:', sendResult.blockReason);
    }
  }

  // Handle escalation
  if (finalState.needsEscalation) {
    // SIM-08: Send acknowledgment before escalating — homeowner shouldn't get silence
    const escalationAck = `I hear you, and I want to make sure this gets handled properly. I'm connecting you with ${client.ownerName} directly — expect to hear from them shortly.`;

    const ackResult = await sendCompliantMessage({
      clientId: client.id,
      to: lead.phone,
      from: client.twilioNumber,
      body: escalationAck,
      messageClassification: 'inbound_reply',
      messageCategory: 'transactional',
      consentBasis: { type: 'lead_reply' },
      leadId,
      queueOnQuietHours: false,
      metadata: { source: 'escalation_acknowledgment' },
    });

    if (ackResult.sent) {
      await db.insert(conversations).values({
        leadId,
        clientId: client.id,
        direction: 'outbound',
        messageType: 'ai_response',
        content: escalationAck,
        twilioSid: ackResult.messageSid || undefined,
      });
      responseSent = true;
    }

    // Existing escalation queue insert follows...
    await db.insert(escalationQueue).values({
      leadId,
      clientId: client.id,
      reason: finalState.escalationReason as EscalationReason,
      reasonDetails: finalState.decisionReasoning,
      triggerMessageId: messageId,
      priority: finalState.signals.sentiment === 'frustrated' ? 1 : 2,
      conversationSummary: context.conversationSummary,
    });

    escalated = true;

    // Escalation due to uncertainty likely indicates a knowledge gap
    if (finalState.escalationReason === 'complex_technical' || finalState.escalationReason === 'other') {
      trackKnowledgeGap(client.id, messageText, 'low').catch(
        err => console.error('[Agent] Knowledge gap tracking failed:', err)
      );
    }
  }

  // Handle flow trigger
  if (finalState.flowToTrigger) {
    try {
      await startFlowExecution(
        finalState.flowToTrigger,
        leadId,
        client.id,
        'conversation_agent'
      );
    } catch (err) {
      console.error('[Agent] Flow trigger failed:', err);
    }
  }

  return {
    action: finalState.lastAction!,
    responseSent,
    responseText: finalState.responseToSend || undefined,
    escalated,
    flowTriggered: finalState.flowToTrigger || undefined,
    newStage: finalState.stage,
  };
}

/**
 * Process a scheduled check (for leads that haven't responded)
 */
export async function processScheduledCheck(leadId: string): Promise<ProcessMessageResult | null> {
  const db = getDb();

  // Load context
  const [context] = await db
    .select()
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);

  if (!context) return null;

  // Check if we should wait longer
  if (context.stage === 'escalated' || context.stage === 'booked' || context.stage === 'lost') {
    return null;
  }

  // Get last message time
  const [lastMessage] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (!lastMessage) return null;

  // If last message was from us and they haven't replied in 24 hours, trigger nurture flow
  const hoursSinceLastMessage = (Date.now() - lastMessage.createdAt!.getTime()) / (1000 * 60 * 60);

  if (lastMessage.direction === 'outbound' && hoursSinceLastMessage > 24) {
    return {
      action: 'trigger_flow',
      responseSent: false,
      escalated: false,
      flowTriggered: 'nurture',
      newStage: context.stage,
    };
  }

  return null;
}
