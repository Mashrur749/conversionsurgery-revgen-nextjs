import { getDb } from '@/db';
import { clients, reportDeliveries, reports } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import {
  claimReportDeliveryForRetry,
  transitionReportDeliveryState,
} from '@/lib/services/report-delivery';
import { sendBiWeeklyReportEmail } from '@/lib/services/report-email';
import { type WithoutUsModelResult } from '@/lib/services/without-us-model';

export const REPORT_DELIVERY_RETRY_POLICY = {
  maxAttempts: 3,
  baseBackoffMinutes: 30,
  maxBackoffMinutes: 360,
  batchSize: 100,
} as const;

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function getReportDeliveryBackoffMs(attemptCount: number): number {
  const safeAttemptCount = Math.max(1, attemptCount);
  const exponent = Math.max(0, safeAttemptCount - 1);
  const backoffMinutes = Math.min(
    REPORT_DELIVERY_RETRY_POLICY.baseBackoffMinutes * (2 ** exponent),
    REPORT_DELIVERY_RETRY_POLICY.maxBackoffMinutes
  );
  return backoffMinutes * 60 * 1000;
}

export function getReportDeliveryNextRetryAt(failedAt: Date, attemptCount: number): Date {
  return new Date(failedAt.getTime() + getReportDeliveryBackoffMs(attemptCount));
}

export function evaluateReportDeliveryRetryEligibility(input: {
  state: string;
  attemptCount: number;
  failedAt: Date | null;
  lastStateAt: Date;
}, now: Date = new Date()) {
  if (input.state !== 'failed') {
    return { eligible: false as const, reason: 'not_failed' as const };
  }

  if (input.attemptCount >= REPORT_DELIVERY_RETRY_POLICY.maxAttempts) {
    return { eligible: false as const, reason: 'retry_exhausted' as const };
  }

  const lastFailureAt = input.failedAt ?? input.lastStateAt;
  const nextRetryAt = getReportDeliveryNextRetryAt(lastFailureAt, input.attemptCount);
  if (now < nextRetryAt) {
    return {
      eligible: false as const,
      reason: 'backoff_pending' as const,
      nextRetryAt,
    };
  }

  return { eligible: true as const, reason: 'eligible' as const, nextRetryAt };
}

