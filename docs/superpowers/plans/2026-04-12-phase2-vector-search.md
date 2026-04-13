# Phase 2: Semantic KB Search (pgvector) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ILIKE keyword matching with pgvector semantic search so the AI retrieves the right KB entries regardless of how the customer phrases their question. Add two-tier context (structural + relevant) to reduce token waste.

**Architecture:** Voyage AI generates embeddings stored in a `vector(1024)` column on `knowledge_base`. `semanticSearch()` replaces `searchKnowledge()`. `buildSmartKnowledgeContext()` replaces `buildKnowledgeContext()` in production AI paths. Embedding is async with fallback to ILIKE.

**Tech Stack:** pgvector (Neon-native), Voyage AI `voyage-3-lite`, Drizzle ORM custom SQL, existing Neon HTTP driver

**Spec:** `docs/superpowers/specs/2026-04-12-ai-pipeline-evals-design.md` — Part 1, Fixes 1, 4, 8

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/schema/knowledge-base.ts` | Modify | Add `embedding`, `embeddingStatus` columns |
| `src/lib/services/embedding.ts` | Create | Voyage AI embedding service (`embed`, `embedBatch`) |
| `src/lib/services/embedding.test.ts` | Create | Unit tests for embedding service (mocked) |
| `src/lib/services/knowledge-base.ts` | Modify | Add `semanticSearch()`, `getStructuralKnowledge()`, `buildSmartKnowledgeContext()` |
| `src/lib/services/knowledge-base.test.ts` | Create | Tests for structural knowledge filtering logic |
| `src/lib/agent/context-builder.ts` | Modify | Use `buildSmartKnowledgeContext()` instead of `buildKnowledgeContext()` |
| `src/lib/agent/orchestrator.ts` | Modify | Pass `messageText` to context builder for search |
| `src/lib/services/structured-knowledge.ts` | Modify | Batch embed after save |
| `src/app/api/admin/clients/[id]/knowledge/route.ts` | Modify | Embed on create |
| `src/app/api/admin/clients/[id]/knowledge/[entryId]/route.ts` | Modify | Re-embed on update |
| `src/app/api/cron/route.ts` | Modify | Add embedding backfill job |
| `drizzle/` | Generated | Migration SQL for vector column + HNSW index |

---

### Task 1: Add pgvector Column to Schema

**Files:**
- Modify: `src/db/schema/knowledge-base.ts`

- [ ] **Step 1: Add vector column and embedding status to schema**

Drizzle ORM doesn't have a native `vector` type, so use `customType` or raw SQL column. Use the `sql` helper approach:

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { clients } from './clients';

export const knowledgeCategoryEnum = pgEnum('knowledge_category', [
  'services',
  'pricing',
  'faq',
  'policies',
  'about',
  'custom',
]);

export const embeddingStatusEnum = pgEnum('embedding_status', [
  'pending',
  'ready',
  'failed',
]);

export const knowledgeBase = pgTable(
  'knowledge_base',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    category: knowledgeCategoryEnum('category').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    keywords: text('keywords'),
    priority: integer('priority').default(0),
    isActive: boolean('is_active').default(true),
    // Vector embedding for semantic search (1024 dims = Voyage AI voyage-3-lite)
    // Column managed via raw SQL migration since Drizzle lacks native vector type
    embeddingStatus: embeddingStatusEnum('embedding_status').default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_knowledge_base_client_id').on(table.clientId),
    index('idx_knowledge_base_category').on(table.clientId, table.category),
  ]
);

export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;
export type NewKnowledgeBaseEntry = typeof knowledgeBase.$inferInsert;
```

- [ ] **Step 2: Generate Drizzle migration**

Run: `npm run db:generate`

This generates the migration SQL for the `embeddingStatus` column. The `embedding vector(1024)` column and HNSW index must be added via a custom SQL migration since Drizzle has no native vector type.

- [ ] **Step 3: Create custom migration for vector column**

