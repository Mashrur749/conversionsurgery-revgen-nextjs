import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import {
  clients,
  clientCancellations,
  CANCEL_TYPES,
  CANCEL_REASON_CATEGORIES,
} from '@/db/schema';

/**
 * POST /api/admin/clients/[id]/cancel
 *
 * Captures a structured cancellation reason and marks the client cancelled.
 * Permission: CLIENTS_EDIT (status mutation matches the existing PATCH route).
 * `MANAGE_CLIENTS` was requested but is not defined in AGENCY_PERMISSIONS.
 */
const cancelClientSchema = z
  .object({
    cancelType: z.enum(CANCEL_TYPES),
    reasonCategory: z.enum(CANCEL_REASON_CATEGORIES),
    notes: z.string().max(4000).optional().nullable(),
  })
  .strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, session, clientId }) => {
    const body = (await request.json()) as unknown;
    const parsed = cancelClientSchema.parse(body);

    const db = getDb();

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [cancellation] = await db
      .insert(clientCancellations)
      .values({
        clientId,
        cancelType: parsed.cancelType,
        reasonCategory: parsed.reasonCategory,
        notes: parsed.notes ?? null,
        capturedBy: session.personId,
      })
      .returning();

    await db
      .update(clients)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(clients.id, clientId));

    return NextResponse.json({ cancellation }, { status: 201 });
  }
);
