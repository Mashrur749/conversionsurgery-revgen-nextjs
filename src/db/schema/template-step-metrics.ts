import {
  pgTable,
  uuid,
  date,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { flowTemplates } from './flow-templates';

/**
 * Step-level performance metrics
 * Tracks which step gets responses in a multi-step template
 */
export const templateStepMetrics = pgTable(
  'template_step_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').references(() => flowTemplates.id, { onDelete: 'cascade' }),
    stepNumber: integer('step_number').notNull(),
    date: date('date').notNull(),

    messagesSent: integer('messages_sent').default(0),
    responsesReceived: integer('responses_received').default(0),
    skipped: integer('skipped').default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('template_step_date_idx').on(
      table.templateId,
      table.stepNumber,
      table.date
    ),
  ]
);

export type TemplateStepMetrics = typeof templateStepMetrics.$inferSelect;
export type NewTemplateStepMetrics = typeof templateStepMetrics.$inferInsert;
