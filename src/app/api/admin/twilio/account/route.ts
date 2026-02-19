import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getAccountBalance, listOwnedNumbers } from '@/lib/services/twilio-provisioning';

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
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
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
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Account API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to fetch account info' },
      { status: 500 }
    );
  }
}
