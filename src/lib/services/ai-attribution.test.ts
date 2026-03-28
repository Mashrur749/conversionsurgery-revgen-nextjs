import { describe, it, expect } from 'vitest';
import { classifyOutcome } from './ai-attribution';
import type { FunnelEventType } from './funnel-tracking';

describe('classifyOutcome', () => {
  describe('positive outcomes', () => {
    const positiveEvents: FunnelEventType[] = [
      'appointment_booked',
      'quote_accepted',
      'job_won',
      'payment_received',
      'review_received',
    ];

    it.each(positiveEvents)('classifies %s as positive', (eventType) => {
      expect(classifyOutcome(eventType)).toBe('positive');
    });
  });

  describe('negative outcomes', () => {
    it('classifies job_lost as negative', () => {
      expect(classifyOutcome('job_lost')).toBe('negative');
    });
  });

  describe('neutral outcomes', () => {
    const neutralEvents: FunnelEventType[] = [
      'lead_created',
      'first_response',
      'qualified',
      'quote_requested',
      'quote_sent',
      'review_requested',
    ];

    it.each(neutralEvents)('classifies %s as neutral', (eventType) => {
      expect(classifyOutcome(eventType)).toBe('neutral');
    });
  });

  describe('completeness', () => {
    const allEventTypes: FunnelEventType[] = [
      'lead_created',
      'first_response',
      'qualified',
      'appointment_booked',
      'quote_requested',
      'quote_sent',
      'quote_accepted',
      'job_won',
      'job_lost',
      'payment_received',
      'review_requested',
      'review_received',
    ];

    it('every FunnelEventType is classified', () => {
      for (const eventType of allEventTypes) {
        const result = classifyOutcome(eventType);
        expect(['positive', 'negative', 'neutral']).toContain(result);
      }
    });
  });
});
