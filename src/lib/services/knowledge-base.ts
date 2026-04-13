import { getDb } from '@/db';
import { knowledgeBase, clients, type NewKnowledgeBaseEntry } from '@/db/schema';
import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import { expandQueryWithSynonyms } from '@/lib/data/trade-synonyms';
import { embedQuery } from '@/lib/services/embedding';

export type KnowledgeCategory = 'services' | 'pricing' | 'faq' | 'policies' | 'about' | 'custom';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

/** Get all knowledge base entries for a client */
export async function getClientKnowledge(clientId: string): Promise<KnowledgeEntry[]> {
  const db = getDb();
  return db
    .select({
      id: knowledgeBase.id,
      category: knowledgeBase.category,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
      keywords: knowledgeBase.keywords,
      priority: knowledgeBase.priority,
    })
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.isActive, true)
    ))
    .orderBy(desc(knowledgeBase.priority), knowledgeBase.category);
}

/** Search knowledge base entries by keyword matching */
export async function searchKnowledge(
  clientId: string,
  query: string
): Promise<KnowledgeEntry[]> {
  const expandedTerms = expandQueryWithSynonyms(query);
  const searchTerms = expandedTerms.length > 0
    ? expandedTerms
    : query.toLowerCase().split(' ').filter(t => t.length > 2);

  if (searchTerms.length === 0) {
    return getClientKnowledge(clientId);
  }

  const db = getDb();
  const results = await db
    .select({
      id: knowledgeBase.id,
      category: knowledgeBase.category,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
      keywords: knowledgeBase.keywords,
      priority: knowledgeBase.priority,
    })
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.isActive, true),
      or(
        ...searchTerms.map(term => ilike(knowledgeBase.title, `%${term}%`)),
        ...searchTerms.map(term => ilike(knowledgeBase.content, `%${term}%`)),
        ...searchTerms.map(term => ilike(knowledgeBase.keywords, `%${term}%`))
      )
    ))
    .orderBy(desc(knowledgeBase.priority))
    .limit(10);

  return results;
}

/**
 * Returns true if this entry should always be included in the AI context
 * regardless of query relevance. Structural entries define who the business is
 * and what rules it operates under — the AI needs them in every conversation.
 */
export function isStructuralEntry(entry: { category: string; priority: number | null }): boolean {
  if (entry.category === 'about' || entry.category === 'policies') return true;
  if (entry.priority !== null && entry.priority >= 9) return true;
  return false;
}

/**
 * Returns all structural knowledge entries for a client — entries that are
 * always included in the AI context regardless of query content.
 */
export async function getStructuralKnowledge(clientId: string): Promise<KnowledgeEntry[]> {
  const all = await getClientKnowledge(clientId);
  return all.filter(e => isStructuralEntry(e));
}

/**
 * Searches the knowledge base using vector similarity (pgvector cosine distance).
 * Falls back to ILIKE keyword search if:
 *   - The Voyage AI embedding API is unavailable, or
 *   - No entries have been embedded yet (zero vector results returned).
 */
