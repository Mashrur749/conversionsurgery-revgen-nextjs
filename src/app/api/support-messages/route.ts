import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientSession } from '@/lib/client-auth';
import { getDb, supportMessages, supportReplies } from '@/db';
import { z } from 'zod';
import { eq, desc, sql, count, and } from 'drizzle-orm';
import { sendSlackSupportNotification } from '@/lib/services/slack';

const supportMessageSchema = z.object({
  page: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
});

// Resolve the caller's identity from either auth system
async function getCallerIdentity(): Promise<{
  userId: string | null;
  userEmail: string;
  isAdmin: boolean;
} | null> {
  // Try NextAuth first (admin/dashboard users)
  const nextAuthSession = await auth();
  if (nextAuthSession?.user) {
    return {
      userId: (nextAuthSession.user as any).id as string,
      userEmail: nextAuthSession.user.email ?? 'unknown',
      isAdmin: (nextAuthSession as any).user?.isAdmin || false,
    };
  }

  // Fall back to client auth (client portal users)
  const clientSession = await getClientSession();
  if (clientSession) {
    return {
      userId: null,
      userEmail: clientSession.client.email,
      isAdmin: false,
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const caller = await getCallerIdentity();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = supportMessageSchema.parse(body);

    const db = getDb();

    await db.insert(supportMessages).values({
      userId: caller.userId,
      userEmail: caller.userEmail,
      page: parsed.page,
      message: parsed.message,
    });

    // Fire-and-forget Slack notification
    sendSlackSupportNotification({
      userEmail: caller.userEmail,
      page: parsed.page,
      message: parsed.message,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Support Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit message' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const caller = await getCallerIdentity();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Build conditions
    const conditions = [];
    if (!caller.isAdmin) {
      // Non-admin: filter by email (works for both NextAuth and client auth)
      conditions.push(eq(supportMessages.userEmail, caller.userEmail));
    }
    if (statusFilter && (statusFilter === 'open' || statusFilter === 'resolved')) {
      conditions.push(eq(supportMessages.status, statusFilter));
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    // Get messages with reply counts
    const messages = await db
      .select({
        id: supportMessages.id,
        userId: supportMessages.userId,
        userEmail: supportMessages.userEmail,
        page: supportMessages.page,
        message: supportMessages.message,
        status: supportMessages.status,
        createdAt: supportMessages.createdAt,
        replyCount: count(supportReplies.id),
        lastReplyAt: sql<string>`max(${supportReplies.createdAt})`,
      })
      .from(supportMessages)
      .leftJoin(supportReplies, eq(supportMessages.id, supportReplies.supportMessageId))
      .where(whereClause)
      .groupBy(supportMessages.id)
      .orderBy(desc(sql`COALESCE(max(${supportReplies.createdAt}), ${supportMessages.createdAt})`));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Support Messages API] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
