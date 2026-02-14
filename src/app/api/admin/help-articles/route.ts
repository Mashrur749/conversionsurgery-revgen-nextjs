import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { z } from 'zod';

export async function GET() {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
