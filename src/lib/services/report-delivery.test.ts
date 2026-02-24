import { describe, expect, it } from 'vitest';
import { buildReportDeliveryStatePatch } from '@/lib/services/report-delivery';

describe('report-delivery state patch', () => {
  it('sets generated timestamps and report linkage', () => {
    const at = new Date('2026-02-24T10:00:00.000Z');
    const patch = buildReportDeliveryStatePatch(0, 'generated', {
      at,
      reportId: 'report-1',
      recipient: 'owner@example.com',
    });

    expect(patch.state).toBe('generated');
    expect(patch.reportId).toBe('report-1');
    expect(patch.recipient).toBe('owner@example.com');
    expect(patch.generatedAt?.toISOString()).toBe(at.toISOString());
    expect(patch.lastStateAt?.toISOString()).toBe(at.toISOString());
  });

  it('increments attempt count and records failures', () => {
    const at = new Date('2026-02-24T10:05:00.000Z');
    const patch = buildReportDeliveryStatePatch(2, 'failed', {
      at,
      incrementAttempt: true,
      errorCode: 'email_send_failed',
      errorMessage: 'SMTP timeout',
    });

    expect(patch.state).toBe('failed');
    expect(patch.attemptCount).toBe(3);
    expect(patch.lastErrorCode).toBe('email_send_failed');
    expect(patch.lastErrorMessage).toBe('SMTP timeout');
    expect(patch.failedAt?.toISOString()).toBe(at.toISOString());
  });
});
