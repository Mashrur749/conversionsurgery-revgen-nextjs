import { getDb } from '@/db';
import { reportDeliveries, reportDeliveryEvents } from '@/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';

export const REPORT_DELIVERY_STATES = [
  'generated',
  'queued',
  'sent',
  'failed',
  'retried',
] as const;

export type ReportDeliveryState = (typeof REPORT_DELIVERY_STATES)[number];

interface EnsureReportDeliveryCycleInput {
  clientId: string;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  channel: 'email';
  recipient?: string | null;
  channelMetadata?: Record<string, unknown>;
}

interface TransitionOptions {
  reportId?: string;
  recipient?: string | null;
  channelMetadata?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  incrementAttempt?: boolean;
  metadata?: Record<string, unknown>;
  at?: Date;
}

export function buildReportDeliveryStatePatch(
  currentAttemptCount: number,
  toState: ReportDeliveryState,
  options: TransitionOptions = {}
) {
  const now = options.at ?? new Date();
  const patch: Partial<typeof reportDeliveries.$inferInsert> = {
    state: toState,
    updatedAt: now,
    lastStateAt: now,
  };

  if (options.reportId) patch.reportId = options.reportId;
  if (options.recipient !== undefined) patch.recipient = options.recipient;
  if (options.channelMetadata) patch.channelMetadata = options.channelMetadata;
  if (options.errorCode !== undefined) patch.lastErrorCode = options.errorCode;
  if (options.errorMessage !== undefined) patch.lastErrorMessage = options.errorMessage;
  if (options.incrementAttempt) patch.attemptCount = currentAttemptCount + 1;

  if (toState === 'generated') patch.generatedAt = now;
  if (toState === 'queued') patch.queuedAt = now;
  if (toState === 'sent') patch.sentAt = now;
  if (toState === 'failed') patch.failedAt = now;
  if (toState === 'retried') patch.retriedAt = now;

  return patch;
}

export async function ensureReportDeliveryCycle(
  input: EnsureReportDeliveryCycleInput
) {
  const db = getDb();
  const [delivery] = await db
    .insert(reportDeliveries)
    .values({
      clientId: input.clientId,
      reportType: input.reportType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      channel: input.channel,
      recipient: input.recipient ?? null,
      channelMetadata: input.channelMetadata,
      state: 'queued',
      queuedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        reportDeliveries.clientId,
        reportDeliveries.reportType,
        reportDeliveries.periodStart,
        reportDeliveries.periodEnd,
        reportDeliveries.channel,
      ],
      set: {
        recipient: input.recipient ?? null,
        channelMetadata: input.channelMetadata,
        updatedAt: new Date(),
      },
    })
    .returning();

  return delivery;
}

export async function transitionReportDeliveryState(
  deliveryId: string,
  toState: ReportDeliveryState,
  options: TransitionOptions = {}
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(reportDeliveries)
      .where(eq(reportDeliveries.id, deliveryId))
      .limit(1);

    if (!current) {
      throw new Error(`Report delivery ${deliveryId} not found`);
    }

    const patch = buildReportDeliveryStatePatch(
      current.attemptCount,
      toState,
      options
    );

    const [updated] = await tx
      .update(reportDeliveries)
      .set(patch)
      .where(eq(reportDeliveries.id, deliveryId))
      .returning();

    await tx.insert(reportDeliveryEvents).values({
      deliveryId,
      fromState: current.state,
      toState,
      errorCode: options.errorCode,
      errorMessage: options.errorMessage,
      metadata: options.metadata ?? options.channelMetadata,
      createdAt: options.at ?? new Date(),
    });

    return updated;
  });
}

export async function getLatestReportDeliveryForClient(
  clientId: string,
  reportType: string = 'bi-weekly'
) {
  const db = getDb();
  const [delivery] = await db
    .select()
    .from(reportDeliveries)
    .where(and(
      eq(reportDeliveries.clientId, clientId),
      eq(reportDeliveries.reportType, reportType)
    ))
    .orderBy(desc(reportDeliveries.periodEnd), desc(reportDeliveries.lastStateAt))
    .limit(1);

  return delivery ?? null;
}

interface ClaimRetryOptions {
  at?: Date;
  metadata?: Record<string, unknown>;
}

export async function claimReportDeliveryForRetry(
  deliveryId: string,
  maxAttempts: number,
  options: ClaimRetryOptions = {}
) {
  const db = getDb();
  const now = options.at ?? new Date();

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(reportDeliveries)
      .where(eq(reportDeliveries.id, deliveryId))
      .limit(1);

    if (!current) return null;

    const [claimed] = await tx
      .update(reportDeliveries)
      .set({
        state: 'retried',
        attemptCount: current.attemptCount + 1,
        retriedAt: now,
        lastStateAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(reportDeliveries.id, deliveryId),
          eq(reportDeliveries.state, 'failed'),
          lt(reportDeliveries.attemptCount, maxAttempts)
        )
      )
      .returning();

    if (!claimed) return null;

    await tx.insert(reportDeliveryEvents).values({
      deliveryId,
      fromState: current.state,
      toState: 'retried',
      metadata: options.metadata,
      createdAt: now,
    });

    return claimed;
  });
}
