import { getStripeClient } from '@/lib/clients/stripe';
import { getDb, withTransaction } from '@/db';
import {
  billingEvents,
  clients,
  conversations,
  leads,
  plans,
  subscriptions,
} from '@/db/schema';
import { resolveOverageBillingPolicy } from '@/lib/services/billing-policy';
import type { PlanFeatures } from '@/lib/services/usage-policy';
import { buildMonthlyOverageIdempotencyKey } from '@/lib/services/idempotency-keys';
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm';

interface OverageRunResult {
  processed: number;
  invoiced: number;
  skippedByPolicy: number;
  totalOverageCents: number;
  errors: number;
  billingMonth: string;
}

interface ApplyMonthlyOveragesOptions {
  cyclePeriodStart?: Date;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function resolveBillingWindow(cyclePeriodStart: Date): { monthStart: Date; monthEnd: Date; monthKey: string } {
  const monthEnd = startOfUtcMonth(cyclePeriodStart);
  const monthStart = new Date(
    Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() - 1, 1, 0, 0, 0, 0)
  );

  return {
    monthStart,
    monthEnd,
    monthKey: formatMonthKey(monthStart),
  };
}

/**
 * Apply monthly overage line items for the previous calendar month.
 * Creates Stripe invoice items and billing events for auditability.
 */
export async function applyMonthlyOverages(
  input: Date | ApplyMonthlyOveragesOptions = new Date()
): Promise<OverageRunResult> {
  const db = getDb();
  const stripe = getStripeClient();
  const cyclePeriodStart =
    input instanceof Date ? startOfUtcMonth(input) : startOfUtcMonth(input.cyclePeriodStart ?? new Date());
  const { monthStart, monthEnd, monthKey } = resolveBillingWindow(cyclePeriodStart);

  const result: OverageRunResult = {
    processed: 0,
    invoiced: 0,
    skippedByPolicy: 0,
    totalOverageCents: 0,
    errors: 0,
    billingMonth: monthKey,
  };

  const activeSubs = await db
    .select({
      subscriptionId: subscriptions.id,
      clientId: subscriptions.clientId,
      stripeCustomerId: subscriptions.stripeCustomerId,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      additionalLeadsCents: subscriptions.additionalLeadsCents,
      additionalSmsCents: subscriptions.additionalSmsCents,
      plan: plans,
      clientName: clients.businessName,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .innerJoin(clients, eq(subscriptions.clientId, clients.id))
    .where(
      and(
        inArray(subscriptions.status, ['active', 'trialing', 'past_due']),
        eq(clients.status, 'active')
      )
    );

  for (const row of activeSubs) {
    result.processed++;
    const idempotencyKey = buildMonthlyOverageIdempotencyKey(row.clientId, monthKey);

    const [alreadyInvoiced] = await db
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(eq(billingEvents.idempotencyKey, idempotencyKey))
      .limit(1);

    if (alreadyInvoiced) {
      continue;
    }

    const features = row.plan.features as PlanFeatures;
    const billingPolicy = resolveOverageBillingPolicy(features, row.plan.slug);

    if (!billingPolicy.chargesOverage) {
      result.skippedByPolicy++;
      continue;
    }

    const [leadCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, row.clientId),
          gte(leads.createdAt, monthStart),
          lt(leads.createdAt, monthEnd)
        )
      );
    const leadsUsed = Number(leadCount?.count || 0);
    const [messageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, row.clientId),
          eq(conversations.direction, 'outbound'),
          gte(conversations.createdAt, monthStart),
          lt(conversations.createdAt, monthEnd)
        )
      );
    const messagesUsed = Number(messageCount?.count || 0);

    const leadOver = features.maxLeadsPerMonth ? Math.max(0, leadsUsed - features.maxLeadsPerMonth) : 0;
    const msgLimit = features.maxMessagesPerMonth ?? null;
    const msgOver = msgLimit ? Math.max(0, messagesUsed - msgLimit) : 0;

    const leadsOverageCents = leadOver > 0 && features.overagePerLeadCents
      ? leadOver * features.overagePerLeadCents
      : 0;
    const smsOverageCents = msgOver > 0 && features.overagePerSmsCents
      ? msgOver * features.overagePerSmsCents
      : 0;
    const totalOverageCents = leadsOverageCents + smsOverageCents;

    if (totalOverageCents <= 0) continue;

    try {
      if (row.stripeCustomerId && row.stripeSubscriptionId) {
        if (leadsOverageCents > 0) {
          await stripe.invoiceItems.create({
            customer: row.stripeCustomerId,
            subscription: row.stripeSubscriptionId,
            currency: 'cad',
            amount: leadsOverageCents,
            description: `Lead overage (${leadOver}) for ${monthKey}`,
            metadata: {
              type: 'lead_overage',
              clientId: row.clientId,
            },
          }, {
            idempotencyKey: `${idempotencyKey}:lead`,
          });
        }

        if (smsOverageCents > 0) {
          await stripe.invoiceItems.create({
            customer: row.stripeCustomerId,
            subscription: row.stripeSubscriptionId,
            currency: 'cad',
            amount: smsOverageCents,
            description: `SMS overage (${msgOver}) for ${monthKey}`,
            metadata: {
              type: 'sms_overage',
              clientId: row.clientId,
            },
          }, {
            idempotencyKey: `${idempotencyKey}:sms`,
          });
        }
      }

      await withTransaction(async (tx) => {
        await tx
          .update(subscriptions)
          .set({
            additionalLeadsCents: (row.additionalLeadsCents || 0) + leadsOverageCents,
            additionalSmsCents: (row.additionalSmsCents || 0) + smsOverageCents,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, row.subscriptionId));

        await tx.insert(billingEvents).values({
          clientId: row.clientId,
          subscriptionId: row.subscriptionId,
          eventType: 'overage_invoiced',
          amountCents: totalOverageCents,
          description: `Monthly overage invoiced for ${row.clientName} (${monthKey})`,
          idempotencyKey,
          rawData: {
            billingMonth: monthKey,
            leadsUsed,
            messagesUsed,
            leadOver,
            msgOver,
            leadsOverageCents,
            smsOverageCents,
            cyclePeriodStart: cyclePeriodStart.toISOString().slice(0, 10),
          },
        });
      });

      result.invoiced++;
      result.totalOverageCents += totalOverageCents;
    } catch (error) {
      console.error('[Overage] Failed to invoice overage for client', row.clientId, error);
      result.errors++;
    }
  }

  return result;
}
