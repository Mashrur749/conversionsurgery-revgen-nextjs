/**
 * Signal Detection Eval — Accuracy Against Labeled Data
 *
 * Tests that the AI correctly detects customer signals (urgency, frustration,
 * purchase intent, browsing, price sensitivity) from conversation messages.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.02-0.04 per run (Haiku-tier, 20 cases)
 * Time: ~45-90 seconds total
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import signalInputs from '@/lib/evals/datasets/signal-detection-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

interface DetectedSignals {
  urgentNeed: boolean;
  frustrated: boolean;
  readyToSchedule: boolean;
  justBrowsing: boolean;
  priceObjection: boolean;
}

describe.skipIf(!HAS_KEY)('Signal Detection Eval: Accuracy Against Labeled Data', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of signalInputs) {
    describe(input.id, () => {
      let detected: DetectedSignals;
      let parseError: string | null = null;

      beforeAll(async () => {
        const formattedMessages = input.messages
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join('\n');

        const result = await ai.chat(
          [
            {
              role: 'user',
              content: `Analyze this conversation and detect customer signals.
Return ONLY a JSON object with these boolean fields:
urgentNeed, frustrated, readyToSchedule, justBrowsing, priceObjection

Messages:
${formattedMessages}`,
            },
          ],
          {
            model: 'fast',
            temperature: 0.3,
            maxTokens: 200,
          },
        );

        try {
          const raw = result.content.trim();
          // Strip markdown code fences if present
          const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          detected = JSON.parse(jsonStr) as DetectedSignals;
        } catch {
          parseError = `Failed to parse JSON response: ${result.content.trim().substring(0, 200)}`;
          detected = {
            urgentNeed: false,
            frustrated: false,
            readyToSchedule: false,
            justBrowsing: false,
            priceObjection: false,
          };
        }
      });

      it('response parsed as valid JSON', () => {
        if (parseError) {
          throw new Error(parseError);
        }
      });

      it('urgentNeed signal matches expected', () => {
        if (parseError) return; // skip if parse failed
        expect(detected.urgentNeed).toBe(input.expectedSignals.urgentNeed);
      });

      it('frustrated signal matches expected', () => {
        if (parseError) return;
        expect(detected.frustrated).toBe(input.expectedSignals.frustrated);
      });

      it('readyToSchedule signal matches expected', () => {
        if (parseError) return;
        expect(detected.readyToSchedule).toBe(input.expectedSignals.readyToSchedule);
      });

      it('justBrowsing signal matches expected', () => {
        if (parseError) return;
        expect(detected.justBrowsing).toBe(input.expectedSignals.justBrowsing);
      });

      it('priceObjection signal matches expected', () => {
        if (parseError) return;
        expect(detected.priceObjection).toBe(input.expectedSignals.priceObjection);
      });
    });
  }
});
