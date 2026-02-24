import { describe, expect, it } from 'vitest';

import {
  buildCronPeriodIdempotencyKey,
  buildMonthlyOverageIdempotencyKey,
} from '@/lib/services/idempotency-keys';

describe('idempotency keys', () => {
  it('builds stable monthly overage keys', () => {
    const key = buildMonthlyOverageIdempotencyKey('CLIENT-123', '2026-02');
    expect(key).toBe('v1:billing:overage:client-123:2026-02');
  });

  it('normalizes cron period keys', () => {
    const key = buildCronPeriodIdempotencyKey('biweekly_reports', '2026-02-16..2026-03-01');
    expect(key).toBe('v1:cron:biweekly_reports:2026-02-16--2026-03-01');
  });
});
