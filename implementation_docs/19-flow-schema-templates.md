# Phase 14a: Flow Schema with Templates

## Prerequisites
- Phase 12 (Client Dashboard) complete
- Existing hardcoded sequences working

## Goal
Database-driven flow system with:
1. **Flow Templates** - Admin-managed reusable sequences
2. **Client Flows** - Template-linked or fully custom
3. **Inheritance System** - Batch updates with client overrides
4. **AI Triggering** - Signal-based suggestions

---

## Step 1: Create Template Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// FLOW TEMPLATES (Admin-managed)
// ============================================
export const flowCategoryEnum = pgEnum('flow_category', [
  'missed_call',
  'form_response', 
  'estimate',
  'appointment',
  'payment',
  'review',
  'referral',
  'custom',
]);

export const flowTemplates = pgTable('flow_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Identity
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull().unique(), // e.g., "estimate-standard"
  description: text('description'),
  category: flowCategoryEnum('category').notNull(),
  
  // Versioning
  version: integer('version').default(1),
  isPublished: boolean('is_published').default(false),
  publishedAt: timestamp('published_at'),
  
  // Defaults for client flows
  defaultTrigger: flowTriggerEnum('default_trigger').default('manual'),
  defaultApprovalMode: flowApprovalEnum('default_approval_mode').default('auto'),
  
  // Metadata
  usageCount: integer('usage_count').default(0), // How many clients use this
  tags: jsonb('tags').$type<string[]>(),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const flowTemplateSteps = pgTable('flow_template_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
  
  // Step config
  stepNumber: integer('step_number').notNull(),
  name: varchar('name', { length: 100 }), // "Initial contact", "Follow-up 1"
  delayMinutes: integer('delay_minutes').default(0),
  
  // Message
  messageTemplate: text('message_template').notNull(),
  
  // Conditions (optional)
  skipConditions: jsonb('skip_conditions').$type<{
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
    custom?: string;
  }>(),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Version history for templates
export const flowTemplateVersions = pgTable('flow_template_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  
  // Snapshot of template at this version
  snapshot: jsonb('snapshot').$type<{
    name: string;
    steps: Array<{
      stepNumber: number;
      delayMinutes: number;
      messageTemplate: string;
    }>;
  }>(),
  
  changeNotes: text('change_notes'),
  publishedAt: timestamp('published_at').defaultNow(),
  publishedBy: uuid('published_by'),
});
```

---

## Step 2: Create Client Flow Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// CLIENT FLOWS
// ============================================
export const flowTriggerEnum = pgEnum('flow_trigger', [
  'webhook',        // Auto on event (missed call, form)
  'scheduled',      // Auto on schedule (appointment reminder)
  'manual',         // Button click
  'ai_suggested',   // AI detects signal, suggests
]);

export const flowApprovalEnum = pgEnum('flow_approval', [
  'auto',           // Execute immediately
  'suggest',        // Show in CRM, no notification
  'ask_sms',        // Send SMS asking for approval
]);

export const flowSyncModeEnum = pgEnum('flow_sync_mode', [
  'inherit',        // 100% from template, gets all updates
  'override',       // Template + customizations, partial updates
  'detached',       // Was template, now independent, no updates
]);

export const flows = pgTable('flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Identity
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: flowCategoryEnum('category').notNull(),
  
  // Template linking
  templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'set null' }),
  templateVersion: integer('template_version'), // Last synced version
  syncMode: flowSyncModeEnum('sync_mode').default('inherit'),
  
  // Trigger config
  trigger: flowTriggerEnum('trigger').notNull().default('manual'),
  approvalMode: flowApprovalEnum('approval_mode').default('auto'),
  
  // AI trigger conditions (for ai_suggested trigger)
  aiTriggerConditions: jsonb('ai_trigger_conditions').$type<{
    signals: string[];      // ['satisfaction', 'ready_to_schedule']
    minConfidence: number;  // 0-100
    keywords?: string[];
  }>(),
  
  // Status
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(0), // Higher = checked first for AI
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const flowSteps = pgTable('flow_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),
  
  // Template linking
  templateStepId: uuid('template_step_id').references(() => flowTemplateSteps.id, { onDelete: 'set null' }),
  
  // Step config
  stepNumber: integer('step_number').notNull(),
  name: varchar('name', { length: 100 }),
  
  // Delay - use custom or fall back to template
  useTemplateDelay: boolean('use_template_delay').default(true),
  customDelayMinutes: integer('custom_delay_minutes'),
  
  // Message - use custom or fall back to template
  useTemplateMessage: boolean('use_template_message').default(true),
  customMessage: text('custom_message'),
  
  // Conditions
  skipConditions: jsonb('skip_conditions').$type<{
    ifReplied?: boolean;
    ifScheduled?: boolean;
    ifPaid?: boolean;
    custom?: string;
  }>(),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Index for quick template lookup
export const flowsTemplateIdx = index('flows_template_idx').on(flows.templateId);
export const flowsClientIdx = index('flows_client_idx').on(flows.clientId);
```

---

## Step 3: Create Flow Execution Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// FLOW EXECUTION TRACKING
// ============================================
export const flowExecutions = pgTable('flow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Status
  status: varchar('status', { length: 20 }).default('active'), 
  // active, completed, cancelled, paused
  
  currentStep: integer('current_step').default(1),
  totalSteps: integer('total_steps'),
  
  // Timing
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: varchar('cancel_reason', { length: 255 }),
  nextStepAt: timestamp('next_step_at'),
  
  // Trigger info
  triggeredBy: varchar('triggered_by', { length: 20 }), // webhook, manual, ai, scheduled
  triggeredByUserId: uuid('triggered_by_user_id'),
  
  // Approval (for ask_sms mode)
  approvalStatus: varchar('approval_status', { length: 20 }), // pending, approved, rejected
  approvalRequestedAt: timestamp('approval_requested_at'),
  approvalRespondedAt: timestamp('approval_responded_at'),
  approvedBy: varchar('approved_by', { length: 255 }),
  
  // Context
  metadata: jsonb('metadata').$type<Record<string, any>>(),
});

