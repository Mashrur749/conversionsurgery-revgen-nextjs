import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    twilioNumber: varchar('twilio_number', { length: 20 }),
    twilioNumberSid: varchar('twilio_number_sid', { length: 50 }),
    operatorPhone: varchar('operator_phone', { length: 20 }),
    operatorName: varchar('operator_name', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_agencies_twilio_number').on(table.twilioNumber),
  ]
);

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
