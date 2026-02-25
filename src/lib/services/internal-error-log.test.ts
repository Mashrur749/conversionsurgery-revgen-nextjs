import { describe, expect, it } from 'vitest';
import { sanitizeLogText, sanitizeLogValue } from '@/lib/services/internal-error-log';

describe('sanitizeLogText', () => {
  it('redacts bearer tokens', () => {
    const input = 'Authorization: Bearer abc.def.ghi';
    const output = sanitizeLogText(input);
    expect(output).toContain('Bearer [REDACTED]');
    expect(output).not.toContain('abc.def.ghi');
  });

  it('redacts OpenAI-style keys', () => {
    const input = 'key=sk-1234567890abcdef1234567890abcdef';
    const output = sanitizeLogText(input);
    expect(output).toContain('sk-[REDACTED]');
    expect(output).not.toContain('1234567890abcdef1234567890abcdef');
  });

  it('truncates long strings', () => {
    const input = 'x'.repeat(2000);
    const output = sanitizeLogText(input, 100);
    expect(output.length).toBeLessThanOrEqual(120);
    expect(output).toContain('[truncated]');
  });

  it('redacts phone numbers in free-form strings', () => {
    const input = 'from +1 (403) 123-4567 to +1-780-999-1111';
    const output = sanitizeLogText(input);
    expect(output).toContain('[PHONE:4567]');
    expect(output).toContain('[PHONE:1111]');
    expect(output).not.toContain('403');
    expect(output).not.toContain('780');
  });
});

describe('sanitizeLogValue', () => {
  it('redacts body and token fields by key name', () => {
    const output = sanitizeLogValue({
      Body: 'Hi there this is private customer message',
      authToken: 'super-secret-token',
      from: '+1-403-123-4567',
    }) as Record<string, unknown>;

    expect(output.Body).toBe('[REDACTED_TEXT] length=41');
    expect(output.authToken).toBe('[REDACTED_SECRET]');
    expect(output.from).toBe('[PHONE:4567]');
  });

  it('keeps non-sensitive metadata keys readable', () => {
    const output = sanitizeLogValue({
      messageSidSuffix: 'SM1234ABCD',
      messageClassification: 'inbound_reply',
      route: '/api/webhooks/twilio/sms',
    }) as Record<string, unknown>;

    expect(output.messageSidSuffix).toBe('SM1234ABCD');
    expect(output.messageClassification).toBe('inbound_reply');
    expect(output.route).toBe('/api/webhooks/twilio/sms');
  });
});
