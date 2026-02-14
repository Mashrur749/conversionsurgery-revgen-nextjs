import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { agencyMessages, clients } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { sendActionPrompt, sendAlert } from '@/lib/services/agency-communication';

/**
 * GET /api/admin/agency/messages
 * List all agency messages. Filterable by clientId, category. Paginated.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get('clientId');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const offset = (page - 1) * limit;

  const db = getDb();

  const conditions = [];
  if (clientId) conditions.push(eq(agencyMessages.clientId, clientId));
  if (category) conditions.push(eq(agencyMessages.category, category));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [messages, countResult] = await Promise.all([
    db
      .select({
        id: agencyMessages.id,
        clientId: agencyMessages.clientId,
        clientName: clients.businessName,
        direction: agencyMessages.direction,
        channel: agencyMessages.channel,
        content: agencyMessages.content,
        subject: agencyMessages.subject,
        category: agencyMessages.category,
        promptType: agencyMessages.promptType,
        actionStatus: agencyMessages.actionStatus,
        clientReply: agencyMessages.clientReply,
        delivered: agencyMessages.delivered,
        createdAt: agencyMessages.createdAt,
        expiresAt: agencyMessages.expiresAt,
      })
      .from(agencyMessages)
      .leftJoin(clients, eq(agencyMessages.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(agencyMessages.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(agencyMessages)
      .where(whereClause),
  ]);

  return NextResponse.json({
    messages,
    pagination: {
      page,
      limit,
      total: Number(countResult[0]?.count ?? 0),
    },
  });
}

/**
 * POST /api/admin/agency/messages
 * Send a custom message or prompt to a client.
 */
const sendMessageSchema = z.object({
  clientId: z.string().uuid(),
  message: z.string().min(1),
  type: z.enum(['custom', 'prompt', 'alert']).default('custom'),
  promptType: z.string().optional(),
  actionPayload: z.record(z.string(), z.unknown()).optional(),
  expiresInHours: z.number().positive().max(168).optional(),
  isUrgent: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = sendMessageSchema.parse(body);

    if (data.type === 'prompt' && data.promptType && data.actionPayload) {
      const id = await sendActionPrompt({
        clientId: data.clientId,
        promptType: data.promptType,
        message: data.message,
        actionPayload: data.actionPayload,
        expiresInHours: data.expiresInHours,
      });
      return NextResponse.json({ success: true, messageId: id });
    }

    if (data.type === 'alert') {
      await sendAlert({
        clientId: data.clientId,
        message: data.message,
        isUrgent: data.isUrgent,
      });
      return NextResponse.json({ success: true });
    }

    // Custom message — send directly via agency number
    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);

    if (!client?.phone) {
      return NextResponse.json({ error: 'Client has no phone number' }, { status: 400 });
    }

    // Import twilio and send
    const twilio = await import('twilio');
    const twilioClient = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );

    const { getAgencyNumber } = await import('@/lib/services/agency-communication');
    const agencyNumber = await getAgencyNumber();
    if (!agencyNumber) {
      return NextResponse.json({ error: 'Agency number not configured' }, { status: 400 });
    }

    const message = await twilioClient.messages.create({
      to: client.phone,
      from: agencyNumber,
      body: data.message,
    });

    const [inserted] = await db
      .insert(agencyMessages)
      .values({
        clientId: data.clientId,
        direction: 'outbound',
        channel: 'sms',
        content: data.message,
        category: 'custom',
        twilioSid: message.sid,
        delivered: true,
      })
      .returning();

    return NextResponse.json({ success: true, messageId: inserted.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Agency Messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
