import {
  pgTable,
  uuid,
  integer,
  time,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

/**
 * Business hours configuration for ring group routing.
 * Determines when high-intent leads trigger ring groups vs escalations.
 * Each row represents one day-of-week for a specific client (0=Sun through 6=Sat).
 */
export const businessHours = pgTable(
  'business_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
    openTime: time('open_time'),
    closeTime: time('close_time'),
    isOpen: boolean('is_open').default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('business_hours_client_day_unique').on(
      table.clientId,
      table.dayOfWeek
    ),
  ]
);

export type BusinessHours = typeof businessHours.$inferSelect;
export type NewBusinessHours = typeof businessHours.$inferInsert;
