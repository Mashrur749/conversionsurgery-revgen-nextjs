import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { responseTemplates } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['positive', 'neutral', 'negative', 'specific_complaint']).optional(),
  templateText: z.string().min(1),
  variables: z.array(z.string()).optional(),
  minRating: z.number().int().min(1).max(5).optional(),
  maxRating: z.number().int().min(1).max(5).optional(),
  keywords: z.array(z.string()).optional(),
});

// GET - List response templates for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const templates = await db
    .select()
    .from(responseTemplates)
    .where(eq(responseTemplates.clientId, id))
    .orderBy(desc(responseTemplates.usageCount));

  return NextResponse.json(templates);
}

// POST - Create a new response template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const db = getDb();
    const [template] = await db
      .insert(responseTemplates)
      .values({
        clientId: id,
        name: data.name,
        category: data.category,
        templateText: data.templateText,
        variables: data.variables,
        minRating: data.minRating,
        maxRating: data.maxRating,
        keywords: data.keywords,
      })
      .returning();

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Response Template] Create error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