Create a new SQL file in `drizzle/` (after the generated one). Name it with the next sequence number:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (Drizzle can't generate this)
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Create HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON knowledge_base USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

- [ ] **Step 4: Review generated SQL**

Read the generated migration files in `drizzle/`. Verify:
- `embedding_status` enum and column are created
- No destructive changes to existing columns
- Custom vector migration is separate and safe

**Do NOT run `db:push` or `db:migrate` yet — ask user for confirmation first.**

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/knowledge-base.ts drizzle/
git commit -m "feat: add embedding column + status to knowledge_base schema

Adds vector(1024) column for pgvector semantic search and
embeddingStatus enum (pending/ready/failed) for async resilience.
HNSW index for fast cosine similarity. Migration not yet applied.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Embedding Service

**Files:**
- Create: `src/lib/services/embedding.ts`
- Create: `src/lib/services/embedding.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/lib/services/embedding.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { embed, embedBatch, buildEmbeddingText } from './embedding';

// Mock the fetch call to Voyage AI
vi.mock('global', () => ({
  fetch: vi.fn(),
}));

describe('buildEmbeddingText', () => {
  it('concatenates title and content', () => {
    expect(buildEmbeddingText('Drain Cleaning', 'We offer professional drain cleaning.'))
      .toBe('Drain Cleaning: We offer professional drain cleaning.');
  });

  it('trims whitespace', () => {
    expect(buildEmbeddingText('  Title  ', '  Content  '))
      .toBe('Title: Content');
  });

  it('truncates to 2000 chars', () => {
    const long = 'A'.repeat(3000);
    expect(buildEmbeddingText('Title', long).length).toBeLessThanOrEqual(2000);
  });
});

describe('embed', () => {
  it('returns a number array', async () => {
    // This test requires VOYAGE_API_KEY — skip in CI
    if (!process.env.VOYAGE_API_KEY) {
      return;
    }
    const result = await embed('test text');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1024);
    expect(typeof result[0]).toBe('number');
  });
});

describe('embedBatch', () => {
  it('returns array of embeddings matching input length', async () => {
    if (!process.env.VOYAGE_API_KEY) {
      return;
    }
    const results = await embedBatch(['text one', 'text two']);
    expect(results.length).toBe(2);
    expect(results[0].length).toBe(1024);
  });
});
```

- [ ] **Step 2: Write the implementation**

Create `src/lib/services/embedding.ts`:

```typescript
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite';
const EMBEDDING_DIMS = 1024;
const MAX_TEXT_LENGTH = 2000;

/**
 * Build the text to embed from a KB entry's title and content.
 * Concatenates with colon separator. Truncates to MAX_TEXT_LENGTH.
 */
export function buildEmbeddingText(title: string, content: string): string {
  const combined = `${title.trim()}: ${content.trim()}`;
  return combined.substring(0, MAX_TEXT_LENGTH);
}

/**
 * Generate embedding for a single text using Voyage AI.
 * Returns a 1024-dimensional float array.
 */
export async function embed(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0];
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * Voyage AI supports batching up to 128 inputs.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set — cannot generate embeddings');
  }

  if (texts.length === 0) return [];

  // Voyage AI batch limit is 128
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 128) {
    batches.push(texts.slice(i, i + 128));
  }

  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: batch,
        input_type: 'document',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI embedding failed (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    for (const item of data.data) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}

/**
 * Embed a single KB entry and return the embedding vector.
 * Used when creating/updating individual entries.
 */
export async function embedKnowledgeEntry(
  title: string,
  content: string
): Promise<number[]> {
  const text = buildEmbeddingText(title, content);
  return embed(text);
}

/**
 * Embed a query for search (uses input_type: 'query' for better retrieval).
 */
export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set');
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [query.substring(0, MAX_TEXT_LENGTH)],
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI query embedding failed (${response.status}): ${error}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}
```

- [ ] **Step 3: Run deterministic tests**

Run: `npx vitest run src/lib/services/embedding.test.ts`
Expected: `buildEmbeddingText` tests PASS. `embed`/`embedBatch` tests skip without API key.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/embedding.ts src/lib/services/embedding.test.ts
git commit -m "feat: add Voyage AI embedding service for KB semantic search

Supports single embed, batch embed (128 per call), and query embed
with correct input_type for retrieval. Truncates input to 2000 chars.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Semantic Search + Two-Tier Context

**Files:**
- Modify: `src/lib/services/knowledge-base.ts`
- Create: `src/lib/services/knowledge-base.test.ts`

- [ ] **Step 1: Write tests for structural knowledge filtering**

Create `src/lib/services/knowledge-base.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isStructuralEntry } from './knowledge-base';

describe('isStructuralEntry', () => {
  it('includes about category', () => {
    expect(isStructuralEntry({ category: 'about', priority: 5 })).toBe(true);
  });

  it('includes policies category', () => {
    expect(isStructuralEntry({ category: 'policies', priority: 5 })).toBe(true);
  });

  it('includes high-priority entries (>= 9)', () => {
    expect(isStructuralEntry({ category: 'services', priority: 9 })).toBe(true);
    expect(isStructuralEntry({ category: 'pricing', priority: 10 })).toBe(true);
  });

  it('excludes low-priority non-structural entries', () => {
    expect(isStructuralEntry({ category: 'faq', priority: 5 })).toBe(false);
    expect(isStructuralEntry({ category: 'custom', priority: 3 })).toBe(false);
    expect(isStructuralEntry({ category: 'pricing', priority: 7 })).toBe(false);
  });

  it('handles null priority', () => {
    expect(isStructuralEntry({ category: 'faq', priority: null })).toBe(false);
    expect(isStructuralEntry({ category: 'about', priority: null })).toBe(true);
  });
});
```

- [ ] **Step 2: Add semantic search and two-tier context to knowledge-base.ts**

Add these functions to `src/lib/services/knowledge-base.ts`:

```typescript
import { embedQuery } from './embedding';
import { sql } from 'drizzle-orm';

/** Determine if a KB entry is structural (always included in AI context) */
export function isStructuralEntry(entry: { category: string; priority: number | null }): boolean {
  if (entry.category === 'about' || entry.category === 'policies') return true;
  if (entry.priority !== null && entry.priority >= 9) return true;
  return false;
}

/**
 * Semantic search using pgvector cosine similarity.
 * Falls back to ILIKE search if embeddings are unavailable.
 */
export async function semanticSearch(
  clientId: string,
  query: string,
  limit: number = 3
): Promise<(KnowledgeEntry & { similarity?: number })[]> {
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query);
  } catch {
    // Embedding service unavailable — fall back to ILIKE
    console.warn('[KB] Embedding service unavailable, falling back to keyword search');
    return searchKnowledge(clientId, query);
  }

  const db = getDb();
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  try {
    const results = await db.execute(sql`
      SELECT id, category, title, content, keywords, priority,
             1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM knowledge_base
      WHERE client_id = ${clientId}
        AND is_active = true
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    if (!results.rows || results.rows.length === 0) {
      // No embedded entries yet — fall back to keyword search
      return searchKnowledge(clientId, query);
    }

    return results.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      category: row.category as KnowledgeCategory,
      title: row.title as string,
      content: row.content as string,
      keywords: row.keywords as string | null,
      priority: row.priority as number | null,
      similarity: row.similarity as number,
    }));
  } catch (err) {
    // pgvector extension might not be enabled — fall back
    console.error('[KB] Vector search failed, falling back to keyword search:', err);
    return searchKnowledge(clientId, query);
  }
}

