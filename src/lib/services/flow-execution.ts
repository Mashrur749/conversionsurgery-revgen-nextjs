import { getDb } from '@/db';
import { flowExecutions, flowStepExecutions, flows, leads, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveFlowSteps } from './flow-resolution';
import { sendSMS } from './twilio';
import {
  recordExecutionStart,
  recordStepMessageSent,
  updateClientOutcomes,
} from './flow-metrics';
import { format } from 'date-fns';

interface Lead {
  id: string;
  phone: string;
  name?: string | null;
}

interface Client {
  twilioNumber: string | null;
}

/**
 * Start executing a flow for a lead
 * Creates a flow execution record and schedules or executes first step
 * @param flowId - Flow ID to execute
 * @param leadId - Lead ID
 * @param clientId - Client ID
 * @param triggeredBy - Trigger source (manual, ai_suggested, etc.)
 * @returns Execution ID
 */
export async function startFlowExecution(
  flowId: string,
  leadId: string,
  clientId: string,
  triggeredBy: string
): Promise<{ executionId: string }> {
  const db = getDb();

  // Resolve the steps for this flow
  const steps = await resolveFlowSteps(flowId);

  if (steps.length === 0) {
    throw new Error('Flow has no steps');
  }

  // Look up the flow to get templateId for metrics
  const [flow] = await db
    .select({ templateId: flows.templateId })
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1);

  const templateId = flow?.templateId || null;

  // Create the execution record
  const [execution] = await db
    .insert(flowExecutions)
    .values({
      flowId,
      leadId,
      clientId,
      status: 'active',
      currentStep: 1,
      totalSteps: steps.length,
      triggeredBy,
    })
    .returning();

  // Record metrics for execution start
  await recordExecutionStart(templateId).catch(console.error);

  // Update client outcomes: lead contacted
  await updateClientOutcomes(
    clientId,
    flowId,
    format(new Date(), 'yyyy-MM'),
    { leadsContacted: 1 }
  ).catch(console.error);

  // Get lead and client for variable substitution
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // Execute the first step immediately if delay is 0
  const firstStep = steps[0];
  const variables: Record<string, string> = {
    leadName: lead?.name || 'there',
    leadPhone: lead?.phone || '',
    businessName: client?.businessName || '',
    ownerName: client?.ownerName || '',
  };

  // Substitute variables in message template
  let messageContent = firstStep.messageTemplate;
  for (const [key, value] of Object.entries(variables)) {
    messageContent = messageContent.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  if (firstStep.delayMinutes === 0) {
    // Execute immediately
    await executeStep(execution.id, firstStep, messageContent, lead, client, templateId);
  } else {
    // Schedule for later
    const scheduledAt = new Date();
    scheduledAt.setMinutes(scheduledAt.getMinutes() + firstStep.delayMinutes);

    await db.insert(flowStepExecutions).values({
      flowExecutionId: execution.id,
      flowStepId: firstStep.id,
      stepNumber: firstStep.stepNumber,
      status: 'scheduled',
      scheduledAt,
      messageContent,
    });

    await db
      .update(flowExecutions)
      .set({ nextStepAt: scheduledAt })
      .where(eq(flowExecutions.id, execution.id));
  }

  return { executionId: execution.id };
}

/**
 * Execute a single flow step
 * @param executionId - Flow execution ID
 * @param step - Step configuration
 * @param messageContent - Processed message content with variables substituted
 * @param lead - Lead record
 * @param client - Client record
 * @param templateId - Optional template ID for metrics
 */
async function executeStep(
  executionId: string,
  step: { id: string; stepNumber: number; name: string | null },
  messageContent: string,
  lead: Lead | undefined,
  client: Client | undefined,
  templateId: string | null = null
): Promise<void> {
  const db = getDb();

  console.log('[FlowEngine] Executing step', step.stepNumber, 'for execution', executionId);

  if (!lead?.phone || !client?.twilioNumber || !messageContent) {
    console.log('[FlowEngine] Skipping step:', !lead?.phone ? 'no lead phone' : !client?.twilioNumber ? 'no twilio number' : 'no message content');
    await db.insert(flowStepExecutions).values({
      flowExecutionId: executionId,
      flowStepId: step.id,
      stepNumber: step.stepNumber,
      status: 'skipped',
      skipReason: 'Missing phone or message',
      executedAt: new Date(),
    });
    return;
  }

  let smsSid: string | null = null;
  let smsError: string | null = null;

  try {
    smsSid = await sendSMS(lead.phone, messageContent, client.twilioNumber);
  } catch (error) {
    smsError = String(error);
  }

  await db.insert(flowStepExecutions).values({
    flowExecutionId: executionId,
    flowStepId: step.id,
    stepNumber: step.stepNumber,
    status: smsSid ? 'sent' : 'failed',
    executedAt: new Date(),
    messageContent,
    messageSid: smsSid,
    error: smsError,
  });

  if (smsSid) {
    console.log('[FlowEngine] Step executed successfully, message SID:', smsSid);
    await recordStepMessageSent(templateId, step.stepNumber).catch((err) =>
      console.error('[FlowEngine] Failed to record step metric:', err)
    );
  } else {
    console.error('[FlowEngine] Step execution failed:', smsError);
  }
}
