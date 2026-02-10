import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, escalationQueue, leads, conversations, teamMembers } from '@/db';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  try {
    const [escalation] = await db
      .select()
      .from(escalationQueue)
      .where(eq(escalationQueue.id, id))
      .limit(1);

    if (!escalation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get lead details
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, escalation.leadId))
      .limit(1);

    // Get conversation history
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, escalation.leadId))
      .orderBy(desc(conversations.createdAt))
      .limit(50);

    // Get assignee details
    let assignee = null;
    if (escalation.assignedTo) {
      const [member] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, escalation.assignedTo))
        .limit(1);
      assignee = member || null;
    }

    return NextResponse.json({
      escalation,
      lead,
      conversation: conversation.reverse(),
      assignee,
    });
  } catch (error) {
    console.error('[Escalation API] Error fetching detail:', error);
    return NextResponse.json({ error: 'Failed to fetch escalation' }, { status: 500 });
  }
}
