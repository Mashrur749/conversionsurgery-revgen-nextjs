import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/services/knowledge-base';
import { embedKnowledgeEntry } from '@/lib/services/embedding';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  keywords: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});

export const PATCH = adminClientRoute<{ id: string; entryId: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { entryId } = params;

    const body = await request.json();
    const data = updateSchema.parse(body);
    await updateKnowledgeEntry(entryId, data, clientId);

    // Re-embed if title or content changed
    if (data.title !== undefined || data.content !== undefined) {
      const db = getDb();
      const [updated] = await db
        .select({ title: knowledgeBase.title, content: knowledgeBase.content })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.id, entryId))
        .limit(1);

      if (updated) {
        embedKnowledgeEntry(updated.title, updated.content)
          .then(async (embedding) => {
            const freshDb = getDb();
            const vectorStr = `[${embedding.join(',')}]`;
            await freshDb.execute(
              sql`UPDATE knowledge_base SET embedding = ${vectorStr}::vector, embedding_status = 'ready' WHERE id = ${entryId}`
            );
          })
          .catch((err) => {
            console.error(`[KB] Re-embedding failed for entry ${entryId}:`, err);
            const freshDb = getDb();
            freshDb.update(knowledgeBase)
              .set({ embeddingStatus: 'failed' as const })
              .where(eq(knowledgeBase.id, entryId))
              .catch(() => {});
          });
      }
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = adminClientRoute<{ id: string; entryId: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ params, clientId }) => {
    const { entryId } = params;

    await deleteKnowledgeEntry(entryId, clientId);

    return NextResponse.json({ success: true });
  }
);
