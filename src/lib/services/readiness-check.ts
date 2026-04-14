/**
 * Autonomous Readiness Checklist Service (FMA 4.2)
 *
 * Evaluates 6 checklist items before an AI mode transition to autonomous.
 * All 6 queries run in parallel via Promise.all.
 */
import { getDb } from '@/db';
import {
  knowledgeBase,
  clientServices,
  auditLog,
  clients,
  businessHours,
  leads,
} from '@/db/schema';
import { and, eq, gte, inArray, count, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessSeverity = 'critical' | 'warning';

export interface ReadinessItem {
  key: string;
  label: string;
  description: string;
  passed: boolean;
  severity: ReadinessSeverity;
  currentValue: number | boolean;
  requiredValue: number | boolean;
}

export interface ReadinessResult {
  items: ReadinessItem[];
  allCriticalPassed: boolean;
  passedCount: number;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Individual check helpers
// ---------------------------------------------------------------------------

async function checkKbEntries(clientId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(knowledgeBase)
    .where(eq(knowledgeBase.clientId, clientId));
  return rows[0]?.value ?? 0;
}

async function checkPricingRange(clientId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(clientServices)
    .where(
      and(
        eq(clientServices.clientId, clientId),
        eq(clientServices.canDiscussPrice, 'yes_range'),
        eq(clientServices.isActive, true),
        sql`${clientServices.priceRangeMinCents} > 0`,
        sql`${clientServices.priceRangeMaxCents} > 0`,
        sql`${clientServices.priceRangeMinCents} < ${clientServices.priceRangeMaxCents}`
      )
    );
  return rows[0]?.value ?? 0;
}

async function checkReviewedInteractions(clientId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.clientId, clientId),
        inArray(auditLog.action, [
          'smart_assist_approved',
          'smart_assist_cancelled',
          'smart_assist_edited',
        ])
      )
    );
  return rows[0]?.value ?? 0;
}

async function checkEscalationRate(clientId: string): Promise<number> {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalRows, escalatedRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, sevenDaysAgo)
        )
      ),
    db
      .select({ value: count() })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          gte(leads.createdAt, sevenDaysAgo),
          eq(leads.status, 'escalated')
        )
      ),
  ]);

  const total = totalRows[0]?.value ?? 0;
  const escalated = escalatedRows[0]?.value ?? 0;

  if (total === 0) return 0;
  return (escalated / total) * 100;
}

async function checkExclusionListReviewed(clientId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ exclusionListReviewed: clients.exclusionListReviewed })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return rows[0]?.exclusionListReviewed ?? false;
}

async function checkBusinessHours(clientId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(businessHours)
    .where(eq(businessHours.clientId, clientId));
  return rows[0]?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Evaluate all 6 autonomous readiness checklist items for a client.
 * All DB queries run in parallel.
 */
export async function getAutonomousReadiness(
  clientId: string
): Promise<ReadinessResult> {
  const [
    kbCount,
    pricingCount,
    reviewedCount,
    escalationRate,
    exclusionReviewed,
    businessHoursCount,
  ] = await Promise.all([
    checkKbEntries(clientId),
    checkPricingRange(clientId),
    checkReviewedInteractions(clientId),
    checkEscalationRate(clientId),
    checkExclusionListReviewed(clientId),
    checkBusinessHours(clientId),
  ]);

  const items: ReadinessItem[] = [
    {
      key: 'kb_entries',
      label: 'Knowledge base entries',
      description: 'At least 10 knowledge base entries are required so the AI has enough context to answer common questions.',
      passed: kbCount >= 10,
      severity: 'critical',
      currentValue: kbCount,
      requiredValue: 10,
    },
    {
      key: 'pricing_range',
      label: 'Pricing range configured',
      description: 'At least one active service must have a valid price range configured so the AI can discuss pricing with homeowners.',
      passed: pricingCount >= 1,
      severity: 'critical',
      currentValue: pricingCount,
      requiredValue: 1,
    },
    {
      key: 'reviewed_interactions',
      label: 'Smart Assist reviewed interactions',
      description: 'At least 30 Smart Assist suggestions must have been approved, cancelled, or edited to calibrate AI behaviour.',
      passed: reviewedCount >= 30,
      severity: 'critical',
      currentValue: reviewedCount,
      requiredValue: 30,
    },
    {
      key: 'escalation_rate',
      label: 'Escalation rate (7 days)',
      description: 'Escalation rate over the past 7 days must be below 20% — high escalation indicates the AI needs more calibration.',
      passed: escalationRate < 20,
      severity: 'warning',
      currentValue: escalationRate,
      requiredValue: 20,
    },
    {
      key: 'exclusion_list',
      label: 'Exclusion list reviewed',
      description: 'The operator must confirm they have reviewed the exclusion list before autonomous mode is enabled.',
      passed: exclusionReviewed,
      severity: 'critical',
      currentValue: exclusionReviewed,
      requiredValue: true,
    },
    {
      key: 'business_hours',
      label: 'Business hours configured',
      description: 'At least one business hours day must be configured so the AI knows when to escalate outside-hours messages.',
      passed: businessHoursCount >= 1,
      severity: 'critical',
      currentValue: businessHoursCount,
      requiredValue: 1,
    },
  ];

  const criticalItems = items.filter((item) => item.severity === 'critical');
  const allCriticalPassed = criticalItems.every((item) => item.passed);
  const passedCount = items.filter((item) => item.passed).length;

  return {
    items,
    allCriticalPassed,
    passedCount,
    totalCount: items.length,
  };
}
