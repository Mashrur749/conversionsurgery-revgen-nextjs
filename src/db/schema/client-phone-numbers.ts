import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const clientPhoneNumbers = pgTable(
  'client_phone_numbers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
    friendlyName: varchar('friendly_name', { length: 100 }),
    isPrimary: boolean('is_primary').default(false),
    isActive: boolean('is_active').default(true),
    capabilities: jsonb('capabilities').$type<{
      sms: boolean;
      voice: boolean;
      mms: boolean;
    }>(),
    purchasedAt: timestamp('purchased_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index('cpn_client_id_idx').on(table.clientId),
    index('cpn_phone_number_idx').on(table.phoneNumber),
  ]
);
