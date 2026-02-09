import {
  getDb,
  flowTemplates,
  flowTemplateSteps,
  flowTemplateVersions,
  flows,
  flowSteps,
} from '@/db';
import { eq } from 'drizzle-orm';

interface TemplateStep {
  stepNumber: number;
  name?: string;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions?: {
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
    custom?: string;
  };
}

interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: 'missed_call' | 'form_response' | 'estimate' | 'appointment' | 'payment' | 'review' | 'referral' | 'custom';
  defaultTrigger?: 'webhook' | 'scheduled' | 'manual' | 'ai_suggested';
  defaultApprovalMode?: 'auto' | 'suggest' | 'ask_sms';
  steps: TemplateStep[];
  tags?: string[];
}

/**
 * Create a new flow template
 */
export async function createTemplate(input: CreateTemplateInput) {
  const db = getDb();

  const [template] = await db
    .insert(flowTemplates)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      defaultTrigger: input.defaultTrigger || 'manual',
      defaultApprovalMode: input.defaultApprovalMode || 'auto',
      tags: input.tags,
      version: 1,
      isPublished: false,
    })
    .returning();

  for (const step of input.steps) {
    await db.insert(flowTemplateSteps).values({
      templateId: template.id,
      stepNumber: step.stepNumber,
      name: step.name,
      delayMinutes: step.delayMinutes,
      messageTemplate: step.messageTemplate,
      skipConditions: step.skipConditions,
    });
  }

  return template;
}

/**
 * Update template step
 */
export async function updateTemplateStep(
  stepId: string,
  updates: Partial<{
    name: string;
    delayMinutes: number;
    messageTemplate: string;
    skipConditions: object;
  }>
) {
  const db = getDb();
  await db
    .update(flowTemplateSteps)
    .set(updates)
    .where(eq(flowTemplateSteps.id, stepId));
}

/**
 * Add step to template
 */
export async function addTemplateStep(templateId: string, step: TemplateStep) {
  const db = getDb();
  const [newStep] = await db
    .insert(flowTemplateSteps)
    .values({
      templateId,
      ...step,
    })
    .returning();

  return newStep;
}

/**
 * Delete step from template and renumber remaining
 */
export async function deleteTemplateStep(stepId: string) {
  const db = getDb();

  const [step] = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.id, stepId))
    .limit(1);

  if (!step) return;

  await db.delete(flowTemplateSteps).where(eq(flowTemplateSteps.id, stepId));

  const remainingSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, step.templateId!))
    .orderBy(flowTemplateSteps.stepNumber);

  for (let i = 0; i < remainingSteps.length; i++) {
    if (remainingSteps[i].stepNumber !== i + 1) {
      await db
        .update(flowTemplateSteps)
        .set({ stepNumber: i + 1 })
        .where(eq(flowTemplateSteps.id, remainingSteps[i].id));
    }
  }
}

/**
 * Publish template and create version snapshot
 */
