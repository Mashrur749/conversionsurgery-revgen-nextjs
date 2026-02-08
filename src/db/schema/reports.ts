import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

/**
 * Generated reports for managed service clients
 * Documents performance metrics and ROI over specific periods
 */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    reportType: varchar('report_type', { length: 50 }).notNull(), // 'bi-weekly', 'monthly', 'custom'
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),

    // Aggregated metrics
    metrics: jsonb('metrics').notNull(), // Summary stats for the period

    // Performance data
    performanceData: jsonb('performance_data'), // Daily breakdown

    // A/B test results if any
    testResults: jsonb('test_results'), // Running tests during period

    // Team performance
    teamPerformance: jsonb('team_performance'), // By team member

    // ROI summary
    roiSummary: jsonb('roi_summary'), // Key ROI metrics

    // Report content
    notes: text('notes'), // Notes about the period

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_reports_client_id').on(table.clientId),
    index('idx_reports_date_range').on(table.startDate, table.endDate),
  ]
);

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
