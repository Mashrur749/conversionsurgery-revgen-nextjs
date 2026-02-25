import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clients, supportMessages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { recordDayOneActivity } from '@/lib/services/day-one-activation';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const requestSchema = z.object({
  clientId: z.string().uuid(),
  email: z.string().email(),
  message: z.string().min(5).max(2000).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const { clientId, email, message } = parsed.data;
  const db = getDb();

  const [client] = await db
    .select({ id: clients.id, businessName: clients.businessName })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.email, email)))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  await db.insert(supportMessages).values({
    userEmail: email,
    page: '/signup/next-steps',
    message:
      message ||
      `Self-serve onboarding assistance requested for ${client.businessName} (${client.id}). Please help with number provisioning and setup.`,
    status: 'open',
  });

  try {
    await recordDayOneActivity({
      clientId: client.id,
      eventType: 'managed_setup_requested',
      actorType: 'client_owner',
      actorId: email,
      notes: 'Client requested managed onboarding support from self-serve checklist.',
      metadata: {
        source: 'public_onboarding_request_setup',
        message: message ?? null,
      },
    });
  } catch (dayOneError) {
    logSanitizedConsoleError('[PublicOnboardingRequestSetup] Failed to log day-one activity:', dayOneError, {
      clientId: client.id,
    });
  }

  return NextResponse.json({ success: true });
}
