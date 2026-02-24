import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { cancellationRequests } from './cancellation-requests';

export const dataExportRequests = pgTable(
  'data_export_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    cancellationRequestId: uuid('cancellation_request_id').references(() => cancellationRequests.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 20 }).default('requested').notNull(), // requested, processing, ready, delivered, failed
    requestedBy: varchar('requested_by', { length: 100 }).default('client_portal').notNull(),
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    dueAt: timestamp('due_at').notNull(),
    startedAt: timestamp('started_at'),
    readyAt: timestamp('ready_at'),
    deliveredAt: timestamp('delivered_at'),
    failedAt: timestamp('failed_at'),
    failureReason: text('failure_reason'),
    downloadToken: varchar('download_token', { length: 120 }),
    downloadTokenExpiresAt: timestamp('download_token_expires_at'),
    artifactSummary: jsonb('artifact_summary').$type<{
      format: 'csv_bundle';
      generatedAt: string;
      datasets: Array<{
        name: string;
        rowCount: number;
      }>;
    }>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_data_export_requests_client').on(table.clientId),
    index('idx_data_export_requests_status').on(table.status),
    index('idx_data_export_requests_due_at').on(table.dueAt),
    index('idx_data_export_requests_cancellation').on(table.cancellationRequestId),
  ]
);

export type DataExportRequest = typeof dataExportRequests.$inferSelect;
export type NewDataExportRequest = typeof dataExportRequests.$inferInsert;
