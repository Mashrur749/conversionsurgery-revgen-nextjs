import { getDb } from '@/db';
import { auditLog } from '@/db/schema';

/**
 * Log a delete action to the audit_log table (D13).
 * Best-effort: errors are logged but never thrown to avoid disrupting the caller.
 */
export async function logDeleteAudit(params: {
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  personId?: string;
  clientId?: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      action: 'delete',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata: params.metadata ?? null,
      personId: params.personId ?? null,
      clientId: params.clientId ?? null,
    });
  } catch (err) {
    console.error('[Audit] Failed to log delete:', err);
  }
}
