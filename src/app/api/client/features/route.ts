import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Subset of feature flags safe for client self-service
const CLIENT_SAFE_TOGGLES = [
  'missedCallSmsEnabled',
  'aiResponseEnabled',
  'photoRequestsEnabled',
  'notificationEmail',
  'notificationSms',
] as const;

type ClientToggle = typeof CLIENT_SAFE_TOGGLES[number];

/** GET /api/client/features - Fetch safe feature toggles for the authenticated client. */
export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const toggles: Record<string, boolean> = {};
  for (const key of CLIENT_SAFE_TOGGLES) {
    toggles[key] = session.client[key] ?? true;
  }

  return NextResponse.json(toggles);
}

const updateSchema = z.object({
  missedCallSmsEnabled: z.boolean().optional(),
  aiResponseEnabled: z.boolean().optional(),
  photoRequestsEnabled: z.boolean().optional(),
  notificationEmail: z.boolean().optional(),
  notificationSms: z.boolean().optional(),
}).strict();

/** PUT /api/client/features - Update safe feature toggles for the authenticated client. */
export async function PUT(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Only allow the safe subset
  const updates: Partial<Record<ClientToggle, boolean>> = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (CLIENT_SAFE_TOGGLES.includes(key as ClientToggle) && val !== undefined) {
      updates[key as ClientToggle] = val;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  await db
    .update(clients)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(clients.id, session.clientId));

  return NextResponse.json({ ok: true });
}
