import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/**
 * A/B tests for experimenting with different configurations
 * Used to optimize client performance and demonstrate ROI
 */
export const abTests = pgTable(
  'ab_tests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    testType: varchar('test_type', { length: 50 }).notNull(), // 'messaging', 'timing', 'team', 'sequence'
    status: varchar('status', { length: 20 }).default('active'), // active, paused, completed, archived
    variantA: jsonb('variant_a').notNull(), // Configuration for variant A
    variantB: jsonb('variant_b').notNull(), // Configuration for variant B
    winner: varchar('winner', { length: 1 }), // 'A' or 'B' - declared after test ends
    startDate: timestamp('start_date').defaultNow(),
    endDate: timestamp('end_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ab_tests_client_id').on(table.clientId),
    index('idx_ab_tests_status').on(table.status),
    index('idx_ab_tests_client_status').on(table.clientId, table.status),
  ]
);

export type ABTest = typeof abTests.$inferSelect;
export type NewABTest = typeof abTests.$inferInsert;

/**
 * Daily metrics per test variant
 * Tracks performance of each variant over time
 */
export const abTestMetrics = pgTable(
  'ab_test_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testId: uuid('test_id')
      .notNull()
      .references(() => abTests.id, { onDelete: 'cascade' }),
    date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
    variant: varchar('variant', { length: 1 }).notNull(), // 'A' or 'B'
    messagesSent: integer('messages_sent').default(0),
    messagesDelivered: integer('messages_delivered').default(0),
    conversationsStarted: integer('conversations_started').default(0),
    appointmentsBooked: integer('appointments_booked').default(0),
    formsResponded: integer('forms_responded').default(0),
    leadsQualified: integer('leads_qualified').default(0),
    estimatesFollowedUp: integer('estimates_followed_up').default(0),
    conversionsCompleted: integer('conversions_completed').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ab_test_metrics_test_id').on(table.testId),
    index('idx_ab_test_metrics_date').on(table.date),
    index('idx_ab_test_metrics_test_variant').on(table.testId, table.variant),
  ]
);

export type ABTestMetrics = typeof abTestMetrics.$inferSelect;
export type NewABTestMetrics = typeof abTestMetrics.$inferInsert;
