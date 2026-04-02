import { NextResponse } from 'next/server';
import { fullSync } from '@/lib/services/calendar';
import { z } from 'zod';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const syncSchema = z
  .object({
    clientId: z.string().uuid('clientId must be a valid UUID'),
  })
  .strict();

/** POST /api/calendar/sync - Trigger a full bidirectional sync for a client */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const body = (await request.json()) as unknown;
    const parsed = syncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId } = parsed.data;
    const results = await fullSync(clientId);

    return NextResponse.json(results);
  }
);
