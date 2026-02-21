import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const templates = await db
      .select()
      .from(responseTemplates)
      .where(eq(responseTemplates.clientId, clientId))
      .orderBy(desc(responseTemplates.usageCount));

    return NextResponse.json(templates);
  }
);

// POST - Create a new response template
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = createTemplateSchema.parse(body);

    const db = getDb();
    const [template] = await db
      .insert(responseTemplates)
      .values({
        clientId,
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
  }
);
