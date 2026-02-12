import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { conversationAgent } from './graph';
import type { ConversationStateType } from './state';
import { getDb } from '@/db';
import {
  leadContext,
  agentDecisions,
  escalationQueue,
  clientAgentSettings,
  conversations,
  leads,
  clients,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sendTrackedSMS } from '@/lib/clients/twilio-tracked';
import { trackUsage } from '@/lib/services/usage-tracking';
import { startFlowExecution } from '@/lib/services/flow-execution';
import { buildKnowledgeContext } from '@/lib/services/knowledge-base';
import type { AgentAction, EscalationReason, LeadStage, LeadSignals } from '@/lib/types/agent';

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

  // Load agent settings
  const [settings] = await db
    .select()
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, client.id))
    .limit(1);

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

  // Retrieve relevant knowledge
  let knowledge: string | null = null;
  try {
    knowledge = await buildKnowledgeContext(client.id);
  } catch (err) {
    console.error('[Agent] Knowledge retrieval failed:', err);
  }

  // Build initial state
  const initialState: Partial<ConversationStateType> = {
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
    knowledgeContext: knowledge,
  };

  // Run the agent graph
  const finalState = await conversationAgent.invoke(initialState);

  const processingTime = Date.now() - startTime;

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
    action: finalState.lastAction as AgentAction,
    actionDetails: {
      responseText: finalState.responseToSend ?? undefined,
      flowId: finalState.flowToTrigger ?? undefined,
      escalationReason: finalState.escalationReason ?? undefined,
    },
    reasoning: finalState.decisionReasoning ?? undefined,
    confidence: 80,
    processingTimeMs: processingTime,
  };
  await db.insert(agentDecisions).values(decisionValues);

  // Update lead context
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
    bookingAttempts: finalState.bookingAttempts,
    totalMessages: (context.totalMessages || 0) + 1,
    leadMessages: (context.leadMessages || 0) + 1,
    updatedAt: new Date(),
  }).where(eq(leadContext.id, context.id));

  // Track AI usage
  trackUsage({
    clientId: client.id,
    service: 'openai',
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

  // Handle response
  if (finalState.responseToSend && !finalState.needsEscalation) {
    await sendTrackedSMS({
      clientId: client.id,
      to: lead.phone,
      from: client.twilioNumber!,
      body: finalState.responseToSend,
      leadId,
    });

    // Save outbound message
    await db.insert(conversations).values({
      leadId,
      clientId: client.id,
      direction: 'outbound',
      messageType: 'ai_response',
      content: finalState.responseToSend,
    });

    responseSent = true;
  }

  // Handle escalation
  if (finalState.needsEscalation) {
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
