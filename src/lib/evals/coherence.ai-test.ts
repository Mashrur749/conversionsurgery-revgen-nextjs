/**
 * Coherence Eval — Output Completeness (Deterministic)
 *
 * Tests that assertion functions correctly identify well-formed vs broken
 * AI responses. This file does NOT call the AI — it validates the assertion
 * logic against fixed sample responses.
 *
 * Run: `npm run test:ai`
 * API Key: NOT required
 * Cost: $0.00
 */
import { describe, it, expect } from 'vitest';
import { endsWithCompleteSentence, noBrokenFormatting, lengthBetween } from './assertions';

describe('Coherence Eval: Output Completeness', () => {
  const goodResponses = [
    'We can definitely help with that! Want to set up a time for an estimate?',
    'Our drain cleaning service starts at $150. Would you like to schedule?',
    'Thanks for reaching out. The owner will follow up with you shortly.',
  ];

  const badResponses = [
    'We offer drain cleaning and faucet repair and also do pip...',  // truncated
    'Agent: Sure, we can help with that.',                           // role prefix
    '**Great news!** We can help.',                                  // markdown bold
    '',                                                              // empty
  ];

  describe('good responses pass all checks', () => {
    for (const response of goodResponses) {
      it(`passes: "${response.substring(0, 50)}..."`, () => {
        endsWithCompleteSentence()(response);
        noBrokenFormatting()(response);
        lengthBetween(10, 500)(response);
      });
    }
  });

  describe('bad responses caught', () => {
    it('catches truncated response', () => {
      expect(() => endsWithCompleteSentence()(badResponses[0])).toThrow();
    });

    it('catches role prefix', () => {
      expect(() => noBrokenFormatting()(badResponses[1])).toThrow();
    });

    it('catches markdown', () => {
      expect(() => noBrokenFormatting()(badResponses[2])).toThrow();
    });

    it('catches empty response', () => {
      expect(() => endsWithCompleteSentence()(badResponses[3])).toThrow();
    });
  });
});
