import { NextRequest, NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema/knowledge-base';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']).optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  keywords: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional(),
}).strict();

/** PATCH /api/client/knowledge/[id] - Update a KB entry. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();
  const [updated] = await db
    .update(knowledgeBase)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(
      eq(knowledgeBase.id, id),
      eq(knowledgeBase.clientId, session.clientId)
    ))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/** DELETE /api/client/knowledge/[id] - Soft-delete a KB entry. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const [updated] = await db
    .update(knowledgeBase)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(knowledgeBase.id, id),
      eq(knowledgeBase.clientId, session.clientId)
    ))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
