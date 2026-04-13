import { describe, it, expect } from 'vitest';
import { isStructuralEntry } from './knowledge-base';

describe('isStructuralEntry', () => {
  it('includes about category', () =>
    expect(isStructuralEntry({ category: 'about', priority: 5 })).toBe(true));

  it('includes policies category', () =>
    expect(isStructuralEntry({ category: 'policies', priority: 5 })).toBe(true));

  it('includes high-priority entries (>= 9)', () =>
    expect(isStructuralEntry({ category: 'services', priority: 9 })).toBe(true));

  it('includes priority 10 entries', () =>
    expect(isStructuralEntry({ category: 'faq', priority: 10 })).toBe(true));

  it('excludes low-priority non-structural', () =>
    expect(isStructuralEntry({ category: 'faq', priority: 5 })).toBe(false));

  it('excludes priority 8 non-structural', () =>
    expect(isStructuralEntry({ category: 'services', priority: 8 })).toBe(false));

  it('excludes pricing category with null priority', () =>
    expect(isStructuralEntry({ category: 'pricing', priority: null })).toBe(false));

  it('handles null priority', () => {
    expect(isStructuralEntry({ category: 'faq', priority: null })).toBe(false);
    expect(isStructuralEntry({ category: 'about', priority: null })).toBe(true);
  });
});
