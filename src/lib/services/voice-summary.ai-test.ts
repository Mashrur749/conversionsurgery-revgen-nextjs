/**
 * Voice Summary Eval — Call Summary Quality
 *
 * Tests that AI-generated voice call summaries are appropriately concise,
 * cover expected points, and end with a complete sentence.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.01-0.02 per run (Haiku-tier, 10 cases)
 * Time: ~30-60 seconds total
 */
import { describe, it, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import { lengthBetween, mentions, endsWithCompleteSentence } from '@/lib/evals/assertions';
import voiceSummaryInputs from '@/lib/evals/datasets/voice-summary-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)('Voice Summary Eval: Call Summary Quality', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of voiceSummaryInputs) {
    describe(input.id, () => {
      let response: string;

      beforeAll(async () => {
        const result = await ai.chat(
          [
            {
              role: 'user',
              content: `Summarize this phone call transcript in 2-3 sentences.
Include: what the caller wanted, key details, and next steps.

${input.transcript}`,
            },
          ],
          {
            model: 'fast',
            temperature: 0.5,
            maxTokens: 150,
          },
        );
        response = result.content.trim();
      });

      it('summary is a reasonable length (50-500 chars)', () => {
        lengthBetween(50, 500)(response);
      });

      it('summary covers expected points', () => {
        mentions(...input.expectedPoints)(response);
      });

      it('summary ends with a complete sentence', () => {
        endsWithCompleteSentence()(response);
      });
    });
  }
});