export async function semanticSearch(
  clientId: string,
  query: string,
  limit: number = 3
): Promise<(KnowledgeEntry & { similarity?: number })[]> {
  try {
    const vector = await embedQuery(query);
    const vectorStr = `[${vector.join(',')}]`;
    const db = getDb();

    const rows = await db.execute(sql`
      SELECT id, category, title, content, keywords, priority,
             1 - (embedding <=> ${vectorStr}::vector) as similarity
      FROM knowledge_base
      WHERE client_id = ${clientId}
        AND is_active = true
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    const results = (rows as unknown as Array<{
      id: string;
      category: string;
      title: string;
      content: string;
      keywords: string | null;
      priority: number | null;
      similarity: number;
    }>).map(row => ({
      id: row.id,
      category: row.category as KnowledgeCategory,
      title: row.title,
      content: row.content,
      keywords: row.keywords,
      priority: row.priority,
      similarity: row.similarity,
    }));

    // Fall back to ILIKE if no embedded entries exist yet
    if (results.length === 0) {
      return searchKnowledge(clientId, query);
    }

    return results;
  } catch (err) {
    // Voyage API down or key missing — degrade gracefully
    console.warn('[semanticSearch] Embedding failed, falling back to keyword search:', err instanceof Error ? err.message : String(err));
    return searchKnowledge(clientId, query);
  }
}

/**
 * Builds a two-tier knowledge context string for AI prompts:
 *   Tier 1 — Structural entries (always included: about, policies, priority >= 9)
 *   Tier 2 — Semantically relevant entries matched to the current query
 *
 * Returns the formatted string and the IDs of query-matched entries for
 * attribution / observability.
 */
export async function buildSmartKnowledgeContext(
  clientId: string,
  query?: string
): Promise<{ full: string; matchedEntryIds: string[] }> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return { full: '', matchedEntryIds: [] };

  const structural = await getStructuralKnowledge(clientId);
  const structuralIds = new Set(structural.map(e => e.id));

  let context = `BUSINESS INFORMATION FOR ${client.businessName.toUpperCase()}\n\n`;

  // Tier 1: structural entries grouped by category
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

  // Tier 2: query-relevant entries (deduplicated against structural set)
  const matchedEntryIds: string[] = [];

  if (query) {
    const searchResults = await semanticSearch(clientId, query, 3);
    const unique = searchResults.filter(e => !structuralIds.has(e.id));

    if (unique.length > 0) {
      context += `--- MOST RELEVANT TO THIS QUESTION ---\n`;
      for (const entry of unique) {
        context += `${entry.title}:\n${entry.content}\n\n`;
        matchedEntryIds.push(entry.id);
      }
    }
  }

  return { full: context, matchedEntryIds };
}

/** @deprecated Use buildSmartKnowledgeContext() for production AI paths. Kept for admin KB preview. */
export async function buildKnowledgeContext(clientId: string): Promise<string> {
  const knowledge = await getClientKnowledge(clientId);
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return '';

  let context = `BUSINESS INFORMATION FOR ${client.businessName.toUpperCase()}\n\n`;

  // Group by category
  const byCategory: Record<string, KnowledgeEntry[]> = {};
  for (const entry of knowledge) {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
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

  return context;
}

// Default knowledge templates for new clients
export const DEFAULT_KNOWLEDGE: Omit<NewKnowledgeBaseEntry, 'id' | 'clientId'>[] = [
  {
    category: 'about',
    title: 'Company Overview',
    content: '[Your company description here]',
    keywords: 'about, company, who',
    priority: 10,
  },
  {
    category: 'services',
    title: 'Services Offered',
    content: '[List your main services here]',
    keywords: 'services, offer, do, provide',
    priority: 9,
  },
  {
    category: 'pricing',
    title: 'Pricing Overview',
    content: 'We offer free estimates. Final pricing depends on the specific project requirements.',
    keywords: 'price, cost, how much, estimate, quote',
    priority: 8,
  },
  {
    category: 'policies',
    title: 'Service Area',
    content: '[Your service area here, e.g., "We serve Calgary and surrounding areas within 50km"]',
    keywords: 'area, location, where, serve',
    priority: 7,
  },
  {
    category: 'policies',
    title: 'Business Hours',
    content: '[Your business hours, e.g., "Monday-Friday 8am-6pm, Saturday 9am-2pm"]',
    keywords: 'hours, open, available, when',
    priority: 7,
  },
];

/** Initialize default knowledge base entries for a new client */
export async function initializeClientKnowledge(clientId: string): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ id: knowledgeBase.id })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.clientId, clientId))
    .limit(1);

  if (existing.length > 0) return;

  for (const entry of DEFAULT_KNOWLEDGE) {
    await db.insert(knowledgeBase).values({
      clientId,
      ...entry,
    });
  }
}

/** Add a new knowledge base entry for a client */
export async function addKnowledgeEntry(
  clientId: string,
  entry: { category: KnowledgeCategory; title: string; content: string; keywords?: string | null; priority?: number | null }
): Promise<string> {
  const db = getDb();
  const [created] = await db
    .insert(knowledgeBase)
    .values({
      clientId,
      ...entry,
    })
    .returning();

  return created.id;
}

/** Update an existing knowledge base entry */
export async function updateKnowledgeEntry(
  id: string,
  updates: Partial<{ category: KnowledgeCategory; title: string; content: string; keywords: string | null; priority: number | null }>,
  clientId?: string
): Promise<void> {
  const db = getDb();
  const condition = clientId
    ? and(eq(knowledgeBase.id, id), eq(knowledgeBase.clientId, clientId))
    : eq(knowledgeBase.id, id);
  await db
    .update(knowledgeBase)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(condition);
}

/** Delete a knowledge base entry by ID, optionally scoped to a client */
export async function deleteKnowledgeEntry(id: string, clientId?: string): Promise<void> {
  const db = getDb();
  const condition = clientId
    ? and(eq(knowledgeBase.id, id), eq(knowledgeBase.clientId, clientId))
    : eq(knowledgeBase.id, id);
  await db.delete(knowledgeBase).where(condition);
}
