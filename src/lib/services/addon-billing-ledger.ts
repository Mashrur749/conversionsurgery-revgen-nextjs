import { getDb } from '@/db';
import {
  addonBillingEvents,
  clientPhoneNumbers,
  clientMemberships,
  clients,
  plans,
  subscriptions,
  voiceCalls,
} from '@/db/schema';
import { and, eq, gte, lt, sql, desc, isNull } from 'drizzle-orm';
import {
  ADDON_PRICING_KEYS,
  type AddonPricingKey,
  getAddonPricing,
} from '@/lib/services/addon-pricing';

type LedgerSourceType = 'team_membership' | 'phone_number' | 'voice_calls_rollup';

interface BillingPeriod {
  start: Date;
  end: Date;
}

interface AddonLedgerEventInput {
  clientId: string;
  addonType: AddonPricingKey;
  sourceType: LedgerSourceType;
  sourceRef?: string;
  quantity: number;
  unitPriceCents: number;
  period: BillingPeriod;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_INCLUDED_TEAM_MEMBERS = 5;
const DEFAULT_INCLUDED_PHONE_NUMBERS = 3;

// Voice AI is included in the base price for clients created on or after this date.
// Pre-existing clients are billed per-minute as an add-on.
const VOICE_INCLUDED_CUTOFF_DATE = new Date('2026-04-03T00:00:00Z');

export function buildAddonBillingIdempotencyKey(parts: string[]): string {
  return parts.join(':');
}

export function secondsToBilledVoiceMinutes(totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  return Math.ceil(totalSeconds / 60);
}

function getCalendarMonthPeriod(referenceDate: Date): BillingPeriod {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));
  return { start, end };
}

async function getClientBillingPeriod(clientId: string, now: Date = new Date()): Promise<BillingPeriod> {
  const db = getDb();
  const [subscription] = await db
    .select({
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) {
    return {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
    };
  }

  return getCalendarMonthPeriod(now);
}

async function getIncludedAddonLimits(clientId: string): Promise<{
  includedTeamMembers: number;
  includedPhoneNumbers: number;
}> {
  const db = getDb();
  const [row] = await db
    .select({
      features: plans.features,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  const features = (row?.features ?? {}) as {
    maxTeamMembers?: number;
    maxPhoneNumbers?: number;
  };

  return {
    includedTeamMembers: features.maxTeamMembers ?? DEFAULT_INCLUDED_TEAM_MEMBERS,
    includedPhoneNumbers: features.maxPhoneNumbers ?? DEFAULT_INCLUDED_PHONE_NUMBERS,
  };
}

export async function recordAddonBillingEvent(
  input: AddonLedgerEventInput
): Promise<void> {
  const db = getDb();
  const quantity = Math.max(0, Math.trunc(input.quantity));
  const totalCents = quantity * input.unitPriceCents;

  if (quantity === 0) {
    return;
  }

  await db
    .insert(addonBillingEvents)
    .values({
      clientId: input.clientId,
      addonType: input.addonType,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      periodStart: input.period.start,
      periodEnd: input.period.end,
      quantity,
      unitPriceCents: input.unitPriceCents,
      totalCents,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: addonBillingEvents.idempotencyKey,
      set: {
        quantity,
        unitPriceCents: input.unitPriceCents,
        totalCents,
        sourceRef: input.sourceRef,
        metadata: input.metadata,
        updatedAt: new Date(),
      },
    });
}

export async function recordTeamMemberAddonEventForMembership(
  clientId: string,
  membershipId: string
): Promise<void> {
  const db = getDb();
  const [activeCountRows, limits, pricing, period] = await Promise.all([
    db
      .select({ activeCount: sql<number>`count(*)::int` })
      .from(clientMemberships)
      .where(and(
        eq(clientMemberships.clientId, clientId),
        eq(clientMemberships.isActive, true)
      )),
    getIncludedAddonLimits(clientId),
    getAddonPricing(clientId),
    getClientBillingPeriod(clientId),
  ]);

  const activeCount = activeCountRows[0]?.activeCount ?? 0;

  if (activeCount <= limits.includedTeamMembers) {
    return;
  }

  const idempotencyKey = buildAddonBillingIdempotencyKey([
    'addon',
    ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER,
    clientId,
    membershipId,
    period.start.toISOString(),
  ]);

  await recordAddonBillingEvent({
    clientId,
    addonType: ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER,
    sourceType: 'team_membership',
    sourceRef: membershipId,
      quantity: 1,
      unitPriceCents: pricing[ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER].unitPriceCents,
      period,
      idempotencyKey,
      metadata: {
        includedTeamMembers: limits.includedTeamMembers,
        activeTeamMembers: activeCount,
      },
    });
}

export async function recordPhoneNumberAddonEventForPurchase(
  clientId: string,
  phoneNumber: string
): Promise<void> {
  const db = getDb();
  const [numberStats, clientRow, limits, pricing, period] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clientPhoneNumbers)
      .where(and(
        eq(clientPhoneNumbers.clientId, clientId),
        eq(clientPhoneNumbers.isActive, true)
      )),
    db
      .select({ twilioNumber: clients.twilioNumber })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1),
    getIncludedAddonLimits(clientId),
    getAddonPricing(clientId),
    getClientBillingPeriod(clientId),
  ]);

  const activeNumbers = Math.max(numberStats[0]?.count ?? 0, clientRow[0]?.twilioNumber ? 1 : 0);
  if (activeNumbers <= limits.includedPhoneNumbers) {
    return;
  }

  const idempotencyKey = buildAddonBillingIdempotencyKey([
    'addon',
    ADDON_PRICING_KEYS.EXTRA_NUMBER,
    clientId,
    phoneNumber,
    period.start.toISOString(),
  ]);

  await recordAddonBillingEvent({
    clientId,
    addonType: ADDON_PRICING_KEYS.EXTRA_NUMBER,
    sourceType: 'phone_number',
    sourceRef: phoneNumber,
    quantity: 1,
    unitPriceCents: pricing[ADDON_PRICING_KEYS.EXTRA_NUMBER].unitPriceCents,
    period,
    idempotencyKey,
    metadata: {
      includedPhoneNumbers: limits.includedPhoneNumbers,
      activePhoneNumbers: activeNumbers,
    },
  });
}

