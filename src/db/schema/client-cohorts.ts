import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

// Cohort tracking for retention analysis
export const clientCohorts = pgTable(
  'client_cohorts',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .unique()
      .references(() => clients.id, { onDelete: 'cascade' }),
    cohortMonth: varchar('cohort_month', { length: 7 }).notNull(), // Month they signed up

    // Monthly retention tracking (months since signup)
    month1Active: boolean('month_1_active'),
    month2Active: boolean('month_2_active'),
    month3Active: boolean('month_3_active'),
    month6Active: boolean('month_6_active'),
    month12Active: boolean('month_12_active'),

    // Revenue over time
    month1RevenueCents: integer('month_1_revenue_cents'),
    month3RevenueCents: integer('month_3_revenue_cents'),
    month6RevenueCents: integer('month_6_revenue_cents'),
    month12RevenueCents: integer('month_12_revenue_cents'),
    lifetimeRevenueCents: integer('lifetime_revenue_cents').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('client_cohorts_cohort_idx').on(table.cohortMonth),
  ]
);

export type ClientCohort = typeof clientCohorts.$inferSelect;
export type NewClientCohort = typeof clientCohorts.$inferInsert;
