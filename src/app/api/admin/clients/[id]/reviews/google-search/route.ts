import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { findGooglePlaceId } from '@/lib/services/google-places';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/admin/clients/[id]/reviews/google-search?q=businessName&address=optional */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 });
  }

  const address = request.nextUrl.searchParams.get('address') || undefined;
  const placeId = await findGooglePlaceId(q, address);

  return NextResponse.json({ placeId, query: q });
}
