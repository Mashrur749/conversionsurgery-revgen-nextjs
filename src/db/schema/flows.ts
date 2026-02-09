import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { flowTemplates, flowTemplateSteps } from './flow-templates';
import {
  flowCategoryEnum,
  flowTriggerEnum,
  flowApprovalEnum,
  flowSyncModeEnum,
} from './flow-enums';

export const flows = pgTable(
  'flows',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),

    // Identity
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    category: flowCategoryEnum('category').notNull(),

    // Template linking
    templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'set null' }),
    templateVersion: integer('template_version'),
    syncMode: flowSyncModeEnum('sync_mode').default('inherit'),

    // Trigger config
    trigger: flowTriggerEnum('trigger').notNull().default('manual'),
    approvalMode: flowApprovalEnum('approval_mode').default('auto'),

    // AI trigger conditions (for ai_suggested trigger)
    aiTriggerConditions: jsonb('ai_trigger_conditions').$type<{
      signals: string[];
      minConfidence: number;
      keywords?: string[];
    }>(),

    // Status
    isActive: boolean('is_active').default(true),
    priority: integer('priority').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('flows_template_idx').on(table.templateId),
    index('flows_client_idx').on(table.clientId),
  ]
);

export const flowSteps = pgTable('flow_steps', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),

  // Template linking
  templateStepId: uuid('template_step_id').references(() => flowTemplateSteps.id, {
    onDelete: 'set null',
  }),

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

export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;
export type FlowStep = typeof flowSteps.$inferSelect;
export type NewFlowStep = typeof flowSteps.$inferInsert;
