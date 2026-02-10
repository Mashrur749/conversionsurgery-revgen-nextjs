import {
  getDb,
  consentRecords,
  optOutRecords,
  doNotContactList,
  complianceAuditLog,
} from '@/db';
import { eq, and, gte, lte, count, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

export interface ComplianceReport {
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalConsents: number;
    activeConsents: number;
    totalOptOuts: number;
    optOutRate: number;
    dncListSize: number;
    messagesBlocked: number;
  };
  consentBreakdown: {
    byType: Record<string, number>;
    bySource: Record<string, number>;
  };
  optOutBreakdown: {
    byReason: Record<string, number>;
    trend: { date: string; count: number }[];
  };
  complianceEvents: {
    type: string;
    count: number;
  }[];
  risks: string[];
  recommendations: string[];
}

export class ComplianceReportGenerator {
  /**
   * Generate comprehensive compliance report
   */
  static async generateReport(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const db = getDb();

    // Get consent stats
    const [totalConsents] = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      );

    const [activeConsents] = await db
      .select({ count: count() })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          eq(consentRecords.isActive, true)
        )
      );

    // Get opt-out stats
    const [totalOptOuts] = await db
      .select({ count: count() })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.createdAt, startDate),
          lte(optOutRecords.createdAt, endDate)
        )
      );

    // Get DNC list size
    const [dncSize] = await db
      .select({ count: count() })
      .from(doNotContactList)
      .where(eq(doNotContactList.isActive, true));

    // Get blocked messages count
    const [blockedMessages] = await db
      .select({ count: count() })
      .from(complianceAuditLog)
      .where(
        and(
          eq(complianceAuditLog.clientId, clientId),
          eq(complianceAuditLog.eventType, 'message_blocked'),
          gte(complianceAuditLog.eventTimestamp, startDate),
          lte(complianceAuditLog.eventTimestamp, endDate)
        )
      );

    // Consent breakdown by type
    const consentByType = await db
      .select({
        type: consentRecords.consentType,
        count: count(),
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      )
      .groupBy(consentRecords.consentType);

    // Consent breakdown by source
    const consentBySource = await db
      .select({
        source: consentRecords.consentSource,
        count: count(),
      })
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.clientId, clientId),
          gte(consentRecords.createdAt, startDate),
          lte(consentRecords.createdAt, endDate)
        )
      )
      .groupBy(consentRecords.consentSource);

    // Opt-out breakdown by reason
    const optOutByReason = await db
      .select({
        reason: optOutRecords.optOutReason,
        count: count(),
      })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.createdAt, startDate),
          lte(optOutRecords.createdAt, endDate)
        )
      )
      .groupBy(optOutRecords.optOutReason);

    // Opt-out trend (daily for last 30 days)
    const optOutTrend = await db
      .select({
        date: sql<string>`DATE(${optOutRecords.optOutTimestamp})`,
        count: count(),
      })
      .from(optOutRecords)
      .where(
        and(
          eq(optOutRecords.clientId, clientId),
          gte(optOutRecords.optOutTimestamp, subDays(new Date(), 30))
        )
      )
      .groupBy(sql`DATE(${optOutRecords.optOutTimestamp})`)
      .orderBy(sql`DATE(${optOutRecords.optOutTimestamp})`);

    // Compliance events
    const events = await db
      .select({
        type: complianceAuditLog.eventType,
        count: count(),
      })
      .from(complianceAuditLog)
      .where(
        and(
          eq(complianceAuditLog.clientId, clientId),
          gte(complianceAuditLog.eventTimestamp, startDate),
          lte(complianceAuditLog.eventTimestamp, endDate)
        )
      )
      .groupBy(complianceAuditLog.eventType);

    // Calculate opt-out rate
    const optOutRate =
      totalConsents.count > 0
        ? (totalOptOuts.count / totalConsents.count) * 100
        : 0;

    // Generate risks and recommendations
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (optOutRate > 5) {
      risks.push(`High opt-out rate: ${optOutRate.toFixed(1)}%`);
      recommendations.push(
        'Review message frequency and content. Consider A/B testing different approaches.'
      );
    }

    const impliedConsents =
      consentByType.find((c) => c.type === 'implied')?.count || 0;
    if (impliedConsents > totalConsents.count * 0.3) {
      risks.push('Over 30% of consents are implied only');
      recommendations.push(
        'Implement clear opt-in forms to capture express written consent.'
      );
    }

    const complaints =
      optOutByReason.find((o) => o.reason === 'complaint')?.count || 0;
    if (complaints > 0) {
      risks.push(`${complaints} complaint-based opt-outs recorded`);
      recommendations.push(
        'Review complaint causes immediately. Consider reducing message frequency.'
      );
    }

    return {
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalConsents: totalConsents.count,
        activeConsents: activeConsents.count,
        totalOptOuts: totalOptOuts.count,
        optOutRate,
        dncListSize: dncSize.count,
        messagesBlocked: blockedMessages.count,
      },
      consentBreakdown: {
        byType: Object.fromEntries(
          consentByType.map((c) => [c.type, c.count])
        ),
        bySource: Object.fromEntries(
          consentBySource.map((c) => [c.source, c.count])
        ),
      },
      optOutBreakdown: {
        byReason: Object.fromEntries(
          optOutByReason.map((o) => [o.reason, o.count])
        ),
        trend: optOutTrend.map((t) => ({ date: t.date, count: t.count })),
      },
      complianceEvents: events.map((e) => ({
        type: e.type,
        count: e.count,
      })),
      risks,
      recommendations,
    };
  }
}
