import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { revokeApiKey } from '@/lib/services/api-key-management';

export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ params }) => {
    const { id } = params;
    await revokeApiKey(id);
    return NextResponse.json({ success: true });
  }
);
