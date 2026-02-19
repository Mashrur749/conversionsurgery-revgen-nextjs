import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { people } from './people';
import { roleTemplates } from './role-templates';

/**
 * Links a person to the agency with a role and client scope.
 *
 * UNIQUE on personId: a person can only be an agency member once (single-tenant agency).
 * clientScope: 'all' = sees all clients; 'assigned' = sees only clients in agency_client_assignments.
 * sessionVersion: Incremented on role/scope change to force re-authentication.
 */
export const agencyMemberships = pgTable(
  'agency_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .unique()
      .references(() => people.id, { onDelete: 'cascade' }),
    roleTemplateId: uuid('role_template_id')
      .notNull()
      .references(() => roleTemplates.id, { onDelete: 'restrict' }),
    clientScope: varchar('client_scope', { length: 20 }).notNull().default('all'), // 'all' | 'assigned'
    isActive: boolean('is_active').notNull().default(true),
    sessionVersion: integer('session_version').notNull().default(1),
    invitedBy: uuid('invited_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_agency_memberships_person_id').on(table.personId),
  ]
);

export type AgencyMembership = typeof agencyMemberships.$inferSelect;
export type NewAgencyMembership = typeof agencyMemberships.$inferInsert;
