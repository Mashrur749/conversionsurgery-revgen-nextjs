/**
 * Review Response Eval — Response Quality by Rating Tier
 *
 * Tests that AI-generated review responses match the expected tone,
 * address the reviewer, avoid generic filler phrases, and respect
 * word-count limits based on rating tier.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.02-0.04 per run (Haiku-tier, 15 cases)
 * Time: ~45-90 seconds total
 */
import { describe, it, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import { maxLength, mentions, doesNotMention } from '@/lib/evals/assertions';
import { matchesTone } from '@/lib/evals/judge';
import dataset from '@/lib/evals/datasets/review-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

/** Rough word-count limit derived from maxLength and rating tier */
function wordLimit(maxLen: number, rating: number): number {
  if (rating <= 2) return maxLen;
  if (rating === 3) return Math.round(maxLen * 0.75);
  return Math.round(maxLen * 0.5);
}

describe.skipIf(!HAS_KEY)('Review Response Eval: Response Quality by Rating Tier', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of dataset) {
    describe(input.id, () => {
      let response: string;

      beforeAll(async () => {
        const isNegative = input.rating <= 2;
        const isNeutral = input.rating === 3;
        const wl = wordLimit(input.maxLength, input.rating);

        let contentInstructions: string;
        if (isNegative) {
          contentInstructions = `This is a negative review. Acknowledge concerns, apologize sincerely, offer to make it right. Under ${wl} words.`;
        } else if (isNeutral) {
          contentInstructions = `This is a 3-star review. Thank them, acknowledge concerns, highlight improvements. Under ${wl} words.`;
        } else {
          contentInstructions = `This is a positive review. Express genuine gratitude, reference something specific, keep it short. Under ${wl} words.`;
        }

        const result = await ai.chat(
          [
            {
              role: 'user',
              content: `${contentInstructions}

Review from ${input.authorName} (${input.rating} stars):
"${input.reviewText}"`,
            },
          ],
          {
            systemPrompt: `You are writing a response to a Google review for ${input.businessName}.
The review is from ${input.authorName}, rated ${input.rating}/5: "${input.reviewText}"

Tone: ${input.tone}
Sign as: ${input.ownerName}

CRITICAL:
- Never use phrases like "We apologize for any inconvenience" — be specific
- Never be defensive or make excuses
- Be authentic and human
- Don't use excessive exclamation points`,
            temperature: 0.7,
            model: 'fast',
            maxTokens: 300,
          },
        );
        response = result.content.trim();
      });

      it('matches the expected tone', async () => {
        await matchesTone(ai, input.tone)(response);
      });

      it('addresses the reviewer or acknowledges the review', () => {
        // For positive reviews: must mention author name or "thank"
        // For negative/neutral reviews: must mention author name or "sorry"/"apolog"
        if (input.rating >= 4) {
          mentions(input.authorName, 'thank')(response);
        } else {
          mentions(input.authorName, 'sorry', 'apolog')(response);
        }
      });

      it('does not use the generic apology filler phrase', () => {
        doesNotMention('apologize for any inconvenience')(response);
      });

      it('respects the word count limit for this rating tier', () => {
        const wl = wordLimit(input.maxLength, input.rating);
        const wordCount = response.split(/\s+/).filter(Boolean).length;
        if (wordCount > wl) {
          throw new Error(
            `Expected word count <= ${wl} for rating ${input.rating}, but got ${wordCount} words.\nResponse: ${response}`
          );
        }
      });
    });
  }
});
