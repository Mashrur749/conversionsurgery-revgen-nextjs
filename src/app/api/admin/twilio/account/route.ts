import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * GET /api/admin/twilio/account
 *
 * Retrieve Twilio account information including current balance and all
 * owned phone numbers.
 * Requires PHONES_MANAGE permission.
 */
export async function GET(_request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.PHONES_MANAGE);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const [balance, numbers] = await Promise.all([
      getAccountBalance(),
      listOwnedNumbers(),
    ]);

    return NextResponse.json({
      balance,
      numbers,
    });
  } catch (error: unknown) {
    return safeErrorResponse('[Twilio] Account API error', error, 'Failed to fetch account info');
  }
}