export const flowStepExecutions = pgTable('flow_step_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  flowExecutionId: uuid('flow_execution_id').references(() => flowExecutions.id, { onDelete: 'cascade' }),
  flowStepId: uuid('flow_step_id').references(() => flowSteps.id, { onDelete: 'set null' }),
  
  stepNumber: integer('step_number').notNull(),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'),
  // pending, scheduled, sent, skipped, failed
  
  // Timing
  scheduledAt: timestamp('scheduled_at'),
  executedAt: timestamp('executed_at'),
  
  // Message sent
  messageContent: text('message_content'),
  messageSid: varchar('message_sid', { length: 50 }), // Twilio SID
  
  // Skip reason if skipped
  skipReason: varchar('skip_reason', { length: 100 }),
  
  // Error if failed
  error: text('error'),
  retryCount: integer('retry_count').default(0),
});

// AI Suggested Actions Queue
export const suggestedActions = pgTable('suggested_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),
  
  // Detection
  detectedSignal: varchar('detected_signal', { length: 100 }),
  confidence: integer('confidence'), // 0-100
  reason: text('reason'), // Human-readable explanation
  triggerMessageId: uuid('trigger_message_id'), // Message that triggered this
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'),
  // pending, approved, rejected, expired
  
  // Timing
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  respondedAt: timestamp('responded_at'),
  respondedBy: varchar('responded_by', { length: 255 }),
  
  // If executed
  flowExecutionId: uuid('flow_execution_id').references(() => flowExecutions.id),
});

// Indexes
export const flowExecutionsLeadIdx = index('flow_executions_lead_idx').on(flowExecutions.leadId);
export const flowExecutionsStatusIdx = index('flow_executions_status_idx').on(flowExecutions.status);
export const suggestedActionsLeadIdx = index('suggested_actions_lead_idx').on(suggestedActions.leadId);
export const suggestedActionsStatusIdx = index('suggested_actions_status_idx').on(suggestedActions.status);
```

---

## Step 4: Create Template Service

**CREATE** `src/lib/services/flow-templates.ts`:

```typescript
import { db } from '@/lib/db';
import { 
  flowTemplates, 
  flowTemplateSteps, 
  flowTemplateVersions,
  flows,
  flowSteps 
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

interface TemplateStep {
  stepNumber: number;
  name?: string;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions?: object;
}

interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  category: string;
  defaultTrigger?: string;
  defaultApprovalMode?: string;
  steps: TemplateStep[];
  tags?: string[];
}

/**
 * Create a new flow template
 */
