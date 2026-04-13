/**
 * Retrieval Eval — Synonym Expansion Coverage (Deterministic)
 *
 * Tests that the synonym expansion function bridges the vocabulary gap between
 * how homeowners describe problems and how services are labelled in the KB.
 *
 * This is a deterministic test — no API calls needed.
 * Full pgvector retrieval testing will be added in a later phase when we
 * have a test database with embeddings.
 *
 * Run: `npm run test:ai`
 * API Key: NOT required
 * Cost: $0.00
 */
import { describe, it, expect } from 'vitest';
import { expandQueryWithSynonyms } from '@/lib/data/trade-synonyms';
import retrievalInputs from './datasets/retrieval-inputs.json';

interface KbEntry {
  title: string;
  content: string;
}

describe('Retrieval Eval: Synonym Expansion Coverage', () => {
  for (const input of retrievalInputs) {
    it(`${input.id}: query "${input.query}" expands to cover expected matches`, () => {
      // Entries with no expected matches are negative / ambiguous cases — nothing to assert
      if (input.expectedMatches.length === 0) return;

      const expanded = expandQueryWithSynonyms(input.query);

      // Track which expected titles are covered by synonym expansion
      let coveredCount = 0;
      const uncoveredTitles: string[] = [];

      for (const expectedTitle of input.expectedMatches) {
        const entry = input.kbEntries.find((e: KbEntry) => e.title === expectedTitle);
        if (!entry) continue;

        const entryWords = (entry.title + ' ' + entry.content).toLowerCase().split(/\s+/);
        const overlap = expanded.some((term) =>
          entryWords.some((w) => w.includes(term) || term.includes(w)),
        );

        if (overlap) {
          coveredCount++;
        } else {
          uncoveredTitles.push(expectedTitle);
        }
      }

      // At least one expected match must be reachable via synonym expansion.
      // Conceptual-only matches (requiring semantic understanding) may not be
      // coverable by keyword expansion alone.
      expect(
        coveredCount,
        `Expanded query covers 0 of ${input.expectedMatches.length} expected matches. ` +
        `Uncovered: [${uncoveredTitles.join(', ')}]. ` +
        `Expanded terms: [${expanded.join(', ')}]`,
      ).toBeGreaterThan(0);
    });
  }
});
