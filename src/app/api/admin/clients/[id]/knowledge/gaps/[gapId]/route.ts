import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import {
  KNOWLEDGE_GAP_STATUSES,
  type KnowledgeGapStatus,
} from '@/lib/services/knowledge-gap-validation';
import { updateKnowledgeGapLifecycle } from '@/lib/services/knowledge-gap-queue';

const patchSchema = z.object({
  status: z.enum(KNOWLEDGE_GAP_STATUSES).optional(),
  ownerPersonId: z.string().uuid().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  kbEntryId: z.string().uuid().nullable().optional(),
});

/** PATCH /api/admin/clients/[id]/knowledge/gaps/[gapId] */
export const PATCH = adminClientRoute<{ id: string; gapId: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId, session }) => {
    const body = await request.json();
    const data = patchSchema.parse(body);

    const updated = await updateKnowledgeGapLifecycle(
      clientId,
      params.gapId,
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
      gap: updated,
    });
  }
);
