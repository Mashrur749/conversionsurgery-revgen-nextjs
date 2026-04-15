import { getDb } from '@/db';
import { clients, escalationQueue, knowledgeGaps } from '@/db/schema';
import { eq, gte, count } from 'drizzle-orm';

export interface CapacitySnapshot {
  totalClients: number;
  byPhase: {
    onboarding: number;
    assist: number;
    autonomous: number;
    manual: number;
  };
  openEscalations: number;
  openKbGaps: number;
  smartAssistQueueDepth: number;
}

export async function getCapacitySnapshot(): Promise<CapacitySnapshot> {
  const db = getDb();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeClients, escalationRows, kbGapRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        aiAgentMode: clients.aiAgentMode,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(eq(clients.status, 'active')),

    db
      .select({ total: count(escalationQueue.id) })
      .from(escalationQueue)
      .where(gte(escalationQueue.createdAt, sevenDaysAgo)),

    db
      .select({ total: count(knowledgeGaps.id) })
      .from(knowledgeGaps)
      .where(eq(knowledgeGaps.status, 'new')),
  ]);

  const byPhase = { onboarding: 0, assist: 0, autonomous: 0, manual: 0 };
  for (const client of activeClients) {
    if (client.createdAt > fourteenDaysAgo) {
      byPhase.onboarding++;
    } else if (client.aiAgentMode === 'assist') {
      byPhase.assist++;
    } else if (client.aiAgentMode === 'autonomous') {
      byPhase.autonomous++;
    } else {
      byPhase.manual++;
    }
  }

  return {
    totalClients: activeClients.length,
    byPhase,
    openEscalations: Number(escalationRows[0]?.total ?? 0),
    openKbGaps: Number(kbGapRows[0]?.total ?? 0),
    smartAssistQueueDepth: activeClients.filter((c) => c.aiAgentMode === 'assist').length,
  };
}
