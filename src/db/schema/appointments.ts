import {
  pgTable,
  uuid,
  varchar,
  date,
  time,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { leads } from './leads';
import { clientMemberships } from './client-memberships';

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
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
    durationMinutes: integer('duration_minutes').default(60),
    endDate: date('end_date'), // nullable, for multi-day jobs
    assignedTeamMemberId: uuid('assigned_team_member_id').references(
      () => clientMemberships.id,
      { onDelete: 'set null' }
    ),
    reminderDayBeforeSent: boolean('reminder_day_before_sent').default(false),
    reminder2hrSent: boolean('reminder_2hr_sent').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_appointments_date').on(table.appointmentDate),
    index('idx_appointments_client_id').on(table.clientId),
    uniqueIndex('uq_appointments_client_date_time')
      .on(table.clientId, table.appointmentDate, table.appointmentTime)
      .where(sql`status != 'cancelled'`),
  ]
);

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
