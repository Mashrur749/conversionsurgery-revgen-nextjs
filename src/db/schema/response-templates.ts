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
import { clients } from './clients';

export const responseTemplates = pgTable(
  'response_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Template info
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('category', { length: 50 }), // positive, neutral, negative, specific_complaint

    // Content
    templateText: text('template_text').notNull(),
    variables: jsonb('variables').$type<string[]>(), // e.g., ['customer_name', 'business_name']

    // Settings
    minRating: integer('min_rating'), // Use for rating >= this
    maxRating: integer('max_rating'), // Use for rating <= this
    keywords: jsonb('keywords').$type<string[]>(), // Match if review contains these

    // Usage tracking
    usageCount: integer('usage_count').default(0),
    lastUsedAt: timestamp('last_used_at'),

    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_response_templates_client').on(table.clientId),
    index('idx_response_templates_category').on(table.category),
  ]
);

export type ResponseTemplate = typeof responseTemplates.$inferSelect;
export type NewResponseTemplate = typeof responseTemplates.$inferInsert;
