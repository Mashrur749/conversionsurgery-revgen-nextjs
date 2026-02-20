import { NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { listUnassignedNumbers } from '@/lib/services/twilio-provisioning';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * GET /api/admin/twilio/unassigned
 *
 * List Twilio phone numbers on the account that are not assigned to any client.
 * Requires PHONES_MANAGE permission.
 */
export async function GET() {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const numbers = await listUnassignedNumbers();

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
    });
  } catch (error: unknown) {
    return safeErrorResponse('[Twilio] Unassigned numbers API error', error, 'Failed to list unassigned numbers');
  }
}
