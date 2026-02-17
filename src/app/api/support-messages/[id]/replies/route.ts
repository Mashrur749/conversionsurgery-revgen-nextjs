import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientSession } from '@/lib/client-auth';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { sendEmail } from '@/lib/services/resend';
import { sendSlackSupportNotification } from '@/lib/services/slack';

const replySchema = z.object({
  content: z.string().min(1).max(5000),
  calcomLink: z.string().url().max(500).optional().or(z.literal('')),
});

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCallerIdentity();
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = replySchema.parse(body);

    const db = getDb();

    // Verify the message exists and user has access
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

    const [reply] = await db
      .insert(supportReplies)
      .values({
        supportMessageId: id,
        content: parsed.content,
        isAdmin: caller.isAdmin,
        authorEmail: caller.userEmail,
        calcomLink: parsed.calcomLink || null,
      })
      .returning();

    // If admin reply, send email notification to the user
    if (caller.isAdmin) {
      const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const threadUrl = `${appUrl}/client/discussions/${id}`;

      sendEmail({
        to: message.userEmail,
        subject: 'New reply to your support request',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1B2F26;">You have a new reply</h2>
            <div style="background: #F8F9FA; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; color: #1B2F26;">${parsed.content}</p>
            </div>
            ${parsed.calcomLink ? `<p style="margin: 16px 0;"><a href="${parsed.calcomLink}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Book a Call</a></p>` : ''}
            <a href="${threadUrl}" style="display: inline-block; background: #1B2F26; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 8px;">View Discussion</a>
          </div>
        `,
      });

      // Slack notification
      sendSlackSupportNotification({
        userEmail: caller.userEmail,
        page: `Reply to thread: ${message.userEmail}`,
        message: parsed.content,
      });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Support Replies API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to post reply' },
      { status: 500 }
    );
  }
}
