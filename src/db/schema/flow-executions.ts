import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';
import { flows, flowSteps } from './flows';

export const flowExecutions = pgTable(
  'flow_executions',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'set null' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),

    // Status: active, completed, cancelled, paused
    status: varchar('status', { length: 20 }).default('active'),

    currentStep: integer('current_step').default(1),
    totalSteps: integer('total_steps'),

    // Timing
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancelReason: varchar('cancel_reason', { length: 255 }),
    nextStepAt: timestamp('next_step_at'),

    // Trigger info
    triggeredBy: varchar('triggered_by', { length: 20 }),
    triggeredByUserId: uuid('triggered_by_user_id'),

    // Approval (for ask_sms mode)
    approvalStatus: varchar('approval_status', { length: 20 }),
    approvalRequestedAt: timestamp('approval_requested_at'),
    approvalRespondedAt: timestamp('approval_responded_at'),
    approvedBy: varchar('approved_by', { length: 255 }),

    // Context
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('flow_executions_lead_idx').on(table.leadId),
    index('flow_executions_status_idx').on(table.status),
    index('flow_executions_client_idx').on(table.clientId),
  ]
);

export const flowStepExecutions = pgTable('flow_step_executions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  flowExecutionId: uuid('flow_execution_id').references(() => flowExecutions.id, {
    onDelete: 'cascade',
  }),
  flowStepId: uuid('flow_step_id').references(() => flowSteps.id, { onDelete: 'set null' }),

  stepNumber: integer('step_number').notNull(),

  // Status: pending, scheduled, sent, skipped, failed
  status: varchar('status', { length: 20 }).default('pending'),

  // Timing
  scheduledAt: timestamp('scheduled_at'),
  executedAt: timestamp('executed_at'),

  // Message sent
  messageContent: text('message_content'),
  messageSid: varchar('message_sid', { length: 50 }),

  // Skip reason if skipped
  skipReason: varchar('skip_reason', { length: 100 }),

  // Error if failed
  error: text('error'),
  retryCount: integer('retry_count').default(0),
});

export const suggestedActions = pgTable(
  'suggested_actions',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    flowId: uuid('flow_id').references(() => flows.id, { onDelete: 'cascade' }),

    // Detection
    detectedSignal: varchar('detected_signal', { length: 100 }),
    confidence: integer('confidence'),
    reason: text('reason'),
    triggerMessageId: uuid('trigger_message_id'),

    // Status: pending, approved, rejected, expired
    status: varchar('status', { length: 20 }).default('pending'),

    // Timing
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
    respondedAt: timestamp('responded_at'),
    respondedBy: varchar('responded_by', { length: 255 }),

    // If executed
    flowExecutionId: uuid('flow_execution_id').references(() => flowExecutions.id),
  },
  (table) => [
    index('suggested_actions_lead_idx').on(table.leadId),
    index('suggested_actions_status_idx').on(table.status),
  ]
);

export type FlowExecution = typeof flowExecutions.$inferSelect;
export type NewFlowExecution = typeof flowExecutions.$inferInsert;
export type FlowStepExecution = typeof flowStepExecutions.$inferSelect;
export type NewFlowStepExecution = typeof flowStepExecutions.$inferInsert;
export type SuggestedAction = typeof suggestedActions.$inferSelect;
export type NewSuggestedAction = typeof suggestedActions.$inferInsert;
