import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const knowledgeCategoryEnum = pgEnum('knowledge_category', [
  'services',
  'pricing',
  'faq',
  'policies',
  'about',
  'custom',
]);

export const knowledgeBase = pgTable(
  'knowledge_base',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    category: knowledgeCategoryEnum('category').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    keywords: text('keywords'), // comma-separated for search
    priority: integer('priority').default(0), // Higher = more important
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_base_client_id').on(table.clientId),
    index('idx_knowledge_base_category').on(table.clientId, table.category),
  ]
);

export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;
export type NewKnowledgeBaseEntry = typeof knowledgeBase.$inferInsert;
