import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import type { NewLead } from '@/db/schema/leads';
import { eq, and } from 'drizzle-orm';

/** PATCH /api/leads/[id] - Update a lead's fields (scoped to the authenticated client). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = (session as { client?: { id?: string } })?.client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Partial<NewLead>;

    const db = getDb();

    const updated = await db
      .update(leads)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('[LeadManagement] Update lead error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