export async function processReportDeliveryRetries(now: Date = new Date()) {
  const db = getDb();

  const failedDeliveries = await db
    .select({
      id: reportDeliveries.id,
      clientId: reportDeliveries.clientId,
      reportId: reportDeliveries.reportId,
      reportType: reportDeliveries.reportType,
      state: reportDeliveries.state,
      attemptCount: reportDeliveries.attemptCount,
      failedAt: reportDeliveries.failedAt,
      lastStateAt: reportDeliveries.lastStateAt,
      lastErrorCode: reportDeliveries.lastErrorCode,
      recipient: reportDeliveries.recipient,
    })
    .from(reportDeliveries)
    .where(
      and(
        eq(reportDeliveries.channel, 'email'),
        eq(reportDeliveries.reportType, 'bi-weekly'),
        eq(reportDeliveries.state, 'failed')
      )
    )
    .orderBy(asc(reportDeliveries.lastStateAt))
    .limit(REPORT_DELIVERY_RETRY_POLICY.batchSize);

  let retried = 0;
  let sent = 0;
  let failed = 0;
  let backoffPending = 0;
  let terminal = 0;
  let skipped = 0;

  for (const delivery of failedDeliveries) {
    const eligibility = evaluateReportDeliveryRetryEligibility(
      {
        state: delivery.state,
        attemptCount: delivery.attemptCount,
        failedAt: delivery.failedAt,
        lastStateAt: delivery.lastStateAt,
      },
      now
    );

    if (!eligibility.eligible) {
      if (eligibility.reason === 'backoff_pending') {
        backoffPending++;
        continue;
      }

      if (eligibility.reason === 'retry_exhausted') {
        terminal++;

        if (delivery.lastErrorCode !== 'retry_exhausted') {
          await transitionReportDeliveryState(delivery.id, 'failed', {
            errorCode: 'retry_exhausted',
            errorMessage: `Retry limit reached (${REPORT_DELIVERY_RETRY_POLICY.maxAttempts})`,
            metadata: {
              maxAttempts: REPORT_DELIVERY_RETRY_POLICY.maxAttempts,
            },
            at: now,
          }).catch((error) => {
            console.error(
              '[ReportDeliveryRetry] Failed to mark terminal retry exhaustion',
              error
            );
          });
        }
      } else {
        skipped++;
      }
      continue;
    }

    const claimed = await claimReportDeliveryForRetry(
      delivery.id,
      REPORT_DELIVERY_RETRY_POLICY.maxAttempts,
      {
        at: now,
        metadata: {
          trigger: 'cron_retry',
          previousAttempts: delivery.attemptCount,
        },
      }
    );

    if (!claimed) {
      skipped++;
      continue;
    }

    retried++;

    try {
      const [client] = await db
        .select({
          id: clients.id,
          businessName: clients.businessName,
          email: clients.email,
        })
        .from(clients)
        .where(eq(clients.id, claimed.clientId))
        .limit(1);

      if (!claimed.reportId) {
        failed++;
        await transitionReportDeliveryState(claimed.id, 'failed', {
          errorCode: 'missing_report',
          errorMessage: 'Report ID missing on delivery record',
          metadata: {
            trigger: 'cron_retry',
          },
          at: now,
        });
        continue;
      }

      const [report] = await db
        .select({
          id: reports.id,
          startDate: reports.startDate,
          endDate: reports.endDate,
          roiSummary: reports.roiSummary,
        })
        .from(reports)
        .where(eq(reports.id, claimed.reportId))
        .limit(1);

      if (!report) {
        failed++;
        await transitionReportDeliveryState(claimed.id, 'failed', {
          reportId: claimed.reportId,
          errorCode: 'missing_report',
          errorMessage: 'Linked report was not found',
          metadata: {
            trigger: 'cron_retry',
          },
          at: now,
        });
        continue;
      }

      const recipient = client?.email ?? claimed.recipient ?? null;
      if (!recipient) {
        failed++;
        await transitionReportDeliveryState(claimed.id, 'failed', {
          reportId: report.id,
          errorCode: 'missing_recipient',
          errorMessage: 'Client email is missing',
          metadata: {
            trigger: 'cron_retry',
          },
          at: now,
        });
        continue;
      }

      await transitionReportDeliveryState(claimed.id, 'queued', {
        reportId: report.id,
        recipient,
        channelMetadata: {
          recipient,
          reportId: report.id,
          trigger: 'cron_retry',
        },
        metadata: {
          trigger: 'cron_retry',
          retryAttempt: claimed.attemptCount,
        },
        at: now,
      });

      const summary = (report.roiSummary as { withoutUsModel?: WithoutUsModelResult } | null) || null;
      const emailResult = await sendBiWeeklyReportEmail({
        to: recipient,
        businessName: client?.businessName ?? 'ConversionSurgery Client',
        periodStart: report.startDate.toString(),
        periodEnd: report.endDate.toString(),
        reportId: report.id,
        withoutUsModel: summary?.withoutUsModel ?? null,
      });

      if (emailResult.success) {
        sent++;
        await transitionReportDeliveryState(claimed.id, 'sent', {
          reportId: report.id,
          recipient,
          channelMetadata: {
            recipient,
            providerMessageId: emailResult.id,
          },
          metadata: {
            provider: 'resend',
            providerMessageId: emailResult.id,
            trigger: 'cron_retry',
          },
          errorCode: null,
          errorMessage: null,
          at: now,
        });
      } else {
        failed++;
        await transitionReportDeliveryState(claimed.id, 'failed', {
          reportId: report.id,
          recipient,
          errorCode: 'email_send_failed',
          errorMessage: stringifyError(emailResult.error),
          metadata: {
            provider: 'resend',
            trigger: 'cron_retry',
          },
          at: now,
        });
      }
    } catch (error) {
      failed++;
      await transitionReportDeliveryState(claimed.id, 'failed', {
        errorCode: 'retry_processing_failed',
        errorMessage: stringifyError(error),
        metadata: {
          trigger: 'cron_retry',
        },
        at: now,
      }).catch((transitionError) => {
        console.error(
          '[ReportDeliveryRetry] Failed to transition delivery state',
          transitionError
        );
      });
    }
  }

  return {
    scanned: failedDeliveries.length,
    retried,
    sent,
    failed,
    backoffPending,
    terminal,
    skipped,
    policy: REPORT_DELIVERY_RETRY_POLICY,
  };
}
