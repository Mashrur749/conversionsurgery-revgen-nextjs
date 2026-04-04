import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientSession } from '@/lib/client-auth';
import { getDb, supportMessages, supportReplies } from '@/db';
import { z } from 'zod';
import { eq, desc, sql, count, and } from 'drizzle-orm';
import { sendSlackSupportNotification } from '@/lib/services/slack';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const supportMessageSchema = z.object({
  page: z.string().min(1).max(500),
  message: z.string().min(1).max(2000),
  targetEmail: z.string().email().max(255).optional(),
});

// Resolve the caller's identity from either auth system
async function getCallerIdentity(): Promise<{
  userId: string | null;
  userEmail: string;
  isAgency: boolean;
} | null> {
  // Try NextAuth first (admin/dashboard users)
  const nextAuthSession = await auth();
  if (nextAuthSession?.user) {
    return {
      userId: (nextAuthSession.user as any).id as string,
      userEmail: nextAuthSession.user.email ?? 'unknown',
      isAgency: nextAuthSession.user?.isAgency || false,
    };
  }

  // Fall back to client auth (client portal users)
  const clientSession = await getClientSession();
  if (clientSession) {
    return {
      userId: null,
      userEmail: clientSession.client.email,
      isAgency: false,
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

    // Admin initiating a thread with a specific client
    if (caller.isAgency && parsed.targetEmail) {
      const [thread] = await db.insert(supportMessages).values({
        userId: caller.userId,
        userEmail: parsed.targetEmail,
        page: parsed.page,
        message: 'New message from your support team',
      }).returning();

      // Add the admin's actual message as the first reply
      await db.insert(supportReplies).values({
        supportMessageId: thread.id,
        content: parsed.message,
        isAdmin: true,
        authorEmail: caller.userEmail,
      });

      // Email the client
      const { sendEmail } = await import('@/lib/services/resend');
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const threadUrl = `${appUrl}/client/discussions/${thread.id}`;

      sendEmail({
        to: parsed.targetEmail,
        subject: 'New message from your support team',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B2F26;">You have a new message</h2>
            <div style="background: #F8F9FA; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; color: #1B2F26;">${parsed.message}</p>
            </div>
            <a href="${threadUrl}" style="display: inline-block; background: #1B2F26; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 8px;">View Discussion</a>
          </div>
        `,
      });

      // Slack notification
      sendSlackSupportNotification({
        userEmail: caller.userEmail,
        page: `Admin initiated thread with: ${parsed.targetEmail}`,
        message: parsed.message,
      });

      return NextResponse.json({ success: true, threadId: thread.id });
    }

    // Normal flow: user creating their own support message
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
    return safeErrorResponse('[SupportMessages][post]', error, 'Failed to submit message');
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
    if (!caller.isAgency) {
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
    return safeErrorResponse('[SupportMessages][get]', error, 'Failed to fetch messages');
  }
}
