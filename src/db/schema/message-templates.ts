import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { templateVariants } from './template-variants';

/**
 * Message templates assigned to clients
 * Links clients to specific template variants for A/B testing
 */
export const messageTemplates = pgTable(
  'message_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    templateType: varchar('template_type', { length: 50 }), // missed_call, form_response, appointment_day_before, etc.
    templateVariantId: uuid('template_variant_id').references(
      () => templateVariants.id,
      { onDelete: 'set null' }
    ), // Links to the variant this client is using
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('message_templates_client_type_unique').on(
      table.clientId,
      table.templateType
    ),
  ]
);

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type NewMessageTemplate = typeof messageTemplates.$inferInsert;
