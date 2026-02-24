import { NextResponse } from 'next/server';
import { z } from 'zod';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  getDownloadableDataExportRequest,
  markDataExportDelivered,
} from '@/lib/services/data-export-requests';
import { buildClientDataExportBundle } from '@/lib/services/data-export-bundle';

const tokenSchema = z.object({
  token: z.string().min(20),
});

/** GET /api/client/exports/[requestId]/download?token=... */
export const GET = portalRoute<{ requestId: string }>(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ request, session, params }) => {
    const parsed = tokenSchema.safeParse({
      token: request.nextUrl.searchParams.get('token'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing or invalid download token' }, { status: 400 });
    }

    const exportRequest = await getDownloadableDataExportRequest({
      requestId: params.requestId,
      clientId: session.clientId,
      token: parsed.data.token,
    });

    if (!exportRequest) {
      return NextResponse.json({ error: 'Export link is invalid or expired' }, { status: 404 });
    }

    const bundle = await buildClientDataExportBundle(session.clientId);
    await markDataExportDelivered(exportRequest.id);

    return new NextResponse(bundle.content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${bundle.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }
);
