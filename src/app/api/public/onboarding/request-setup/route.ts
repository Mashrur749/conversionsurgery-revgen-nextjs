import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clients, supportMessages } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

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

  return NextResponse.json({ success: true });
}
