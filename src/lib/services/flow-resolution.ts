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

