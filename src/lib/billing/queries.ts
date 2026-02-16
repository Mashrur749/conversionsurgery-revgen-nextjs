import { getDb } from '@/db';
import {
  subscriptions,
  billingPaymentMethods,
  subscriptionInvoices,
  plans,
  usageRecords,
  teamMembers,
  clients,
} from '@/db/schema';
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm';

export async function getBillingData(clientId: string) {
  const db = getDb();

  const [subscription, methods, invoiceList, usage] = await Promise.all([
    // Get subscription with plan via join
    getSubscriptionWithPlan(clientId),

    // Get payment methods
    db
      .select()
      .from(billingPaymentMethods)
      .where(eq(billingPaymentMethods.clientId, clientId))
      .orderBy(desc(billingPaymentMethods.isDefault), desc(billingPaymentMethods.createdAt)),

    // Get recent invoices
    db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.clientId, clientId))
      .orderBy(desc(subscriptionInvoices.invoiceDate))
      .limit(20),

    // Get current period usage
    getUsageForPeriod(clientId),
  ]);

  return {
    subscription: subscription
      ? {
          id: subscription.subscription.id,
          status: subscription.subscription.status,
          plan: {
            id: subscription.plan.id,
            name: subscription.plan.name,
            priceMonthly: subscription.plan.priceMonthly,
            features: subscription.plan.features as {
              maxLeadsPerMonth: number | null;
              maxTeamMembers: number | null;
              maxPhoneNumbers: number;
              includesVoiceAi: boolean;
              includesCalendarSync: boolean;
              includesAdvancedAnalytics: boolean;
              includesWhiteLabel: boolean;
              supportLevel: string;
              apiAccess: boolean;
            },
          },
          currentPeriodStart: subscription.subscription.currentPeriodStart!,
          currentPeriodEnd: subscription.subscription.currentPeriodEnd!,
          trialEnd: subscription.subscription.trialEnd,
          cancelAtPeriodEnd: subscription.subscription.cancelAtPeriodEnd ?? false,
          discountPercent: subscription.subscription.discountPercent,
        }
      : null,
    paymentMethods: methods.map((m) => ({
      id: m.id,
      type: m.type || 'card',
      isDefault: m.isDefault ?? false,
      card:
        m.type === 'card'
          ? {
              brand: m.cardBrand || '',
              last4: m.cardLast4 || '',
              expMonth: m.cardExpMonth || 0,
              expYear: m.cardExpYear || 0,
            }
          : undefined,
      bankAccount:
        m.type !== 'card'
          ? {
              bankName: m.bankName || '',
              last4: m.bankLast4 || '',
            }
          : undefined,
    })),
    invoices: invoiceList.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber || '',
      status: inv.status || 'draft',
      amountDue: inv.amountDueCents,
      amountPaid: inv.amountPaidCents ?? 0,
      createdAt: inv.invoiceDate ?? inv.createdAt!,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      pdfUrl: inv.pdfUrl,
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
      lineItems: (inv.lineItems || []).map((item) => ({
        description: item.description,
        totalCents: item.totalCents,
        quantity: item.quantity,
      })),
    })),
    usage,
  };
}

async function getSubscriptionWithPlan(clientId: string) {
  const db = getDb();

  const result = await db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  return result[0] || null;
}

async function getUsageForPeriod(clientId: string) {
  const db = getDb();

  const subResult = await getSubscriptionWithPlan(clientId);
  if (!subResult) return null;

  const { subscription, plan } = subResult;
  const periodStart = subscription.currentPeriodStart;
  const periodEnd = subscription.currentPeriodEnd;

  if (!periodStart || !periodEnd) return null;

  // Get usage records for current period
  const usageData = await db
    .select({
      totalLeads: sql<number>`coalesce(sum(case when ${usageRecords.usageType} = 'lead' then ${usageRecords.quantity} else 0 end), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.clientId, clientId),
        gte(usageRecords.periodStart, periodStart),
        lte(usageRecords.periodEnd, periodEnd)
      )
    );

  const usage = usageData[0] || { totalLeads: 0 };
  const features = plan.features as {
    maxLeadsPerMonth: number | null;
    maxTeamMembers: number | null;
    maxPhoneNumbers: number;
    overagePerLeadCents?: number;
    allowOverages?: boolean;
  };

  // Get team member count
  const teamMemberResult = await db
    .select({ count: count() })
    .from(teamMembers)
    .where(eq(teamMembers.clientId, clientId));

  // Get phone number count (client has one twilioNumber)
  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const leadsOverage = features.maxLeadsPerMonth
    ? Math.max(0, usage.totalLeads - features.maxLeadsPerMonth)
    : 0;

  const overageCostCents = leadsOverage > 0 && features.overagePerLeadCents
    ? leadsOverage * features.overagePerLeadCents
    : 0;

  return {
    leads: {
      used: usage.totalLeads,
      included: features.maxLeadsPerMonth,
      overage: leadsOverage,
      overageCostCents,
      allowOverages: features.allowOverages ?? true,
    },
    teamMembers: {
      used: teamMemberResult[0]?.count ?? 0,
      included: features.maxTeamMembers ?? 3,
    },
    phoneNumbers: {
      used: client?.twilioNumber ? 1 : 0,
      included: features.maxPhoneNumbers ?? 1,
    },
  };
}

export async function getPlans() {
  const db = getDb();

  return db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.displayOrder);
}

export async function getCurrentSubscription(clientId: string) {
  const db = getDb();

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  return sub || null;
}

export async function getAdminBillingStats() {
  const db = getDb();

  // Get all subscriptions with plans
  const allSubs = await db
    .select({
      status: subscriptions.status,
      priceMonthly: plans.priceMonthly,
      canceledAt: subscriptions.canceledAt,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id));

  const activeSubs = allSubs.filter((s) => s.status === 'active');
  const trialingSubs = allSubs.filter((s) => s.status === 'trialing');
  const pastDueSubs = allSubs.filter((s) => s.status === 'past_due');

  // MRR from active subscriptions
  const mrr = activeSubs.reduce((sum, s) => sum + (s.priceMonthly || 0), 0);

  // Canceled this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const canceledThisMonth = allSubs.filter(
    (s) => s.status === 'canceled' && s.canceledAt && s.canceledAt >= startOfMonth
  ).length;

  // Churn rate
  const totalActive = activeSubs.length + trialingSubs.length;
  const churnRate = totalActive > 0
    ? parseFloat(((canceledThisMonth / totalActive) * 100).toFixed(1))
    : 0;

  // Failed payments = past_due subs
  const failedPaymentsAmount = pastDueSubs.reduce((sum, s) => sum + (s.priceMonthly || 0), 0);

  return {
    mrr,
    mrrChange: 0, // Would need historical data for delta
    activeSubscriptions: activeSubs.length,
    trialingSubscriptions: trialingSubs.length,
    churnRate,
    canceledThisMonth,
    failedPayments: pastDueSubs.length,
    failedPaymentsAmount,
    revenueHistory: [] as { month: string; revenue: number }[],
  };
}
