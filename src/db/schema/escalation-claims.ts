import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { leads } from './leads';
import { clients } from './clients';
import { clientMemberships } from './client-memberships';

/**
 * Escalation claims for high-intent leads
 * Allows team members to claim leads from SMS notifications
 */
export const escalationClaims = pgTable(
  'escalation_claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    claimedBy: uuid('claimed_by').references(() => clientMemberships.id, { onDelete: 'set null' }),
    claimToken: varchar('claim_token', { length: 64 }).notNull().unique(),
    escalationReason: varchar('escalation_reason', { length: 255 }),
    lastLeadMessage: text('last_lead_message'),
    status: varchar('status', { length: 20 }).default('pending'), // pending, claimed, resolved
    notifiedAt: timestamp('notified_at').defaultNow().notNull(),
    claimedAt: timestamp('claimed_at'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_escalation_claims_lead_id').on(table.leadId),
    index('idx_escalation_claims_token').on(table.claimToken),
    index('idx_escalation_claims_client_id').on(table.clientId),
    index('idx_escalation_claims_status').on(table.status),
  ]
);

export type EscalationClaim = typeof escalationClaims.$inferSelect;
export type NewEscalationClaim = typeof escalationClaims.$inferInsert;
