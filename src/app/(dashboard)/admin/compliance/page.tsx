import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getDb,
  consentRecords,
  optOutRecords,
  doNotContactList,
  complianceAuditLog,
} from '@/db';
import { eq, and, gte, count } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { ComplianceDashboardClient } from './compliance-dashboard-client';

export default async function CompliancePage() {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    redirect('/dashboard');
  }

  const db = getDb();
  const thirtyDaysAgo = subDays(new Date(), 30);

  // Aggregate stats across all clients
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
        eq(complianceAuditLog.eventType, 'message_blocked'),
        gte(complianceAuditLog.eventTimestamp, thirtyDaysAgo)
      )
    );

  const activeConsents = activeConsentsResult.count;
  const totalOptOuts = totalOptOutsResult.count;
  const dncListSize = dncSizeResult.count;
  const messagesBlocked = blockedMessagesResult.count;

  // Calculate opt-out rate and compliance score
  const optOutRate =
    activeConsents > 0 ? (totalOptOuts / activeConsents) * 100 : 0;

  let complianceScore = 100;
  if (optOutRate > 5) complianceScore -= 20;
  else if (optOutRate > 2) complianceScore -= 10;
  if (messagesBlocked > 0) complianceScore -= 5;
  complianceScore = Math.max(0, complianceScore);

  // Generate risks
  const risks: string[] = [];
  if (optOutRate > 5) {
    risks.push(`High opt-out rate: ${optOutRate.toFixed(1)}% in last 30 days`);
  }
  if (messagesBlocked > 10) {
    risks.push(`${messagesBlocked} messages blocked in last 30 days`);
  }

  const stats = {
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

      <ComplianceDashboardClient stats={stats} risks={risks} />
    </div>
  );
}
