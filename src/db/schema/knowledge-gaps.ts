import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/**
 * Tracks questions where the AI had low confidence — knowledge gaps
 * the operator should fill to improve response quality.
 *
 * Weekly digest: "These questions came up that aren't in the knowledge base"
 */
export const knowledgeGaps = pgTable(
  'knowledge_gaps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),

    /** The customer question or topic that triggered low confidence */
    question: text('question').notNull(),

    /** Category of the question (auto-detected) */
    category: text('category'),

    /** Number of times this question/topic has come up */
    occurrences: integer('occurrences').notNull().default(1),

    /** AI confidence level when this gap was detected */
    confidenceLevel: text('confidence_level').notNull(), // 'low' | 'medium'

    /** Whether the operator has addressed this gap */
    resolved: timestamp('resolved'),

    /** Knowledge base entry ID that resolved this gap */
    resolvedByKbId: uuid('resolved_by_kb_id'),

    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_gaps_client').on(table.clientId),
    index('idx_knowledge_gaps_unresolved').on(table.clientId, table.resolved),
    index('idx_knowledge_gaps_last_seen').on(table.lastSeenAt),
  ]
);

export type KnowledgeGap = typeof knowledgeGaps.$inferSelect;
export type NewKnowledgeGap = typeof knowledgeGaps.$inferInsert;
