/**
 * R2 client unit tests — verify the upload helper passes Object Lock
 * parameters through correctly and that env-var validation works.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const sendMock = vi.fn();

class S3ClientMockImpl {
  // Capture constructor args via static array.
  static calls: unknown[] = [];
  send = sendMock;
  constructor(args: unknown) {
    S3ClientMockImpl.calls.push(args);
  }
}

class PutObjectCommandImpl {
  static calls: unknown[] = [];
  input: unknown;
  __type = 'PutObjectCommand';
  constructor(input: unknown) {
    this.input = input;
    PutObjectCommandImpl.calls.push(input);
  }
}

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: S3ClientMockImpl,
  PutObjectCommand: PutObjectCommandImpl,
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  S3ClientMockImpl.calls.length = 0;
  PutObjectCommandImpl.calls.length = 0;
  process.env.R2_ACCOUNT_ID = 'acct_test';
  process.env.R2_ACCESS_KEY_ID = 'key_test';
  process.env.R2_SECRET_ACCESS_KEY = 'secret_test';
  process.env.R2_AUDIT_BUCKET = 'audit-logs';
  process.env.R2_AUDIT_RETENTION_DAYS = '2557';
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('R2 client wrapper', () => {
  it('uploadAuditExport applies COMPLIANCE Object Lock with retain-until in the future', async () => {
    sendMock.mockResolvedValue({ ETag: '"abc123etag"' });

    const { uploadAuditExport } = await import('./r2');

    const before = Date.now();
    const body = Buffer.from('{"test":"payload"}', 'utf-8');
    const result = await uploadAuditExport('audit-export/2026-01-01-deadbeef.json', body);
    const after = Date.now();

    expect(PutObjectCommandImpl.calls.length).toBe(1);
    const cmdInput = PutObjectCommandImpl.calls[0] as Record<string, unknown>;

    expect(cmdInput.Bucket).toBe('audit-logs');
    expect(cmdInput.Key).toBe('audit-export/2026-01-01-deadbeef.json');
    expect(cmdInput.Body).toBe(body);
    expect(cmdInput.ContentType).toBe('application/json');
    expect(cmdInput.ObjectLockMode).toBe('COMPLIANCE');
    expect(cmdInput.ObjectLockRetainUntilDate).toBeInstanceOf(Date);

    // 2557 days in ms with a small slack window for execution time
    const retainTs = (cmdInput.ObjectLockRetainUntilDate as Date).getTime();
    const expectedFloor = before + 2557 * 86_400_000 - 1000;
    const expectedCeil = after + 2557 * 86_400_000 + 1000;
    expect(retainTs).toBeGreaterThanOrEqual(expectedFloor);
    expect(retainTs).toBeLessThanOrEqual(expectedCeil);

    expect(result.key).toBe('audit-export/2026-01-01-deadbeef.json');
    expect(result.etag).toBe('"abc123etag"');
    expect(result.bucket).toBe('audit-logs');
    expect(typeof result.retainUntil).toBe('string');
    expect(new Date(result.retainUntil).getTime()).toBe(retainTs);
  });

  it('uploadAuditExport accepts an explicit retentionDays override', async () => {
    sendMock.mockResolvedValue({ ETag: '"x"' });

    const { uploadAuditExport } = await import('./r2');

    const before = Date.now();
    await uploadAuditExport('k', Buffer.from('x'), 30);
    const after = Date.now();

    const cmdInput = PutObjectCommandImpl.calls[0] as Record<string, unknown>;
    const retainTs = (cmdInput.ObjectLockRetainUntilDate as Date).getTime();
    expect(retainTs).toBeGreaterThanOrEqual(before + 30 * 86_400_000 - 1000);
    expect(retainTs).toBeLessThanOrEqual(after + 30 * 86_400_000 + 1000);
  });

  it('getR2Client points at the Cloudflare R2 endpoint with auto region', async () => {
    const { getR2Client } = await import('./r2');
    getR2Client();

    expect(S3ClientMockImpl.calls.length).toBe(1);
    const cfg = S3ClientMockImpl.calls[0] as Record<string, unknown>;
    expect(cfg.region).toBe('auto');
    expect(cfg.endpoint).toBe('https://acct_test.r2.cloudflarestorage.com');
    expect(cfg.credentials).toEqual({
      accessKeyId: 'key_test',
      secretAccessKey: 'secret_test',
    });
  });

  it('getR2Config throws when required env vars are missing', async () => {
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_AUDIT_BUCKET;

    const { getR2Config } = await import('./r2');
    expect(() => getR2Config()).toThrow(/R2_ACCESS_KEY_ID/);
    expect(() => getR2Config()).toThrow(/R2_AUDIT_BUCKET/);
  });

  it('getR2Config defaults retentionDays to 2557 when env var is missing', async () => {
    delete process.env.R2_AUDIT_RETENTION_DAYS;

    const { getR2Config } = await import('./r2');
    const cfg = getR2Config();
    expect(cfg.retentionDays).toBe(2557);
  });

  it('getR2Config rejects non-numeric or non-positive retentionDays', async () => {
    process.env.R2_AUDIT_RETENTION_DAYS = '-1';

    const { getR2Config } = await import('./r2');
    expect(() => getR2Config()).toThrow(/positive integer/);
  });
});
