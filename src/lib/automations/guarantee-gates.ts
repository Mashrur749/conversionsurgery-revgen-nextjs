/**
 * Operational guarantee gates for Wave A billing.
 *
 * A5: Day-21 go-live gate — is the client live by day 21?
 * A6: Day-30 logging gate — 80% of inquiries logged with source/status/follow-up?
 */
import { getDb } from '@/db';
import { subscriptions, clients, leads, plans } from '@/db/schema';
import { onboardingMilestones } from '@/db/schema/onboarding-day-one';
import { eq, and, sql, gte } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { alertOperator } from '@/lib/services/operator-alerts';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

// ============================================
// A5: Day-21 Go-Live Gate
// ============================================

interface GoLiveResult {
  subscriptionId: string;
  clientId: string;
  businessName: string;
  daysSinceActivation: number;
  isLive: boolean;
  action: 'already_live' | 'extended' | 'not_yet_due';
}

/**
 * Check all active subscriptions for day-21 go-live status.
 * "Live" = aiAgentMode is 'autonomous' OR (aiAgentMode is 'assist' AND all onboarding milestones complete).
 */
export async function processGoLiveGate(): Promise<GoLiveResult[]> {
  const db = getDb();
  const results: GoLiveResult[] = [];

  // Find active subscriptions past day 21
  const activeSubscriptions = await db
    .select({
      subscriptionId: subscriptions.id,
      clientId: subscriptions.clientId,
      guaranteeStartAt: subscriptions.guaranteeStartAt,
      guaranteeStatus: subscriptions.guaranteeStatus,
    })
    .from(subscriptions)
    .where(
      and(
        sql`${subscriptions.status} IN ('active', 'trialing')`,
        sql`${subscriptions.guaranteeStartAt} IS NOT NULL`
      )
    );

  for (const sub of activeSubscriptions) {
    if (!sub.guaranteeStartAt) continue;

    const daysSince = Math.floor(
      (Date.now() - sub.guaranteeStartAt.getTime()) / MS_IN_DAY
    );

    // Only check subscriptions at or past day 21
    if (daysSince < 21) {
      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: '',
        daysSinceActivation: daysSince,
        isLive: false,
        action: 'not_yet_due',
      });
      continue;
    }

    // Check if client is "live"
    const [client] = await db
      .select({
        businessName: clients.businessName,
        aiAgentMode: clients.aiAgentMode,
      })
      .from(clients)
      .where(eq(clients.id, sub.clientId))
      .limit(1);

    if (!client) continue;

    const isAutonomous = client.aiAgentMode === 'autonomous';

    // Check onboarding milestones if in assist mode
    let onboardingComplete = false;
    if (client.aiAgentMode === 'assist') {
      const [incomplete] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(onboardingMilestones)
        .where(
          and(
            eq(onboardingMilestones.clientId, sub.clientId),
            sql`${onboardingMilestones.status} != 'completed'`
          )
        );
      onboardingComplete = (incomplete?.count ?? 0) === 0;
    }

    const isLive = isAutonomous || onboardingComplete;

    if (isLive) {
      // Log fulfillment event
      await db.update(subscriptions).set({
        guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] go_live_met at day ${daysSince}`}`,
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, sub.subscriptionId));

      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: client.businessName,
        daysSinceActivation: daysSince,
        isLive: true,
        action: 'already_live',
      });
    } else {
      // Not live — extend and notify operator
      await db.update(subscriptions).set({
        guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] go_live_extended at day ${daysSince} — aiMode=${client.aiAgentMode}`}`,
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, sub.subscriptionId));

      try {
        await alertOperator(
          `Go-live extension: ${client.businessName}`,
          `${client.businessName} is not yet live at day ${daysSince}. AI mode: ${client.aiAgentMode}. Continue onboarding at no additional charge per the operational guarantee.`
        );
      } catch (err) {
        logSanitizedConsoleError('[Guarantee][go-live-alert]', err, {
          clientId: sub.clientId,
        });
      }

      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: client.businessName,
        daysSinceActivation: daysSince,
        isLive: false,
        action: 'extended',
      });
    }
  }

  return results;
}

// ============================================
// A6: Day-30 Logging Gate
// ============================================

const LOGGING_THRESHOLD = 0.8; // 80%
const LOW_VOLUME_THRESHOLD = 7; // inquiries in 30 days
const LOW_VOLUME_DEFER_WINDOW_DAYS = 30;

interface LoggingGateResult {
  subscriptionId: string;
  clientId: string;
  businessName: string;
  daysSinceActivation: number;
  totalInquiries: number;
  loggedInquiries: number;
  loggingRate: number;
  action: 'met' | 'paused' | 'resumed' | 'deferred_low_volume' | 'not_yet_due';
}

/**
 * Check all active subscriptions for day-30 logging compliance.
 * "Logged" = lead has source AND status != 'new' AND at least one follow-up (status changed from 'new').
 * Low-volume exception: <7 inquiries in 30 days → defer evaluation.
 */
