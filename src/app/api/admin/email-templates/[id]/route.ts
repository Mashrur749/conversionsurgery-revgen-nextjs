import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { emailTemplates } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logDeleteAudit } from '@/lib/services/audit';

export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(template);
  }
);

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
}).strict();

export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ request, params }) => {
    const { id } = params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(emailTemplates)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  }
);

export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEMPLATES_EDIT },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();
    const [deleted] = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
    if (deleted) {
      await logDeleteAudit({ resourceType: 'email_template', resourceId: id, metadata: { name: deleted.name } });
    }
    return NextResponse.json({ success: true });
  }
);
