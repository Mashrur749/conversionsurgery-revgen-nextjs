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
import { leads } from './leads';

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Source info
    source: varchar('source', { length: 20 }).notNull(), // google, yelp, facebook, bbb, angi, homeadvisor, other
    externalId: varchar('external_id', { length: 255 }),
    externalUrl: varchar('external_url', { length: 1000 }),

    // Review content
    authorName: varchar('author_name', { length: 255 }),
    authorPhoto: varchar('author_photo', { length: 1000 }),
    rating: integer('rating').notNull(), // 1-5
    reviewText: text('review_text'),

    // Response
    hasResponse: boolean('has_response').default(false),
    responseText: text('response_text'),
    responseDate: timestamp('response_date'),

    // AI analysis
    sentiment: varchar('sentiment', { length: 20 }), // positive, neutral, negative
    aiSuggestedResponse: text('ai_suggested_response'),
    keyTopics: jsonb('key_topics').$type<string[]>(),

    // Alerts
    alertSent: boolean('alert_sent').default(false),
    alertSentAt: timestamp('alert_sent_at'),

    // Lead matching
    matchedLeadId: uuid('matched_lead_id').references(() => leads.id, { onDelete: 'set null' }),

    // Timestamps
    reviewDate: timestamp('review_date'),
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_reviews_client').on(table.clientId),
    index('idx_reviews_source').on(table.source),
    index('idx_reviews_date').on(table.reviewDate),
  ]
);

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
