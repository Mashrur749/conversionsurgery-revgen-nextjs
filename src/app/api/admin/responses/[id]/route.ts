import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logDeleteAudit } from '@/lib/services/audit';

const updateSchema = z.object({
  responseText: z.string().min(1).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'posted', 'rejected']).optional(),
});

/** GET - Get a single review response by ID. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  const db = getDb();
  const [response] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, id))
    .limit(1);

  if (!response) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(response);
}

/** PATCH - Update a review response's text or status. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.responseText) updates.responseText = data.responseText;
    if (data.status) updates.status = data.status;

    const db = getDb();
    await db
      .update(reviewResponses)
      .set(updates)
      .where(eq(reviewResponses.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Reputation] Update response error for', id, ':', error);
    return NextResponse.json({ error: 'Failed to update response' }, { status: 500 });
  }
}

/** DELETE - Delete a draft review response. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  const db = getDb();
  const [deleted] = await db.delete(reviewResponses).where(eq(reviewResponses.id, id)).returning();
  if (deleted) {
    await logDeleteAudit({ resourceType: 'review_response', resourceId: id });
  }

  return NextResponse.json({ success: true });
}
