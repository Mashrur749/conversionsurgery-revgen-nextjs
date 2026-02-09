import { getDb, flows, suggestedActions, clients, leads } from '@/db';
import { eq, and } from 'drizzle-orm';
import { detectSignals, mapSignalsToFlows, type DetectedSignals } from './signal-detection';
import { sendSMS } from './twilio';

export async function checkAndSuggestFlows(
  leadId: string,
  clientId: string,
  conversationHistory: { role: string; content: string }[]
): Promise<void> {
  const db = getDb();

  // Detect signals
  const signals = await detectSignals(conversationHistory);

  if (signals.confidence < 60) return; // Not confident enough

  // Map signals to flow names
  const suggestedFlowNames = mapSignalsToFlows(signals);

  if (suggestedFlowNames.length === 0) return;

  // Find matching flows for this client
  const clientFlows = await db
    .select()
    .from(flows)
    .where(and(
      eq(flows.clientId, clientId),
      eq(flows.trigger, 'ai_suggested'),
      eq(flows.isActive, true)
    ));

  for (const flowName of suggestedFlowNames) {
    const matchingFlow = clientFlows.find(f =>
      f.name.toLowerCase().includes(flowName.toLowerCase())
    );

    if (!matchingFlow) continue;

    // Check if we already suggested this flow recently
    const existingSuggestion = await db
      .select()
      .from(suggestedActions)
      .where(and(
        eq(suggestedActions.leadId, leadId),
        eq(suggestedActions.flowId, matchingFlow.id),
        eq(suggestedActions.status, 'pending')
      ))
      .limit(1);

    if (existingSuggestion.length > 0) continue;

    // Create suggestion
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [suggestion] = await db
      .insert(suggestedActions)
      .values({
        leadId,
        clientId,
        flowId: matchingFlow.id,
        reason: `Detected: ${signals.rawSignals.join(', ')}`,
        detectedSignal: flowName,
        confidence: signals.confidence,
        expiresAt,
      })
      .returning();

    // If flow requires SMS approval, send it
    if (matchingFlow.approvalMode === 'ask_sms') {
      await sendApprovalSMS(suggestion.id, clientId, leadId, matchingFlow.name);
    }
  }
}

async function sendApprovalSMS(
  suggestionId: string,
  clientId: string,
  leadId: string,
  flowName: string
): Promise<void> {
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!client?.phone || !client.twilioNumber) return;

  const message = `AI suggests: "${flowName}" for ${lead?.name || lead?.phone}\n\nReply:\nYES ${suggestionId.slice(0, 8)} - to approve\nNO ${suggestionId.slice(0, 8)} - to skip`;

  await sendSMS(client.phone, client.twilioNumber, message);
}

export async function handleApprovalResponse(
  clientId: string,
  messageBody: string
): Promise<{ handled: boolean; action?: string }> {
  const upperBody = messageBody.toUpperCase().trim();

  // Check for YES/NO pattern
  const yesMatch = upperBody.match(/^YES\s+([A-F0-9]{8})/i);
  const noMatch = upperBody.match(/^NO\s+([A-F0-9]{8})/i);

  if (!yesMatch && !noMatch) {
    return { handled: false };
  }

  const shortId = (yesMatch || noMatch)![1].toLowerCase();
  const approved = !!yesMatch;

  const db = getDb();

  // Find the suggestion
  const suggestions = await db
    .select()
    .from(suggestedActions)
    .where(and(
      eq(suggestedActions.clientId, clientId),
      eq(suggestedActions.status, 'pending')
    ));

  const suggestion = suggestions.find(s => s.id.startsWith(shortId));

  if (!suggestion) {
    return { handled: true, action: 'suggestion_not_found' };
  }

  if (approved) {
    // Update suggestion
    await db
      .update(suggestedActions)
      .set({
        status: 'approved',
        respondedAt: new Date(),
        respondedBy: 'sms',
      })
      .where(eq(suggestedActions.id, suggestion.id));

    // Start the flow execution
    const { startFlowExecution } = await import('./flow-execution');
    await startFlowExecution(
      suggestion.flowId!,
      suggestion.leadId!,
      suggestion.clientId!,
      'ai_suggested'
    );

    return { handled: true, action: 'flow_approved' };
  } else {
    // Reject
    await db
      .update(suggestedActions)
      .set({
        status: 'rejected',
        respondedAt: new Date(),
        respondedBy: 'sms',
      })
      .where(eq(suggestedActions.id, suggestion.id));

    return { handled: true, action: 'flow_rejected' };
  }
}
