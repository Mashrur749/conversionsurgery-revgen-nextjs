import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, leads } from '@/db';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = (session as any).client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    const db = getDb();

    const updated = await db
      .update(leads)
      .set({
        ...body,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