export async function createTemplate(input: CreateTemplateInput) {
  const [template] = await db
    .insert(flowTemplates)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category as any,
      defaultTrigger: (input.defaultTrigger as any) || 'manual',
      defaultApprovalMode: (input.defaultApprovalMode as any) || 'auto',
      tags: input.tags,
      version: 1,
      isPublished: false,
    })
    .returning();

  // Create steps
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
  await db
    .update(flowTemplateSteps)
    .set(updates)
    .where(eq(flowTemplateSteps.id, stepId));
}

/**
 * Add step to template
 */
export async function addTemplateStep(
  templateId: string,
  step: TemplateStep
) {
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
 * Delete step from template
 */
export async function deleteTemplateStep(stepId: string) {
  // Get step to find template and renumber
  const [step] = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.id, stepId))
    .limit(1);
  
  if (!step) return;
  
  await db.delete(flowTemplateSteps).where(eq(flowTemplateSteps.id, stepId));
  
  // Renumber remaining steps
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
  // Get current template with steps
  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then(r => r[0]);

  if (!template) throw new Error('Template not found');

  const steps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  const newVersion = template.version + 1;

  // Create version snapshot
  await db.insert(flowTemplateVersions).values({
    templateId,
    version: newVersion,
    snapshot: {
      name: template.name,
      steps: steps.map(s => ({
        stepNumber: s.stepNumber,
        delayMinutes: s.delayMinutes || 0,
        messageTemplate: s.messageTemplate,
      })),
    },
    changeNotes,
    publishedBy,
  });

  // Update template
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
  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then(r => r[0]);

  if (!template) throw new Error('Template not found');

  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  // Get all flows using this template
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
    // Skip detached flows
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

    // Skip if already on latest version
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
      // Update flow
      await db
        .update(flows)
        .set({
          templateVersion: template.version,
          updatedAt: new Date(),
        })
        .where(eq(flows.id, flow.id));

      // For 'inherit' mode, update all steps that use template
      if (flow.syncMode === 'inherit') {
        // Delete existing steps and recreate from template
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

      // For 'override' mode, only update steps that use template values
      if (flow.syncMode === 'override') {
        const existingSteps = await db
          .select()
          .from(flowSteps)
          .where(eq(flowSteps.flowId, flow.id));

        for (const tStep of templateSteps) {
          const existing = existingSteps.find(
            s => s.templateStepId === tStep.id || s.stepNumber === tStep.stepNumber
          );

          if (!existing) {
            // New step from template
            await db.insert(flowSteps).values({
              flowId: flow.id,
              templateStepId: tStep.id,
              stepNumber: tStep.stepNumber,
              name: tStep.name,
              useTemplateDelay: true,
              useTemplateMessage: true,
            });
          }
          // Existing step - template values auto-resolved at runtime
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

  // Update usage count
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
    trigger?: string;
    approvalMode?: string;
  } = {}
) {
  const template = await db
    .select()
    .from(flowTemplates)
    .where(eq(flowTemplates.id, templateId))
    .limit(1)
    .then(r => r[0]);

  if (!template) throw new Error('Template not found');

  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, templateId))
    .orderBy(flowTemplateSteps.stepNumber);

  // Create flow
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
      trigger: (options.trigger as any) || template.defaultTrigger,
      approvalMode: (options.approvalMode as any) || template.defaultApprovalMode,
    })
    .returning();

  // Create steps linked to template
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

  // Increment template usage
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
    category: string;
    trigger?: string;
    approvalMode?: string;
    steps: TemplateStep[];
  }
) {
  const [flow] = await db
    .insert(flows)
    .values({
      clientId,
      name: input.name,
      description: input.description,
      category: input.category as any,
      syncMode: 'detached', // No template
      trigger: (input.trigger as any) || 'manual',
      approvalMode: (input.approvalMode as any) || 'auto',
    })
    .returning();

  // Create steps
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
  const flow = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1)
    .then(r => r[0]);

  if (!flow?.templateId) throw new Error('Flow not linked to template');

  // Get template steps for current values
  const templateSteps = await db
    .select()
    .from(flowTemplateSteps)
    .where(eq(flowTemplateSteps.templateId, flow.templateId));

  const templateStepMap = new Map(templateSteps.map(s => [s.id, s]));

  // Get flow steps
  const steps = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.flowId, flowId));

  // Convert each step to custom values
  for (const step of steps) {
    const tStep = step.templateStepId 
      ? templateStepMap.get(step.templateStepId)
      : null;

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

  // Update flow
  await db
    .update(flows)
    .set({
      syncMode: 'detached',
      updatedAt: new Date(),
    })
    .where(eq(flows.id, flowId));

  // Decrement template usage
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
```

---

## Step 5: Create Flow Step Resolution Service

**CREATE** `src/lib/services/flow-resolution.ts`:

```typescript
import { db } from '@/lib/db';
import { flows, flowSteps, flowTemplateSteps } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface ResolvedStep {
  id: string;
  stepNumber: number;
  name: string | null;
  delayMinutes: number;
  messageTemplate: string;
  skipConditions: object | null;
  source: 'template' | 'custom' | 'mixed';
}

/**
 * Resolve flow steps with template fallbacks
 * Returns the actual values to use for each step
 */
export async function resolveFlowSteps(flowId: string): Promise<ResolvedStep[]> {
  const flow = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1)
    .then(r => r[0]);

  if (!flow) throw new Error('Flow not found');

  const steps = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.flowId, flowId))
    .orderBy(flowSteps.stepNumber);

  // Get template steps if linked
  let templateStepMap = new Map<string, typeof flowTemplateSteps.$inferSelect>();
  
  if (flow.templateId) {
    const templateSteps = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.templateId, flow.templateId));
    
    templateStepMap = new Map(templateSteps.map(s => [s.id, s]));
  }

  return steps.map(step => {
    const templateStep = step.templateStepId 
      ? templateStepMap.get(step.templateStepId)
      : null;

    // Resolve delay
    const delayMinutes = step.useTemplateDelay && templateStep
      ? templateStep.delayMinutes || 0
      : step.customDelayMinutes || 0;

    // Resolve message
    const messageTemplate = step.useTemplateMessage && templateStep
      ? templateStep.messageTemplate
      : step.customMessage || '';

    // Determine source
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
      skipConditions: step.skipConditions || templateStep?.skipConditions || null,
      source,
    };
  });
}

