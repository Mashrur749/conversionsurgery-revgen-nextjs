import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  KNOWLEDGE_GAP_STATUSES,
  type KnowledgeGapStatus,
} from '@/lib/services/knowledge-gap-validation';
import { listKnowledgeGapQueue } from '@/lib/services/knowledge-gap-queue';

const listQuerySchema = z.object({
  status: z.string().optional(),
  ownerPersonId: z.string().uuid().optional(),
  search: z.string().optional(),
  highPriority: z.enum(['true', 'false']).optional(),
  staleOnly: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

function parseStatuses(statusParam: string | undefined): KnowledgeGapStatus[] | undefined {
  if (!statusParam) return undefined;
  const tokens = statusParam
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const statuses = tokens.filter((token): token is KnowledgeGapStatus =>
    KNOWLEDGE_GAP_STATUSES.includes(token as KnowledgeGapStatus)
  );
  return statuses.length > 0 ? statuses : undefined;
}

/** GET /api/admin/clients/[id]/knowledge/gaps */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const url = new URL(request.url);
    const parsed = listQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
      ownerPersonId: url.searchParams.get('ownerPersonId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      highPriority: url.searchParams.get('highPriority') ?? undefined,
      staleOnly: url.searchParams.get('staleOnly') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    const queue = await listKnowledgeGapQueue(clientId, {
      statuses: parseStatuses(parsed.status),
      ownerPersonId: parsed.ownerPersonId,
      search: parsed.search,
      onlyHighPriority: parsed.highPriority === 'true',
      onlyStale: parsed.staleOnly === 'true',
      limit: parsed.limit,
    });

    return NextResponse.json({
      success: true,
      ...queue,
    });
  }
);
