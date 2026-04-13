import { describe, it, expect } from 'vitest';
import { shouldUpdateSummary } from './conversation-summary';

describe('shouldUpdateSummary', () => {
  it('returns false when message count is low', () => {
    expect(
      shouldUpdateSummary({ totalMessages: 10, lastMessageAt: new Date(), existingSummary: null })
    ).toBe(false);
  });

  it('returns true when messages > 20 and no summary', () => {
    expect(
      shouldUpdateSummary({ totalMessages: 25, lastMessageAt: new Date(), existingSummary: null })
    ).toBe(true);
  });

  it('returns true on re-engagement after 24h gap', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(
      shouldUpdateSummary({ totalMessages: 15, lastMessageAt: yesterday, existingSummary: null })
    ).toBe(true);
  });

  it('returns false when gap is under 24h', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000);
    expect(
      shouldUpdateSummary({ totalMessages: 15, lastMessageAt: recent, existingSummary: null })
    ).toBe(false);
  });

  it('returns true when 10+ new messages since last summary', () => {
    expect(
      shouldUpdateSummary({
        totalMessages: 35,
        lastMessageAt: new Date(),
        existingSummary: 'existing',
        summaryMessageCount: 22,
      })
    ).toBe(true);
  });

  it('returns false when summary is recent enough', () => {
    expect(
      shouldUpdateSummary({
        totalMessages: 25,
        lastMessageAt: new Date(),
        existingSummary: 'existing',
        summaryMessageCount: 22,
      })
    ).toBe(false);
  });
});