/**
 * Get structural knowledge entries (always included in AI context).
 * About, policies, and high-priority (>= 9) entries.
 */
export async function getStructuralKnowledge(clientId: string): Promise<KnowledgeEntry[]> {
  const all = await getClientKnowledge(clientId);
  return all.filter(e => isStructuralEntry(e));
}

/**
 * Smart context: structural (always) + semantic search matches (per-message).
 * Replaces buildKnowledgeContext() for production AI paths.
 */
export async function buildSmartKnowledgeContext(
  clientId: string,
  query?: string
): Promise<{ full: string; matchedEntryIds: string[] }> {
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return { full: '', matchedEntryIds: [] };

  const allEntries = await getClientKnowledge(clientId);
  const structural = allEntries.filter(e => isStructuralEntry(e));
  const structuralIds = new Set(structural.map(e => e.id));

  // Format structural context
  let context = `BUSINESS INFORMATION FOR ${client.businessName.toUpperCase()}\n\n`;
  const byCategory: Record<string, KnowledgeEntry[]> = {};
  for (const entry of structural) {
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(entry);
  }

  const categoryLabels: Record<string, string> = {
    services: 'SERVICES OFFERED',
    pricing: 'PRICING INFORMATION',
    faq: 'FREQUENTLY ASKED QUESTIONS',
    policies: 'POLICIES & PROCEDURES',
    about: 'ABOUT THE COMPANY',
    custom: 'ADDITIONAL INFORMATION',
  };

  for (const [category, entries] of Object.entries(byCategory)) {
    context += `--- ${categoryLabels[category] || category.toUpperCase()} ---\n`;
    for (const entry of entries) {
      context += `${entry.title}:\n${entry.content}\n\n`;
    }
  }

  // Add search-matched entries if query provided
  if (!query) {
    return { full: context, matchedEntryIds: [] };
  }

  const relevant = await semanticSearch(clientId, query, 3);
  const uniqueRelevant = relevant.filter(r => !structuralIds.has(r.id));

  if (uniqueRelevant.length > 0) {
    context += `\n## MOST RELEVANT TO THIS QUESTION\n`;
    for (const entry of uniqueRelevant) {
      context += `[${entry.category}] ${entry.title}: ${entry.content}\n\n`;
    }
  }

  return {
    full: context,
    matchedEntryIds: uniqueRelevant.map(r => r.id),
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/services/knowledge-base.test.ts`
Expected: `isStructuralEntry` tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/knowledge-base.ts src/lib/services/knowledge-base.test.ts
git commit -m "feat: add semantic search + two-tier KB context

semanticSearch() uses pgvector cosine similarity with ILIKE fallback.
buildSmartKnowledgeContext() splits KB into structural (always) +
search-matched (per-message) for ~55% token reduction.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Integrate Smart Context into AI Pipeline

**Files:**
- Modify: `src/lib/agent/context-builder.ts`
- Modify: `src/lib/agent/orchestrator.ts`

- [ ] **Step 1: Update context-builder to accept currentMessage**

In `src/lib/agent/context-builder.ts`, the `BuildContextParams` interface already has `currentMessage`. Modify `buildAIContext()` to use `buildSmartKnowledgeContext()` instead of `buildKnowledgeContext()`:

Find where `buildKnowledgeContext` is called (around line 162) and replace with:

```typescript
import { buildSmartKnowledgeContext } from '@/lib/services/knowledge-base';

// Replace:
// knowledge = await buildKnowledgeContext(clientId);
// With:
const smartContext = await buildSmartKnowledgeContext(clientId, currentMessage);
knowledge = smartContext.full;
```

Also update the relevant knowledge section — remove the separate `searchKnowledge` call since `buildSmartKnowledgeContext` already includes search-matched entries.

- [ ] **Step 2: Verify orchestrator passes messageText**

In `src/lib/agent/orchestrator.ts`, verify that `buildAIContext()` is called with `currentMessage`. Check the existing call — it should already pass `messageText` via the params. If not, add it.

- [ ] **Step 3: Mark old buildKnowledgeContext as deprecated**

In `src/lib/services/knowledge-base.ts`, add comment:

```typescript
/**
 * @deprecated Use buildSmartKnowledgeContext() for production AI paths.
 * This function is kept for admin UI (KB preview page) where full context display is needed.
 */
export async function buildKnowledgeContext(clientId: string): Promise<string> {
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/context-builder.ts src/lib/agent/orchestrator.ts src/lib/services/knowledge-base.ts
git commit -m "feat: integrate smart KB context into AI pipeline

Production AI paths now use buildSmartKnowledgeContext() with
structural + search-matched entries. ~55% token reduction per message.
buildKnowledgeContext() deprecated but kept for admin preview UI.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Auto-Embed on KB CRUD Operations

**Files:**
- Modify: `src/app/api/admin/clients/[id]/knowledge/route.ts`
- Modify: `src/app/api/admin/clients/[id]/knowledge/[entryId]/route.ts`
- Modify: `src/lib/services/structured-knowledge.ts`

- [ ] **Step 1: Embed on create (route.ts POST)**

In the POST handler, after `addKnowledgeEntry()`, trigger async embedding:

```typescript
import { embedKnowledgeEntry } from '@/lib/services/embedding';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq } from 'drizzle-orm';

// After: const entryId = await addKnowledgeEntry(clientId, data);
// Add:
// Fire-and-forget embedding — entry works without it (ILIKE fallback)
embedKnowledgeEntry(data.title, data.content)
  .then(async (embedding) => {
    const db = getDb();
    const vectorStr = `[${embedding.join(',')}]`;
    await db.execute(
      sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${entryId}`
    );
  })
  .catch((err) => {
    console.error(`[KB] Embedding failed for entry ${entryId}:`, err);
    const db = getDb();
    db.update(knowledgeBase)
      .set({ embeddingStatus: 'failed' })
      .where(eq(knowledgeBase.id, entryId))
      .catch(() => {});
  });
