import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { people } from './people';
import { clients } from './clients';

/**
 * Immutable log of all permission-relevant actions.
 * Append-only: no UPDATE or DELETE operations on this table.
 *
 * personId uses SET NULL on delete so audit entries survive person deletion.
 * metadata contains action-specific context (e.g., { previousRole, newRole }).
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    sessionId: varchar('session_id', { length: 255 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_log_person_id').on(table.personId),
    index('idx_audit_log_client_id').on(table.clientId),
    index('idx_audit_log_action').on(table.action),
    index('idx_audit_log_created_at').on(table.createdAt),
    index('idx_audit_log_resource').on(table.resourceType, table.resourceId),
  ]
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
