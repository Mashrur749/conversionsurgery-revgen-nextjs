/**
 * No-Show Recovery Eval — Follow-Up Message Quality
 *
 * Tests that AI-generated no-show recovery messages are warm, empathetic,
 * free of guilt language, and focused on rescheduling.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.01-0.02 per run (Haiku-tier, 10 cases)
 * Time: ~30-60 seconds total
 */
import { describe, it, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import { maxLength, doesNotMention } from '@/lib/evals/assertions';
import { sentimentIs } from '@/lib/evals/judge';
import dataset from '@/lib/evals/datasets/no-show-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)('No-Show Recovery Eval: Follow-Up Message Quality', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of dataset) {
    describe(input.id, () => {
      let response: string;

      beforeAll(async () => {
        const attemptPrompt = input.attempt === 1
          ? `This is the FIRST follow-up after a no-show. Be warm and understanding. Reference their specific project if known.`
          : `This is the SECOND and FINAL follow-up. Be even shorter and more casual. Give them an easy out.`;

        const conversationHistory = input.conversationHistory
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join('\n');

        const result = await ai.chat(
          [
            {
              role: 'user',
              content: `Write a follow-up text message (attempt ${input.attempt} of 2).`,
            },
          ],
          {
            systemPrompt: `You are writing a no-show follow-up SMS from ${input.ownerName} at ${input.businessName}.
The customer "${input.leadName}" missed their appointment on ${input.appointmentDate} at ${input.appointmentTime}.

${attemptPrompt}

Rules:
- 1-2 short sentences maximum
- Be warm and understanding — no guilt, no pressure
- Offer to reschedule, make it easy
- Do NOT use exclamation marks excessively
- Do NOT use "just checking in"

Conversation context:
${conversationHistory}

Project info: ${input.projectType}`,
            temperature: 0.8,
            model: 'fast',
            maxTokens: 150,
          },
        );
        response = result.content.trim();
      });

      it('fits within SMS limit (200 chars)', () => {
        maxLength(200)(response);
      });

      it('does not use guilt language', () => {
        doesNotMention('missed', 'forgot', 'no-show', "didn't show")(response);
      });

      it('does not use "just checking in"', () => {
        doesNotMention('just checking in')(response);
      });

      it('conveys an empathetic sentiment', async () => {
        await sentimentIs(ai, 'empathetic')(response);
      });
    });
  }
});
