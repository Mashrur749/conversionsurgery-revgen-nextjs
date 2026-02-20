import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { helpArticles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logDeleteAudit } from '@/lib/services/audit';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(helpArticles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(helpArticles.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  const db = getDb();
  const [deleted] = await db.delete(helpArticles).where(eq(helpArticles.id, id)).returning();
  if (deleted) {
    await logDeleteAudit({ resourceType: 'help_article', resourceId: id, metadata: { title: deleted.title } });
  }

  return NextResponse.json({ success: true });
}
