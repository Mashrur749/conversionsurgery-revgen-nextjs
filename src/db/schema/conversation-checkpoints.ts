import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { leadStageEnum } from './agent-enums';

/**
 * Conversation Checkpoints — periodic summaries of long conversations
 * Used for context management and reducing token usage in LLM calls
 */
export const conversationCheckpoints = pgTable(
  'conversation_checkpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),

    // When this checkpoint was created
    messageIndex: integer('message_index').notNull(),
    checkpointAt: timestamp('checkpoint_at').defaultNow().notNull(),

    // Compressed summary of conversation up to this point
    summary: text('summary').notNull(),

    // Key extracted data at this point
    extractedData: jsonb('extracted_data').$type<{
      projectDetails?: string;
      customerNeeds?: string[];
      questionsAsked?: string[];
      questionsAnswered?: string[];
      agreements?: string[];
      openIssues?: string[];
    }>(),

    // Context state at checkpoint
    stageAtCheckpoint: leadStageEnum('stage_at_checkpoint'),
    scoresAtCheckpoint: jsonb('scores_at_checkpoint').$type<{
      urgency: number;
      budget: number;
      intent: number;
    }>(),

    // Token count for context management
    tokenCount: integer('token_count'),
  },
  (table) => [
    index('conversation_checkpoints_lead_idx').on(table.leadId),
    index('conversation_checkpoints_message_idx').on(table.messageIndex),
  ]
);

export type ConversationCheckpoint =
  typeof conversationCheckpoints.$inferSelect;
export type NewConversationCheckpoint =
  typeof conversationCheckpoints.$inferInsert;
