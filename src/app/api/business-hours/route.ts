import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb, withTransaction } from '@/db';
import { businessHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  requireAgencyClientPermission,
  AGENCY_PERMISSIONS,
  getAgencySession,
  canAccessClient,
} from '@/lib/permissions';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const requestedClientId = url.searchParams.get('clientId');
    let clientId = requestedClientId || await getClientId();

    if (!clientId) {
      return Response.json({ error: 'No client' }, { status: 403 });
    }

    if (session.user?.isAgency) {
      const agencySession = await getAgencySession();
      if (!agencySession || !canAccessClient(agencySession, clientId)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      const ownClientId = await getClientId();
      if (!ownClientId || clientId !== ownClientId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const db = getDb();

    const hours = await db
      .select()
      .from(businessHours)
      .where(eq(businessHours.clientId, clientId))
      .orderBy(businessHours.dayOfWeek);

    return Response.json({ hours });
  } catch (error) {
    return safeErrorResponse('[BusinessHours] Fetch error', error, 'Failed to fetch business hours');
  }
}

const businessHoursSchema = z.object({
  clientId: z.string().uuid(),
  hours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string(),
      closeTime: z.string(),
      isOpen: z.boolean(),
    })
  ),
});

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const parsed = businessHoursSchema.safeParse(data);

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const validated = parsed.data;

    await requireAgencyClientPermission(
      validated.clientId,
      AGENCY_PERMISSIONS.CLIENTS_EDIT
    );

    const db = getDb();

    // Wrap delete + insert in transaction to prevent partial state (D12)
    const result = await withTransaction(async (tx) => {
      await tx.delete(businessHours).where(eq(businessHours.clientId, validated.clientId));

      return tx
        .insert(businessHours)
        .values(
          validated.hours.map(hour => ({
            clientId: validated.clientId,
            dayOfWeek: hour.dayOfWeek,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
            isOpen: hour.isOpen,
          }))
        )
        .returning();
    });

    return Response.json({ success: true, hours: result });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Forbidden'))) {
      return permissionErrorResponse(error);
    }
    return safeErrorResponse('[BusinessHours] Update error', error, 'Failed to update business hours');
  }
}
