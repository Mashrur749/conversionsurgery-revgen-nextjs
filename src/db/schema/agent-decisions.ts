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
import { leads } from './leads';
import { clients } from './clients';
import { conversations } from './conversations';
import { leadStageEnum, agentActionEnum } from './agent-enums';

/**
 * Agent Decisions — records every AI decision for debugging and learning
 */
export const agentDecisions = pgTable(
  'agent_decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),

    // What triggered this decision
    triggerType: varchar('trigger_type', { length: 30 }).notNull(), // 'inbound_message', 'scheduled', 'flow_complete', 'manual'

    // State at decision time
    stageAtDecision: leadStageEnum('stage_at_decision'),
    contextSnapshot: jsonb('context_snapshot').$type<{
      urgencyScore: number;
      budgetScore: number;
      intentScore: number;
      sentiment: string;
      recentObjections: string[];
    }>(),

    // The decision
    action: agentActionEnum('action').notNull(),
    actionDetails: jsonb('action_details').$type<{
      responseText?: string;
      flowId?: string;
      escalationReason?: string;
      waitDurationMinutes?: number;
      [key: string]: unknown;
    }>(),

    // Reasoning (from LLM)
    reasoning: text('reasoning'),
    confidence: integer('confidence'), // 0-100

    // Alternative actions considered
    alternativesConsidered: jsonb('alternatives_considered').$type<
      Array<{
        action: string;
        confidence: number;
        reason: string;
      }>
    >(),

    // Outcome (filled in later)
    outcome: varchar('outcome', { length: 30 }), // 'positive', 'negative', 'neutral', 'pending'
    outcomeDetails: text('outcome_details'),

    // Timing
    processingTimeMs: integer('processing_time_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('agent_decisions_lead_idx').on(table.leadId),
    index('agent_decisions_client_idx').on(table.clientId),
    index('agent_decisions_action_idx').on(table.action),
    index('agent_decisions_created_idx').on(table.createdAt),
  ]
);

export type AgentDecision = typeof agentDecisions.$inferSelect;
export type NewAgentDecision = typeof agentDecisions.$inferInsert;
