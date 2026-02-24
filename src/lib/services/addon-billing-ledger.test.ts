import { describe, expect, it } from 'vitest';
import {
  buildAddonBillingIdempotencyKey,
  secondsToBilledVoiceMinutes,
} from '@/lib/services/addon-billing-ledger';

describe('addon-billing-ledger helpers', () => {
  it('builds stable idempotency keys', () => {
    const key = buildAddonBillingIdempotencyKey([
      'addon',
      'voice_minutes',
      'client-123',
      '2026-02-01T00:00:00.000Z',
    ]);
    expect(key).toBe('addon:voice_minutes:client-123:2026-02-01T00:00:00.000Z');
  });

  it('rounds voice usage seconds to billable minutes', () => {
    expect(secondsToBilledVoiceMinutes(0)).toBe(0);
    expect(secondsToBilledVoiceMinutes(1)).toBe(1);
    expect(secondsToBilledVoiceMinutes(60)).toBe(1);
    expect(secondsToBilledVoiceMinutes(61)).toBe(2);
    expect(secondsToBilledVoiceMinutes(359)).toBe(6);
  });
});
