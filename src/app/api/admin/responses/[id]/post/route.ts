import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { postResponseToGoogle } from '@/lib/services/google-business';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** POST - Post a review response to Google Business Profile. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;

  try {
    const result = await postResponseToGoogle(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Reputation] Post response to Google error for', id, ':', error);
    return NextResponse.json(
      { error: 'Failed to post response to Google' },
      { status: 500 }
    );
  }
}
