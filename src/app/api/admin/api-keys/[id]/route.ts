import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { revokeApiKey } from '@/lib/services/api-key-management';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;
  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}
