import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * Message template variants for aggregate A/B testing
 * Tracks different versions of message templates tested across all clients
 * Example: "Missed Call - Standard", "Missed Call - Aggressive"
 */
export const templateVariants = pgTable(
  'template_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateType: varchar('template_type', { length: 50 }).notNull(), // missed_call, form_response, appointment_day_before, etc.
    name: varchar('name', { length: 255 }).notNull(), // "Standard", "Aggressive", "Friendly", etc.
    content: text('content').notNull(), // The actual message template with variables like {name}
    isActive: boolean('is_active').default(true), // Whether this variant is available for new clients
    notes: text('notes'), // What's different about this variant (e.g. "More urgent tone, added emoji")
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_template_variants_type').on(table.templateType),
    index('idx_template_variants_active').on(table.isActive),
    unique('template_variants_type_name_unique').on(table.templateType, table.name),
  ]
);

export type TemplateVariant = typeof templateVariants.$inferSelect;
export type NewTemplateVariant = typeof templateVariants.$inferInsert;
