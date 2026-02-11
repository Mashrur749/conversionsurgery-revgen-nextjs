import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { clients } from './clients';
import { conversations } from './conversations';
import { teamMembers } from './team-members';
import { escalationReasonEnum } from './agent-enums';

/**
 * Escalation Queue — human handoff queue for leads that need personal attention
 */
export const escalationQueue = pgTable(
  'escalation_queue',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Why escalated
    reason: escalationReasonEnum('reason').notNull(),
    reasonDetails: text('reason_details'),
    triggerMessageId: uuid('trigger_message_id').references(
      () => conversations.id
    ),

    // Priority (1=highest, 5=lowest)
    priority: integer('priority').default(3).notNull(),

    // Context for human
    conversationSummary: text('conversation_summary'),
    suggestedResponse: text('suggested_response'),
    keyPoints: jsonb('key_points').$type<string[]>().default([]),

    // Assignment
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, assigned, in_progress, resolved, dismissed
    assignedTo: uuid('assigned_to').references(() => teamMembers.id),
    assignedAt: timestamp('assigned_at'),

    // Resolution
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: uuid('resolved_by').references(() => teamMembers.id),
    resolution: varchar('resolution', { length: 30 }), // 'handled', 'returned_to_ai', 'no_action', 'converted', 'lost'
    resolutionNotes: text('resolution_notes'),

    // Should AI resume after human handles?
    returnToAi: boolean('return_to_ai').default(true),
    returnToAiAfter: timestamp('return_to_ai_after'),

    // Timing
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    // SLA tracking
    firstResponseAt: timestamp('first_response_at'),
    slaDeadline: timestamp('sla_deadline'),
    slaBreach: boolean('sla_breach').default(false),
  },
  (table) => [
    index('escalation_queue_lead_idx').on(table.leadId),
    index('escalation_queue_client_idx').on(table.clientId),
    index('escalation_queue_status_idx').on(table.status),
    index('escalation_queue_priority_idx').on(table.priority),
    index('escalation_queue_assigned_idx').on(table.assignedTo),
  ]
);

export type EscalationQueueItem = typeof escalationQueue.$inferSelect;
export type NewEscalationQueueItem = typeof escalationQueue.$inferInsert;
