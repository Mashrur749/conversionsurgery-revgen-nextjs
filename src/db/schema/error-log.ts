import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const errorLog = pgTable(
  'error_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    errorType: varchar('error_type', { length: 100 }),
    errorMessage: text('error_message'),
    errorDetails: jsonb('error_details'),
    resolved: boolean('resolved').default(false),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_error_log_client_id').on(table.clientId),
    index('idx_error_log_error_type').on(table.errorType),
    index('idx_error_log_created_at').on(table.createdAt),
  ]
);

export type ErrorLog = typeof errorLog.$inferSelect;
export type NewErrorLog = typeof errorLog.$inferInsert;
