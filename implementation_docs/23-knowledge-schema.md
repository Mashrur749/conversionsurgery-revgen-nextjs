# Phase 15a: Knowledge Base Schema

## Current State (after Phase 14)
- AI responds with generic knowledge
- No business-specific context
- Same responses regardless of client's services

## Goal
Store business-specific knowledge that AI uses to answer questions accurately.

---

## Step 1: Create Knowledge Base Tables

**APPEND** to `src/lib/db/schema.ts`:

```typescript
// ============================================
// KNOWLEDGE BASE
// ============================================
export const knowledgeCategoryEnum = pgEnum('knowledge_category', [
  'services',
  'pricing',
  'faq',
  'policies',
  'about',
  'custom',
]);

export const knowledgeBase = pgTable('knowledge_base', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  category: knowledgeCategoryEnum('category').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  keywords: text('keywords'), // comma-separated for search
  priority: integer('priority').default(0), // Higher = more important
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const knowledgeBaseRelations = relations(knowledgeBase, ({ one }) => ({
  client: one(clients, { fields: [knowledgeBase.clientId], references: [clients.id] }),
}));
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Knowledge Base Service

**CREATE** `src/lib/services/knowledge-base.ts`:

```typescript
import { db } from '@/lib/db';
import { knowledgeBase, clients } from '@/lib/db/schema';
import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';

export interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

export async function getClientKnowledge(clientId: string): Promise<KnowledgeEntry[]> {
  return db
    .select()
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, clientId),
      eq(knowledgeBase.isActive, true)
    ))
    .orderBy(desc(knowledgeBase.priority), knowledgeBase.category);
}

export async function searchKnowledge(
  clientId: string,
  query: string
): Promise<KnowledgeEntry[]> {
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
  
  if (searchTerms.length === 0) {
    return getClientKnowledge(clientId);
  }

  // Search in title, content, and keywords
  const results = await db
    .select()
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

export async function buildKnowledgeContext(clientId: string): Promise<string> {
  const knowledge = await getClientKnowledge(clientId);
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
export const DEFAULT_KNOWLEDGE: Omit<KnowledgeEntry, 'id'>[] = [
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

export async function initializeClientKnowledge(clientId: string): Promise<void> {
  const existing = await db
    .select()
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

export async function addKnowledgeEntry(
  clientId: string,
  entry: Omit<KnowledgeEntry, 'id'>
): Promise<string> {
  const [created] = await db
    .insert(knowledgeBase)
    .values({
      clientId,
      ...entry,
    })
    .returning();

  return created.id;
}

export async function updateKnowledgeEntry(
  id: string,
  updates: Partial<Omit<KnowledgeEntry, 'id'>>
): Promise<void> {
  await db
    .update(knowledgeBase)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBase.id, id));
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
}
```

---

## Step 3: Create Knowledge Base API Routes

**CREATE** `src/app/api/admin/clients/[id]/knowledge/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getClientKnowledge,
  addKnowledgeEntry,
  initializeClientKnowledge,
} from '@/lib/services/knowledge-base';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await initializeClientKnowledge(params.id);
  const entries = await getClientKnowledge(params.id);

  return NextResponse.json({ entries });
}

const createSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']),
  title: z.string().min(1),
  content: z.string().min(1),
  keywords: z.string().optional(),
  priority: z.number().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const id = await addKnowledgeEntry(params.id, data);

    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
```

**CREATE** `src/app/api/admin/clients/[id]/knowledge/[entryId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/services/knowledge-base';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  await updateKnowledgeEntry(params.entryId, body);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await deleteKnowledgeEntry(params.entryId);

  return NextResponse.json({ success: true });
}
```

---

## Verify

1. `npm run dev`
2. Run: `npx drizzle-kit push`
3. Test API:
   ```bash
   # Get knowledge
   curl http://localhost:3000/api/admin/clients/{clientId}/knowledge
   
   # Add entry
   curl -X POST http://localhost:3000/api/admin/clients/{clientId}/knowledge \
     -H "Content-Type: application/json" \
     -d '{"category":"services","title":"Roof Repairs","content":"We fix all types of roof damage."}'
   ```

---

## Next
Proceed to **Phase 15b** for knowledge base UI.
