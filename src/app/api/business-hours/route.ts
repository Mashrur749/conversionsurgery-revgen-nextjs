import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { businessHours } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const businessHoursSchema = z.object({
  clientId: z.string().uuid(),
  hours: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      openTime: z.string(),
      closeTime: z.string(),
      isOpen: z.boolean(),
    })
  ),
});

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const data = await req.json();
    const validated = businessHoursSchema.parse(data);

    const db = getDb();

    // Delete existing hours for this client
    await db.delete(businessHours).where(eq(businessHours.clientId, validated.clientId));

    // Insert new hours
    const result = await db
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

    return Response.json({ success: true, hours: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Business hours update error:', error);
    return Response.json({ error: 'Failed to update business hours' }, { status: 500 });
  }
}
