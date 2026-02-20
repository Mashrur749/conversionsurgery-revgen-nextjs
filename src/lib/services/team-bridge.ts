/**
 * Bridge layer: queries the new `clientMemberships` + `people` tables
 * and returns results shaped like the legacy `teamMembers` rows.
 *
 * This allows all escalation, call-routing, and team-management code to
 * work against the new access management schema without changing their
 * response shapes or call-site logic.
 *
 * Once all consumers are migrated to new UI (SPEC-04/05), this bridge
 * and the legacy `teamMembers` table can be removed.
 */

import { getDb } from '@/db';
import { clientMemberships, people } from '@/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';

/** Shape compatible with the legacy `TeamMember` type. */
export interface BridgedTeamMember {
  id: string;            // clientMemberships.id
  clientId: string;
  name: string;          // people.name
  phone: string;         // people.phone
  email: string | null;  // people.email
  role: string | null;   // role from template (simplified)
  receiveEscalations: boolean;
  receiveHotTransfers: boolean;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all team members for a client, ordered by priority.
 * Equivalent to: SELECT * FROM team_members WHERE client_id = ? ORDER BY priority
 */
export async function getTeamMembers(clientId: string): Promise<BridgedTeamMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: clientMemberships.id,
      clientId: clientMemberships.clientId,
      name: people.name,
      phone: people.phone,
      email: people.email,
      receiveEscalations: clientMemberships.receiveEscalations,
      receiveHotTransfers: clientMemberships.receiveHotTransfers,
      priority: clientMemberships.priority,
      isActive: clientMemberships.isActive,
      createdAt: clientMemberships.createdAt,
      updatedAt: clientMemberships.updatedAt,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(eq(clientMemberships.clientId, clientId))
    .orderBy(clientMemberships.priority);

  return rows.map(r => ({
    ...r,
    phone: r.phone || '',
    role: null, // legacy field — role is now template-based
  }));
}

/**
 * Get a single team member by membership ID.
 * Equivalent to: SELECT * FROM team_members WHERE id = ? LIMIT 1
 */
export async function getTeamMemberById(membershipId: string): Promise<BridgedTeamMember | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: clientMemberships.id,
      clientId: clientMemberships.clientId,
      name: people.name,
      phone: people.phone,
      email: people.email,
      receiveEscalations: clientMemberships.receiveEscalations,
      receiveHotTransfers: clientMemberships.receiveHotTransfers,
      priority: clientMemberships.priority,
      isActive: clientMemberships.isActive,
      createdAt: clientMemberships.createdAt,
      updatedAt: clientMemberships.updatedAt,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(eq(clientMemberships.id, membershipId))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    phone: row.phone || '',
    role: null,
  };
}

/**
 * Get active members who receive escalations for a client, ordered by priority.
 */
export async function getEscalationMembers(clientId: string): Promise<BridgedTeamMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: clientMemberships.id,
      clientId: clientMemberships.clientId,
      name: people.name,
      phone: people.phone,
      email: people.email,
      receiveEscalations: clientMemberships.receiveEscalations,
      receiveHotTransfers: clientMemberships.receiveHotTransfers,
      priority: clientMemberships.priority,
      isActive: clientMemberships.isActive,
      createdAt: clientMemberships.createdAt,
      updatedAt: clientMemberships.updatedAt,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true),
      eq(clientMemberships.receiveEscalations, true)
    ))
    .orderBy(clientMemberships.priority);

  return rows.map(r => ({
    ...r,
    phone: r.phone || '',
    role: null,
  }));
}

/**
 * Get active members who receive hot transfers for a client, ordered by priority.
 */
export async function getHotTransferMembers(clientId: string): Promise<BridgedTeamMember[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: clientMemberships.id,
      clientId: clientMemberships.clientId,
      name: people.name,
      phone: people.phone,
      email: people.email,
      receiveEscalations: clientMemberships.receiveEscalations,
      receiveHotTransfers: clientMemberships.receiveHotTransfers,
      priority: clientMemberships.priority,
      isActive: clientMemberships.isActive,
      createdAt: clientMemberships.createdAt,
      updatedAt: clientMemberships.updatedAt,
    })
    .from(clientMemberships)
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true),
      eq(clientMemberships.receiveHotTransfers, true)
    ))
    .orderBy(clientMemberships.priority);

  return rows.map(r => ({
    ...r,
    phone: r.phone || '',
    role: null,
  }));
}

/**
 * Count active team members for a client.
 * Equivalent to: SELECT count(*) FROM team_members WHERE client_id = ? AND is_active = true
 */
export async function getActiveTeamMemberCount(clientId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientMemberships)
    .where(and(
      eq(clientMemberships.clientId, clientId),
      eq(clientMemberships.isActive, true)
    ));
  return result?.count || 0;
}

/**
 * Count all team members for a client (active + inactive).
 */
export async function getTotalTeamMemberCount(clientId: string): Promise<number> {
  const db = getDb();
  const [result] = await db
    .select({ count: count() })
    .from(clientMemberships)
    .where(eq(clientMemberships.clientId, clientId));
  return result?.count || 0;
}