export async function publishTemplate(
  templateId: string,
  changeNotes?: string,
  publishedBy?: string
) {
  const db = getDb();

  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then((r) => r[0]);

  if (!template) throw new Error('Template not found');

  const steps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  const newVersion = (template.version ?? 1) + 1;

  await db.insert(flowTemplateVersions).values({
    templateId,
    version: newVersion,
    snapshot: {
      name: template.name,
      steps: steps.map((s) => ({
        stepNumber: s.stepNumber,
        delayMinutes: s.delayMinutes || 0,
        messageTemplate: s.messageTemplate,
      })),
    },
    changeNotes,
    publishedBy,
  });

  await db
    .update(flowTemplates)
    .set({
      version: newVersion,
      isPublished: true,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(flowTemplates.id, templateId));

  return newVersion;
}

/**
 * Get clients using a template
 */
export async function getTemplateUsage(templateId: string) {
  const db = getDb();
  return db
    .select({
      flowId: flows.id,
      flowName: flows.name,
      clientId: flows.clientId,
      syncMode: flows.syncMode,
      templateVersion: flows.templateVersion,
    })
    .from(flows)
    .where(eq(flows.templateId, templateId));
}

/**
 * Push template update to clients
 */
export async function pushTemplateUpdate(
  templateId: string,
  options: { dryRun?: boolean } = {}
): Promise<{
  affected: number;
  skipped: number;
  details: Array<{
    clientId: string;
    flowId: string;
    action: 'updated' | 'skipped';
    reason?: string;
  }>;
}> {
  const db = getDb();

  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then((r) => r[0]);

  if (!template) throw new Error('Template not found');

  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  const clientFlows = await db
    .select()
    .from(flows)
    .where(eq(flows.templateId, templateId));

  const details: Array<{
    clientId: string;
    flowId: string;
    action: 'updated' | 'skipped';
    reason?: string;
  }> = [];

  let affected = 0;
  let skipped = 0;

  for (const flow of clientFlows) {
    if (flow.syncMode === 'detached') {
      details.push({
        clientId: flow.clientId!,
        flowId: flow.id,
        action: 'skipped',
        reason: 'Flow is detached from template',
      });
      skipped++;
      continue;
    }

    if (flow.templateVersion === template.version) {
      details.push({
        clientId: flow.clientId!,
        flowId: flow.id,
        action: 'skipped',
        reason: 'Already on latest version',
      });
      skipped++;
      continue;
    }

    if (!options.dryRun) {
      await db
        .update(flows)
        .set({
          templateVersion: template.version,
          updatedAt: new Date(),
        })
        .where(eq(flows.id, flow.id));

      if (flow.syncMode === 'inherit') {
        await db.delete(flowSteps).where(eq(flowSteps.flowId, flow.id));

        for (const tStep of templateSteps) {
          await db.insert(flowSteps).values({
            flowId: flow.id,
            templateStepId: tStep.id,
            stepNumber: tStep.stepNumber,
            name: tStep.name,
            useTemplateDelay: true,
            useTemplateMessage: true,
            skipConditions: tStep.skipConditions,
          });
        }
      }

      if (flow.syncMode === 'override') {
        const existingSteps = await db
          .select()
          .from(flowSteps)
          .where(eq(flowSteps.flowId, flow.id));

        for (const tStep of templateSteps) {
          const existing = existingSteps.find(
            (s) => s.templateStepId === tStep.id || s.stepNumber === tStep.stepNumber
          );

          if (!existing) {
            await db.insert(flowSteps).values({
              flowId: flow.id,
              templateStepId: tStep.id,
              stepNumber: tStep.stepNumber,
              name: tStep.name,
              useTemplateDelay: true,
              useTemplateMessage: true,
            });
          }
        }
      }
    }

    details.push({
      clientId: flow.clientId!,
      flowId: flow.id,
      action: 'updated',
    });
    affected++;
  }

  if (!options.dryRun) {
    await db
      .update(flowTemplates)
      .set({ usageCount: affected + skipped })
      .where(eq(flowTemplates.id, templateId));
  }

  return { affected, skipped, details };
}

/**
 * Create client flow from template
 */
export async function createFlowFromTemplate(
  clientId: string,
  templateId: string,
  options: {
    name?: string;
    syncMode?: 'inherit' | 'override';
    trigger?: 'webhook' | 'scheduled' | 'manual' | 'ai_suggested';
    approvalMode?: 'auto' | 'suggest' | 'ask_sms';
  } = {}
) {
  const db = getDb();

  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then((r) => r[0]);

  if (!template) throw new Error('Template not found');

  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  const [flow] = await db
    .insert(flows)
    .values({
      clientId,
      name: options.name || template.name,
      description: template.description,
      category: template.category,
      templateId,
      templateVersion: template.version,
      syncMode: options.syncMode || 'inherit',
      trigger: options.trigger || template.defaultTrigger || 'manual',
      approvalMode: options.approvalMode || template.defaultApprovalMode || 'auto',
    })
    .returning();

  for (const tStep of templateSteps) {
    await db.insert(flowSteps).values({
      flowId: flow.id,
      templateStepId: tStep.id,
      stepNumber: tStep.stepNumber,
      name: tStep.name,
      useTemplateDelay: true,
      useTemplateMessage: true,
      skipConditions: tStep.skipConditions,
    });
  }

  await db
    .update(flowTemplates)
    .set({ usageCount: (template.usageCount || 0) + 1 })
    .where(eq(flowTemplates.id, templateId));

  return flow;
}

/**
 * Create custom flow (no template)
 */
export async function createCustomFlow(
  clientId: string,
  input: {
    name: string;
    description?: string;
    category: 'missed_call' | 'form_response' | 'estimate' | 'appointment' | 'payment' | 'review' | 'referral' | 'custom';
    trigger?: 'webhook' | 'scheduled' | 'manual' | 'ai_suggested';
    approvalMode?: 'auto' | 'suggest' | 'ask_sms';
    steps: TemplateStep[];
  }
) {
  const db = getDb();

  const [flow] = await db
    .insert(flows)
    .values({
      clientId,
      name: input.name,
      description: input.description,
      category: input.category,
      syncMode: 'detached',
      trigger: input.trigger || 'manual',
      approvalMode: input.approvalMode || 'auto',
    })
    .returning();

  for (const step of input.steps) {
    await db.insert(flowSteps).values({
      flowId: flow.id,
      stepNumber: step.stepNumber,
      name: step.name,
      useTemplateDelay: false,
      customDelayMinutes: step.delayMinutes,
      useTemplateMessage: false,
      customMessage: step.messageTemplate,
      skipConditions: step.skipConditions,
    });
  }

  return flow;
}

/**
 * Detach flow from template (make fully independent)
 */
export async function detachFlowFromTemplate(flowId: string) {
  const db = getDb();

  const flow = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1)
    .then((r) => r[0]);

  if (!flow?.templateId) throw new Error('Flow not linked to template');

  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, flow.templateId));

  const templateStepMap = new Map(templateSteps.map((s) => [s.id, s]));

  const steps = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.flowId, flowId));

  for (const step of steps) {
    const tStep = step.templateStepId ? templateStepMap.get(step.templateStepId) : null;

    await db
      .update(flowSteps)
      .set({
        templateStepId: null,
        useTemplateDelay: false,
        customDelayMinutes: step.useTemplateDelay
          ? tStep?.delayMinutes || 0
          : step.customDelayMinutes,
        useTemplateMessage: false,
        customMessage: step.useTemplateMessage
          ? tStep?.messageTemplate || ''
          : step.customMessage,
      })
      .where(eq(flowSteps.id, step.id));
  }

  await db
    .update(flows)
    .set({
      syncMode: 'detached',
      updatedAt: new Date(),
    })
    .where(eq(flows.id, flowId));

  const [template] = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, flow.templateId))
    .limit(1);

  if (template) {
    await db
      .update(flowTemplates)
      .set({ usageCount: Math.max(0, (template.usageCount || 1) - 1) })
      .where(eq(flowTemplates.id, flow.templateId));
  }
}
