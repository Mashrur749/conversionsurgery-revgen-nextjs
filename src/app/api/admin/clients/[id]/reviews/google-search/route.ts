import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findGooglePlaceId } from '@/lib/services/google-places';

/** GET /api/admin/clients/[id]/reviews/google-search?q=businessName&address=optional */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
  }

  const address = request.nextUrl.searchParams.get('address') || undefined;
  const placeId = await findGooglePlaceId(q, address);

  return NextResponse.json({ placeId, query: q });
}
