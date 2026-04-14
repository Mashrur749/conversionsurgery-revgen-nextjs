import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { agentDecisions, clients, leads } from '@/db/schema';
import { and, desc, eq, gte, lte } from 'drizzle-orm';

/**
 * GET /api/admin/ai-effectiveness/decisions
 *
 * Returns recent agent decisions with analysisSnapshot for the snapshot viewer.
 *
 * Query params:
 *   days     — lookback window (default 14, max 90)
 *   clientId — optional client scope
 *   limit    — max rows (default 50, max 200)
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const url = new URL(request.url);

    const daysParam = parseInt(url.searchParams.get('days') ?? '14', 10);
    const days = Math.min(Math.max(daysParam, 1), 90);
    const limitParam = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const rowLimit = Math.min(Math.max(limitParam, 1), 200);
    const clientId = url.searchParams.get('clientId') ?? undefined;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const db = getDb();

    const baseWhere = clientId
      ? and(
          gte(agentDecisions.createdAt, startDate),
          lte(agentDecisions.createdAt, endDate),
          eq(agentDecisions.clientId, clientId)
        )
      : and(
          gte(agentDecisions.createdAt, startDate),
          lte(agentDecisions.createdAt, endDate)
        );

    const rows = await db
      .select({
        id: agentDecisions.id,
        createdAt: agentDecisions.createdAt,
        action: agentDecisions.action,
        confidence: agentDecisions.confidence,
        outcome: agentDecisions.outcome,
        processingTimeMs: agentDecisions.processingTimeMs,
        analysisSnapshot: agentDecisions.analysisSnapshot,
        actionDetails: agentDecisions.actionDetails,
        reasoning: agentDecisions.reasoning,
        clientName: clients.businessName,
        leadName: leads.name,
        leadPhone: leads.phone,
      })
      .from(agentDecisions)
      .leftJoin(clients, eq(agentDecisions.clientId, clients.id))
      .leftJoin(leads, eq(agentDecisions.leadId, leads.id))
      .where(baseWhere)
      .orderBy(desc(agentDecisions.createdAt))
      .limit(rowLimit);

    return NextResponse.json({ decisions: rows });
  }
);
