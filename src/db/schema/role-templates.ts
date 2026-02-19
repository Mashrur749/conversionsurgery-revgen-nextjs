import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Reusable permission bundles. Built-in templates are seeded;
 * custom templates can be created by agency owners.
 *
 * scope: 'agency' for agency dashboard roles, 'client' for client portal roles.
 * permissions: Postgres text[] array of permission strings (e.g., 'portal.dashboard').
 * isBuiltIn: Prevents deletion/modification of system templates.
 */
export const roleTemplates = pgTable(
  'role_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    scope: varchar('scope', { length: 20 }).notNull(), // 'agency' | 'client'
    permissions: text('permissions').array().notNull(),
    isBuiltIn: boolean('is_built_in').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_role_templates_scope').on(table.scope),
  ]
);

export type RoleTemplate = typeof roleTemplates.$inferSelect;
export type NewRoleTemplate = typeof roleTemplates.$inferInsert;
