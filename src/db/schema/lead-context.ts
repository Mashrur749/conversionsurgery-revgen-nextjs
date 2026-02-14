import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { clients } from './clients';
import { clientServices } from './client-services';
import { leadStageEnum, sentimentEnum, agentActionEnum } from './agent-enums';

/**
 * Lead Context — AI's understanding of each lead
 * Tracks journey state, detected signals, extracted info, and next action recommendations
 */
export const leadContext = pgTable(
  'lead_context',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .unique()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Current stage in journey
    stage: leadStageEnum('stage').default('new').notNull(),
    previousStage: leadStageEnum('previous_stage'),
    stageChangedAt: timestamp('stage_changed_at').defaultNow(),

    // Detected signals (0-100 confidence)
    urgencyScore: integer('urgency_score').default(50),
    budgetScore: integer('budget_score').default(50),
    intentScore: integer('intent_score').default(50),

    // Sentiment tracking
    currentSentiment: sentimentEnum('current_sentiment').default('neutral'),
    sentimentHistory: jsonb('sentiment_history')
      .$type<
        Array<{
          sentiment: string;
          confidence: number;
          messageId: string;
          timestamp: string;
        }>
      >()
      .default([]),

    // Extracted information
    projectType: varchar('project_type', { length: 100 }),
    projectSize: varchar('project_size', { length: 50 }),
    estimatedValue: integer('estimated_value'),
    preferredTimeframe: varchar('preferred_timeframe', { length: 50 }),
    propertyType: varchar('property_type', { length: 50 }),

    // Matched service from client catalog (set by AI classification)
    matchedServiceId: uuid('matched_service_id')
      .references(() => clientServices.id, { onDelete: 'set null' }),

    // Objections and concerns
    objections: jsonb('objections')
      .$type<
        Array<{
          type: string;
          detail: string;
          raisedAt: string;
          addressedAt?: string;
          resolved: boolean;
        }>
      >()
      .default([]),

    // Competitor mentions
    competitorMentions: jsonb('competitor_mentions')
      .$type<
        Array<{
          name?: string;
          context: string;
          messageId: string;
          timestamp: string;
        }>
      >()
      .default([]),

    // Interaction metrics
    totalMessages: integer('total_messages').default(0),
    leadMessages: integer('lead_messages').default(0),
    agentMessages: integer('agent_messages').default(0),
    avgResponseTimeSeconds: integer('avg_response_time_seconds'),

    // Booking attempts
    bookingAttempts: integer('booking_attempts').default(0),
    lastBookingAttempt: timestamp('last_booking_attempt'),

    // Quote/estimate tracking
    quotesSent: integer('quotes_sent').default(0),
    lastQuoteAmount: integer('last_quote_amount'),
    lastQuoteSentAt: timestamp('last_quote_sent_at'),

    // Conversation summary (updated by AI)
    conversationSummary: text('conversation_summary'),
    keyFacts: jsonb('key_facts').$type<string[]>().default([]),

    // Next action recommendation
    recommendedAction: agentActionEnum('recommended_action'),
    recommendedActionReason: text('recommended_action_reason'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('lead_context_lead_idx').on(table.leadId),
    index('lead_context_client_idx').on(table.clientId),
    index('lead_context_stage_idx').on(table.stage),
    index('lead_context_intent_idx').on(table.intentScore),
  ]
);

export type LeadContext = typeof leadContext.$inferSelect;
export type NewLeadContext = typeof leadContext.$inferInsert;
