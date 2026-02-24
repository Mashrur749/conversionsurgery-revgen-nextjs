import { getDb } from '@/db';
import { reportDeliveries, reports } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { evaluateReportDeliveryRetryEligibility } from '@/lib/services/report-delivery-retry';

export interface ClientLatestReportDelivery {
  deliveryId: string;
  reportId: string | null;
  reportTitle: string | null;
  state: string;
  periodStart: string;
  periodEnd: string;
  attemptCount: number;
  sentAt: Date | null;
  failedAt: Date | null;
  lastStateAt: Date;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  retryReason: 'eligible' | 'not_failed' | 'retry_exhausted' | 'backoff_pending';
  nextRetryAt: Date | null;
  statusSummary: string;
  downloadPath: string | null;
}

function formatUtc(date: Date): string {
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function buildStatusSummary(input: {
  state: string;
  sentAt: Date | null;
  retryReason: 'eligible' | 'not_failed' | 'retry_exhausted' | 'backoff_pending';
  nextRetryAt: Date | null;
  lastStateAt: Date;
}) {
  if (input.state === 'sent' && input.sentAt) {
    return `Delivered on ${formatUtc(input.sentAt)}.`;
  }

  if (input.state === 'failed') {
    if (input.retryReason === 'backoff_pending') {
      return input.nextRetryAt
        ? `Delivery retry is scheduled for ${formatUtc(input.nextRetryAt)}.`
        : 'Delivery retry is waiting for the next retry window.';
    }

    if (input.retryReason === 'eligible') {
      return 'Delivery failed and is queued for automatic retry.';
    }

    if (input.retryReason === 'retry_exhausted') {
      return 'Delivery reached retry limit and is escalated for manual handling.';
    }

    return 'Delivery failed and is awaiting operator action.';
  }

  if (input.state === 'queued' || input.state === 'retried') {
    return 'Delivery is currently in progress.';
  }

  if (input.state === 'generated') {
    return 'Report generated and waiting to be queued for delivery.';
  }

  return `Last updated ${formatUtc(input.lastStateAt)}.`;
}

export async function getClientLatestReportDelivery(
  clientId: string,
  now: Date = new Date()
): Promise<ClientLatestReportDelivery | null> {
  const db = getDb();
  const [row] = await db
    .select({
      deliveryId: reportDeliveries.id,
      reportId: reportDeliveries.reportId,
      reportTitle: reports.title,
      state: reportDeliveries.state,
      periodStart: reportDeliveries.periodStart,
      periodEnd: reportDeliveries.periodEnd,
      attemptCount: reportDeliveries.attemptCount,
      sentAt: reportDeliveries.sentAt,
      failedAt: reportDeliveries.failedAt,
      lastStateAt: reportDeliveries.lastStateAt,
      lastErrorCode: reportDeliveries.lastErrorCode,
      lastErrorMessage: reportDeliveries.lastErrorMessage,
    })
    .from(reportDeliveries)
    .leftJoin(reports, eq(reports.id, reportDeliveries.reportId))
    .where(
      and(
        eq(reportDeliveries.clientId, clientId),
        eq(reportDeliveries.reportType, 'bi-weekly'),
        eq(reportDeliveries.channel, 'email')
      )
    )
    .orderBy(desc(reportDeliveries.periodEnd), desc(reportDeliveries.lastStateAt))
    .limit(1);

  if (!row) return null;

  const retryEligibility = evaluateReportDeliveryRetryEligibility(
    {
      state: row.state,
      attemptCount: row.attemptCount,
      failedAt: row.failedAt,
      lastStateAt: row.lastStateAt,
    },
    now
  );

  const retryReason = retryEligibility.reason;
  const nextRetryAt = retryEligibility.eligible
    ? retryEligibility.nextRetryAt
    : (retryEligibility.nextRetryAt ?? null);

  return {
    deliveryId: row.deliveryId,
    reportId: row.reportId,
    reportTitle: row.reportTitle,
    state: row.state,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    attemptCount: row.attemptCount,
    sentAt: row.sentAt,
    failedAt: row.failedAt,
    lastStateAt: row.lastStateAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    retryReason,
    nextRetryAt,
    statusSummary: buildStatusSummary({
      state: row.state,
      sentAt: row.sentAt,
      retryReason,
      nextRetryAt,
      lastStateAt: row.lastStateAt,
    }),
    downloadPath: row.reportId ? `/api/client/reports/${row.reportId}/download` : null,
  };
}

