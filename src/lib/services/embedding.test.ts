import { describe, it, expect } from 'vitest';
import { buildEmbeddingText, embed, embedBatch, embedQuery, embedKnowledgeEntry } from './embedding';

describe('buildEmbeddingText', () => {
  it('concatenates title and content with colon', () => {
    expect(buildEmbeddingText('Drain Cleaning', 'Professional service'))
      .toBe('Drain Cleaning: Professional service');
  });

  it('trims whitespace', () => {
    expect(buildEmbeddingText('  Title  ', '  Content  '))
      .toBe('Title: Content');
  });

  it('truncates to 2000 chars', () => {
    const long = 'A'.repeat(3000);
    expect(buildEmbeddingText('T', long).length).toBeLessThanOrEqual(2000);
  });

  it('handles empty content', () => {
    expect(buildEmbeddingText('Title', '')).toBe('Title:');
  });

  it('handles empty title', () => {
    expect(buildEmbeddingText('', 'Content')).toBe(': Content');
  });

  it('truncates exactly at 2000 chars when combined text exceeds limit', () => {
    const title = 'T'.repeat(10);
    const content = 'C'.repeat(3000);
    const result = buildEmbeddingText(title, content);
    expect(result.length).toBe(2000);
  });
});

describe.skipIf(!process.env.VOYAGE_API_KEY)('embed (live API)', () => {
  it('returns a non-empty array of numbers for a short text', async () => {
    const result = await embed('Drain cleaning service in Calgary');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    result.forEach((val) => expect(typeof val).toBe('number'));
  });

  it('returns 1024-dim array for voyage-3-lite', async () => {
    const result = await embed('Test embedding dimension');
    expect(result.length).toBe(1024);
  });
});

describe.skipIf(!process.env.VOYAGE_API_KEY)('embedBatch (live API)', () => {
  it('returns embeddings for each input text', async () => {
    const texts = ['First text', 'Second text', 'Third text'];
    const results = await embedBatch(texts);
    expect(results.length).toBe(3);
    results.forEach((embedding) => {
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  it('handles single text batch', async () => {
    const results = await embedBatch(['Single text']);
    expect(results.length).toBe(1);
    expect(Array.isArray(results[0])).toBe(true);
  });
});

describe.skipIf(!process.env.VOYAGE_API_KEY)('embedQuery (live API)', () => {
  it('returns a non-empty array of numbers', async () => {
    const result = await embedQuery('how much does drain cleaning cost?');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns same dimension as embed', async () => {
    const docEmbedding = await embed('Drain cleaning service');
    const queryEmbedding = await embedQuery('drain cleaning');
    expect(queryEmbedding.length).toBe(docEmbedding.length);
  });
});

describe.skipIf(!process.env.VOYAGE_API_KEY)('embedKnowledgeEntry (live API)', () => {
  it('embeds a knowledge entry by title and content', async () => {
    const result = await embedKnowledgeEntry(
      'Drain Cleaning',
      'We offer professional drain cleaning starting at $150.'
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