```

- [ ] **Step 2: Re-embed on update ([entryId]/route.ts PATCH)**

In the PATCH handler, after updating the entry, trigger re-embedding if title or content changed:

```typescript
if (updates.title || updates.content) {
  // Fetch updated entry for embedding
  const [updated] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1);
  if (updated) {
    embedKnowledgeEntry(updated.title, updated.content)
      .then(async (embedding) => {
        const vectorStr = `[${embedding.join(',')}]`;
        await db.execute(
          sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${id}`
        );
      })
      .catch((err) => {
        console.error(`[KB] Re-embedding failed for entry ${id}:`, err);
        db.update(knowledgeBase)
          .set({ embeddingStatus: 'failed' })
          .where(eq(knowledgeBase.id, id))
          .catch(() => {});
      });
  }
}
```

- [ ] **Step 3: Batch embed on structured knowledge save**

In `src/lib/services/structured-knowledge.ts`, after the bulk insert in `saveStructuredKnowledge()`:

```typescript
import { embedBatch, buildEmbeddingText } from './embedding';

// After: await db.insert(knowledgeBase).values(entries);
// Add:
// Batch embed all new entries (fire-and-forget)
const textsToEmbed = entries.map(e => buildEmbeddingText(e.title, e.content));
embedBatch(textsToEmbed)
  .then(async (embeddings) => {
    const db2 = getDb();
    // Fetch the IDs of entries we just inserted (by clientId + tag)
    const inserted = await db2
      .select({ id: knowledgeBase.id, title: knowledgeBase.title })
      .from(knowledgeBase)
      .where(and(
        eq(knowledgeBase.clientId, clientId),
        eq(knowledgeBase.keywords, tag)
      ))
      .orderBy(knowledgeBase.createdAt);

    for (let i = 0; i < Math.min(inserted.length, embeddings.length); i++) {
      const vectorStr = `[${embeddings[i].join(',')}]`;
      await db2.execute(
        sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${inserted[i].id}`
      );
    }
  })
  .catch((err) => {
    console.error('[KB] Batch embedding failed:', err);
  });
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/clients/[id]/knowledge/route.ts src/app/api/admin/clients/[id]/knowledge/*/route.ts src/lib/services/structured-knowledge.ts
git commit -m "feat: auto-embed KB entries on create/update/structured-save

Embeddings generated async via Voyage AI. Entries work immediately
via ILIKE fallback. embeddingStatus tracks pending/ready/failed.
Structured knowledge batch-embeds all entries after save.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Embedding Backfill Cron Job

**Files:**
- Modify: `src/app/api/cron/route.ts`

- [ ] **Step 1: Add backfill job to cron orchestrator**

Add a new job that processes KB entries with `embeddingStatus = 'pending'` or `'failed'`:

```typescript
import { embedKnowledgeEntry } from '@/lib/services/embedding';

// Add to cron job list:
async function backfillEmbeddings(): Promise<{ processed: number; failed: number }> {
  const db = getDb();
  const pending = await db
    .select({ id: knowledgeBase.id, title: knowledgeBase.title, content: knowledgeBase.content })
    .from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.isActive, true),
        or(
          eq(knowledgeBase.embeddingStatus, 'pending'),
          eq(knowledgeBase.embeddingStatus, 'failed')
        )
      )
    )
    .limit(50); // Process 50 per run to avoid timeouts

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const embedding = await embedKnowledgeEntry(entry.title, entry.content);
      const vectorStr = `[${embedding.join(',')}]`;
      await db.execute(
        sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${entry.id}`
      );
      processed++;
    } catch {
      await db.update(knowledgeBase)
        .set({ embeddingStatus: 'failed' })
        .where(eq(knowledgeBase.id, entry.id));
      failed++;
    }
  }

  return { processed, failed };
}
```

Register in the cron orchestrator's job list with a 1-hour interval.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/route.ts
git commit -m "feat: add embedding backfill cron job

Processes up to 50 pending/failed KB entries per run. Ensures all
entries eventually get embeddings even if initial async embed fails.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Install Voyage AI Dependency + Update Docs

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `docs/product/PLATFORM-CAPABILITIES.md`
- Modify: `docs/engineering/01-TESTING-GUIDE.md`

- [ ] **Step 1: Note — no npm package needed**

Voyage AI is called via HTTP fetch (no SDK needed). The embedding service uses native `fetch`. No new dependency to install.

Add `VOYAGE_API_KEY` to the environment variable documentation.

- [ ] **Step 2: Update PLATFORM-CAPABILITIES.md**

In Section 1 (AI Conversation Agent), add under knowledge base subsection:

```markdown
### Semantic Knowledge Retrieval

Knowledge base entries are embedded using Voyage AI `voyage-3-lite` (1024-dimensional vectors) and searched using pgvector cosine similarity. This replaces keyword matching and handles:
- Synonym matching ("leaky faucet" matches "dripping tap repair")
- Conceptual matching ("my basement is flooding" matches "Emergency Services")
- Multi-word queries without exact phrase requirements

Context is split into two tiers:
- **Structural** (always included): Company overview, service area, hours, restrictions, high-priority entries
- **Search-matched** (per-message): Top 3 semantically relevant entries for the customer's question

Fallback: If Voyage AI is unavailable, the system falls back to keyword (ILIKE) search automatically.
```

- [ ] **Step 3: Update 01-TESTING-GUIDE.md**

Add test step:

```markdown
### Step XX: Semantic Search Verification

1. Verify pgvector extension is enabled:
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'vector';
   ```
2. Check embedding status for a client:
   ```sql
   SELECT embedding_status, count(*) FROM knowledge_base WHERE client_id = '{id}' GROUP BY embedding_status;
   ```
3. All active entries should have `embedding_status = 'ready'`.
4. Test semantic search by sending a message with different phrasing than KB entry titles.
```

- [ ] **Step 4: Commit**

```bash
git add docs/product/PLATFORM-CAPABILITIES.md docs/engineering/01-TESTING-GUIDE.md
git commit -m "docs: document semantic KB search and two-tier context

Adds pgvector semantic search to capabilities doc and embedding
verification steps to testing guide.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Run Quality Gate

- [ ] **Step 1: Run ms:gate**

Run: `npm run ms:gate`
Expected: PASS

- [ ] **Step 2: Run no-regressions**

Run: `npm run quality:no-regressions`
Expected: PASS

- [ ] **Step 3: Apply migration (with user confirmation)**

Ask user: "Migration ready. Run `npm run db:migrate` to add vector column and HNSW index?"

Only after user confirms: `npm run db:migrate`
