import {
  pgTable,
  uuid,
  varchar,
  date,
  time,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    appointmentDate: date('appointment_date').notNull(),
    appointmentTime: time('appointment_time').notNull(),
    address: varchar('address', { length: 500 }),
    status: varchar('status', { length: 20 }).default('scheduled'), // scheduled, confirmed, completed, no_show, cancelled
    reminderDayBeforeSent: boolean('reminder_day_before_sent').default(false),
    reminder2hrSent: boolean('reminder_2hr_sent').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_appointments_date').on(table.appointmentDate),
    index('idx_appointments_client_id').on(table.clientId),
  ]
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
