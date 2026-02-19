import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Universal identity table. One row per human being.
 * All auth flows resolve to a person. Memberships link people
 * to contexts (businesses or agency) with role-based permissions.
 */
export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('people_email_unique').on(table.email).where(sql`email IS NOT NULL`),
    uniqueIndex('people_phone_unique').on(table.phone).where(sql`phone IS NOT NULL`),
    index('idx_people_email').on(table.email),
    index('idx_people_phone').on(table.phone),
    check('people_has_identifier', sql`email IS NOT NULL OR phone IS NOT NULL`),
  ]
);

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
