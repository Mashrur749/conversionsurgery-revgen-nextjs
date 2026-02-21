import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { flows } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  isActive: z.boolean(),
}).strict();

/** PATCH /api/client/flows/[id] - Toggle a flow on/off for the authenticated client. */
export const PATCH = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session, params }) => {
    const { id } = params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify the flow belongs to this client
    const [flow] = await db
      .select({ id: flows.id })
      .from(flows)
      .where(and(eq(flows.id, id), eq(flows.clientId, session.clientId)))
      .limit(1);

    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    await db
      .update(flows)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(and(eq(flows.id, id), eq(flows.clientId, session.clientId)));

    return NextResponse.json({ ok: true });
  }
);
