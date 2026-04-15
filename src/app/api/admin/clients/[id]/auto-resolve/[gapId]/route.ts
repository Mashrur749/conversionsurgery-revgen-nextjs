import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getAutoResolveSuggestion, applyAutoResolve } from '@/lib/services/auto-resolve';

const applySchema = z.object({
  answer: z.string().min(1),
  kbEntryId: z.string().uuid().optional(),
}).strict();

/** GET /api/admin/clients/[id]/auto-resolve/[gapId] — suggest a KB-sourced answer */
export const GET = adminClientRoute<{ id: string; gapId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId, params }) => {
    const { gapId } = params;
    const suggestion = await getAutoResolveSuggestion(clientId, gapId);
    return NextResponse.json(suggestion);
  }
);

/** POST /api/admin/clients/[id]/auto-resolve/[gapId] — apply operator-approved resolution */
export const POST = adminClientRoute<{ id: string; gapId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId, params, session }) => {
    const { gapId } = params;

    const body = await request.json();
    const { answer, kbEntryId } = applySchema.parse(body);

    const result = await applyAutoResolve({
      clientId,
      gapId,
      answer,
      kbEntryId,
      operatorPersonId: session.personId,
    });

    return NextResponse.json(result);
  }
);
