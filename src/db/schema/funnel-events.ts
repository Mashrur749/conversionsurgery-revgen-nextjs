import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';

// Funnel analytics (for detailed conversion tracking)
export const funnelEvents = pgTable(
  'funnel_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),

    eventType: varchar('event_type', { length: 50 }).notNull(),
    // Event types: 'lead_created', 'first_response', 'qualified', 'appointment_booked',
    // 'quote_sent', 'quote_accepted', 'job_won', 'job_lost', 'payment_received',
    // 'review_requested', 'review_received'

    eventData: jsonb('event_data').$type<Record<string, unknown>>(),
    valueCents: integer('value_cents'), // Associated value if any

    // Attribution
    source: varchar('source', { length: 50 }), // 'missed_call', 'web_form', 'referral'
    campaign: varchar('campaign', { length: 100 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('funnel_events_client_idx').on(table.clientId),
    index('funnel_events_lead_idx').on(table.leadId),
    index('funnel_events_type_idx').on(table.eventType),
    index('funnel_events_created_idx').on(table.createdAt),
  ]
);

export type FunnelEvent = typeof funnelEvents.$inferSelect;
export type NewFunnelEvent = typeof funnelEvents.$inferInsert;
