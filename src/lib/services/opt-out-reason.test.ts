import { describe, it, expect } from 'vitest';
import { classifyOptOutReason } from './opt-out-reason';

describe('classifyOptOutReason', () => {
  it('detects competitor chosen', () => {
    expect(classifyOptOutReason('We found someone else, stop')).toBe('competitor_chosen');
    expect(classifyOptOutReason('went with another company')).toBe('competitor_chosen');
  });

  it('detects project cancelled', () => {
    expect(classifyOptOutReason('We changed our mind about the project')).toBe('project_cancelled');
    expect(classifyOptOutReason('not doing the renovation anymore')).toBe('project_cancelled');
  });

  it('detects bad experience', () => {
    expect(classifyOptOutReason('too many texts, stop')).toBe('bad_experience');
    expect(classifyOptOutReason('stop texting me this is annoying')).toBe('bad_experience');
  });

  it('detects cost', () => {
    expect(classifyOptOutReason("it's too expensive for us")).toBe('cost');
    expect(classifyOptOutReason('over our budget, stop')).toBe('cost');
  });

  it('detects not interested', () => {
    expect(classifyOptOutReason('not interested anymore')).toBe('not_interested');
    expect(classifyOptOutReason('no thanks, stop')).toBe('not_interested');
  });

  it('returns unknown for bare STOP', () => {
    expect(classifyOptOutReason('STOP')).toBe('unknown');
    expect(classifyOptOutReason('stop')).toBe('unknown');
  });

  it('returns unknown for ambiguous messages', () => {
    expect(classifyOptOutReason('please stop')).toBe('unknown');
  });
});
