import { describe, it, expect } from 'vitest';
import {
  formatDigestSms,
  buildDigestActionPayload,
  type DigestItem,
} from './contractor-digest';

// ── formatDigestSms ──────────────────────────────────────────────────────────

describe('formatDigestSms', () => {
  it('formats a digest with mixed item types', () => {
    const items: DigestItem[] = [
      { type: 'estimate_prompt', id: 'lead-1', label: 'Sarah T.' },
      { type: 'won_lost_prompt', id: 'lead-2', label: 'Mike R.' },
      { type: 'kb_gap', id: 'gap-1', label: 'Do you offer financing?' },
    ];

    const sms = formatDigestSms('Alpine Concrete', items);

    // Header
    expect(sms).toContain('Morning update for Alpine Concrete:');

    // Lead section
    expect(sms).toContain('2 leads need input:');
    expect(sms).toContain('1. Sarah T. — sent quote? Reply 1=YES');
    expect(sms).toContain('2. Mike R. — won or lost? Reply W2 or L2');

    // KB section
    expect(sms).toContain('1 question from a homeowner:');
    expect(sms).toContain('3. "Do you offer financing?" Reply with answer');

    // Skip option
    expect(sms).toContain('Reply 0 to skip all.');
  });

  it('formats a digest with only KB gaps', () => {
    const items: DigestItem[] = [
      { type: 'kb_gap', id: 'gap-1', label: 'Do you serve Edmonton?' },
      { type: 'kb_gap', id: 'gap-2', label: 'What is your warranty?' },
    ];

    const sms = formatDigestSms('Elite Roofing', items);

    expect(sms).toContain('Morning update for Elite Roofing:');
    expect(sms).not.toContain('leads need input');
    expect(sms).toContain('2 questions from a homeowner:');
    expect(sms).toContain('1. "Do you serve Edmonton?" Reply with answer');
    expect(sms).toContain('2. "What is your warranty?" Reply with answer');
    expect(sms).toContain('Reply 0 to skip all.');
  });

  it('formats a digest with only estimate prompts', () => {
    const items: DigestItem[] = [
      { type: 'estimate_prompt', id: 'lead-1', label: 'Jane D.' },
    ];

    const sms = formatDigestSms('Quick Fix Plumbing', items);

    expect(sms).toContain('Morning update for Quick Fix Plumbing:');
    expect(sms).toContain('1 lead needs input:');
    expect(sms).toContain('1. Jane D. — sent quote? Reply 1=YES');
    expect(sms).not.toContain('question');
  });

  it('formats a digest with only won/lost prompts', () => {
    const items: DigestItem[] = [
      { type: 'won_lost_prompt', id: 'lead-1', label: 'Bob S.' },
      { type: 'won_lost_prompt', id: 'lead-2', label: 'Amy L.' },
    ];

    const sms = formatDigestSms('Top Builders', items);

    expect(sms).toContain('2 leads need input:');
    expect(sms).toContain('1. Bob S. — won or lost? Reply W1 or L1');
    expect(sms).toContain('2. Amy L. — won or lost? Reply W2 or L2');
  });

  it('truncates long KB gap questions', () => {
    const longQuestion = 'A'.repeat(80);
    const items: DigestItem[] = [
      { type: 'kb_gap', id: 'gap-1', label: longQuestion },
    ];

    const sms = formatDigestSms('Test Co', items);

    // Should be truncated to 57 chars + "..."
    expect(sms).toContain('...');
    expect(sms).not.toContain(longQuestion);
  });

  it('handles singular vs plural correctly', () => {
    const singleLead: DigestItem[] = [
      { type: 'estimate_prompt', id: 'lead-1', label: 'Sarah T.' },
    ];
    expect(formatDigestSms('Co', singleLead)).toContain('1 lead needs input:');

    const multiLeads: DigestItem[] = [
      { type: 'estimate_prompt', id: 'lead-1', label: 'Sarah T.' },
      { type: 'won_lost_prompt', id: 'lead-2', label: 'Mike R.' },
    ];
    expect(formatDigestSms('Co', multiLeads)).toContain('2 leads need input:');

    const singleGap: DigestItem[] = [
      { type: 'kb_gap', id: 'gap-1', label: 'Question?' },
    ];
    expect(formatDigestSms('Co', singleGap)).toContain('1 question from a homeowner:');

    const multiGaps: DigestItem[] = [
      { type: 'kb_gap', id: 'gap-1', label: 'Q1?' },
      { type: 'kb_gap', id: 'gap-2', label: 'Q2?' },
    ];
    expect(formatDigestSms('Co', multiGaps)).toContain('2 questions from a homeowner:');
  });
});

// ── buildDigestActionPayload ─────────────────────────────────────────────────

describe('buildDigestActionPayload', () => {
  it('builds payload with correct structure', () => {
    const items: DigestItem[] = [
      { type: 'estimate_prompt', id: 'lead-1', label: 'Sarah T.' },
      { type: 'won_lost_prompt', id: 'lead-2', label: 'Mike R.' },
      { type: 'kb_gap', id: 'gap-1', label: 'Do you offer financing?' },
    ];

    const payload = buildDigestActionPayload(items);

    expect(payload.interactionType).toBe('daily_digest');
    expect(payload.options).toHaveLength(3);

    const options = payload.options as Array<{
      index: number;
      type: string;
      id: string;
      label: string;
    }>;

    expect(options[0]).toEqual({
      index: 1,
      type: 'estimate_prompt',
      id: 'lead-1',
      label: 'Sarah T.',
    });
    expect(options[1]).toEqual({
      index: 2,
      type: 'won_lost_prompt',
      id: 'lead-2',
      label: 'Mike R.',
    });
    expect(options[2]).toEqual({
      index: 3,
      type: 'kb_gap',
      id: 'gap-1',
      label: 'Do you offer financing?',
    });
  });
});

// ── Max items cap ─────────────────────────────────────────────────────────────

describe('digest item cap', () => {
  it('formatDigestSms works with 8 items (max cap)', () => {
    const items: DigestItem[] = Array.from({ length: 8 }, (_, i) => ({
      type: 'kb_gap' as const,
      id: `gap-${i}`,
      label: `Question ${i + 1}?`,
    }));

    const sms = formatDigestSms('Test Co', items);
    expect(sms).toContain('8. "Question 8?" Reply with answer');
    expect(sms).toContain('8 questions from a homeowner:');
  });
});
