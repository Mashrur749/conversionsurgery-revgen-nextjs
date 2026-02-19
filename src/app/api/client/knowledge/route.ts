import { NextRequest, NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { knowledgeBase } from '@/db/schema/knowledge-base';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const createSchema = z.object({
  category: z.enum(['services', 'pricing', 'faq', 'policies', 'about', 'custom']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  keywords: z.string().max(500).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

/** GET /api/client/knowledge - List all KB entries for the authenticated client. */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.KNOWLEDGE_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const entries = await db
    .select()
    .from(knowledgeBase)
    .where(and(
      eq(knowledgeBase.clientId, session.clientId),
      eq(knowledgeBase.isActive, true)
    ))
    .orderBy(knowledgeBase.category, knowledgeBase.priority);

  return NextResponse.json({ entries });
}

/** POST /api/client/knowledge - Create a new KB entry. */
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.KNOWLEDGE_EDIT);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();
  const [entry] = await db
    .insert(knowledgeBase)
    .values({
      clientId: session.clientId,
      ...parsed.data,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
