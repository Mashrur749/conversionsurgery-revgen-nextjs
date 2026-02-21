import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { postResponseToGoogle } from '@/lib/services/google-business';

/** POST - Post a review response to Google Business Profile. */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ params }) => {
    const { id } = params;

    const result = await postResponseToGoogle(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }
);
