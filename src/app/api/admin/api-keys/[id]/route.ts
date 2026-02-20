import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { revokeApiKey } from '@/lib/services/api-key-management';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { id } = await params;
  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}
