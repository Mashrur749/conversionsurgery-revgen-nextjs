import {
  pgTable,
  uuid,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { people } from './people';
import { clients } from './clients';
import { roleTemplates } from './role-templates';

/**
 * Links a person to a business (client) with a role and optional permission overrides.
 *
 * permissionOverrides: JSONB with { grant: string[], revoke: string[] } structure.
 * Effective permissions = (role template permissions + grants) - revokes.
 *
 * isOwner: Business owner designation; partial unique index ensures exactly one per client.
 * sessionVersion: Incremented when permissions/role change; cookie includes this version
 *   and is rejected if stale, forcing re-authentication.
 */
export const clientMemberships = pgTable(
  'client_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    roleTemplateId: uuid('role_template_id')
      .notNull()
      .references(() => roleTemplates.id, { onDelete: 'restrict' }),
    permissionOverrides: jsonb('permission_overrides'),
    isOwner: boolean('is_owner').notNull().default(false),
    receiveEscalations: boolean('receive_escalations').notNull().default(false),
    receiveHotTransfers: boolean('receive_hot_transfers').notNull().default(false),
    priority: integer('priority').notNull().default(1),
    isActive: boolean('is_active').notNull().default(true),
    sessionVersion: integer('session_version').notNull().default(1),
    invitedBy: uuid('invited_by').references(() => people.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('client_memberships_person_client_unique').on(
      table.personId,
      table.clientId
    ),
    uniqueIndex('client_memberships_one_owner_per_client')
      .on(table.clientId)
      .where(sql`is_owner = true`),
    index('idx_client_memberships_client_id').on(table.clientId),
    index('idx_client_memberships_person_id').on(table.personId),
  ]
);

export type ClientMembership = typeof clientMemberships.$inferSelect;
export type NewClientMembership = typeof clientMemberships.$inferInsert;
