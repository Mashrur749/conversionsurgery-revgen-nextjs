import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const reassignSchema = z.object({
  phoneNumber: z.string().min(1),
  targetClientId: z.string().uuid(),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { phoneNumber, targetClientId } = reassignSchema.parse(body);

    const db = getDb();

    // Verify target client exists and is active
    const [targetClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, targetClientId))
      .limit(1);

    if (!targetClient) {
      return Response.json({ error: 'Target client not found' }, { status: 404 });
    }

    if (targetClient.status === 'cancelled') {
      return Response.json(
        { error: 'Cannot assign number to cancelled client' },
        { status: 400 }
      );
    }

    // Release current assignment (if any)
    await db
      .update(clients)
      .set({ twilioNumber: null, updatedAt: new Date() })
      .where(eq(clients.twilioNumber, phoneNumber));

    // Assign to new client
    await db
      .update(clients)
      .set({
        twilioNumber: phoneNumber,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, targetClientId));

    return Response.json({
      success: true,
      phoneNumber,
      clientId: targetClientId,
      message: `Phone number reassigned to ${targetClient.businessName}`,
    });
  } catch (error: any) {
    console.error('[Phone Reassign] Error:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to reassign phone number' },
      { status: 500 }
    );
  }
}
