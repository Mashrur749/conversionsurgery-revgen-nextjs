import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  date,
  index,
} from 'drizzle-orm/pg-core';

export const cronJobCursors = pgTable(
  'cron_job_cursors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobKey: varchar('job_key', { length: 100 }).notNull().unique(),
    periodType: varchar('period_type', { length: 20 }).notNull(),
    lastSuccessfulPeriod: date('last_successful_period'),
    lastRunAt: timestamp('last_run_at'),
    lastSuccessAt: timestamp('last_success_at'),
    status: varchar('status', { length: 20 }).notNull().default('idle'),
    backlogCount: integer('backlog_count').notNull().default(0),
    lastErrorMessage: text('last_error_message'),
    lastErrorAt: timestamp('last_error_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('cron_job_cursors_status_idx').on(table.status),
    index('cron_job_cursors_backlog_idx').on(table.backlogCount),
    index('cron_job_cursors_last_run_idx').on(table.lastRunAt),
  ]
);

export type CronJobCursor = typeof cronJobCursors.$inferSelect;
export type NewCronJobCursor = typeof cronJobCursors.$inferInsert;
