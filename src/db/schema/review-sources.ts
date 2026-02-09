import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const reviewSources = pgTable(
  'review_sources',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Source config
    source: varchar('source', { length: 20 }).notNull(), // google, yelp, facebook, bbb, angi, homeadvisor, other
    isActive: boolean('is_active').default(true),

    // Platform-specific IDs
    googlePlaceId: varchar('google_place_id', { length: 255 }),
    yelpBusinessId: varchar('yelp_business_id', { length: 255 }),
    facebookPageId: varchar('facebook_page_id', { length: 255 }),

    // Last fetch info
    lastFetchedAt: timestamp('last_fetched_at'),
    lastReviewDate: timestamp('last_review_date'),
    totalReviews: integer('total_reviews').default(0),
    averageRating: real('average_rating'),

    // Error tracking
    lastError: text('last_error'),
    consecutiveErrors: integer('consecutive_errors').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_review_sources_client').on(table.clientId),
  ]
);

export type ReviewSource = typeof reviewSources.$inferSelect;
export type NewReviewSource = typeof reviewSources.$inferInsert;
