import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  buildExportDownloadPath,
  listClientDataExportRequests,
  requestAndProcessDataExport,
  resolveDataExportSlaState,
} from '@/lib/services/data-export-requests';

/** GET /api/client/exports */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
    const requests = await listClientDataExportRequests(session.clientId);
    const now = new Date();

    return NextResponse.json({
      requests: requests.map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
        dueAt: request.dueAt.toISOString(),
        readyAt: request.readyAt?.toISOString() ?? null,
        deliveredAt: request.deliveredAt?.toISOString() ?? null,
        failedAt: request.failedAt?.toISOString() ?? null,
        failureReason: request.failureReason ?? null,
        downloadTokenExpiresAt: request.downloadTokenExpiresAt?.toISOString() ?? null,
        downloadPath: request.downloadToken
          ? buildExportDownloadPath(request.id, request.downloadToken)
          : null,
        slaState: resolveDataExportSlaState({ status: request.status, dueAt: request.dueAt }, now),
      })),
    });
  }
);

/** POST /api/client/exports */
export const POST = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ session }) => {
    const request = await requestAndProcessDataExport({
      clientId: session.clientId,
      requestedBy: 'client_portal_manual',
    });

    return NextResponse.json({
      success: true,
      request: {
        id: request.id,
        status: request.status,
        dueAt: request.dueAt.toISOString(),
        readyAt: request.readyAt?.toISOString() ?? null,
        failureReason: request.failureReason ?? null,
        downloadPath: request.downloadToken
          ? buildExportDownloadPath(request.id, request.downloadToken)
          : null,
      },
    });
  }
);
