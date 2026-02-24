import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const onboardingMilestoneStatusEnum = pgEnum(
  'onboarding_milestone_status',
  ['pending', 'completed', 'overdue']
);

export const revenueLeakAuditStatusEnum = pgEnum(
  'revenue_leak_audit_status',
  ['draft', 'delivered']
);

export const onboardingSlaAlertStatusEnum = pgEnum(
  'onboarding_sla_alert_status',
  ['open', 'resolved']
);

/** Day-one activation milestones tracked per client. */
export const onboardingMilestones = pgTable(
  'onboarding_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    milestoneKey: varchar('milestone_key', { length: 80 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: onboardingMilestoneStatusEnum('status').notNull().default('pending'),
    targetAt: timestamp('target_at').notNull(),
    completedAt: timestamp('completed_at'),
    completedBy: varchar('completed_by', { length: 120 }),
    evidence: jsonb('evidence').$type<{
      link?: string;
      note?: string;
      source?: string;
    }>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('uq_onboarding_milestones_client_key').on(table.clientId, table.milestoneKey),
    index('idx_onboarding_milestones_client').on(table.clientId),
    index('idx_onboarding_milestones_status_target').on(table.status, table.targetAt),
  ]
);

/** Revenue Leak Audit artifact for onboarding proof of delivery. */
export const revenueLeakAudits = pgTable(
  'revenue_leak_audits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' })
      .unique(),
    status: revenueLeakAuditStatusEnum('status').notNull().default('draft'),
    summary: text('summary'),
    findings: jsonb('findings').$type<
      Array<{
        title: string;
        detail: string;
        priority: 'high' | 'medium' | 'low';
        estimatedImpactCentsLow?: number;
        estimatedImpactCentsHigh?: number;
      }>
    >(),
    estimatedImpactLowCents: integer('estimated_impact_low_cents'),
    estimatedImpactBaseCents: integer('estimated_impact_base_cents'),
    estimatedImpactHighCents: integer('estimated_impact_high_cents'),
    artifactUrl: text('artifact_url'),
    deliveredAt: timestamp('delivered_at'),
    deliveredBy: varchar('delivered_by', { length: 120 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_revenue_leak_audits_status').on(table.status),
  ]
);

/** Internal SLA alerts/tasks for overdue day-one activation milestones. */
export const onboardingSlaAlerts = pgTable(
  'onboarding_sla_alerts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => onboardingMilestones.id, {
      onDelete: 'set null',
    }),
    milestoneKey: varchar('milestone_key', { length: 80 }).notNull(),
    status: onboardingSlaAlertStatusEnum('status').notNull().default('open'),
    reason: text('reason').notNull(),
    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_onboarding_sla_alerts_client_status').on(table.clientId, table.status),
    index('idx_onboarding_sla_alerts_milestone').on(table.milestoneKey),
  ]
);

/** Immutable activity stream for day-one onboarding operations. */
export const onboardingMilestoneActivities = pgTable(
  'onboarding_milestone_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => onboardingMilestones.id, {
      onDelete: 'set null',
    }),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    actorType: varchar('actor_type', { length: 30 }).notNull().default('system'),
    actorId: varchar('actor_id', { length: 120 }),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_onboarding_activities_client').on(table.clientId, table.createdAt),
    index('idx_onboarding_activities_milestone').on(table.milestoneId),
  ]
);

export type OnboardingMilestone = typeof onboardingMilestones.$inferSelect;
export type NewOnboardingMilestone = typeof onboardingMilestones.$inferInsert;
export type RevenueLeakAudit = typeof revenueLeakAudits.$inferSelect;
export type OnboardingSlaAlert = typeof onboardingSlaAlerts.$inferSelect;
export type OnboardingMilestoneActivity = typeof onboardingMilestoneActivities.$inferSelect;

