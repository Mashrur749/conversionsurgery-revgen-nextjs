import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { reports } from './reports';

export const reportDeliveries = pgTable(
  'report_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
    reportType: varchar('report_type', { length: 50 }).notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    channel: varchar('channel', { length: 20 }).default('email').notNull(),
    recipient: text('recipient'),
    state: varchar('state', { length: 20 }).default('queued').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    channelMetadata: jsonb('channel_metadata').$type<Record<string, unknown>>(),
    lastErrorCode: varchar('last_error_code', { length: 100 }),
    lastErrorMessage: text('last_error_message'),
    generatedAt: timestamp('generated_at'),
    queuedAt: timestamp('queued_at'),
    sentAt: timestamp('sent_at'),
    failedAt: timestamp('failed_at'),
    retriedAt: timestamp('retried_at'),
    lastStateAt: timestamp('last_state_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_report_deliveries_client').on(table.clientId, table.periodEnd),
    index('idx_report_deliveries_state').on(table.state, table.lastStateAt),
    uniqueIndex('uq_report_deliveries_cycle_channel').on(
      table.clientId,
      table.reportType,
      table.periodStart,
      table.periodEnd,
      table.channel
    ),
  ]
);

export type ReportDelivery = typeof reportDeliveries.$inferSelect;
export type NewReportDelivery = typeof reportDeliveries.$inferInsert;

export const reportDeliveryEvents = pgTable(
  'report_delivery_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => reportDeliveries.id, { onDelete: 'cascade' }),
    fromState: varchar('from_state', { length: 20 }),
    toState: varchar('to_state', { length: 20 }).notNull(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_report_delivery_events_delivery').on(table.deliveryId, table.createdAt),
  ]
);

export type ReportDeliveryEvent = typeof reportDeliveryEvents.$inferSelect;
export type NewReportDeliveryEvent = typeof reportDeliveryEvents.$inferInsert;
