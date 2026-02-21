import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { findGooglePlaceId } from '@/lib/services/google-places';

/** GET /api/admin/clients/[id]/reviews/google-search?q=businessName&address=optional */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ request }) => {
    const q = request.nextUrl.searchParams.get('q');
    if (!q) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
    }

    const address = request.nextUrl.searchParams.get('address') || undefined;
    const placeId = await findGooglePlaceId(q, address);

    return NextResponse.json({ placeId, query: q });
  }
);
