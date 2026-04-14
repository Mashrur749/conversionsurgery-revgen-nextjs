import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getDb,
  consentRecords,
  optOutRecords,
  doNotContactList,
  complianceAuditLog,
  leads,
} from "@/db";
import { eq, and, gte, count, isNotNull } from "drizzle-orm";
import { subDays } from "date-fns";
import { ComplianceDashboardClient } from "./compliance-dashboard-client";
import { getQuietHoursPolicyDiagnostics } from "@/lib/compliance/quiet-hours-policy";
import type { OptOutReasonCount } from "@/components/compliance/ComplianceDashboard";

interface ComplianceStats {
  activeConsents: number;
  totalOptOuts: number;
  optOutRate: number;
  dncListSize: number;
  messagesBlocked: number;
  complianceScore: number;
}

function calculateComplianceScore(optOutRate: number, messagesBlocked: number): number {
  let score = 100;
  if (optOutRate > 5) score -= 20;
  else if (optOutRate > 2) score -= 10;
  if (messagesBlocked > 0) score -= 5;
  return Math.max(0, score);
}

function generateRisks(optOutRate: number, messagesBlocked: number): string[] {
  const risks: string[] = [];
  if (optOutRate > 5) {
    risks.push("High opt-out rate: " + optOutRate.toFixed(1) + "% in last 30 days");
  }
  if (messagesBlocked > 10) {
    risks.push(messagesBlocked + " messages blocked in last 30 days");
  }
  return risks;
}

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
    redirect("/dashboard");
  }

  const db = getDb();
  const thirtyDaysAgo = subDays(new Date(), 30);

  const [activeConsentsResult] = await db
    .select({ count: count() })
    .from(consentRecords)
    .where(eq(consentRecords.isActive, true));

  const [totalOptOutsResult] = await db
    .select({ count: count() })
    .from(optOutRecords)
    .where(gte(optOutRecords.createdAt, thirtyDaysAgo));

  const [dncSizeResult] = await db
    .select({ count: count() })
    .from(doNotContactList)
    .where(eq(doNotContactList.isActive, true));

  const [blockedMessagesResult] = await db
    .select({ count: count() })
    .from(complianceAuditLog)
    .where(
      and(
        eq(complianceAuditLog.eventType, "message_blocked"),
        gte(complianceAuditLog.eventTimestamp, thirtyDaysAgo)
      )
    );

  const optOutReasonRows = await db
    .select({
      reason: leads.optOutReason,
      count: count(),
    })
    .from(leads)
    .where(and(eq(leads.optedOut, true), isNotNull(leads.optOutReason)))
    .groupBy(leads.optOutReason);

  const activeConsents = activeConsentsResult.count;
  const totalOptOuts = totalOptOutsResult.count;
  const dncListSize = dncSizeResult.count;
  const messagesBlocked = blockedMessagesResult.count;

  const optOutRate =
    activeConsents > 0 ? (totalOptOuts / activeConsents) * 100 : 0;
  const complianceScore = calculateComplianceScore(optOutRate, messagesBlocked);
  const risks = generateRisks(optOutRate, messagesBlocked);
  const quietHoursPolicy = await getQuietHoursPolicyDiagnostics();

  const reasonTotal = optOutReasonRows.reduce((sum, r) => sum + r.count, 0);
  const optOutReasonBreakdown: OptOutReasonCount[] = optOutReasonRows
    .filter((r): r is { reason: string; count: number } => r.reason !== null)
    .map((r) => ({
      reason: r.reason,
      count: r.count,
      percentage: reasonTotal > 0 ? Math.round((r.count / reasonTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const stats: ComplianceStats = {
    activeConsents,
    totalOptOuts,
    optOutRate,
    dncListSize,
    messagesBlocked,
    complianceScore,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">TCPA Compliance</h1>
        <p className="text-muted-foreground">
          Monitor consent, opt-outs, and compliance across all clients
        </p>
      </div>

      <ComplianceDashboardClient
        stats={stats}
        risks={risks}
        quietHoursPolicy={quietHoursPolicy}
        optOutReasonBreakdown={optOutReasonBreakdown}
      />
    </div>
  );
}
