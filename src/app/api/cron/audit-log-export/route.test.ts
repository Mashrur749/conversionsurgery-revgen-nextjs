/**
 * audit-log-export cron route tests — verifies the export pipeline
 * (DB read → JSON serialize → SHA-256 hash → R2 upload → last-run advance)
 * with mocked DB and R2 client.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const uploadAuditExportMock = vi.fn();
vi.mock('@/lib/clients/r2', () => ({
  uploadAuditExport: (...args: unknown[]) => uploadAuditExportMock(...args),
}));

// Capture inserted/updated rows for systemSettings + observe queries
const consentRowsRef = { current: [] as Record<string, unknown>[] };
const auditRowsRef = { current: [] as Record<string, unknown>[] };

// Key-aware system_settings store: gateway-style upsert reads then writes
// per key, so the mock must track which key is being asked about.
const systemSettingsStore = new Map<string, string>();
const insertedSettings: Record<string, unknown>[] = [];
const updatedSettings: Record<string, unknown>[] = [];

// Capture the most-recent `where(eq(systemSettings.key, K))` arg so the
// limit() resolver knows which key to look up. We track a single "next key"
// because upsertSetting is sequential (await each lookup before next).
let pendingSystemSettingsKey: string | null = null;

function mockSelectFrom(table: string) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockImplementation(async () => {
          if (table === 'systemSettings') {
            const key = pendingSystemSettingsKey;
            if (key && systemSettingsStore.has(key)) {
              return [{ id: `s_${key}`, value: systemSettingsStore.get(key)! }];
            }
            return [];
          }
          return [];
        }),
        orderBy: vi.fn().mockResolvedValue(
          table === 'consentRecords'
            ? consentRowsRef.current
            : table === 'complianceAuditLog'
              ? auditRowsRef.current
              : []
        ),
      })),
    })),
  };
}

const mockDb = {
  select: vi.fn((_selection: unknown) => mockSelectFromAny()),
  insert: vi.fn((table: { __name?: string }) => ({
    values: vi.fn(async (vals: Record<string, unknown>) => {
      if (table?.__name === 'systemSettings') {
        insertedSettings.push(vals);
        const key = vals.key as string;
        const value = vals.value as string;
        systemSettingsStore.set(key, value);
      }
      return undefined;
    }),
  })),
  update: vi.fn((table: { __name?: string }) => ({
    set: vi.fn((vals: Record<string, unknown>) => ({
      where: vi.fn(async () => {
        if (table?.__name === 'systemSettings' && pendingSystemSettingsKey) {
          updatedSettings.push({ key: pendingSystemSettingsKey, ...vals });
          systemSettingsStore.set(
            pendingSystemSettingsKey,
            vals.value as string
          );
        }
        return undefined;
      }),
    })),
  })),
};

function mockSelectFromAny(): { from: (table: { __name?: string }) => unknown } {
  return {
    from: (table: { __name?: string }) => mockSelectFrom(table?.__name ?? '').from(),
  };
}

vi.mock('@/db', () => ({
  getDb: () => mockDb,
  consentRecords: { __name: 'consentRecords', createdAt: { __name: 'created_at' } },
  complianceAuditLog: {
    __name: 'complianceAuditLog',
    eventTimestamp: { __name: 'event_timestamp' },
  },
  systemSettings: {
    __name: 'systemSettings',
    key: { __name: 'key' },
    value: { __name: 'value' },
  },
}));

vi.mock('drizzle-orm', () => ({
  gte: vi.fn(),
  eq: vi.fn((column: { __name?: string } | undefined, value: unknown) => {
    // Capture the key for systemSettings lookups so the select/update mocks
    // know which row to read/write. The route only filters systemSettings
    // by `key`; other eq() calls are safely ignored.
    if (column?.__name === 'key' && typeof value === 'string') {
      pendingSystemSettingsKey = value;
    }
    return undefined;
  }),
  asc: vi.fn(),
  count: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
  // relations() is invoked at module load time by `src/db/schema/relations.ts`.
  // Return a no-op factory so the import chain doesn't blow up under test.
  relations: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  consentRowsRef.current = [];
  auditRowsRef.current = [];
  systemSettingsStore.clear();
  pendingSystemSettingsKey = null;
  insertedSettings.length = 0;
  updatedSettings.length = 0;
});

describe('runAuditLogExport', () => {
  it('reads compliance data, uploads to R2, and advances last-run timestamp on success', async () => {
    consentRowsRef.current = [
      { id: 'c1', phoneNumberHash: 'hash1', consentType: 'implied', createdAt: new Date('2026-04-30') },
    ];
    auditRowsRef.current = [
      { id: 'a1', eventType: 'message_sent', eventTimestamp: new Date('2026-04-30') },
      { id: 'a2', eventType: 'internal_sms_sentinel_block', eventTimestamp: new Date('2026-05-01') },
    ];

    uploadAuditExportMock.mockResolvedValue({
      key: 'audit-export/2026-05-07-abc.json',
      etag: '"etag123"',
      retainUntil: '2033-05-07T00:00:00.000Z',
      bucket: 'audit-logs',
    });

    const { runAuditLogExport } = await import('./route');
    const result = await runAuditLogExport(new Date('2026-05-07T03:00:00Z'));

    expect(uploadAuditExportMock).toHaveBeenCalledTimes(1);
    const [keyArg, bodyArg] = uploadAuditExportMock.mock.calls[0];
    expect(typeof keyArg).toBe('string');
    expect(keyArg).toMatch(/^audit-export\/2026-05-07-[a-f0-9]{12}\.json$/);
    expect(Buffer.isBuffer(bodyArg)).toBe(true);

    // Body must be valid JSON containing the expected counts
    const payload = JSON.parse((bodyArg as Buffer).toString('utf-8')) as {
      recordCount: number;
      consentRecords: unknown[];
      auditLog: unknown[];
      since: string;
      exportedAt: string;
    };
    expect(payload.recordCount).toBe(3);
    expect(payload.consentRecords).toHaveLength(1);
    expect(payload.auditLog).toHaveLength(2);
    expect(payload.exportedAt).toBe('2026-05-07T03:00:00.000Z');

    expect(result.recordCount).toBe(3);
    expect(result.consentCount).toBe(1);
    expect(result.auditLogCount).toBe(2);
    expect(result.key).toBe(keyArg);
    expect(result.etag).toBe('"etag123"');
    expect(typeof result.contentHash).toBe('string');
    expect(result.contentHash.length).toBe(64);

    // Three settings written: last_run_at, last_run_object_key, last_run_retain_until
    expect(insertedSettings).toHaveLength(3);
    const insertedKeys = insertedSettings.map((r) => r.key);
    expect(insertedKeys).toContain('audit_export.last_run_at');
    expect(insertedKeys).toContain('audit_export.last_run_object_key');
    expect(insertedKeys).toContain('audit_export.last_run_retain_until');

    const runAtRow = insertedSettings.find(
      (r) => r.key === 'audit_export.last_run_at'
    );
    expect(runAtRow?.value).toBe('2026-05-07T03:00:00.000Z');

    const objectKeyRow = insertedSettings.find(
      (r) => r.key === 'audit_export.last_run_object_key'
    );
    expect(objectKeyRow?.value).toMatch(/^audit-export\/2026-05-07-/);

    const retainRow = insertedSettings.find(
      (r) => r.key === 'audit_export.last_run_retain_until'
    );
    expect(retainRow?.value).toBe('2033-05-07T00:00:00.000Z');
  });

  it('uses 7-day lookback when no prior export is recorded', async () => {
    uploadAuditExportMock.mockResolvedValue({
      key: 'k',
      etag: '"e"',
      retainUntil: 'r',
      bucket: 'b',
    });

    const { runAuditLogExport } = await import('./route');
    const now = new Date('2026-05-07T03:00:00Z');
    const result = await runAuditLogExport(now);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    expect(result.since).toBe(sevenDaysAgo);
  });

  it('updates last-run when a prior row exists (does NOT insert again)', async () => {
    // Seed all three settings so the route's upsert path takes the UPDATE
    // branch for each one. The route persists last_run_at, last_run_object_key,
    // and last_run_retain_until in writeLastRunMetadata.
    systemSettingsStore.set(
      'audit_export.last_run_at',
      '2026-04-30T03:00:00.000Z'
    );
    systemSettingsStore.set(
      'audit_export.last_run_object_key',
      'audit-export/2026-04-30-prev.json'
    );
    systemSettingsStore.set(
      'audit_export.last_run_retain_until',
      '2033-04-30T00:00:00.000Z'
    );

    uploadAuditExportMock.mockResolvedValue({
      key: 'k',
      etag: '"e"',
      retainUntil: 'r',
      bucket: 'b',
    });

    const { runAuditLogExport } = await import('./route');
    await runAuditLogExport(new Date('2026-05-07T03:00:00Z'));

    expect(insertedSettings).toHaveLength(0);
    expect(updatedSettings).toHaveLength(3);
    const runAtUpdate = updatedSettings.find(
      (r) => r.key === 'audit_export.last_run_at'
    );
    expect(runAtUpdate?.value).toBe('2026-05-07T03:00:00.000Z');
  });

  it('does NOT advance last-run when R2 upload throws', async () => {
    uploadAuditExportMock.mockRejectedValue(new Error('R2 down'));

    const { runAuditLogExport } = await import('./route');

    await expect(
      runAuditLogExport(new Date('2026-05-07T03:00:00Z'))
    ).rejects.toThrow('R2 down');

    expect(insertedSettings).toHaveLength(0);
    expect(updatedSettings).toHaveLength(0);
  });

  it('produces a stable content hash for identical input bodies', async () => {
    consentRowsRef.current = [{ id: 'c1', createdAt: new Date('2026-04-30') }];
    auditRowsRef.current = [];
    uploadAuditExportMock.mockResolvedValue({
      key: 'k',
      etag: '"e"',
      retainUntil: 'r',
      bucket: 'b',
    });

    const { runAuditLogExport } = await import('./route');
    const a = await runAuditLogExport(new Date('2026-05-07T03:00:00Z'));
    // Reset the systemSettings state so both runs pick the same `since`
    // window (no prior export). This isolates the hash-stability check
    // from the last-run-advance side effect.
    systemSettingsStore.clear();
    const b = await runAuditLogExport(new Date('2026-05-07T03:00:00Z'));

    expect(a.contentHash).toBe(b.contentHash);
  });
});
