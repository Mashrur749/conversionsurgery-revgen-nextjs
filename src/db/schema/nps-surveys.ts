import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { leads } from './leads';
import { appointments } from './appointments';

export const npsSurveys = pgTable(
  'nps_surveys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
    score: integer('score'), // 1-10
    comment: text('comment'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
    sentVia: varchar('sent_via', { length: 10 }).default('sms'),
    status: varchar('status', { length: 20 }).default('sent'), // sent, responded, expired
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_nps_surveys_client').on(table.clientId),
    index('idx_nps_surveys_lead').on(table.leadId),
    index('idx_nps_surveys_status').on(table.status),
  ]
);

export type NpsSurvey = typeof npsSurveys.$inferSelect;
export type NewNpsSurvey = typeof npsSurveys.$inferInsert;
