import { describe, expect, it } from 'vitest';
import {
  QUIET_HOURS_MESSAGE_CLASSIFICATIONS,
  QUIET_HOURS_POLICY_MODES,
  resolveQuietHoursDecision,
} from '@/lib/compliance/quiet-hours-policy';

describe('resolveQuietHoursDecision', () => {
  it('fails closed when classification is missing', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: true,
      policyMode: QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE,
      messageClassification: null,
    });

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('Missing quiet-hours message classification');
  });

  it('sends immediately outside quiet hours', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: false,
      queueOnQuietHours: true,
      policyMode: QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.PROACTIVE_OUTREACH,
    });

    expect(result.decision).toBe('send');
  });

  it('queues all outbound in strict mode when quiet hours are active', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: true,
      policyMode: QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.INBOUND_REPLY,
    });

    expect(result.decision).toBe('queue');
  });

  it('blocks all outbound in strict mode when queueing is disabled', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: false,
      policyMode: QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.INBOUND_REPLY,
    });

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('strict queue mode');
  });

  it('allows inbound replies in inbound-allowed mode during quiet hours', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: true,
      policyMode: QUIET_HOURS_POLICY_MODES.INBOUND_REPLY_ALLOWED,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.INBOUND_REPLY,
    });

    expect(result.decision).toBe('send');
  });

  it('queues proactive outreach in inbound-allowed mode during quiet hours', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: true,
      policyMode: QUIET_HOURS_POLICY_MODES.INBOUND_REPLY_ALLOWED,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.PROACTIVE_OUTREACH,
    });

    expect(result.decision).toBe('queue');
  });

  it('blocks proactive outreach when queueing is disabled in inbound-allowed mode', () => {
    const result = resolveQuietHoursDecision({
      isQuietHours: true,
      queueOnQuietHours: false,
      policyMode: QUIET_HOURS_POLICY_MODES.INBOUND_REPLY_ALLOWED,
      messageClassification: QUIET_HOURS_MESSAGE_CLASSIFICATIONS.PROACTIVE_OUTREACH,
    });

    expect(result.decision).toBe('block');
    expect(result.reason).toContain('proactive outreach deferred');
  });
});

