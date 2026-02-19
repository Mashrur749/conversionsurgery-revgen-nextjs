import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

export async function GET() {
  try {
    await requirePortalPermission(PORTAL_PERMISSIONS.DASHBOARD);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const articles = await db
    .select({
      id: helpArticles.id,
      title: helpArticles.title,
      slug: helpArticles.slug,
      content: helpArticles.content,
      category: helpArticles.category,
    })
    .from(helpArticles)
    .where(eq(helpArticles.isPublished, true))
    .orderBy(helpArticles.sortOrder);

  return NextResponse.json(articles);
}
