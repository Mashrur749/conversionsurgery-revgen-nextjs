import { describe, it, expect } from 'vitest';
import { truncateAtSentence } from './text';

describe('truncateAtSentence', () => {
  it('returns text unchanged when under limit', () => {
    expect(truncateAtSentence('Hello world.', 50)).toBe('Hello world.');
  });

  it('returns text unchanged when at exact limit', () => {
    const text = 'Hello world.';
    expect(truncateAtSentence(text, text.length)).toBe(text);
  });

  it('handles empty string', () => {
    expect(truncateAtSentence('', 10)).toBe('');
  });

  it('truncates at period boundary', () => {
    // Sentence ends at index 14 ('.'), window = 20, midpoint = 10 — 14 > 10, uses sentence
    const text = 'First sentence. Second sentence that is very long and goes over the limit.';
    const result = truncateAtSentence(text, 20);
    expect(result).toBe('First sentence.');
  });

  it('truncates at exclamation mark', () => {
    // Sentence ends at index 10 ('!'), window = 18, midpoint = 9 — 10 > 9, uses sentence
    const text = 'Great news! This part is much too long to include in the output here.';
    const result = truncateAtSentence(text, 18);
    expect(result).toBe('Great news!');
  });

  it('truncates at question mark', () => {
    const text = 'Are you sure? This additional content is too long to fit within the limit.';
    const result = truncateAtSentence(text, 20);
    expect(result).toBe('Are you sure?');
  });

  it('falls back to word boundary when no sentence end in back half', () => {
    // No sentence boundary in the back half (after position 50% = 15)
    const text = 'This is a very long sentence without any early termination point here';
    const result = truncateAtSentence(text, 30);
    expect(result).not.toContain('.');
    // Should end at a word boundary (no mid-word cut)
    const words = result.split(' ');
    const lastWord = words[words.length - 1];
    expect(text).toContain(lastWord);
    expect(result).toBe(result.trim());
  });

  it('handles single word exceeding limit', () => {
    const text = 'Superlongwordwithnospaces';
    const result = truncateAtSentence(text, 10);
    // No space found, returns raw substring
    expect(result).toBe('Superlongw');
    expect(result.length).toBe(10);
  });

  it('trims trailing whitespace', () => {
    const text = 'Hello.   Extra content that goes way beyond the limit here.';
    const result = truncateAtSentence(text, 15);
    expect(result).toBe(result.trim());
    expect(result).not.toMatch(/\s+$/);
  });

  it('uses sentence boundary in back half of limit', () => {
    // Sentence boundary at position 20, limit 30 — 20 > 15 (50%) → should use sentence
    const text = 'Short first sentence. Then a longer second sentence continues here.';
    const result = truncateAtSentence(text, 30);
    expect(result).toBe('Short first sentence.');
  });

  it('picks last complete sentence that fits', () => {
    // 'One. Two. Three. Four. This' truncated to 27 chars
    // Last sentence boundary in back half: 'Four.' ends at index 21, midpoint 13 — 21 > 13
    const text = 'One. Two. Three. Four. This final part is too long to include.';
    const result = truncateAtSentence(text, 27);
    expect(result).toBe('One. Two. Three. Four.');
    expect(result.length).toBeLessThanOrEqual(27);
  });

  it('does not produce trailing ellipsis', () => {
    const text = 'This is a sentence. And this part goes over the limit here at some point.';
    const result = truncateAtSentence(text, 30);
    expect(result).not.toMatch(/\.\.\.$/);
  });

  it('skips sentence boundary in front half, uses word boundary instead', () => {
    // "Hi." ends at position 2, which is < 50% of 50 (25), so word boundary should be used
    const text = 'Hi. This is a longer sentence without more periods in this text here';
    const result = truncateAtSentence(text, 50);
    // Should NOT be "Hi." — that's too short (front half)
    // Should truncate at last word boundary within 50 chars
    expect(result).not.toBe('Hi.');
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).not.toContain('...');
  });

  it('does not cut mid-word', () => {
    const text = 'No sentence here but words are important in this text output';
    const result = truncateAtSentence(text, 20);
    // The char at position 20 is mid-word, should fall back to last space
    expect(result).toBe(result.trim());
    const charAfterResult = text[result.length];
    // Either result ends at a space or end of text
    expect(charAfterResult === ' ' || charAfterResult === undefined).toBe(true);
  });
});
