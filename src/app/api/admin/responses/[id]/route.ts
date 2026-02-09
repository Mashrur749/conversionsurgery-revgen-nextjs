import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  responseText: z.string().min(1).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'posted', 'rejected']).optional(),
});

// GET - Get single response
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

// PATCH - Update response text or status
export async function PATCH(
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
    const data = updateSchema.parse(body);

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Review Response] Update error:', error);
    return NextResponse.json({ error: 'Failed to update response' }, { status: 500 });
  }
}

// DELETE - Delete draft response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  await db.delete(reviewResponses).where(eq(reviewResponses.id, id));

  return NextResponse.json({ success: true });
}
