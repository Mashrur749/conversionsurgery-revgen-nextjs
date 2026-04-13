/**
 * Grounding Eval — KB Boundary Respect
 *
 * Tests that the AI stays within knowledge base boundaries: answering
 * confidently when information is present, deferring to the owner when
 * it is absent or ambiguous, and never hallucinating services or pricing.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.01-0.03 per run (Haiku-tier, 15 cases)
 * Time: ~30-60 seconds total
 */
import { describe, it, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import { mentions, doesNotMention } from './assertions';
import { doesNotHallucinate } from './judge';
import groundingInputs from './datasets/knowledge-grounding-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)('Grounding Eval: KB Boundary Respect', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of groundingInputs) {
    describe(input.id, () => {
      let response: string;

      beforeAll(async () => {
        const result = await ai.chat(
          [{ role: 'user', content: input.customerMessage }],
          {
            systemPrompt: `You are a helpful assistant for a home services business.\n\n## BUSINESS KNOWLEDGE\n${input.kbContext}\n\nRespond naturally over SMS. If you don't know something, defer to the owner.`,
            temperature: 0.3,
            model: 'fast',
            maxTokens: 200,
          }
        );
        response = result.content;
      });

      if (input.mustContain.length > 0) {
        it('contains expected terms', () => {
          mentions(...input.mustContain)(response);
        });
      }

      if (input.mustNotContain.length > 0) {
        it('does not contain forbidden terms', () => {
          doesNotMention(...input.mustNotContain)(response);
        });
      }

      it('does not hallucinate beyond KB', async () => {
        await doesNotHallucinate(ai, input.kbContext)(response);
      });
    });
  }
});
