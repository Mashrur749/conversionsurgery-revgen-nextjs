import { auth } from '@/auth';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const reassignSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  targetClientId: z.string().uuid('Target client ID must be a valid UUID'),
});

/**
 * PATCH /api/admin/phone-numbers/reassign
 *
 * Reassign a phone number from its current client to a different client.
 * Releases the number from the existing holder and assigns it to the target.
 * Requires admin authentication.
 */
export async function PATCH(req: Request) {
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = reassignSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, targetClientId } = parsed.data;

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

    console.log(`[Twilio] Reassigned ${phoneNumber} to client ${targetClient.businessName} (${targetClientId})`);

    return Response.json({
      success: true,
      phoneNumber,
      clientId: targetClientId,
      message: `Phone number reassigned to ${targetClient.businessName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Phone reassign error:', message);

    return Response.json(
      { error: message || 'Failed to reassign phone number' },
      { status: 500 }
    );
  }
}
