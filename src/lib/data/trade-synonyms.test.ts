import { describe, it, expect } from 'vitest';
import { expandQueryWithSynonyms } from './trade-synonyms';

describe('expandQueryWithSynonyms', () => {
  it('expands faucet-related terms: "my faucet is leaking" includes "tap"', () => {
    const result = expandQueryWithSynonyms('my faucet is leaking');
    expect(result).toContain('tap');
  });

  it('expands faucet-related terms: "my faucet is leaking" includes "spigot"', () => {
    const result = expandQueryWithSynonyms('my faucet is leaking');
    expect(result).toContain('spigot');
  });

  it('expands faucet-related terms: "my faucet is leaking" includes "dripping"', () => {
    const result = expandQueryWithSynonyms('my faucet is leaking');
    expect(result).toContain('dripping');
  });

  it('expands legal suite: "legal suite" includes "secondary suite"', () => {
    const result = expandQueryWithSynonyms('legal suite');
    expect(result).toContain('secondary suite');
  });

  it('expands legal suite: "legal suite" includes "basement suite"', () => {
    const result = expandQueryWithSynonyms('legal suite');
    expect(result).toContain('basement suite');
  });

  it('expands legal suite: "legal suite" includes "in-law suite"', () => {
    const result = expandQueryWithSynonyms('legal suite');
    expect(result).toContain('in-law suite');
  });

  it('expands hot water tank: "hot water tank" includes "water heater"', () => {
    const result = expandQueryWithSynonyms('hot water tank');
    expect(result).toContain('water heater');
  });

  it('expands hot water tank: "hot water tank" includes "hot water heater"', () => {
    const result = expandQueryWithSynonyms('hot water tank');
    expect(result).toContain('hot water heater');
  });

  it('returns original terms for an unknown query', () => {
    const result = expandQueryWithSynonyms('completely unknown xyzzy term');
    // Should include original words that are 3+ chars
    expect(result).toContain('completely');
    expect(result).toContain('unknown');
    expect(result).toContain('xyzzy');
    expect(result).toContain('term');
  });

  it('returns empty array for empty input', () => {
    const result = expandQueryWithSynonyms('');
    expect(result).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    const result = expandQueryWithSynonyms('   ');
    expect(result).toEqual([]);
  });

  it('deduplicates terms', () => {
    // "estimate" appears in the quote/estimate group — calling with "estimate quote"
    // should not produce duplicates of those synonyms
    const result = expandQueryWithSynonyms('estimate quote');
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });

  it('expands quote synonyms: "get a quote" includes "estimate"', () => {
    const result = expandQueryWithSynonyms('get a quote');
    expect(result).toContain('estimate');
  });

  it('expands quote synonyms: "get a quote" includes "bid"', () => {
    const result = expandQueryWithSynonyms('get a quote');
    expect(result).toContain('bid');
  });

  it('expands eavestrough: "eavestrough cleaning" includes "gutter"', () => {
    const result = expandQueryWithSynonyms('eavestrough cleaning');
    expect(result).toContain('gutter');
  });

  it('expands breaker panel: "breaker panel replacement" includes "electrical panel"', () => {
    const result = expandQueryWithSynonyms('breaker panel replacement');
    expect(result).toContain('electrical panel');
  });

  it('expands booking intent: "book an appointment" includes "schedule"', () => {
    const result = expandQueryWithSynonyms('book an appointment');
    expect(result).toContain('schedule');
  });

  it('expands booking intent: "come out" includes "site visit"', () => {
    const result = expandQueryWithSynonyms('come out');
    expect(result).toContain('site visit');
  });

  it('handles multi-word phrase matching for "kitchen reno"', () => {
    const result = expandQueryWithSynonyms('kitchen reno');
    expect(result).toContain('kitchen renovation');
    expect(result).toContain('kitchen remodel');
  });

  it('handles multi-word phrase matching for "drain cleaning"', () => {
    const result = expandQueryWithSynonyms('drain cleaning');
    expect(result).toContain('clogged drain');
    expect(result).toContain('blocked drain');
  });

  it('is case-insensitive: "Faucet" expands to "tap"', () => {
    const result = expandQueryWithSynonyms('Faucet is broken');
    expect(result).toContain('tap');
  });

  it('preserves original query words in output', () => {
    const result = expandQueryWithSynonyms('my faucet');
    expect(result).toContain('faucet');
  });

  it('filters out short words (< 3 chars) from original query', () => {
    // "my" is 2 chars — should not appear
    const result = expandQueryWithSynonyms('my tap');
    expect(result).not.toContain('my');
    expect(result).toContain('tap');
  });

  it('expands furnace: "furnace not working" includes "heating system"', () => {
    const result = expandQueryWithSynonyms('furnace not working');
    expect(result).toContain('heating system');
  });

  it('expands AC: "air conditioning repair" includes "air conditioner"', () => {
    const result = expandQueryWithSynonyms('air conditioning repair');
    expect(result).toContain('air conditioner');
  });

  it('expands warranty: "warranty on work" includes "guarantee"', () => {
    const result = expandQueryWithSynonyms('warranty on work');
    expect(result).toContain('guarantee');
  });

  it('expands emergency: "urgent leak" includes "emergency"', () => {
    const result = expandQueryWithSynonyms('urgent leak');
    expect(result).toContain('emergency');
  });
});
