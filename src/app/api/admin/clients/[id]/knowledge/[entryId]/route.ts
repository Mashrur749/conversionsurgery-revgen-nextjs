import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { updateKnowledgeEntry, deleteKnowledgeEntry } from '@/lib/services/knowledge-base';
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
