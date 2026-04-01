import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import {
  escalationQueue,
  conversations,
  errorLog,
  knowledgeGaps,
  reportDeliveries,
  clients,
} from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import {
  adminRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  link?: string;
}

/**
 * GET /api/admin/notifications/feed
 *
 * Derives in-app notifications from existing data for the admin dashboard.
 * Returns up to 20 items sorted newest first.
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const db = getDb();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const notifications: NotificationItem[] = [];

    // 1. Active escalations (pending/assigned)
    const activeEscalations = await db
      .select({
        id: escalationQueue.id,
        reason: escalationQueue.reason,
        reasonDetails: escalationQueue.reasonDetails,
        priority: escalationQueue.priority,
        status: escalationQueue.status,
        slaBreach: escalationQueue.slaBreach,
        createdAt: escalationQueue.createdAt,
        clientId: escalationQueue.clientId,
        businessName: clients.businessName,
      })
      .from(escalationQueue)
      .innerJoin(clients, eq(clients.id, escalationQueue.clientId))
      .where(
        and(
          sql`${escalationQueue.status} IN ('pending', 'assigned')`,
          gte(escalationQueue.createdAt, fortyEightHoursAgo)
        )
      )
      .orderBy(desc(escalationQueue.createdAt))
      .limit(8);

    for (const esc of activeEscalations) {
      const isBreach = esc.slaBreach;
      notifications.push({
        id: `esc-${esc.id}`,
        type: isBreach ? 'sla_breach' : 'escalation',
        title: isBreach ? 'SLA breach alert' : 'New escalation',
        description: `${esc.businessName}: ${esc.reasonDetails || esc.reason}`,
        timestamp: esc.createdAt.toISOString(),
        icon: isBreach ? 'shield' : 'alert-triangle',
        link: '/escalations',
      });
    }

    // 2. AI flagged messages (last 48h)
    const flaggedMessages = await db
      .select({
        id: conversations.id,
        flagReason: conversations.flagReason,
        flaggedAt: conversations.flaggedAt,
        leadId: conversations.leadId,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.flagged, true),
          gte(conversations.flaggedAt, fortyEightHoursAgo)
        )
      )
      .orderBy(desc(conversations.flaggedAt))
      .limit(5);

    for (const msg of flaggedMessages) {
      notifications.push({
        id: `flag-${msg.id}`,
        type: 'ai_flagged',
        title: 'AI message flagged',
        description: msg.flagReason
          ? `Flagged for: ${msg.flagReason}`
          : 'An AI-generated message was flagged for review',
        timestamp: (msg.flaggedAt || new Date()).toISOString(),
        icon: 'message-square',
        link: '/admin/ai-quality',
      });
    }

    // 3. Report delivery failures (last 48h)
    const failedDeliveries = await db
      .select({
        id: reportDeliveries.id,
        reportType: reportDeliveries.reportType,
        lastErrorCode: reportDeliveries.lastErrorCode,
        failedAt: reportDeliveries.failedAt,
        clientId: reportDeliveries.clientId,
        businessName: clients.businessName,
      })
      .from(reportDeliveries)
      .innerJoin(clients, eq(clients.id, reportDeliveries.clientId))
      .where(
        and(
          eq(reportDeliveries.state, 'failed'),
          gte(reportDeliveries.failedAt, fortyEightHoursAgo)
        )
      )
      .orderBy(desc(reportDeliveries.failedAt))
      .limit(5);

    for (const delivery of failedDeliveries) {
      notifications.push({
        id: `report-fail-${delivery.id}`,
        type: 'report_failure',
        title: 'Report delivery failed',
        description: `${delivery.businessName}: ${delivery.reportType} report failed${delivery.lastErrorCode ? ` (${delivery.lastErrorCode})` : ''}`,
        timestamp: (delivery.failedAt || new Date()).toISOString(),
        icon: 'file-text',
        link: '/admin/reports',
      });
    }

    // 4. Knowledge gaps detected (last 24h, new status only)
    const newGaps = await db
      .select({
        id: knowledgeGaps.id,
        question: knowledgeGaps.question,
        category: knowledgeGaps.category,
        occurrences: knowledgeGaps.occurrences,
        firstSeenAt: knowledgeGaps.firstSeenAt,
        clientId: knowledgeGaps.clientId,
        businessName: clients.businessName,
      })
      .from(knowledgeGaps)
      .innerJoin(clients, eq(clients.id, knowledgeGaps.clientId))
      .where(
        and(
          eq(knowledgeGaps.status, 'new'),
          gte(knowledgeGaps.firstSeenAt, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(knowledgeGaps.firstSeenAt))
      .limit(5);

    for (const gap of newGaps) {
      notifications.push({
        id: `gap-${gap.id}`,
        type: 'knowledge_gap',
        title: 'Knowledge gap detected',
        description: `${gap.businessName}: ${gap.category || 'Uncategorized'} - ${gap.question.slice(0, 80)}${gap.question.length > 80 ? '...' : ''}`,
        timestamp: gap.firstSeenAt.toISOString(),
        icon: 'book-open',
      });
    }

    // 5. Recent errors (last 24h, unresolved)
    const recentErrors = await db
      .select({
        id: errorLog.id,
        errorType: errorLog.errorType,
        createdAt: errorLog.createdAt,
      })
      .from(errorLog)
      .where(
        and(
          eq(errorLog.resolved, false),
          gte(errorLog.createdAt, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(errorLog.createdAt))
      .limit(3);

    for (const err of recentErrors) {
      notifications.push({
        id: `error-${err.id}`,
        type: 'system_error',
        title: 'System error',
        description: err.errorType || 'An unresolved error occurred',
        timestamp: err.createdAt.toISOString(),
        icon: 'shield',
      });
    }

    // Sort all by timestamp descending, take 20
    notifications.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      notifications: notifications.slice(0, 20),
    });
  }
);
