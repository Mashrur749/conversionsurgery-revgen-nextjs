import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  date,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const reviewMetrics = pgTable(
  'review_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),

    // Period
    period: varchar('period', { length: 20 }).notNull(), // daily, weekly, monthly
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),

    // Metrics
    totalReviews: integer('total_reviews').default(0),
    averageRating: real('average_rating'),
    fiveStarCount: integer('five_star_count').default(0),
    fourStarCount: integer('four_star_count').default(0),
    threeStarCount: integer('three_star_count').default(0),
    twoStarCount: integer('two_star_count').default(0),
    oneStarCount: integer('one_star_count').default(0),

    // By source
    googleCount: integer('google_count').default(0),
    yelpCount: integer('yelp_count').default(0),

    // Sentiment
    positiveCount: integer('positive_count').default(0),
    neutralCount: integer('neutral_count').default(0),
    negativeCount: integer('negative_count').default(0),

    // Response metrics
    respondedCount: integer('responded_count').default(0),
    avgResponseTimeHours: real('avg_response_time_hours'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_review_metrics_client').on(table.clientId),
    unique('review_metrics_client_period_start').on(
      table.clientId,
      table.period,
      table.periodStart
    ),
  ]
);

export type ReviewMetric = typeof reviewMetrics.$inferSelect;
export type NewReviewMetric = typeof reviewMetrics.$inferInsert;
