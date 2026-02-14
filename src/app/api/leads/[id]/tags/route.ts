import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClientId } from '@/lib/get-client-id';
import { z } from 'zod';

const tagsSchema = z.object({
  tags: z.array(z.string().max(50)).max(20),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const clientId = await getClientId();
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = tagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(leads)
    .set({ tags: parsed.data.tags, updatedAt: new Date() })
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)));

  return NextResponse.json({ success: true, tags: parsed.data.tags });
}
