import { getDb } from '@/db';
import { knowledgeBase, clients, type NewKnowledgeBaseEntry } from '@/db/schema';
import { eq, and, desc, ilike, or } from 'drizzle-orm';

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
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);

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

/** Build a formatted knowledge context string for AI prompts (FROZEN EXPORT) */
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
  updates: Partial<{ category: KnowledgeCategory; title: string; content: string; keywords: string | null; priority: number | null }>
): Promise<void> {
  const db = getDb();
  await db
    .update(knowledgeBase)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBase.id, id));
}

/** Delete a knowledge base entry by ID */
export async function deleteKnowledgeEntry(id: string): Promise<void> {
  const db = getDb();
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}
