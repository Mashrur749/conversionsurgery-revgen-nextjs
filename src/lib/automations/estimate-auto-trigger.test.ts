import { describe, expect, it } from 'vitest';
import { detectEstimateSentSignal } from './estimate-auto-trigger';

describe('detectEstimateSentSignal', () => {
  // --- Should trigger ---
  it('returns true for "waiting to hear back on that quote"', () => {
    expect(detectEstimateSentSignal('waiting to hear back on that quote')).toBe(true);
  });

  it('returns true for "comparing a few quotes"', () => {
    expect(detectEstimateSentSignal('comparing a few quotes')).toBe(true);
  });

  it('returns true for "got your estimate"', () => {
    expect(detectEstimateSentSignal('got your estimate')).toBe(true);
  });

  it('returns true for "received the quote"', () => {
    expect(detectEstimateSentSignal('received the quote')).toBe(true);
  });

  it('returns true for "sent us a price last week"', () => {
    expect(detectEstimateSentSignal('sent us a price last week')).toBe(true);
  });

  it('returns true for "discussing with my wife"', () => {
    expect(detectEstimateSentSignal('discussing with my wife')).toBe(true);
  });

  it('returns true for "reviewing the estimate"', () => {
    expect(detectEstimateSentSignal('reviewing the estimate')).toBe(true);
  });

  it('returns true for "reviewing the proposal"', () => {
    expect(detectEstimateSentSignal('reviewing the proposal')).toBe(true);
  });

  it('returns true for "waiting on the bid"', () => {
    expect(detectEstimateSentSignal('waiting on the bid')).toBe(true);
  });

  it('returns true for "need time to decide"', () => {
    expect(detectEstimateSentSignal('need time to decide')).toBe(true);
  });

  it('returns true for "thinking it over"', () => {
    expect(detectEstimateSentSignal('thinking it over')).toBe(true);
  });

  it('returns true for "comparing prices from a few contractors"', () => {
    expect(detectEstimateSentSignal('comparing prices from a few contractors')).toBe(true);
  });

  it('returns true for "discussing with my husband"', () => {
    expect(detectEstimateSentSignal('discussing with my husband')).toBe(true);
  });

  it('returns true for "discussing with my partner"', () => {
    expect(detectEstimateSentSignal('discussing with my partner')).toBe(true);
  });

  it('returns true for "discussing with my spouse"', () => {
    expect(detectEstimateSentSignal('discussing with my spouse')).toBe(true);
  });

  it('returns true for "we got the quote you sent"', () => {
    expect(detectEstimateSentSignal('we got the quote you sent')).toBe(true);
  });

  it('returns true for "you sent us a price"', () => {
    expect(detectEstimateSentSignal('you sent us a price')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(detectEstimateSentSignal('COMPARING A FEW QUOTES')).toBe(true);
    expect(detectEstimateSentSignal('Received The Estimate')).toBe(true);
  });

  // --- Should NOT trigger ---
  it('returns false for "When can you come take a look?"', () => {
    expect(detectEstimateSentSignal('When can you come take a look?')).toBe(false);
  });

  it('returns false for "How much does drain cleaning cost?"', () => {
    expect(detectEstimateSentSignal('How much does drain cleaning cost?')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(detectEstimateSentSignal('')).toBe(false);
  });

  it('returns false for "What services do you offer?"', () => {
    expect(detectEstimateSentSignal('What services do you offer?')).toBe(false);
  });

  it('returns false for "Can you come out next Tuesday?"', () => {
    expect(detectEstimateSentSignal('Can you come out next Tuesday?')).toBe(false);
  });

  it('returns false for "Do you do free estimates?"', () => {
    expect(detectEstimateSentSignal('Do you do free estimates?')).toBe(false);
  });

  it('returns false for "How much would it cost to fix a leaky faucet?"', () => {
    expect(detectEstimateSentSignal('How much would it cost to fix a leaky faucet?')).toBe(false);
  });

  it('returns false for "Please send me a quote"', () => {
    expect(detectEstimateSentSignal('Please send me a quote')).toBe(false);
  });

  it('returns false for "Can I get a price on this?"', () => {
    expect(detectEstimateSentSignal('Can I get a price on this?')).toBe(false);
  });
});
