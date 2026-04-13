import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  getClientKnowledge,
  addKnowledgeEntry,
  initializeClientKnowledge,
} from '@/lib/services/knowledge-base';
import { embedKnowledgeEntry } from '@/lib/services/embedding';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    await initializeClientKnowledge(clientId);
    const entries = await getClientKnowledge(clientId);

    return NextResponse.json({ entries });
  }
);

const createSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  keywords: z.string().optional(),
  priority: z.number().optional(),
});

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = createSchema.parse(body);

    const entryId = await addKnowledgeEntry(clientId, data);

    // Fire-and-forget: generate embedding asynchronously
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
          .set({ embeddingStatus: 'failed' as const })
          .where(eq(knowledgeBase.id, entryId))
          .catch(() => {});
      });

    return NextResponse.json({ id: entryId });
  }
);
