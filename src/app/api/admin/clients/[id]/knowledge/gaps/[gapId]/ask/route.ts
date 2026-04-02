import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getKnowledgeGapById, updateKnowledgeGapLifecycle } from '@/lib/services/knowledge-gap-queue';
import { sendAlert } from '@/lib/services/agency-communication';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** POST /api/admin/clients/[id]/knowledge/gaps/[gapId]/ask
 * Sends an SMS to the client owner asking how to answer a knowledge gap question,
 * then sets the gap status to in_progress.
 */
export const POST = adminClientRoute<{ id: string; gapId: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ params, clientId, session }) => {
    const db = getDb();

    // Fetch the gap
    const gap = await getKnowledgeGapById(clientId, params.gapId);
    if (!gap) {
      return NextResponse.json({ error: 'Knowledge gap not found' }, { status: 404 });
    }

    // Already in-progress — don't send duplicate
    if (gap.status === 'in_progress') {
      return NextResponse.json({ success: true, alreadySent: true });
    }

    // Fetch client for businessName check
    const [client] = await db
      .select({ id: clients.id, businessName: clients.businessName, status: clients.status })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.status === 'paused') {
      return NextResponse.json({ error: 'Client is paused — cannot send SMS' }, { status: 422 });
    }

    // Send SMS to client owner via agency number
    await sendAlert({
      clientId,
      message: `${client.businessName} — a customer asked about "${gap.question}". How should we answer this? Reply here and we'll update the AI.`,
    });

    // Transition gap to in_progress, assign to actor (logs who asked and when)
    await updateKnowledgeGapLifecycle(clientId, params.gapId, session.personId, {
      status: 'in_progress',
      ownerPersonId: session.personId,
    });

    return NextResponse.json({ success: true, alreadySent: false });
  }
);
