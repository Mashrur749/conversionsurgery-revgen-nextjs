/**
 * Booking Conversation Eval — Time Preference Extraction Accuracy
 *
 * Tests that the AI correctly extracts scheduling preferences from customer
 * messages, including ordinal references, day/time mentions, and null cases
 * where no clear preference is stated.
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.01 per run (Haiku-tier, 10 cases)
 * Time: ~20-40 seconds total
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider } from '@/lib/ai/types';
import bookingInputs from '@/lib/evals/datasets/booking-inputs.json';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

interface BookingSlot {
  date: string;
  time: string;
  displayDate: string;
  displayTime: string;
}

interface ExtractedPreference {
  date: string | null;
  time: string | null;
}

describe.skipIf(!HAS_KEY)('Booking Conversation Eval: Time Preference Extraction', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  for (const input of bookingInputs) {
    describe(input.id, () => {
      let result: ExtractedPreference;
      let parseError: string | null = null;

      beforeAll(async () => {
        const slotsFormatted = input.availableSlots
          .map((s: BookingSlot) => `- ${s.displayDate} at ${s.displayTime}`)
          .join('\n');

        const aiResult = await ai.chat(
          [
            {
              role: 'user',
              content: `Extract the customer's scheduling preference from their message.
Available slots:
${slotsFormatted}

Customer message: "${input.customerMessage}"

Return ONLY a JSON object: {"date": "YYYY-MM-DD" or null, "time": "HH:mm" or null}
If no clear preference, return {"date": null, "time": null}.`,
            },
          ],
          {
            model: 'fast',
            temperature: 0,
            maxTokens: 50,
          },
        );

        try {
          const raw = aiResult.content.trim();
          // Strip markdown code fences if present
          const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          result = JSON.parse(jsonStr) as ExtractedPreference;
        } catch {
          parseError = `Failed to parse JSON response: ${aiResult.content.trim().substring(0, 200)}`;
          result = { date: null, time: null };
        }
      });

      it('response parsed as valid JSON', () => {
        if (parseError) {
          throw new Error(parseError);
        }
      });

      if (input.expectedDate !== null && input.expectedTime !== null) {
        it(`extracts correct date: ${input.expectedDate}`, () => {
          if (parseError) return;
          expect(result.date).toBe(input.expectedDate);
        });

        it(`extracts correct time: ${input.expectedTime}`, () => {
          if (parseError) return;
          expect(result.time).toBe(input.expectedTime);
        });
      } else {
        it('returns null date when no clear preference', () => {
          if (parseError) return;
          expect(result.date).toBeNull();
        });

        it('returns null time when no clear preference', () => {
          if (parseError) return;
          expect(result.time).toBeNull();
        });
      }
    });
  }
});
