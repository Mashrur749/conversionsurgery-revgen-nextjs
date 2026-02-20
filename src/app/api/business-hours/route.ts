import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb } from '@/db';
import { businessHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId') || await getClientId();

    if (!clientId) {
      return Response.json({ error: 'No client' }, { status: 403 });
    }

    const db = getDb();

    const hours = await db
      .select()
      .from(businessHours)
      .where(eq(businessHours.clientId, clientId))
      .orderBy(businessHours.dayOfWeek);

    return Response.json({ hours });
  } catch (error) {
    console.error('[BusinessHours] Fetch error:', error);
    return Response.json({ error: 'Failed to fetch business hours' }, { status: 500 });
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
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);

    const data = await req.json();
    const parsed = businessHoursSchema.safeParse(data);

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const validated = parsed.data;
    const db = getDb();

    // Wrap delete + insert in transaction to prevent partial state (D12)
    const result = await db.transaction(async (tx) => {
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
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[BusinessHours] Update error:', error);
    return Response.json({ error: 'Failed to update business hours' }, { status: 500 });
  }
}
