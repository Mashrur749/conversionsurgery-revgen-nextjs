import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { assignExistingNumber } from '@/lib/services/twilio-provisioning';
import { z } from 'zod';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

const assignSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 characters'),
  clientId: z.string().uuid('Client ID must be a valid UUID'),
});

/**
 * POST /api/admin/twilio/assign
 *
 * Assign an existing owned Twilio number to a client without configuring
 * webhooks. Use the configure endpoint separately to set up webhooks.
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
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { phoneNumber, clientId } = parsed.data;

    console.log(`[Twilio] Assign request: number=${phoneNumber}, client=${clientId}`);

    const result = await assignExistingNumber(phoneNumber, clientId);

    if (!result.success) {
      console.error(`[Twilio] Assign failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    console.log(`[Twilio] Assign success: ${phoneNumber} → ${clientId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return safeErrorResponse('[Twilio] Assign API error', error, 'Failed to assign number');
  }
}
