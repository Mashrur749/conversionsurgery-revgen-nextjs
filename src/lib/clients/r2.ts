/**
 * Cloudflare R2 client (S3-compatible).
 *
 * Used by the weekly compliance audit-log export (see
 * `src/app/api/cron/audit-log-export/route.ts`). Object Lock with COMPLIANCE
 * mode is applied per-object so the bucket-level default (configured in the
 * Cloudflare dashboard, see `.planning/phases/wave-A-hardening/OPERATOR-ACTIONS.md`
 * Action 1B) is reinforced explicitly. Even if the bucket default is misconfigured,
 * each object carries its own non-overridable retention.
 *
 * Environment variables (loaded at runtime; never logged):
 *   - R2_ACCOUNT_ID            Cloudflare account ID
 *   - R2_ACCESS_KEY_ID         R2 API token access key
 *   - R2_SECRET_ACCESS_KEY     R2 API token secret
 *   - R2_AUDIT_BUCKET          Bucket name (e.g. conversionsurgery-audit-logs)
 *   - R2_AUDIT_RETENTION_DAYS  Per-object retention in days (default 2557 = 7y)
 */
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  retentionDays: number;
}

/**
 * Read R2 configuration from environment. Throws when required vars are
 * missing — callers (the cron route) handle that as a 500.
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_AUDIT_BUCKET;
  const retentionRaw = process.env.R2_AUDIT_RETENTION_DAYS;

  const missing: string[] = [];
  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_AUDIT_BUCKET');

  if (missing.length > 0) {
    throw new Error(`R2 configuration missing: ${missing.join(', ')}`);
  }

  const retentionDays = retentionRaw ? parseInt(retentionRaw, 10) : 2557;
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error(`R2_AUDIT_RETENTION_DAYS must be a positive integer (got ${retentionRaw})`);
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    retentionDays,
  };
}

/**
 * Build a configured S3Client pointed at Cloudflare R2.
 * Constructor only — no network I/O. Cheap to call per request.
 */
export function getR2Client(config: R2Config = getR2Config()): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export interface UploadAuditExportResult {
  key: string;
  etag: string | undefined;
  retainUntil: string; // ISO timestamp
  bucket: string;
}

/**
 * Upload a serialized audit-log export to R2 with COMPLIANCE-mode Object Lock.
 *
 * The retention is computed from `retentionDays` and applied via
 * `ObjectLockRetainUntilDate` + `ObjectLockMode: 'COMPLIANCE'`. COMPLIANCE
 * differs from GOVERNANCE: even an account root user cannot shorten or remove
 * the retention until it expires. This is the regulatory-grade mode.
 *
 * @param key            Object key inside the bucket
 *                       (e.g. `audit-export/2026-05-07-abc123.json`)
 * @param body           Bytes to upload (Buffer of UTF-8 JSON)
 * @param retentionDays  Optional override of the env-configured retention
 * @returns              Upload result with the retain-until timestamp
 */
export async function uploadAuditExport(
  key: string,
  body: Buffer,
  retentionDays?: number,
): Promise<UploadAuditExportResult> {
  const config = getR2Config();
  const effectiveRetentionDays = retentionDays ?? config.retentionDays;
  const retainUntil = new Date(Date.now() + effectiveRetentionDays * 86_400_000);

  const client = getR2Client(config);

  const response = await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      ObjectLockMode: 'COMPLIANCE',
      ObjectLockRetainUntilDate: retainUntil,
    }),
  );

  return {
    key,
    etag: response.ETag,
    retainUntil: retainUntil.toISOString(),
    bucket: config.bucket,
  };
}
