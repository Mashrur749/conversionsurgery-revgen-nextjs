import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { z } from 'zod';

export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const db = getDb();
  const articles = await db
    .select()
    .from(helpArticles)
    .orderBy(helpArticles.sortOrder);

  return NextResponse.json(articles);
}

const createSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [article] = await db
    .insert(helpArticles)
    .values(parsed.data)
    .returning();

  return NextResponse.json(article, { status: 201 });
}
