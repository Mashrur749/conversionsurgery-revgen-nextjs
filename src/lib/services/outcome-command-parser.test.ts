import { describe, it, expect } from 'vitest';
import { parseOutcomeCommand } from './outcome-command-parser';

describe('parseOutcomeCommand', () => {
  describe('WON command', () => {
    it('parses WON with ref code', () => {
      const result = parseOutcomeCommand('WON 4A');
      expect(result).toEqual({ matched: true, action: 'won', refCode: '4A' });
    });

    it('parses WON with ref code and revenue', () => {
      const result = parseOutcomeCommand('WON 4A 55000');
      expect(result).toEqual({ matched: true, action: 'won', refCode: '4A', revenueDollars: 55000 });
    });

    it('is case insensitive', () => {
      const result = parseOutcomeCommand('won 4a');
      expect(result).toEqual({ matched: true, action: 'won', refCode: '4A' });
    });

    it('handles whitespace', () => {
      const result = parseOutcomeCommand('  WON   3B  ');
      expect(result).toEqual({ matched: true, action: 'won', refCode: '3B' });
    });

    it('rejects WON without ref code', () => {
      expect(parseOutcomeCommand('WON')).toEqual({ matched: false });
    });

    it('rejects WON with zero revenue', () => {
      expect(parseOutcomeCommand('WON 4A 0')).toEqual({ matched: false });
    });

    it('parses multi-char ref codes', () => {
      const result = parseOutcomeCommand('WON 1Z');
      expect(result).toEqual({ matched: true, action: 'won', refCode: '1Z' });
    });
  });

  describe('LOST command', () => {
    it('parses LOST with ref code', () => {
      const result = parseOutcomeCommand('LOST 4A');
      expect(result).toEqual({ matched: true, action: 'lost', refCode: '4A' });
    });

    it('is case insensitive', () => {
      const result = parseOutcomeCommand('lost 3b');
      expect(result).toEqual({ matched: true, action: 'lost', refCode: '3B' });
    });

    it('rejects LOST without ref code', () => {
      expect(parseOutcomeCommand('LOST')).toEqual({ matched: false });
    });
  });

  describe('WINS command', () => {
    it('parses WINS', () => {
      expect(parseOutcomeCommand('WINS')).toEqual({ matched: true, action: 'wins' });
    });

    it('is case insensitive', () => {
      expect(parseOutcomeCommand('wins')).toEqual({ matched: true, action: 'wins' });
    });

    it('handles whitespace', () => {
      expect(parseOutcomeCommand('  WINS  ')).toEqual({ matched: true, action: 'wins' });
    });
  });

  describe('non-matching input', () => {
    it('returns matched: false for regular messages', () => {
      expect(parseOutcomeCommand('Hello there')).toEqual({ matched: false });
    });

    it('returns matched: false for partial matches', () => {
      expect(parseOutcomeCommand('I WON the lottery')).toEqual({ matched: false });
    });

    it('returns matched: false for EST command', () => {
      expect(parseOutcomeCommand('EST John')).toEqual({ matched: false });
    });

    it('returns matched: false for STOP', () => {
      expect(parseOutcomeCommand('STOP')).toEqual({ matched: false });
    });
  });
});
