import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    const db = getDb();
    const articles = await db
      .select()
      .from(helpArticles)
      .orderBy(helpArticles.sortOrder);

    return NextResponse.json(articles);
  }
);

const createSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
}).strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async ({ request }) => {
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
);
