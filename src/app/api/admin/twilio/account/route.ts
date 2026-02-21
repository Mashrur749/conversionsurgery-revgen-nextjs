import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';

/**
 * GET /api/admin/twilio/account
 *
 * Retrieve Twilio account information including current balance and all
 * owned phone numbers.
 * Requires PHONES_MANAGE permission.
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.PHONES_MANAGE },
  async () => {
    const [balance, numbers] = await Promise.all([
      getAccountBalance(),
      listOwnedNumbers(),
    ]);

    return NextResponse.json({
      balance,
      numbers,
    });
  }
);
