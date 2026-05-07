/**
 * Pure-function date-math tests for the consent status badge derivation.
 * Vitest only includes `*.test.ts` (see vitest.config.ts), so we test the
 * helper in isolation rather than the JSX component.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveConsentBadgeState,
  deriveInlineConsentIndicator,
} from './consent-status-badge-state';

const DAY_MS = 86_400_000;

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

describe('deriveConsentBadgeState', () => {
  const now = new Date('2026-05-07T12:00:00Z');

  it('returns implied_valid when inquiry is 100 days ago and consent is implied', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(100, now),
      consentSource: 'inquiry',
      consentType: 'implied',
      consentTimestamp: daysAgo(100, now),
      now,
    });

    expect(state.kind).toBe('implied_valid');
    expect(state.tone).toBe('default');
    expect(state.label).toMatch(/Inquiry received/);
    expect(state.detail).toMatch(/valid until/);
  });

  it('returns implied_approaching when inquiry is 165 days ago', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(165, now),
      consentSource: 'inquiry',
      consentType: 'implied',
      consentTimestamp: daysAgo(165, now),
      now,
    });

    expect(state.kind).toBe('implied_approaching');
    expect(state.tone).toBe('warning');
    expect(state.label).toMatch(/15 days until/); // 180 - 165
  });

  it('returns implied_expired when inquiry is 200 days ago and only implied consent', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(200, now),
      consentSource: 'inquiry',
      consentType: 'implied',
      consentTimestamp: daysAgo(200, now),
      now,
    });

    expect(state.kind).toBe('implied_expired');
    expect(state.tone).toBe('error');
    expect(state.label).toMatch(/expired/i);
  });

  it('returns express_on_file when express_written exists, even with old inquiry', () => {
    const evidence =
      'Signed consent form returned via email 2024-08-15; estimate request from website';
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(200, now),
      consentSource: 'web_form',
      consentType: 'express_written',
      consentTimestamp: daysAgo(40, now),
      consentEvidence: evidence,
      now,
    });

    expect(state.kind).toBe('express_on_file');
    expect(state.tone).toBe('success');
    expect(state.detail).toBeDefined();
    // Truncation cap is 80 — short evidence passes through.
    expect(state.detail).toBe(evidence);
  });

  it('truncates very long evidence in express_on_file detail', () => {
    const longEvidence = 'x'.repeat(200);
    const state = deriveConsentBadgeState({
      inquiryDate: null,
      consentSource: 'web_form',
      consentType: 'express_written',
      consentTimestamp: daysAgo(10, now),
      consentEvidence: longEvidence,
      now,
    });

    expect(state.kind).toBe('express_on_file');
    expect((state.detail ?? '').length).toBeLessThanOrEqual(80);
  });

  it('returns customer_valid when transaction was 600 days ago', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(600, now),
      consentSource: 'existing_customer',
      consentType: 'implied',
      consentTimestamp: daysAgo(600, now),
      now,
    });

    expect(state.kind).toBe('customer_valid');
    expect(state.tone).toBe('success');
    // 730 - 600 = 130 days remaining ≈ 4 months.
    expect(state.detail).toMatch(/4 months remaining/);
  });

  it('returns customer_expired when transaction was 800 days ago', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(800, now),
      consentSource: 'existing_customer',
      consentType: 'implied',
      consentTimestamp: daysAgo(800, now),
      now,
    });

    expect(state.kind).toBe('customer_expired');
    expect(state.tone).toBe('error');
    expect(state.label).toMatch(/expired/i);
  });

  it('returns not_recorded when inquiryDate is null and no consent record', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: null,
      now,
    });

    expect(state.kind).toBe('not_recorded');
    expect(state.tone).toBe('muted');
  });

  it('boundary: exactly 150 days = approaching (inclusive lower bound)', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(150, now),
      consentType: 'implied',
      now,
    });
    expect(state.kind).toBe('implied_approaching');
  });

  it('boundary: exactly 180 days = expired (inclusive upper bound)', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(180, now),
      consentType: 'implied',
      now,
    });
    expect(state.kind).toBe('implied_expired');
  });

  it('boundary: 149 days = still valid', () => {
    const state = deriveConsentBadgeState({
      inquiryDate: daysAgo(149, now),
      consentType: 'implied',
      now,
    });
    expect(state.kind).toBe('implied_valid');
  });
});

describe('deriveInlineConsentIndicator', () => {
  const now = new Date('2026-05-07T12:00:00Z');

  it('returns null for fresh implied consent (< 150 days)', () => {
    expect(
      deriveInlineConsentIndicator({
        inquiryDate: daysAgo(50, now),
        consentType: 'implied',
        now,
      })
    ).toBeNull();
  });

  it('returns warning for 165-day inquiry', () => {
    const indicator = deriveInlineConsentIndicator({
      inquiryDate: daysAgo(165, now),
      consentType: 'implied',
      now,
    });
    expect(indicator?.tone).toBe('warning');
    expect(indicator?.tooltip).toMatch(/closing in 15 days/);
  });

  it('returns error for 200-day inquiry', () => {
    const indicator = deriveInlineConsentIndicator({
      inquiryDate: daysAgo(200, now),
      consentType: 'implied',
      now,
    });
    expect(indicator?.tone).toBe('error');
  });

  it('returns null when express consent overrides expired implied window', () => {
    expect(
      deriveInlineConsentIndicator({
        inquiryDate: daysAgo(200, now),
        consentType: 'express_written',
        consentTimestamp: daysAgo(40, now),
        now,
      })
    ).toBeNull();
  });

  it('returns error when customer consent has expired (>730 days)', () => {
    const indicator = deriveInlineConsentIndicator({
      inquiryDate: daysAgo(800, now),
      consentSource: 'existing_customer',
      consentTimestamp: daysAgo(800, now),
      now,
    });
    expect(indicator?.tone).toBe('error');
  });
});
