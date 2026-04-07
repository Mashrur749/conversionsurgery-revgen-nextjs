import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';
import { people } from './people';

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'cascade',
    }),
    personId: uuid('person_id').references(() => people.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 6 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_otp_codes_phone_expires').on(table.phone, table.expiresAt),
    index('idx_otp_codes_email_expires').on(table.email, table.expiresAt),
    index('idx_otp_codes_client_id').on(table.clientId),
    index('idx_otp_codes_person_id').on(table.personId),
    check('otp_at_least_one_contact', sql`${table.phone} IS NOT NULL OR ${table.email} IS NOT NULL`),
  ]
);

export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;
