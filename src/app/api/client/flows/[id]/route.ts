import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { flows } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  isActive: z.boolean(),
}).strict();

/** PATCH /api/client/flows/[id] - Toggle a flow on/off for the authenticated client. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify the flow belongs to this client
  const [flow] = await db
    .select({ id: flows.id })
    .from(flows)
    .where(and(eq(flows.id, id), eq(flows.clientId, session.clientId)))
    .limit(1);

  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }

  await db
    .update(flows)
    .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
    .where(eq(flows.id, id));

  return NextResponse.json({ ok: true });
}
