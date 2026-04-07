/**
 * Client Ownership Validation
 *
 * Ensures cross-table references stay within the same client boundary.
 * Use before writing a FK that references a row in another client-scoped table.
 *
 * Example:
 *   await assertSameClient(db, 'leads', leadId, clientId, 'lead');
 */

import { sql } from 'drizzle-orm';
import type { Database } from '@/db/client';

/** Tables that have a client_id column and can be ownership-checked. */
const VALID_TABLES = new Set([
  'leads',
  'client_services',
  'client_memberships',
  'conversations',
  'appointments',
  'invoices',
  'jobs',
  'flows',
  'flow_executions',
  'knowledge_base',
  'reviews',
  'payments',
  'media_attachments',
  'calendar_events',
  'response_templates',
  'escalation_queue',
  'escalation_claims',
  'nps_surveys',
  'call_attempts',
  'voice_calls',
  'agent_decisions',
  'lead_context',
  'suggested_actions',
] as const);

type ValidTable = typeof VALID_TABLES extends Set<infer T> ? T : never;

/**
 * Verifies that a referenced row belongs to the expected client.
 * Throws if the row doesn't exist or belongs to a different client.
 *
 * @param db - Database instance
 * @param tableName - The SQL table name (must be in VALID_TABLES allowlist)
 * @param id - The row ID to look up
 * @param expectedClientId - The client ID that should own this row
 * @param label - Human-readable name for error messages (e.g., 'lead', 'service')
 */
export async function assertSameClient(
  db: Database,
  tableName: ValidTable,
  id: string,
  expectedClientId: string,
  label: string
): Promise<void> {
  if (!VALID_TABLES.has(tableName)) {
    throw new Error(`Invalid table for ownership check: ${tableName}`);
  }

  // Table name is from the allowlist (safe), values are parameterized
  const result = await db.execute(
    sql`SELECT client_id FROM ${sql.identifier(tableName)} WHERE id = ${id} LIMIT 1`
  );

  const row = result.rows[0] as { client_id?: string } | undefined;

  if (!row) {
    throw new ClientOwnershipError(`${label} not found: ${id}`);
  }

  if (row.client_id !== expectedClientId) {
    throw new ClientOwnershipError(
      `${label} ${id} belongs to a different client`
    );
  }
}

/**
 * Batch-verify multiple references belong to the same client.
 * Skips null/undefined IDs (nullable FKs).
 */
export async function assertAllSameClient(
  db: Database,
  expectedClientId: string,
  checks: Array<{
    table: ValidTable;
    id: string | null | undefined;
    label: string;
  }>
): Promise<void> {
  const activeChecks = checks.filter(
    (c): c is typeof c & { id: string } => c.id != null
  );
  await Promise.all(
    activeChecks.map((c) =>
      assertSameClient(db, c.table, c.id, expectedClientId, c.label)
    )
  );
}

export class ClientOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientOwnershipError';
  }
}
