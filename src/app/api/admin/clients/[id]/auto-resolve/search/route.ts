import { NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/services/knowledge-base';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * GET /api/admin/clients/[id]/auto-resolve/search?q=...
 *
 * Searches the client&apos;s knowledge base for an entry matching the given query.
 * Used by the escalations page to surface KB suggestions for complex_technical
 * escalations. Feature-flagged via `autoResolve`.
 */
export const GET = adminClientRoute(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_VIEW,
    clientIdFrom: (p: { id: string }) => p.id,
  },
  async ({ request, clientId }) => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q) {
      return NextResponse.json({ found: false, reason: 'Missing query' });
    }

    const enabled = await resolveFeatureFlag(clientId, 'autoResolve');
    if (!enabled) {
      return NextResponse.json({ found: false, reason: 'Auto-resolve disabled' });
    }

    const matches = await semanticSearch(clientId, q, 1);

    if (
      matches.length === 0 ||
      (matches[0].similarity !== undefined && matches[0].similarity <= 0.3)
    ) {
      return NextResponse.json({ found: false, reason: 'No match above threshold' });
    }

    const best = matches[0];
    return NextResponse.json({
      found: true,
      entry: {
        id: best.id,
        title: best.title,
        content: best.content,
        category: best.category,
        similarity: best.similarity,
      },
    });
  }
);