export async function rollupVoiceUsageAddonEvents(now: Date = new Date()): Promise<{
  clientsEvaluated: number;
  eventsUpserted: number;
}> {
  const db = getDb();
  const activeClients = await db
    .select({
      clientId: subscriptions.clientId,
      clientCreatedAt: clients.createdAt,
    })
    .from(subscriptions)
    .innerJoin(clients, eq(subscriptions.clientId, clients.id))
    .where(and(
      gte(subscriptions.currentPeriodEnd, now),
      eq(subscriptions.status, 'active')
    ))
    .groupBy(subscriptions.clientId, clients.createdAt);

  let eventsUpserted = 0;

  for (const row of activeClients) {
    const clientId = row.clientId;

    // Voice is included in the base price for clients created on or after the cutoff date.
    if (row.clientCreatedAt >= VOICE_INCLUDED_CUTOFF_DATE) {
      continue;
    }
    const period = await getClientBillingPeriod(clientId, now);
    const [voiceStats, pricing] = await Promise.all([
      db
        .select({ seconds: sql<number>`coalesce(sum(${voiceCalls.duration}), 0)::int` })
        .from(voiceCalls)
        .where(and(
          eq(voiceCalls.clientId, clientId),
          gte(voiceCalls.startedAt, period.start),
          lt(voiceCalls.startedAt, period.end)
        )),
      getAddonPricing(clientId, period.start),
    ]);

    const billedMinutes = secondsToBilledVoiceMinutes(voiceStats[0]?.seconds ?? 0);
    if (billedMinutes <= 0) {
      continue;
    }

    const idempotencyKey = buildAddonBillingIdempotencyKey([
      'addon',
      ADDON_PRICING_KEYS.VOICE_MINUTES,
      clientId,
      period.start.toISOString(),
    ]);

    await recordAddonBillingEvent({
      clientId,
      addonType: ADDON_PRICING_KEYS.VOICE_MINUTES,
      sourceType: 'voice_calls_rollup',
      sourceRef: period.start.toISOString().slice(0, 10),
      quantity: billedMinutes,
      unitPriceCents: pricing[ADDON_PRICING_KEYS.VOICE_MINUTES].unitPriceCents,
      period,
      idempotencyKey,
      metadata: {
        totalSeconds: voiceStats[0]?.seconds ?? 0,
      },
    });

    eventsUpserted++;
  }

  return {
    clientsEvaluated: activeClients.length,
    eventsUpserted,
  };
}

export async function linkAddonEventsToInvoice(params: {
  invoiceId: string;
  clientId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const db = getDb();
  const events = await db
    .select({
      id: addonBillingEvents.id,
      addonType: addonBillingEvents.addonType,
    })
    .from(addonBillingEvents)
    .where(and(
      eq(addonBillingEvents.clientId, params.clientId),
      eq(addonBillingEvents.periodStart, params.periodStart),
      eq(addonBillingEvents.periodEnd, params.periodEnd),
      isNull(addonBillingEvents.invoiceId)
    ));

  for (const event of events) {
    await db
      .update(addonBillingEvents)
      .set({
        invoiceId: params.invoiceId,
        invoiceLineItemRef: `addon:${event.addonType}:${event.id}`,
        updatedAt: new Date(),
      })
      .where(eq(addonBillingEvents.id, event.id));
  }
}
