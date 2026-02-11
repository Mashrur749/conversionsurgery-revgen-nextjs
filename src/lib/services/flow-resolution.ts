import { getDb } from '@/db';
import { flows, flowSteps, flowTemplateSteps } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface ResolvedStep {
  id: string;
  stepNumber: number;
  name: string | null;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions: {
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
    custom?: string;
  } | null;
  source: 'template' | 'custom' | 'mixed';
}

/**
 * Resolve flow steps with template fallbacks
 * Returns the actual values to use for each step by merging flow and template data
 * @param flowId - Flow ID
 * @returns Array of resolved steps with computed values
 */
export async function resolveFlowSteps(flowId: string): Promise<ResolvedStep[]> {
  const db = getDb();

  const flow = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1)
    .then((r) => r[0]);

  if (!flow) throw new Error('Flow not found');

  const steps = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.flowId, flowId))
    .orderBy(flowSteps.stepNumber);

  let templateStepMap = new Map<string, typeof flowTemplateSteps.$inferSelect>();

  if (flow.templateId) {
    const templateSteps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, flow.templateId));

    templateStepMap = new Map(templateSteps.map((s) => [s.id, s]));
  }

  return steps.map((step) => {
    const templateStep = step.templateStepId
      ? templateStepMap.get(step.templateStepId)
      : null;

    const delayMinutes =
      step.useTemplateDelay && templateStep
        ? templateStep.delayMinutes || 0
        : step.customDelayMinutes || 0;

    const messageTemplate =
      step.useTemplateMessage && templateStep
        ? templateStep.messageTemplate
        : step.customMessage || '';

    let source: 'template' | 'custom' | 'mixed' = 'custom';
    if (step.useTemplateDelay && step.useTemplateMessage && templateStep) {
      source = 'template';
    } else if ((step.useTemplateDelay || step.useTemplateMessage) && templateStep) {
      source = 'mixed';
    }

    return {
      id: step.id,
      stepNumber: step.stepNumber,
      name: step.name || templateStep?.name || null,
      delayMinutes,
      messageTemplate,
      skipConditions: (step.skipConditions || templateStep?.skipConditions || null) as ResolvedStep['skipConditions'],
      source,
    };
  });
}

/**
 * Get effective message for a step with variable substitution
 * @param stepId - Flow step ID
 * @param variables - Variables to substitute in template (e.g., {name}, {business_name})
 * @returns Processed message with variables replaced
 */
export async function getStepMessage(
  stepId: string,
  variables: Record<string, string>
): Promise<string> {
  const db = getDb();

  const step = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.id, stepId))
    .limit(1)
    .then((r) => r[0]);

  if (!step) throw new Error('Step not found');

  let template: string;

  if (step.useTemplateMessage && step.templateStepId) {
    const tStep = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.id, step.templateStepId))
      .limit(1)
      .then((r) => r[0]);

    template = tStep?.messageTemplate || '';
  } else {
    template = step.customMessage || '';
  }

  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  return message;
}

/**
 * Format delay in minutes for human-readable display
 * @param minutes - Delay in minutes
 * @returns Human-readable delay string (e.g., "1 day", "2 hours", "30 minutes")
 */
export function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately';
  if (minutes < 0) return `${Math.abs(minutes / 60)} hours before`;

  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return `${minutes} minutes`;
}
