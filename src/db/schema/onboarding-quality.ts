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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { people } from './people';

/**
 * Immutable snapshots of onboarding quality gate evaluations.
 * These snapshots provide historical traceability of readiness decisions.
 */
export const onboardingQualitySnapshots = pgTable(
  'onboarding_quality_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 40 }).notNull().default('system'),
    policyMode: varchar('policy_mode', { length: 20 }).notNull().default('enforce'),
    evaluatedByPersonId: uuid('evaluated_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    totalScore: integer('total_score').notNull().default(0),
    maxScore: integer('max_score').notNull().default(0),
    passedCritical: boolean('passed_critical').notNull().default(false),
    passedAll: boolean('passed_all').notNull().default(false),
    gateResults: jsonb('gate_results').notNull(),
    criticalFailures: jsonb('critical_failures'),
    recommendedActions: jsonb('recommended_actions'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_onboarding_quality_snapshots_client_created').on(
      table.clientId,
      table.createdAt
    ),
    index('idx_onboarding_quality_snapshots_source').on(table.source, table.createdAt),
  ]
);

/**
 * Explicit per-client override for onboarding quality gate enforcement.
 * Allows controlled autonomous-mode activation with required operator reason.
 */
export const onboardingQualityOverrides = pgTable(
  'onboarding_quality_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    allowAutonomousMode: boolean('allow_autonomous_mode').notNull().default(true),
    reason: text('reason').notNull(),
    approvedByPersonId: uuid('approved_by_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_onboarding_quality_overrides_client').on(table.clientId),
    index('idx_onboarding_quality_overrides_active').on(table.isActive, table.expiresAt),
  ]
);

export type OnboardingQualitySnapshot = typeof onboardingQualitySnapshots.$inferSelect;
export type NewOnboardingQualitySnapshot = typeof onboardingQualitySnapshots.$inferInsert;

export type OnboardingQualityOverride = typeof onboardingQualityOverrides.$inferSelect;
export type NewOnboardingQualityOverride = typeof onboardingQualityOverrides.$inferInsert;
