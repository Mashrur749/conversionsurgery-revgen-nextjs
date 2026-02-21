import { auth } from '@/auth';
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

/** Compliance stats displayed on the admin dashboard */
interface ComplianceStats {
  activeConsents: number;
  totalOptOuts: number;
  optOutRate: number;
  dncListSize: number;
  messagesBlocked: number;
  complianceScore: number;
}

/** Calculates a compliance score (0-100) based on opt-out rate and blocked messages */
function calculateComplianceScore(optOutRate: number, messagesBlocked: number): number {
  let score = 100;
  if (optOutRate > 5) score -= 20;
  else if (optOutRate > 2) score -= 10;
  if (messagesBlocked > 0) score -= 5;
  return Math.max(0, score);
}

/** Generates human-readable risk descriptions from compliance metrics */
function generateRisks(optOutRate: number, messagesBlocked: number): string[] {
  const risks: string[] = [];
  if (optOutRate > 5) {
    risks.push(`High opt-out rate: ${optOutRate.toFixed(1)}% in last 30 days`);
  }
  if (messagesBlocked > 10) {
    risks.push(`${messagesBlocked} messages blocked in last 30 days`);
  }
  return risks;
}

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user?.isAgency) {
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

  const optOutRate =
    activeConsents > 0 ? (totalOptOuts / activeConsents) * 100 : 0;
  const complianceScore = calculateComplianceScore(optOutRate, messagesBlocked);
  const risks = generateRisks(optOutRate, messagesBlocked);

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

      <ComplianceDashboardClient stats={stats} risks={risks} />
    </div>
  );
}
