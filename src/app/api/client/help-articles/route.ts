import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async () => {
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
);
