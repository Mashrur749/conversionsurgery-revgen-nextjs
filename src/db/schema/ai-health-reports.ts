import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const aiHealthReports = pgTable('ai_health_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  period: varchar('period', { length: 20 }).notNull(), // 'weekly'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),

  metrics: jsonb('metrics').$type<{
    confidenceTrend: { current: number; prior: number; delta: number };
    escalationRate: { current: number; prior: number; delta: number };
    outputGuardViolationRate: number;
    avgResponseTimeMs: { current: number; prior: number; delta: number };
    qualityTierUsageRate: { current: number; prior: number; delta: number };
    winBackOptOutRate: number;
    smartAssistCorrectionRate: number;
    voyageFallbackRate: number;
  }>().notNull(),

  alerts: jsonb('alerts').$type<Array<{
    severity: 'warning' | 'critical';
    metric: string;
    message: string;
    threshold: number;
    actual: number;
  }>>().notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AiHealthReport = typeof aiHealthReports.$inferSelect;
export type NewAiHealthReport = typeof aiHealthReports.$inferInsert;
