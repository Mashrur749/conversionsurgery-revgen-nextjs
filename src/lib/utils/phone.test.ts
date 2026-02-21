import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  formatPhoneNumber,
  isValidPhoneNumber,
} from './phone';

describe('normalizePhoneNumber', () => {
  it('passes through E.164 format unchanged', () => {
    expect(normalizePhoneNumber('+14165551234')).toBe('+14165551234');
  });

  it('adds +1 to 10-digit Canadian/US numbers', () => {
    expect(normalizePhoneNumber('4165551234')).toBe('+14165551234');
  });

  it('strips formatting characters', () => {
    expect(normalizePhoneNumber('(416) 555-1234')).toBe('+14165551234');
  });

  it('handles 11-digit with leading 1', () => {
    expect(normalizePhoneNumber('14165551234')).toBe('+14165551234');
  });

  it('returns original for unparseable input', () => {
    expect(normalizePhoneNumber('abc')).toBe('abc');
  });
});

describe('formatPhoneNumber', () => {
  it('formats E.164 to national format', () => {
    const result = formatPhoneNumber('+14165551234');
    expect(result).toMatch(/\d{3}.*\d{3}.*\d{4}/);
  });

  it('returns original for unparseable input', () => {
    expect(formatPhoneNumber('abc')).toBe('abc');
  });
});

describe('isValidPhoneNumber', () => {
  it('returns true for valid number', () => {
    expect(isValidPhoneNumber('+14165551234')).toBe(true);
  });

  it('returns true for 10-digit Canadian number', () => {
    expect(isValidPhoneNumber('4165551234')).toBe(true);
  });

  it('returns false for invalid input', () => {
    expect(isValidPhoneNumber('abc')).toBe(false);
  });

  it('returns false for too-short number', () => {
    expect(isValidPhoneNumber('123')).toBe(false);
  });
});
