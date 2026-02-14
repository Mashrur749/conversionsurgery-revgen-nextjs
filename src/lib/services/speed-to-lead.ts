/**
 * Speed-to-Lead Service
 *
 * Computes response time metrics — how fast the system responds to new leads.
 * Compares against industry benchmarks and client's pre-ConversionSurgery baseline.
 */

import { getDb } from '@/db';
import { leads, conversations, clients } from '@/db/schema';
import { eq, and, gte, asc, sql } from 'drizzle-orm';

// Industry benchmarks (in minutes)
const INDUSTRY_AVG_RESPONSE_MINUTES = 42;
const TOP_PERFORMER_RESPONSE_MINUTES = 5;

export interface SpeedToLeadMetrics {
  avgResponseTimeSeconds: number;
  medianResponseTimeSeconds: number;
  totalLeadsWithResponse: number;
  fastestResponseSeconds: number;
  slowestResponseSeconds: number;
  percentUnder1Min: number;
  percentUnder5Min: number;
  // Comparison
  industryAvgMinutes: number;
  previousResponseTimeMinutes: number | null;
  speedMultiplier: number | null; // "You respond Xx faster than industry average"
  improvementVsPrevious: string | null; // "3 hours → 47 seconds"
}

/**
 * Computes speed-to-lead metrics for a client over a date range.
 * Response time = first outbound conversation.createdAt - lead.createdAt
 */
export async function getSpeedToLeadMetrics(
  clientId: string,
  startDate?: Date
): Promise<SpeedToLeadMetrics> {
  const db = getDb();
  const dateFilter = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get the client's previous response time for comparison
  const [client] = await db
    .select({ previousResponseTimeMinutes: clients.previousResponseTimeMinutes })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // For each lead created in the period, find the time of the first outbound message
  const responseTimes = await db
    .select({
      leadId: leads.id,
      leadCreatedAt: leads.createdAt,
      firstResponseAt: sql<Date>`min(${conversations.createdAt})`,
    })
    .from(leads)
    .innerJoin(
      conversations,
      and(
        eq(conversations.leadId, leads.id),
        eq(conversations.direction, 'outbound')
      )
    )
    .where(and(
      eq(leads.clientId, clientId),
      gte(leads.createdAt, dateFilter)
    ))
    .groupBy(leads.id, leads.createdAt);

  if (responseTimes.length === 0) {
    return {
      avgResponseTimeSeconds: 0,
      medianResponseTimeSeconds: 0,
      totalLeadsWithResponse: 0,
      fastestResponseSeconds: 0,
      slowestResponseSeconds: 0,
      percentUnder1Min: 0,
      percentUnder5Min: 0,
      industryAvgMinutes: INDUSTRY_AVG_RESPONSE_MINUTES,
      previousResponseTimeMinutes: client?.previousResponseTimeMinutes ?? null,
      speedMultiplier: null,
      improvementVsPrevious: null,
    };
  }

  // Compute response times in seconds
  const deltas = responseTimes
    .map(r => {
      const leadTime = new Date(r.leadCreatedAt).getTime();
      const responseTime = new Date(r.firstResponseAt).getTime();
      return Math.max(0, Math.round((responseTime - leadTime) / 1000));
    })
    .sort((a, b) => a - b);

  const totalLeads = deltas.length;
  const avgSeconds = Math.round(deltas.reduce((a, b) => a + b, 0) / totalLeads);
  const medianSeconds = deltas[Math.floor(totalLeads / 2)];
  const fastest = deltas[0];
  const slowest = deltas[totalLeads - 1];
  const under1Min = deltas.filter(d => d < 60).length;
  const under5Min = deltas.filter(d => d < 300).length;

  const avgMinutes = avgSeconds / 60;
  const speedMultiplier = avgMinutes > 0
    ? Math.round(INDUSTRY_AVG_RESPONSE_MINUTES / avgMinutes)
    : null;

  const previousMin = client?.previousResponseTimeMinutes ?? null;
  let improvementVsPrevious: string | null = null;
  if (previousMin) {
    improvementVsPrevious = `${formatDuration(previousMin * 60)} → ${formatDuration(avgSeconds)}`;
  }

  return {
    avgResponseTimeSeconds: avgSeconds,
    medianResponseTimeSeconds: medianSeconds,
    totalLeadsWithResponse: totalLeads,
    fastestResponseSeconds: fastest,
    slowestResponseSeconds: slowest,
    percentUnder1Min: Math.round((under1Min / totalLeads) * 100),
    percentUnder5Min: Math.round((under5Min / totalLeads) * 100),
    industryAvgMinutes: INDUSTRY_AVG_RESPONSE_MINUTES,
    previousResponseTimeMinutes: previousMin,
    speedMultiplier,
    improvementVsPrevious,
  };
}

/** Formats seconds into a human-readable duration string */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