export async function processLoggingGate(): Promise<LoggingGateResult[]> {
  const db = getDb();
  const stripe = getStripeClient();
  const results: LoggingGateResult[] = [];

  const activeSubscriptions = await db
    .select({
      subscriptionId: subscriptions.id,
      clientId: subscriptions.clientId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      guaranteeStartAt: subscriptions.guaranteeStartAt,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(
      and(
        sql`${subscriptions.status} IN ('active', 'trialing', 'paused')`,
        sql`${subscriptions.guaranteeStartAt} IS NOT NULL`
      )
    );

  for (const sub of activeSubscriptions) {
    if (!sub.guaranteeStartAt) continue;

    const daysSince = Math.floor(
      (Date.now() - sub.guaranteeStartAt.getTime()) / MS_IN_DAY
    );

    // Only check subscriptions at or past day 30
    if (daysSince < 30) {
      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: '',
        daysSinceActivation: daysSince,
        totalInquiries: 0,
        loggedInquiries: 0,
        loggingRate: 0,
        action: 'not_yet_due',
      });
      continue;
    }

    const [client] = await db
      .select({ businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.id, sub.clientId))
      .limit(1);

    if (!client) continue;

    // Count inquiries in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - LOW_VOLUME_DEFER_WINDOW_DAYS * MS_IN_DAY);

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, sub.clientId),
          gte(leads.createdAt, thirtyDaysAgo)
        )
      );

    const totalInquiries = totalResult?.count ?? 0;

    // Low-volume exception
    if (totalInquiries < LOW_VOLUME_THRESHOLD) {
      await db.update(subscriptions).set({
        guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] logging_gate_deferred — ${totalInquiries} inquiries (below ${LOW_VOLUME_THRESHOLD} threshold)`}`,
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, sub.subscriptionId));

      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: client.businessName,
        daysSinceActivation: daysSince,
        totalInquiries,
        loggedInquiries: 0,
        loggingRate: 0,
        action: 'deferred_low_volume',
      });
      continue;
    }

    // Count properly logged inquiries (has source, status beyond 'new', implying follow-up)
    const [loggedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, sub.clientId),
          gte(leads.createdAt, thirtyDaysAgo),
          sql`${leads.source} IS NOT NULL`,
          sql`${leads.status} != 'new'`
        )
      );

    const loggedInquiries = loggedResult?.count ?? 0;
    const loggingRate = totalInquiries > 0 ? loggedInquiries / totalInquiries : 0;

    if (loggingRate >= LOGGING_THRESHOLD) {
      // Met — resume billing if paused
      if (sub.status === 'paused' && sub.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            pause_collection: '' as unknown as undefined,
          });
          await db.update(subscriptions).set({
            status: 'active',
            pausedAt: null,
            resumesAt: null,
            guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] logging_gate_met — ${(loggingRate * 100).toFixed(0)}% (${loggedInquiries}/${totalInquiries}) — billing resumed`}`,
            updatedAt: new Date(),
          }).where(eq(subscriptions.id, sub.subscriptionId));
        } catch (err) {
          logSanitizedConsoleError('[Guarantee][logging-resume]', err, {
            subscriptionId: sub.subscriptionId,
          });
        }

        results.push({
          subscriptionId: sub.subscriptionId,
          clientId: sub.clientId,
          businessName: client.businessName,
          daysSinceActivation: daysSince,
          totalInquiries,
          loggedInquiries,
          loggingRate,
          action: 'resumed',
        });
      } else {
        await db.update(subscriptions).set({
          guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] logging_gate_met — ${(loggingRate * 100).toFixed(0)}% (${loggedInquiries}/${totalInquiries})`}`,
          updatedAt: new Date(),
        }).where(eq(subscriptions.id, sub.subscriptionId));

        results.push({
          subscriptionId: sub.subscriptionId,
          clientId: sub.clientId,
          businessName: client.businessName,
          daysSinceActivation: daysSince,
          totalInquiries,
          loggedInquiries,
          loggingRate,
          action: 'met',
        });
      }
    } else {
      // Not met — pause billing
      if (sub.status !== 'paused' && sub.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            pause_collection: { behavior: 'mark_uncollectible' },
          });
          await db.update(subscriptions).set({
            status: 'paused',
            pausedAt: new Date(),
            guaranteeNotes: sql`COALESCE(${subscriptions.guaranteeNotes}, '') || ${`\n[${new Date().toISOString()}] logging_gate_failed — ${(loggingRate * 100).toFixed(0)}% (${loggedInquiries}/${totalInquiries}) — billing paused`}`,
            updatedAt: new Date(),
          }).where(eq(subscriptions.id, sub.subscriptionId));
        } catch (err) {
          logSanitizedConsoleError('[Guarantee][logging-pause]', err, {
            subscriptionId: sub.subscriptionId,
          });
        }

        try {
          await alertOperator(
            `Logging gate failed: ${client.businessName}`,
            `${client.businessName} logging rate is ${(loggingRate * 100).toFixed(0)}% (${loggedInquiries}/${totalInquiries} inquiries). Below 80% threshold. Billing paused per operational guarantee.`
          );
        } catch (err) {
          logSanitizedConsoleError('[Guarantee][logging-alert]', err, {
            clientId: sub.clientId,
          });
        }
      }

      results.push({
        subscriptionId: sub.subscriptionId,
        clientId: sub.clientId,
        businessName: client.businessName,
        daysSinceActivation: daysSince,
        totalInquiries,
        loggedInquiries,
        loggingRate,
        action: 'paused',
      });
    }
  }

  return results;
}