/**
 * Get effective message for a step with variable substitution
 */
export async function getStepMessage(
  stepId: string,
  variables: Record<string, string>
): Promise<string> {
  const step = await db
    .select()
    .from(flowSteps)
    .where(eq(flowSteps.id, stepId))
    .limit(1)
    .then(r => r[0]);

  if (!step) throw new Error('Step not found');

  let template: string;

  if (step.useTemplateMessage && step.templateStepId) {
    const tStep = await db
      .select()
      .from(flowTemplateSteps)
      .where(eq(flowTemplateSteps.id, step.templateStepId))
      .limit(1)
      .then(r => r[0]);
    
    template = tStep?.messageTemplate || '';
  } else {
    template = step.customMessage || '';
  }

  // Substitute variables
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  return message;
}

/**
 * Format delay for display
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
```

---

## Step 6: Seed Default Templates

**CREATE** `src/lib/db/seed-flow-templates.ts`:

```typescript
import { db } from '@/lib/db';
import { flowTemplates, flowTemplateSteps } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createTemplate, publishTemplate } from '@/lib/services/flow-templates';

const DEFAULT_TEMPLATES = [
  {
    name: 'Estimate Follow-up - Standard',
    slug: 'estimate-standard',
    description: 'Standard 4-step estimate follow-up over 14 days',
    category: 'estimate',
    defaultTrigger: 'manual',
    defaultApprovalMode: 'auto',
    tags: ['estimate', 'sales'],
    steps: [
      {
        stepNumber: 1,
        name: 'Initial follow-up',
        delayMinutes: 0,
        messageTemplate: "Hi {name}! Thanks for requesting an estimate from {business_name}. We've sent it to your email. Any questions, just reply here!",
      },
      {
        stepNumber: 2,
        name: 'Day 2 check-in',
        delayMinutes: 2 * 24 * 60,
        messageTemplate: "Hi {name}, just checking in on the estimate we sent. Happy to answer any questions or adjust the scope if needed!",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Day 5 follow-up',
        delayMinutes: 3 * 24 * 60,
        messageTemplate: "Hey {name}! Wanted to make sure you got our estimate. If you're comparing quotes, we'd love the chance to earn your business. Any questions?",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 4,
        name: 'Day 14 final',
        delayMinutes: 9 * 24 * 60,
        messageTemplate: "Hi {name}, this is our last follow-up on your estimate. It expires soon, so let us know if you'd like to move forward. Thanks for considering {business_name}!",
        skipConditions: { ifReplied: true, ifScheduled: true },
      },
    ],
  },
  {
    name: 'Estimate Follow-up - Aggressive',
    slug: 'estimate-aggressive',
    description: 'Faster 4-step follow-up over 7 days for urgent leads',
    category: 'estimate',
    defaultTrigger: 'manual',
    defaultApprovalMode: 'auto',
    tags: ['estimate', 'sales', 'urgent'],
    steps: [
      {
        stepNumber: 1,
        name: 'Immediate',
        delayMinutes: 0,
        messageTemplate: "Hi {name}! Your estimate from {business_name} is ready. Check your email! Reply here with any questions.",
      },
      {
        stepNumber: 2,
        name: 'Day 1',
        delayMinutes: 24 * 60,
        messageTemplate: "Hey {name}! Did you get a chance to review the estimate? I'm here if you have questions.",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 3,
        name: 'Day 3',
        delayMinutes: 2 * 24 * 60,
        messageTemplate: "{name}, just following up! Ready to get your project scheduled when you are.",
        skipConditions: { ifReplied: true },
      },
      {
        stepNumber: 4,
        name: 'Day 7',
        delayMinutes: 4 * 24 * 60,
        messageTemplate: "Last check-in, {name}! Let me know if you'd like to move forward or if anything's holding you back.",
        skipConditions: { ifReplied: true, ifScheduled: true },
      },
    ],
  },
  {
    name: 'Payment Reminder - Friendly',
    slug: 'payment-friendly',
    description: 'Friendly 4-step payment reminder over 21 days',
    category: 'payment',
    defaultTrigger: 'manual',
    defaultApprovalMode: 'ask_sms',
    tags: ['payment', 'invoice'],
    steps: [
      {
        stepNumber: 1,
        name: 'Invoice sent',
        delayMinutes: 0,
        messageTemplate: "Hi {name}! Your invoice of {amount} is ready. Pay easily here: {payment_link}",
      },
      {
        stepNumber: 2,
        name: 'Due date reminder',
        delayMinutes: 7 * 24 * 60,
        messageTemplate: "Friendly reminder: Your invoice of {amount} is due soon. Pay here: {payment_link}",
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 3,
        name: 'Past due',
        delayMinutes: 7 * 24 * 60,
        messageTemplate: "Hi {name}, your balance of {amount} is past due. Please pay when you can: {payment_link}",
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 4,
        name: 'Final notice',
        delayMinutes: 7 * 24 * 60,
        messageTemplate: "Final notice: Please pay your balance of {amount} to avoid further action. {payment_link}",
        skipConditions: { ifPaid: true },
      },
    ],
  },
  {
    name: 'Payment Reminder - Firm',
    slug: 'payment-firm',
    description: 'Firmer 4-step payment reminder over 14 days',
    category: 'payment',
    defaultTrigger: 'manual',
    defaultApprovalMode: 'ask_sms',
    tags: ['payment', 'invoice', 'firm'],
    steps: [
      {
        stepNumber: 1,
        name: 'Invoice sent',
        delayMinutes: 0,
        messageTemplate: "Hi {name}, your invoice of {amount} is ready for payment: {payment_link}",
      },
      {
        stepNumber: 2,
        name: 'Day 3 reminder',
        delayMinutes: 3 * 24 * 60,
        messageTemplate: "Reminder: Invoice #{invoice_number} for {amount} is due {due_date}. Pay now: {payment_link}",
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 3,
        name: 'Past due notice',
        delayMinutes: 4 * 24 * 60,
        messageTemplate: "PAST DUE: Your balance of {amount} requires immediate attention. {payment_link}",
        skipConditions: { ifPaid: true },
      },
      {
        stepNumber: 4,
        name: 'Final warning',
        delayMinutes: 7 * 24 * 60,
        messageTemplate: "FINAL NOTICE: {amount} is significantly past due. Pay immediately to avoid collection action: {payment_link}",
        skipConditions: { ifPaid: true },
      },
    ],
  },
  {
    name: 'Review Request - Simple',
    slug: 'review-simple',
    description: 'Single review request after job completion',
    category: 'review',
    defaultTrigger: 'ai_suggested',
    defaultApprovalMode: 'ask_sms',
    tags: ['review', 'reputation'],
    steps: [
      {
        stepNumber: 1,
        name: 'Review request',
        delayMinutes: 24 * 60,
        messageTemplate: "Hi {name}! Thanks for choosing {business_name}. If you're happy with our work, would you mind leaving us a quick review? {review_link} - It really helps!",
      },
    ],
  },
  {
    name: 'Review Request + Reminder',
    slug: 'review-with-reminder',
    description: 'Review request with follow-up reminder',
    category: 'review',
    defaultTrigger: 'ai_suggested',
    defaultApprovalMode: 'ask_sms',
    tags: ['review', 'reputation'],
    steps: [
      {
        stepNumber: 1,
        name: 'Initial request',
        delayMinutes: 24 * 60,
        messageTemplate: "Hi {name}! Thanks for choosing {business_name}. We'd love your feedback! {review_link}",
      },
      {
        stepNumber: 2,
        name: 'Reminder',
        delayMinutes: 3 * 24 * 60,
        messageTemplate: "Hey {name}, just a gentle reminder - your review would mean a lot to us! {review_link} Thanks!",
      },
    ],
  },
  {
    name: 'Referral Request',
    slug: 'referral-standard',
    description: 'Referral request after positive interaction',
    category: 'referral',
    defaultTrigger: 'ai_suggested',
    defaultApprovalMode: 'ask_sms',
    tags: ['referral', 'growth'],
    steps: [
      {
        stepNumber: 1,
        name: 'Referral ask',
        delayMinutes: 3 * 24 * 60,
        messageTemplate: "Hi {name}! Glad you're happy with our work. If you know anyone who needs {service_type}, we'd appreciate a referral! We offer ${referral_bonus} for every referral that books.",
      },
    ],
  },
  {
    name: 'Appointment Reminder',
    slug: 'appointment-reminder',
    description: 'Confirmation + day-before reminder',
    category: 'appointment',
    defaultTrigger: 'scheduled',
    defaultApprovalMode: 'auto',
    tags: ['appointment', 'scheduling'],
    steps: [
      {
        stepNumber: 1,
        name: 'Confirmation',
        delayMinutes: 0,
        messageTemplate: "Your appointment with {business_name} is confirmed for {appointment_date} at {appointment_time}. Reply YES to confirm or call us to reschedule.",
      },
      {
        stepNumber: 2,
        name: 'Day before',
        delayMinutes: -24 * 60,
        messageTemplate: "Reminder: Your appointment with {business_name} is tomorrow at {appointment_time}. See you then!",
      },
    ],
  },
];

export async function seedDefaultTemplates() {
  for (const templateData of DEFAULT_TEMPLATES) {
    // Check if already exists
    const existing = await db
      .select()
      .from(flowTemplates)
      .where(eq(flowTemplates.slug, templateData.slug))
      .limit(1);

    if (existing.length > 0) {
      console.log(`Template "${templateData.slug}" already exists, skipping`);
      continue;
    }

    const template = await createTemplate(templateData as any);
    await publishTemplate(template.id, 'Initial version');
    console.log(`Created template: ${templateData.name}`);
  }

  console.log('Default templates seeded!');
}

// Run if called directly
if (require.main === module) {
  seedDefaultTemplates()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
```

---

## Step 7: Run Migration

```bash
npx drizzle-kit generate
npx drizzle-kit migrate

# Seed templates
npx tsx src/lib/db/seed-flow-templates.ts
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add template + flow tables |
| `src/lib/services/flow-templates.ts` | Created |
| `src/lib/services/flow-resolution.ts` | Created |
| `src/lib/db/seed-flow-templates.ts` | Created |

---

## Verification

```bash
# 1. Check tables created
npx drizzle-kit studio

# 2. Verify templates seeded
SELECT * FROM flow_templates;
SELECT * FROM flow_template_steps ORDER BY template_id, step_number;

# 3. Create flow from template via API (Phase 14b)
```

## Success Criteria
- [ ] Template tables created
- [ ] Client flow tables with template linking
- [ ] Execution tracking tables
- [ ] Default templates seeded (8 templates)
- [ ] Template → client flow creation works
- [ ] Push update logic handles sync modes
- [ ] Step resolution returns correct values
