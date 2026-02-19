import { NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { listUnassignedNumbers } from '@/lib/services/twilio-provisioning';

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
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {
    const numbers = await listUnassignedNumbers();

    return NextResponse.json({
      success: true,
      numbers,
      count: numbers.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Twilio] Unassigned numbers API error:', message);
    return NextResponse.json(
      { error: message || 'Failed to list unassigned numbers' },
      { status: 500 }
    );
  }
}
