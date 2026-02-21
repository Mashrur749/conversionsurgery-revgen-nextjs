import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientSession } from '@/lib/client-auth';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, asc } from 'drizzle-orm';

async function getCallerIdentity(): Promise<{
  userEmail: string;
  isAdmin: boolean;
} | null> {
  const nextAuthSession = await auth();
  if (nextAuthSession?.user) {
    return {
      userEmail: nextAuthSession.user.email ?? 'unknown',
      isAdmin: (nextAuthSession as any).user?.isAdmin || false,
    };
  }

  const clientSession = await getClientSession();
  if (clientSession) {
    return {
      userEmail: clientSession.client.email,
      isAdmin: false,
    };
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerIdentity();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();

    const [message] = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.id, id))
      .limit(1);

    if (!message) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Only allow owner (by email) or admin
    if (!caller.isAdmin && message.userEmail !== caller.userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const replies = await db
      .select()
      .from(supportReplies)
      .where(eq(supportReplies.supportMessageId, id))
      .orderBy(asc(supportReplies.createdAt));

    return NextResponse.json({ message, replies });
  } catch (error) {
    console.error('[Support Message Detail] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch message' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user?.isAdmin || false;
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json() as { status: string };
    const status = body.status;

    if (status !== 'open' && status !== 'resolved') {
      return NextResponse.json(
        { error: 'Invalid status. Must be "open" or "resolved".' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [updated] = await db
      .update(supportMessages)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportMessages.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ message: updated });
  } catch (error) {
    console.error('[Support Message PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}
