import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { listUnassignedNumbers } from '@/lib/services/twilio-provisioning';

/**
 * GET /api/admin/twilio/unassigned
 *
 * List Twilio phone numbers on the account that are not assigned to any client.
 * Requires PHONES_MANAGE permission.
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE },
  async () => {
    const numbers = await listUnassignedNumbers();

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
    });
  }
);
