import { getDb } from '@/db';
import { funnelEvents } from '@/db/schema';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { subDays } from 'date-fns';

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
}

/**
 * Get funnel metrics for a client (or all clients if clientId is null).
 * Returns counts at each funnel stage with conversion rates.
 */
export async function getFunnelMetrics(
  clientId?: string,
  days: number = 30
): Promise<FunnelStage[]> {
  const db = getDb();
  const since = subDays(new Date(), days);

  const conditions = [gte(funnelEvents.createdAt, since)];
  if (clientId) {
    conditions.push(eq(funnelEvents.clientId, clientId));
  }

  const stageCounts = await db
    .select({
      eventType: funnelEvents.eventType,
      count: count(),
    })
    .from(funnelEvents)
    .where(and(...conditions))
    .groupBy(funnelEvents.eventType);

  const countMap = new Map(stageCounts.map(s => [s.eventType, s.count]));

  // Define funnel stages in order
  const stages = [
    { stage: 'lead_created', label: 'Leads' },
    { stage: 'first_response', label: 'Contacted' },
    { stage: 'appointment_booked', label: 'Appointments' },
    { stage: 'job_won', label: 'Jobs Won' },
    { stage: 'payment_received', label: 'Paid' },
    { stage: 'review_received', label: 'Reviews' },
  ];

  let previousCount: number | null = null;
  return stages.map(({ stage, label }) => {
    const stageCount = countMap.get(stage) ?? 0;
    const conversion = previousCount !== null && previousCount > 0
      ? Math.round((stageCount / previousCount) * 100)
      : null;
    previousCount = stageCount;
    return { stage, label, count: stageCount, conversionFromPrevious: conversion };
  });
}
