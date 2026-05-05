import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { people } from './people';

/**
 * Structured cancellation reason capture. One row per cancellation event.
 *
 * Covers Day-14 cancel right + post-90-day cancellations. The `cancelType`
 * column distinguishes the trigger (e.g. `day_14`, `post_term_30day`) since
 * `clients.status` collapses both into the single `cancelled` value.
 */
export const clientCancellations = pgTable(
  'client_cancellations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    // 'day_14' | 'mid_term_guarantee' | 'mid_term_breach' | 'post_term_30day' | 'other'
    cancelType: varchar('cancel_type', { length: 32 }).notNull(),
    // 'cost' | 'not_delivering_results' | 'scope_mismatch'
    // | 'personal_business_change' | 'competitor_chosen' | 'tech_issues' | 'other'
    reasonCategory: varchar('reason_category', { length: 32 }).notNull(),
    notes: text('notes'),
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
    capturedBy: uuid('captured_by').references(() => people.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_client_cancellations_client').on(table.clientId),
    index('idx_client_cancellations_captured_at').on(table.capturedAt),
    index('idx_client_cancellations_cancel_type').on(table.cancelType),
  ]
);

export type ClientCancellation = typeof clientCancellations.$inferSelect;
export type NewClientCancellation = typeof clientCancellations.$inferInsert;

// Allowed string-literal unions for validation/UI use.
export const CANCEL_TYPES = [
  'day_14',
  'mid_term_guarantee',
  'mid_term_breach',
  'post_term_30day',
  'other',
] as const;
export type CancelType = (typeof CANCEL_TYPES)[number];

export const CANCEL_REASON_CATEGORIES = [
  'cost',
  'not_delivering_results',
  'scope_mismatch',
  'personal_business_change',
  'competitor_chosen',
  'tech_issues',
  'other',
] as const;
export type CancelReasonCategory = (typeof CANCEL_REASON_CATEGORIES)[number];
