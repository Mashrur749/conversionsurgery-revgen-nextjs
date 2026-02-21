import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { emailTemplates } from '@/db/schema';
import { z } from 'zod';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async () => {
    const db = getDb();
    const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.name).limit(200);
    return NextResponse.json(templates);
  }
);

const createSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  htmlBody: z.string().min(1),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
}).strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ request }) => {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const [template] = await db.insert(emailTemplates).values(parsed.data).returning();
    return NextResponse.json(template, { status: 201 });
  }
);
