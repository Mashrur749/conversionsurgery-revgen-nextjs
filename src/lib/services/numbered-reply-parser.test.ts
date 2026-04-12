import { describe, it, expect } from 'vitest';
import {
  isNumberedReply,
  parseNumberedReply,
} from './numbered-reply-parser';

describe('isNumberedReply', () => {
  it('accepts bare digits', () => {
    expect(isNumberedReply('1')).toBe(true);
    expect(isNumberedReply('3')).toBe(true);
    expect(isNumberedReply('0')).toBe(true);
  });

  it('accepts W/L patterns', () => {
    expect(isNumberedReply('W1')).toBe(true);
    expect(isNumberedReply('L2')).toBe(true);
    expect(isNumberedReply('W13 L2')).toBe(true);
    expect(isNumberedReply('W')).toBe(true);
    expect(isNumberedReply('L')).toBe(true);
  });

  it('accepts with whitespace', () => {
    expect(isNumberedReply(' 1 ')).toBe(true);
    expect(isNumberedReply(' W1 ')).toBe(true);
  });

  it('rejects natural language', () => {
    expect(isNumberedReply('hello')).toBe(false);
    expect(isNumberedReply('EST Sarah')).toBe(false);
    expect(isNumberedReply('YES')).toBe(false);
    expect(isNumberedReply('WON A1B2C3D4')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isNumberedReply('')).toBe(false);
    expect(isNumberedReply('  ')).toBe(false);
  });

  it('rejects long strings', () => {
    expect(isNumberedReply('W12345678901234567890X')).toBe(false);
  });
});

describe('parseNumberedReply', () => {
  describe('bare digit selection', () => {
    it('selects option 1', () => {
      const result = parseNumberedReply('1', 3);
      expect(result).toEqual({
        matched: true,
        skipAll: false,
        selections: [{ index: 1, action: 'select' }],
      });
    });

    it('selects option 3 out of 5', () => {
      const result = parseNumberedReply('3', 5);
      expect(result).toEqual({
        matched: true,
        skipAll: false,
        selections: [{ index: 3, action: 'select' }],
      });
    });

    it('rejects out of range', () => {
      expect(parseNumberedReply('4', 3).matched).toBe(false);
      expect(parseNumberedReply('0', 3).skipAll).toBe(true); // 0 = skip
      expect(parseNumberedReply('99', 5).matched).toBe(false);
    });
  });

  describe('skip all', () => {
    it('parses 0 as skip all', () => {
      const result = parseNumberedReply('0', 3);
      expect(result).toEqual({ matched: true, skipAll: true, selections: [] });
    });
  });

  describe('bare W / L (all won / all lost)', () => {
    it('W marks all as won', () => {
      const result = parseNumberedReply('W', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 2, action: 'won' },
        { index: 3, action: 'won' },
      ]);
    });

    it('L marks all as lost', () => {
      const result = parseNumberedReply('L', 2);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'lost' },
        { index: 2, action: 'lost' },
      ]);
    });

    it('is case insensitive', () => {
      expect(parseNumberedReply('w', 3).matched).toBe(true);
      expect(parseNumberedReply('l', 2).matched).toBe(true);
    });
  });

  describe('W/L with digits', () => {
    it('W1 marks option 1 as won', () => {
      const result = parseNumberedReply('W1', 3);
      expect(result).toEqual({
        matched: true,
        skipAll: false,
        selections: [{ index: 1, action: 'won' }],
      });
    });

    it('L2 marks option 2 as lost', () => {
      const result = parseNumberedReply('L2', 3);
      expect(result).toEqual({
        matched: true,
        skipAll: false,
        selections: [{ index: 2, action: 'lost' }],
      });
    });

    it('W13 marks 1 and 3 as won', () => {
      const result = parseNumberedReply('W13', 3);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 3, action: 'won' },
      ]);
    });
  });

  describe('compound W/L patterns', () => {
    it('W13 L2 — mixed outcomes', () => {
      const result = parseNumberedReply('W13 L2', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 2, action: 'lost' },
        { index: 3, action: 'won' },
      ]);
    });

    it('W13L2 — no space between groups', () => {
      const result = parseNumberedReply('W13L2', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 2, action: 'lost' },
        { index: 3, action: 'won' },
      ]);
    });

    it('L2W1 — reverse order works', () => {
      const result = parseNumberedReply('L2W1', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 2, action: 'lost' },
      ]);
    });

    it('W1,3 L2 — commas work', () => {
      const result = parseNumberedReply('W1,3 L2', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([
        { index: 1, action: 'won' },
        { index: 2, action: 'lost' },
        { index: 3, action: 'won' },
      ]);
    });
  });

  describe('case insensitivity', () => {
    it('w13 l2', () => {
      const result = parseNumberedReply('w13 l2', 3);
      expect(result.matched).toBe(true);
      expect(result.selections.length).toBe(3);
    });
  });

  describe('whitespace tolerance', () => {
    it('handles leading/trailing spaces', () => {
      const result = parseNumberedReply('  W1  ', 3);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([{ index: 1, action: 'won' }]);
    });

    it('handles spaces within groups', () => {
      const result = parseNumberedReply('W 1 3 L 2', 3);
      // After comma removal and split on W/L, "W 1 3" → digits "13", "L 2" → digit "2"
      expect(result.matched).toBe(true);
      expect(result.selections.length).toBe(3);
    });
  });

  describe('deduplication', () => {
    it('W11 deduplicates to single selection', () => {
      const result = parseNumberedReply('W11', 3);
      expect(result.selections).toEqual([{ index: 1, action: 'won' }]);
    });
  });

  describe('edge cases', () => {
    it('empty string', () => {
      expect(parseNumberedReply('', 3).matched).toBe(false);
    });

    it('maxIndex 0', () => {
      expect(parseNumberedReply('1', 0).matched).toBe(false);
    });

    it('out of range digit in compound', () => {
      expect(parseNumberedReply('W9', 3).matched).toBe(false);
    });

    it('invalid prefix', () => {
      expect(parseNumberedReply('X1', 3).matched).toBe(false);
    });

    it('natural language falls through', () => {
      expect(parseNumberedReply('hello', 3).matched).toBe(false);
    });

    it('YES falls through', () => {
      expect(parseNumberedReply('YES', 3).matched).toBe(false);
    });

    it('single digit maxIndex=1', () => {
      const result = parseNumberedReply('1', 1);
      expect(result.matched).toBe(true);
      expect(result.selections).toEqual([{ index: 1, action: 'select' }]);
    });
  });
});
