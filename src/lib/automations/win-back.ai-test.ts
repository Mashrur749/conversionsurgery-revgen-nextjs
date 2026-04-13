/**
 * Win-Back Eval — Re-engagement Message Quality
 *
 * Tests that AI-generated win-back messages are human-sounding, concise,
 * free of banned phrases, and never use urgency or scarcity language.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.01-0.02 per run (Haiku-tier, 10 cases)
 * Time: ~30-60 seconds total
 */
import { describe, it, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import { buildGuardrailPrompt } from '@/lib/agent/guardrails';
import { maxLength, doesNotMention } from '@/lib/evals/assertions';
import { soundsHuman } from '@/lib/evals/judge';
import dataset from '@/lib/evals/datasets/win-back-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

describe.skipIf(!HAS_KEY)('Win-Back Eval: Re-engagement Message Quality', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of dataset) {
    describe(input.id, () => {
      let response: string;

      beforeAll(async () => {
        const attemptPrompt = input.attempt === 1
          ? `This is the FIRST re-engagement. Reference their specific project naturally.`
          : `This is the FINAL follow-up. Even shorter — just a soft "still here if you need us" vibe. 1 sentence max.`;

        const conversationHistory = input.conversationHistory
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join('\n');

        const guardrailText = buildGuardrailPrompt({
          ownerName: input.ownerName,
          businessName: input.businessName,
          agentTone: 'casual',
          messagesWithoutResponse: 0,
          canDiscussPricing: false,
        });

        const result = await ai.chat(
          [
            {
              role: 'user',
              content: `Write a re-engagement text (attempt ${input.attempt} of 2) for ${input.leadName}.`,
            },
          ],
          {
            systemPrompt: `You're writing a casual follow-up text from ${input.ownerName} at ${input.businessName}.
Write like a real person texting — not a marketer, not a chatbot.

${attemptPrompt}

Rules:
- 1-2 short sentences maximum
- Reference their specific project from conversation history
- Give them an easy out — "no rush", "whenever you're ready"
- NEVER mention how long it's been since you last talked
- NEVER use "just checking in"
- NEVER use urgency, scarcity, or promotional language
- NEVER reference weather, news, or unverifiable external claims
- Sound slightly informal — contractions, short sentences
- End with a soft ask, not a hard CTA
- Do NOT start with "Hi" or "Hello" — just jump in casually

Good: "Hey Mike, just wanted to follow up on the deck project. Let me know if you'd like to get that estimate set up."
Bad: "Hi Michael! Just checking in about your recent inquiry. We'd love to help!"

${guardrailText}

Conversation context:
${conversationHistory}

Project info: ${input.projectType}`,
            temperature: 0.9,
            model: 'fast',
            maxTokens: 100,
          },
        );
        response = result.content.trim();
      });

      it('fits within SMS limit (160 chars)', () => {
        maxLength(160)(response);
      });

      it('does not use "just checking in"', () => {
        doesNotMention('just checking in')(response);
      });

      it('does not use urgency or scarcity language', () => {
        doesNotMention('limited time', 'act now', 'hurry', 'expires', 'special offer')(response);
      });

      it('sounds like a real human texting', async () => {
        await soundsHuman(ai)(response);
      });
    });
  }
});
