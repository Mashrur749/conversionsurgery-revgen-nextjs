import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const conversationModeSchema = z.object({
  mode: z.enum(['ai', 'human', 'paused']),
}).strict();

/**
 * POST /api/admin/leads/[id]/conversation-mode
 * Set the conversation mode for a lead (AI, human, or paused).
 */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ request, session, params }) => {
    const { id } = params;
    const body = await request.json();
    const parsed = conversationModeSchema.parse(body);
    const db = getDb();

    const isHumanTakeover = parsed.mode === 'human';
    const isHandback = parsed.mode === 'ai';

    const updated = await db
      .update(leads)
      .set({
        conversationMode: parsed.mode,
        ...(isHumanTakeover && {
          humanTakeoverAt: new Date(),
          humanTakeoverBy: `agency:${session.personId}`,
        }),
        ...(isHandback && {
          humanTakeoverAt: null,
          humanTakeoverBy: null,
          actionRequired: false,
        }),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))
      .returning({ id: leads.id, conversationMode: leads.conversationMode });

    if (!updated.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      conversationMode: updated[0].conversationMode,
    });
  }
);
