import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { requestAndProcessDataExport } from '@/lib/services/data-export-requests';

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const result = await requestAndProcessDataExport({
      clientId,
      requestedBy: 'admin_dashboard',
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      requestId: result.id,
    });
  }
);
