import {
  pgTable,
  uuid,
  text,
  integer,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { people } from './people';
import { knowledgeBase } from './knowledge-base';

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

    /** Queue lifecycle status. */
    status: varchar('status', { length: 20 }).notNull().default('new'),

    /** Assignment + triage metadata. */
    ownerPersonId: uuid('owner_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    dueAt: timestamp('due_at'),
    priorityScore: integer('priority_score').notNull().default(0),
    reviewRequired: boolean('review_required').notNull().default(false),

    /** Required resolution linkage metadata. */
    resolutionNote: text('resolution_note'),
    kbEntryId: uuid('resolved_by_kb_id').references(() => knowledgeBase.id, {
      onDelete: 'set null',
    }),
    resolvedByPersonId: uuid('resolved_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at'),
    verifiedByPersonId: uuid('verified_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at'),

    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_gaps_client').on(table.clientId),
    index('idx_knowledge_gaps_status').on(table.clientId, table.status),
    index('idx_knowledge_gaps_priority').on(table.clientId, table.priorityScore, table.status),
    index('idx_knowledge_gaps_due').on(table.dueAt, table.status),
    index('idx_knowledge_gaps_last_seen').on(table.lastSeenAt),
  ]
);

export type KnowledgeGap = typeof knowledgeGaps.$inferSelect;
export type NewKnowledgeGap = typeof knowledgeGaps.$inferInsert;
