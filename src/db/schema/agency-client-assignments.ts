import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { agencyMemberships } from './agency-memberships';
import { clients } from './clients';

/**
 * Join table specifying which clients a scoped agency member can access.
 * Only relevant when agency_memberships.clientScope = 'assigned'.
 *
 * Uses a proper join table (not UUID array) for referential integrity:
 * if a client is deleted, the assignment is cascade-deleted.
 */
export const agencyClientAssignments = pgTable(
  'agency_client_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agencyMembershipId: uuid('agency_membership_id')
      .notNull()
      .references(() => agencyMemberships.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('aca_membership_client_unique').on(
      table.agencyMembershipId,
      table.clientId
    ),
    index('idx_aca_membership_id').on(table.agencyMembershipId),
    index('idx_aca_client_id').on(table.clientId),
  ]
);

export type AgencyClientAssignment = typeof agencyClientAssignments.$inferSelect;
export type NewAgencyClientAssignment = typeof agencyClientAssignments.$inferInsert;
