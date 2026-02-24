import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  KNOWLEDGE_GAP_STATUSES,
  type KnowledgeGapStatus,
} from '@/lib/services/knowledge-gap-validation';
import { bulkUpdateKnowledgeGapLifecycle } from '@/lib/services/knowledge-gap-queue';

const bulkSchema = z.object({
  gapIds: z.array(z.string().uuid()).min(1).max(200),
  status: z.enum(KNOWLEDGE_GAP_STATUSES).optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  kbEntryId: z.string().uuid().nullable().optional(),
});

/** POST /api/admin/clients/[id]/knowledge/gaps/bulk */
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId, session }) => {
    const body = await request.json();
    const data = bulkSchema.parse(body);

    const result = await bulkUpdateKnowledgeGapLifecycle(
      clientId,
      data.gapIds,
      session.personId,
      {
        status: data.status as KnowledgeGapStatus | undefined,
        ownerPersonId: data.ownerPersonId,
        dueAt: data.dueAt === undefined
          ? undefined
          : (data.dueAt ? new Date(data.dueAt) : null),
        resolutionNote: data.resolutionNote,
        kbEntryId: data.kbEntryId,
      }
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  }
);
