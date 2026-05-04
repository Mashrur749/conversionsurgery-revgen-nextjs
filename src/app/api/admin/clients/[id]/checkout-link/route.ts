import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import { createCheckoutSession } from '@/lib/services/subscription';
import { isPlanAvailable } from '@/lib/services/plan-availability';

const bodySchema = z.object({
  planId: z.string().uuid(),
}).strict();

/** POST /api/admin/clients/[id]/checkout-link — generate a Stripe Checkout URL */
export const POST = adminClientRoute(
  {
    permission: AGENCY_PERMISSIONS.BILLING_MANAGE,
    clientIdFrom: (p: { id: string }) => p.id,
  },
  async ({ request, clientId }) => {
    const body = await request.json();
    const { planId } = bodySchema.parse(body);

    // Enforce plan capacity (e.g. Pilot max 3 active clients)
    const availability = await isPlanAvailable(planId);
    if (!availability.available) {
      return NextResponse.json(
        {
          error: 'Plan capacity reached',
          activeCount: availability.activeCount,
          maxAllowed: availability.maxAllowed,
        },
        { status: 409 }
      );
    }

    const { url, sessionId } = await createCheckoutSession(clientId, planId);

    return NextResponse.json({ url, sessionId });
  }
);
