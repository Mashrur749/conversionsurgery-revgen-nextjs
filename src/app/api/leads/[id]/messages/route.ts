import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { conversations } from '@/db/schema/conversations';
import { eq, and, desc } from 'drizzle-orm';

/** GET /api/leads/[id]/messages - Fetch all messages for a lead. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = session?.client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const db = getDb();

  // Verify lead belongs to client
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, id))
    .orderBy(desc(conversations.createdAt));

  return NextResponse.json({ messages });
}
