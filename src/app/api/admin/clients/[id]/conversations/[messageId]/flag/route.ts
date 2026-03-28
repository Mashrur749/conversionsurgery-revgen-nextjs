import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import {
  flagMessage,
  unflagMessage,
  FLAG_REASONS,
} from '@/lib/services/ai-feedback';

const flagSchema = z.object({
  reason: z.enum(FLAG_REASONS),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/clients/[id]/conversations/[messageId]/flag
 * Flag an AI-generated message as problematic.
 */
export const POST = adminClientRoute<{ id: string; messageId: string }>(
  {
    permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
    clientIdFrom: (p) => p.id,
  },
  async ({ request, session, params, clientId }) => {
    const body = await request.json();
    const data = flagSchema.parse(body);
    const { messageId } = params;

    const result = await flagMessage({
      messageId,
      clientId,
      flaggedBy: session.personId,
      reason: data.reason,
      note: data.note,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  }
);

/**
 * DELETE /api/admin/clients/[id]/conversations/[messageId]/flag
 * Remove the flag from a message.
 */
export const DELETE = adminClientRoute<{ id: string; messageId: string }>(
  {
    permission: AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
    clientIdFrom: (p) => p.id,
  },
  async ({ params, clientId }) => {
    const { messageId } = params;

    const result = await unflagMessage({ messageId, clientId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  }
);
