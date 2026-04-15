import { getDb } from '@/db';
import { clients, escalationQueue, knowledgeGaps } from '@/db/schema';
import { eq, and, gte, count, sql } from 'drizzle-orm';

export interface ClientCapacity {
  clientId: string;
  clientName: string;
  phase: string;
  baseHours: number;
  activityAdjustment: number;
  totalHours: number;
}

export interface CapacityEstimate {
  clients: ClientCapacity[];
  totalWeeklyHours: number;
  maxCapacityHours: number;
  utilizationPercent: number;
  alertLevel: 'green' | 'yellow' | 'red';
  smartAssistQueueDepth: number;
}

export async function getCapacityEstimate(): Promise<CapacityEstimate> {
  const db = getDb();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Query all active clients
  const activeClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      aiAgentMode: clients.aiAgentMode,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  // 2. Parallel: escalation counts and KB gap counts per client
  const [escalationRows, kbGapRows] = await Promise.all([
    db
      .select({
        clientId: escalationQueue.clientId,
        escalationCount: count(escalationQueue.id),
      })
      .from(escalationQueue)
      .where(gte(escalationQueue.createdAt, sevenDaysAgo))
      .groupBy(escalationQueue.clientId),

    db
      .select({
        clientId: knowledgeGaps.clientId,
        gapCount: count(knowledgeGaps.id),
      })
      .from(knowledgeGaps)
      .where(eq(knowledgeGaps.status, 'new'))
      .groupBy(knowledgeGaps.clientId),
  ]);

  // Build lookup maps
  const escalationByClient = new Map<string, number>();
  for (const row of escalationRows) {
    escalationByClient.set(row.clientId, Number(row.escalationCount));
  }

  const gapsByClient = new Map<string, number>();
  for (const row of kbGapRows) {
    gapsByClient.set(row.clientId, Number(row.gapCount));
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 3. Compute per-client capacity
  const clientCapacities: ClientCapacity[] = activeClients.map((client) => {
    let phase: string;
    let baseHours: number;

    if (client.createdAt > fourteenDaysAgo) {
      phase = 'Onboarding';
      baseHours = 5.0;
    } else if (client.aiAgentMode === 'assist') {
      phase = 'Smart Assist';
      baseHours = 2.5;
    } else if (client.aiAgentMode === 'autonomous') {
      phase = 'Autonomous';
      baseHours = 1.5;
    } else {
      phase = 'Manual';
      baseHours = 3.0;
    }

    const escalations = escalationByClient.get(client.id) ?? 0;
    const gaps = gapsByClient.get(client.id) ?? 0;

    let activityAdjustment = 0;
    if (escalations > 5) activityAdjustment += 1.0;
    if (gaps > 5) activityAdjustment += 0.5;

    return {
      clientId: client.id,
      clientName: client.businessName,
      phase,
      baseHours,
      activityAdjustment,
      totalHours: baseHours + activityAdjustment,
    };
  });

  // 4-7. Aggregate metrics
  const totalWeeklyHours = clientCapacities.reduce((sum, c) => sum + c.totalHours, 0);
  const maxCapacityHours = 40;
  const utilizationPercent = Math.round((totalWeeklyHours / maxCapacityHours) * 100);

  let alertLevel: 'green' | 'yellow' | 'red';
  if (utilizationPercent >= 100) {
    alertLevel = 'red';
  } else if (utilizationPercent >= 80) {
    alertLevel = 'yellow';
  } else {
    alertLevel = 'green';
  }

  // 8. Smart assist queue depth
  const smartAssistQueueDepth = activeClients.filter(
    (c) => c.aiAgentMode === 'assist'
  ).length;

  return {
    clients: clientCapacities,
    totalWeeklyHours,
    maxCapacityHours,
    utilizationPercent,
    alertLevel,
    smartAssistQueueDepth,
  };
}
