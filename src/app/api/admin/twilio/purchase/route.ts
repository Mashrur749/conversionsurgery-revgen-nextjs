import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { purchaseNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

const purchaseSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/purchase
 *
 * Purchase a phone number from Twilio and assign it to a client.
 * Requires PHONES_MANAGE permission.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, clientId } = parsed.data;

    // Check phone number usage limit
    const { checkUsageLimit } = await import('@/lib/services/subscription');
    const { clientPhoneNumbers } = await import('@/db/schema');
    const { eq: eqOp, count: countFn } = await import('drizzle-orm');
    const { getDb: getDatabase } = await import('@/db');
    const phoneDb = getDatabase();
    const phoneCount = await phoneDb
      .select({ count: countFn() })
      .from(clientPhoneNumbers)
      .where(eqOp(clientPhoneNumbers.clientId, clientId));
    // +1 for the primary twilioNumber on clients table
    const currentPhoneCount = (phoneCount[0]?.count ?? 0) + 1;
    const usageCheck = await checkUsageLimit(clientId, 'phone_numbers', currentPhoneCount);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: `Phone number limit reached (${usageCheck.current}/${usageCheck.limit}). Upgrade plan for more numbers.` },
        { status: 403 }
      );
    }

    console.log(`[Twilio] Purchase request: number=${phoneNumber}, client=${clientId}`);

    const result = await purchaseNumber(phoneNumber, clientId);

    if (!result.success) {
      console.error(`[Twilio] Purchase failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Purchase success: SID=${result.sid}`);
    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error: unknown) {
    return safeErrorResponse('[Twilio] Purchase API error', error, 'Failed to purchase number');
  }
}
