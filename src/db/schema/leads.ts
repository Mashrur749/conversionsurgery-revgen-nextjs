import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    address: varchar('address', { length: 500 }),
    projectType: varchar('project_type', { length: 255 }),
    notes: text('notes'),
    source: varchar('source', { length: 50 }), // missed_call, form, manual
    status: varchar('status', { length: 50 }).default('new'), // new, contacted, estimate_sent, won, lost, opted_out
    actionRequired: boolean('action_required').default(false),
    actionRequiredReason: varchar('action_required_reason', { length: 255 }),
    optedOut: boolean('opted_out').default(false),
    optedOutAt: timestamp('opted_out_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    unique('leads_client_phone_unique').on(table.clientId, table.phone),
    index('idx_leads_client_id').on(table.clientId),
    index('idx_leads_phone').on(table.phone),
    index('idx_leads_status').on(table.status),
    index('idx_leads_action_required').on(table.actionRequired).where(
      sql`${table.actionRequired} = true`
    ),
  ]
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
