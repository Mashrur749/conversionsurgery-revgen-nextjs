/**
 * Weekly audit-log export to Cloudflare R2 with COMPLIANCE-mode Object Lock.
 *
 * Rationale: regulators (CASL, TCPA defense) expect immutable, time-stamped
 * snapshots of consent + send/block decisions. We rely on Neon for online
 * querying, but the regulatory artifact lives in R2 with 7-year retention
 * (configurable via R2_AUDIT_RETENTION_DAYS).
 *
 * Behaviour:
 *   - Reads the last-export timestamp from `system_settings`
 *     (key = `audit_export.last_run_at`). First run uses 7 days ago as the
 *     window start.
 *   - Selects all `consent_records` with `created_at >= since` and all
 *     `compliance_audit_log` rows with `event_timestamp >= since`.
 *   - Serializes to deterministic JSON, computes SHA-256 over the bytes.
 *   - Uploads to R2 at `audit-export/YYYY-MM-DD-{shortHash}.json` with
 *     `ObjectLockMode: 'COMPLIANCE'` and `ObjectLockRetainUntilDate`.
 *   - On success, persists `audit_export.last_run_at` for the next run.
 *
 * Auth: bearer `CRON_SECRET` via `verifyCronSecret()`.
 *
 * Operator Action 1B and 1C in `OPERATOR-ACTIONS.md` provision the bucket and
 * the env vars. If R2 is unconfigured, the route returns 500 with a clear
 * error and the DB-side last-run timestamp is NOT advanced.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { gte, eq, asc } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import {
  getDb,
  consentRecords,
  complianceAuditLog,
  systemSettings,
} from '@/db';
import { uploadAuditExport } from '@/lib/clients/r2';

const LAST_RUN_KEY = 'audit_export.last_run_at';
const LAST_RUN_OBJECT_KEY = 'audit_export.last_run_object_key';
const LAST_RUN_RETAIN_UNTIL_KEY = 'audit_export.last_run_retain_until';
const DEFAULT_LOOKBACK_MS = 7 * 86_400_000;

interface AuditExportPayload {
  exportedAt: string;
  since: string;
  recordCount: number;
  consentRecords: Record<string, unknown>[];
  auditLog: Record<string, unknown>[];
}

async function readLastRunAt(): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, LAST_RUN_KEY))
    .limit(1);

  if (!row) return null;
  const parsed = new Date(row.value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function upsertSetting(key: string, value: string, description: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: systemSettings.id })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value, description });
  }
}

async function writeLastRunMetadata(
  at: Date,
  objectKey: string,
  retainUntil: string
): Promise<void> {
  await upsertSetting(
    LAST_RUN_KEY,
    at.toISOString(),
    'Wall-clock timestamp of the last successful R2 audit-log export. Used as the lower bound for the next export window.'
  );
  await upsertSetting(
    LAST_RUN_OBJECT_KEY,
    objectKey,
    'R2 object key of the last successful audit-log export.'
  );
  await upsertSetting(
    LAST_RUN_RETAIN_UNTIL_KEY,
    retainUntil,
    'COMPLIANCE-mode Object Lock retain-until timestamp (ISO 8601) of the last successful audit-log export.'
  );
}

/**
 * Compute the export window: [since, exportedAt). Defaults to last 7 days
 * when no prior export is recorded.
 */
function resolveWindow(lastRunAt: Date | null, now: Date): { since: Date; exportedAt: Date } {
  const since = lastRunAt ?? new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
  return { since, exportedAt: now };
}

/** Format the object key as `audit-export/YYYY-MM-DD-{shortHash}.json`. */
function buildObjectKey(exportedAt: Date, contentHash: string): string {
  const yyyy = exportedAt.getUTCFullYear();
  const mm = String(exportedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(exportedAt.getUTCDate()).padStart(2, '0');
  const short = contentHash.slice(0, 12);
  return `audit-export/${yyyy}-${mm}-${dd}-${short}.json`;
}

/**
 * Execute the export. Exposed as a named export so the cron orchestrator
 * (`src/app/api/cron/route.ts`) and unit tests can invoke without an HTTP
 * round-trip if needed; the GET handler is the production entry.
 */
export async function runAuditLogExport(now: Date = new Date()): Promise<{
  exportedAt: string;
  since: string;
  recordCount: number;
  consentCount: number;
  auditLogCount: number;
  key: string;
  etag: string | undefined;
  retainUntil: string;
  contentHash: string;
}> {
  const db = getDb();
  const lastRunAt = await readLastRunAt();
  const { since, exportedAt } = resolveWindow(lastRunAt, now);

  const consents = await db
    .select()
    .from(consentRecords)
    .where(gte(consentRecords.createdAt, since))
    .orderBy(asc(consentRecords.createdAt));

  const auditRows = await db
    .select()
    .from(complianceAuditLog)
    .where(gte(complianceAuditLog.eventTimestamp, since))
    .orderBy(asc(complianceAuditLog.eventTimestamp));

  const recordCount = consents.length + auditRows.length;

  const payload: AuditExportPayload = {
    exportedAt: exportedAt.toISOString(),
    since: since.toISOString(),
    recordCount,
    consentRecords: consents as unknown as Record<string, unknown>[],
    auditLog: auditRows as unknown as Record<string, unknown>[],
  };

  const serialized = JSON.stringify(payload);
  const body = Buffer.from(serialized, 'utf-8');
  const contentHash = createHash('sha256').update(body).digest('hex');
  const key = buildObjectKey(exportedAt, contentHash);

  const upload = await uploadAuditExport(key, body);

  // Persist last-run metadata ONLY after successful upload so a failed export
  // doesn't lose data — next run re-emits the same window.
  await writeLastRunMetadata(exportedAt, key, upload.retainUntil);

  return {
    exportedAt: exportedAt.toISOString(),
    since: since.toISOString(),
    recordCount,
    consentCount: consents.length,
    auditLogCount: auditRows.length,
    key,
    etag: upload.etag,
    retainUntil: upload.retainUntil,
    contentHash,
  };
}

/** GET /api/cron/audit-log-export — weekly R2 export, bearer-auth via CRON_SECRET. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAuditLogExport();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][audit-log-export]', error, 'Audit log export failed');
  }
}

