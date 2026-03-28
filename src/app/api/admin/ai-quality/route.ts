import { NextResponse } from 'next/server';
import {
  adminRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import {
  getAllFlaggedMessages,
  getFlagStats,
} from '@/lib/services/ai-feedback';

/**
 * GET /api/admin/ai-quality
 *
 * Returns flagged AI messages across all clients with summary stats.
 * Query params: ?limit=50&offset=0&clientId=xxx
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') ?? '50', 10),
      100
    );
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const clientId = url.searchParams.get('clientId');

    if (clientId) {
      const { getFlaggedMessages } = await import(
        '@/lib/services/ai-feedback'
      );
      const [messages, stats] = await Promise.all([
        getFlaggedMessages(clientId, { limit, offset }),
        getFlagStats(clientId),
      ]);

      return NextResponse.json({ messages, stats });
    }

    const messages = await getAllFlaggedMessages({ limit, offset });

    return NextResponse.json({ messages });
  }
);
