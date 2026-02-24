import { getDb } from '@/db';
import {
  agencyMemberships,
  clients,
  people,
  reportDeliveries,
  reports,
  roleTemplates,
  systemSettings,
} from '@/db/schema';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import {
  claimReportDeliveryForRetry,
  transitionReportDeliveryState,
} from '@/lib/services/report-delivery';
import { sendBiWeeklyReportEmail } from '@/lib/services/report-email';
import { sendEmail } from '@/lib/services/resend';
import { type WithoutUsModelResult } from '@/lib/services/without-us-model';

export const REPORT_DELIVERY_RETRY_POLICY = {
  maxAttempts: 3,
  baseBackoffMinutes: 30,
  maxBackoffMinutes: 360,
  batchSize: 100,
} as const;

const TERMINAL_ALERT_SETTING_KEY = 'last_report_delivery_terminal_alert_date';

type RetryEligibilityReason =
  | 'eligible'
  | 'not_failed'
  | 'retry_exhausted'
  | 'backoff_pending';

interface ReportDeliveryCandidate {
  id: string;
  clientId: string;
  reportId: string | null;
  reportType: string;
  state: string;
  attemptCount: number;
  failedAt: Date | null;
  lastStateAt: Date;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  recipient: string | null;
  periodStart: string;
  periodEnd: string;
  clientBusinessName: string | null;
}

export interface ReportDeliveryOpsRow {
  id: string;
  clientId: string;
  clientBusinessName: string | null;
  reportId: string | null;
  reportTitle: string | null;
  reportType: string;
  periodStart: string;
  periodEnd: string;
  state: string;
  attemptCount: number;
  recipient: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  failedAt: Date | null;
  lastStateAt: Date;
  retryReason: RetryEligibilityReason;
  nextRetryAt: Date | null;
  canRetryNow: boolean;
  isTerminal: boolean;
}

interface RetryExecutionOptions {
  now: Date;
  trigger: 'cron_retry' | 'operator_retry';
  forceBackoff?: boolean;
  forceTerminal?: boolean;
}

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

export function getReportDeliveryNextRetryAt(
  failedAt: Date,
  attemptCount: number
): Date {
  return new Date(failedAt.getTime() + getReportDeliveryBackoffMs(attemptCount));
}

export function evaluateReportDeliveryRetryEligibility(
  input: {
    state: string;
    attemptCount: number;
    failedAt: Date | null;
    lastStateAt: Date;
  },
  now: Date = new Date()
) {
  if (input.state !== 'failed') {
    return { eligible: false as const, reason: 'not_failed' as const };
  }

  if (input.attemptCount >= REPORT_DELIVERY_RETRY_POLICY.maxAttempts) {
    return { eligible: false as const, reason: 'retry_exhausted' as const };
  }

  const lastFailureAt = input.failedAt ?? input.lastStateAt;
  const nextRetryAt = getReportDeliveryNextRetryAt(
    lastFailureAt,
    input.attemptCount
  );
  if (now < nextRetryAt) {
    return {
      eligible: false as const,
      reason: 'backoff_pending' as const,
      nextRetryAt,
    };
  }

  return { eligible: true as const, reason: 'eligible' as const, nextRetryAt };
}

function mapDeliveryToOpsRow(
  delivery: ReportDeliveryCandidate,
  reportTitle: string | null,
  now: Date
): ReportDeliveryOpsRow {
  const eligibility = evaluateReportDeliveryRetryEligibility(
    {
      state: delivery.state,
      attemptCount: delivery.attemptCount,
      failedAt: delivery.failedAt,
      lastStateAt: delivery.lastStateAt,
    },
    now
  );

  return {
    id: delivery.id,
    clientId: delivery.clientId,
    clientBusinessName: delivery.clientBusinessName,
    reportId: delivery.reportId,
    reportTitle,
    reportType: delivery.reportType,
    periodStart: delivery.periodStart,
    periodEnd: delivery.periodEnd,
    state: delivery.state,
    attemptCount: delivery.attemptCount,
    recipient: delivery.recipient,
    lastErrorCode: delivery.lastErrorCode,
    lastErrorMessage: delivery.lastErrorMessage,
    failedAt: delivery.failedAt,
    lastStateAt: delivery.lastStateAt,
    retryReason: eligibility.reason,
    nextRetryAt: eligibility.eligible ? eligibility.nextRetryAt : (eligibility.nextRetryAt ?? null),
    canRetryNow: delivery.state === 'failed' && (eligibility.reason === 'eligible'),
    isTerminal: eligibility.reason === 'retry_exhausted',
  };
}

async function getReportDeliveryCandidateById(
  deliveryId: string
): Promise<ReportDeliveryCandidate | null> {
  const db = getDb();
  const [row] = await db
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
      lastErrorMessage: reportDeliveries.lastErrorMessage,
      recipient: reportDeliveries.recipient,
      periodStart: reportDeliveries.periodStart,
      periodEnd: reportDeliveries.periodEnd,
      clientBusinessName: clients.businessName,
    })
    .from(reportDeliveries)
    .leftJoin(clients, eq(clients.id, reportDeliveries.clientId))
    .where(eq(reportDeliveries.id, deliveryId))
    .limit(1);

  return row ?? null;
}

async function executeReportDeliveryRetry(
  delivery: ReportDeliveryCandidate,
  options: RetryExecutionOptions
) {
  const now = options.now;

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
    if (eligibility.reason === 'backoff_pending' && !options.forceBackoff) {
      return { status: 'backoff_pending' as const };
    }

    if (eligibility.reason === 'retry_exhausted' && !options.forceTerminal) {
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
      return { status: 'terminal' as const };
    }
  }

  const claimed = await claimReportDeliveryForRetry(
    delivery.id,
    REPORT_DELIVERY_RETRY_POLICY.maxAttempts,
    {
      at: now,
      allowBeyondMaxAttempts: options.forceTerminal,
      metadata: {
        trigger: options.trigger,
        previousAttempts: delivery.attemptCount,
      },
    }
  );

  if (!claimed) {
    return { status: 'skipped' as const };
  }

  const db = getDb();

  try {
    const [client] = await db
      .select({
        businessName: clients.businessName,
        email: clients.email,
      })
      .from(clients)
      .where(eq(clients.id, claimed.clientId))
      .limit(1);

    if (!claimed.reportId) {
      await transitionReportDeliveryState(claimed.id, 'failed', {
        errorCode: 'missing_report',
        errorMessage: 'Report ID missing on delivery record',
        metadata: { trigger: options.trigger },
        at: now,
      });
      return { status: 'failed' as const, reason: 'missing_report' as const };
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
      await transitionReportDeliveryState(claimed.id, 'failed', {
        reportId: claimed.reportId,
        errorCode: 'missing_report',
        errorMessage: 'Linked report was not found',
        metadata: { trigger: options.trigger },
        at: now,
      });
      return { status: 'failed' as const, reason: 'missing_report' as const };
    }

    const recipient = client?.email ?? claimed.recipient ?? null;
    if (!recipient) {
      await transitionReportDeliveryState(claimed.id, 'failed', {
        reportId: report.id,
        errorCode: 'missing_recipient',
        errorMessage: 'Client email is missing',
        metadata: { trigger: options.trigger },
        at: now,
      });
      return {
        status: 'failed' as const,
        reason: 'missing_recipient' as const,
      };
    }

    await transitionReportDeliveryState(claimed.id, 'queued', {
      reportId: report.id,
      recipient,
      channelMetadata: {
        recipient,
        reportId: report.id,
        trigger: options.trigger,
      },
      metadata: {
        trigger: options.trigger,
        retryAttempt: claimed.attemptCount,
      },
      at: now,
    });

    const summary =
      (report.roiSummary as { withoutUsModel?: WithoutUsModelResult } | null) ||
      null;

    const emailResult = await sendBiWeeklyReportEmail({
      to: recipient,
      businessName: client?.businessName ?? 'ConversionSurgery Client',
      periodStart: report.startDate.toString(),
      periodEnd: report.endDate.toString(),
      reportId: report.id,
      withoutUsModel: summary?.withoutUsModel ?? null,
    });

    if (emailResult.success) {
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
          trigger: options.trigger,
        },
        errorCode: null,
        errorMessage: null,
        at: now,
      });
      return { status: 'sent' as const };
    }

    await transitionReportDeliveryState(claimed.id, 'failed', {
      reportId: report.id,
      recipient,
      errorCode: 'email_send_failed',
      errorMessage: stringifyError(emailResult.error),
      metadata: {
        provider: 'resend',
        trigger: options.trigger,
      },
      at: now,
    });
    return { status: 'failed' as const, reason: 'email_send_failed' as const };
  } catch (error) {
    await transitionReportDeliveryState(claimed.id, 'failed', {
      errorCode: 'retry_processing_failed',
      errorMessage: stringifyError(error),
      metadata: {
        trigger: options.trigger,
      },
      at: now,
    }).catch((transitionError) => {
      console.error(
        '[ReportDeliveryRetry] Failed to transition delivery state',
        transitionError
      );
    });

    return { status: 'failed' as const, reason: 'retry_processing_failed' as const };
  }
}

async function sendTerminalFailureAlert(
  terminalRows: ReportDeliveryCandidate[],
  now: Date
) {
  if (terminalRows.length === 0) return { sent: 0, skipped: true };

  const db = getDb();
  const today = now.toISOString().slice(0, 10);

  const [lastAlert] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, TERMINAL_ALERT_SETTING_KEY))
    .limit(1);

  if (lastAlert?.value === today) {
    return { sent: 0, skipped: true };
  }

  const owners = await db
    .select({
      email: people.email,
      name: people.name,
    })
    .from(agencyMemberships)
    .innerJoin(people, eq(agencyMemberships.personId, people.id))
    .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
    .where(
      and(
        eq(agencyMemberships.isActive, true),
        eq(roleTemplates.slug, 'agency_owner'),
        isNotNull(people.email)
      )
    );

  let sent = 0;
  const rowsHtml = terminalRows
    .slice(0, 20)
    .map((row) => {
      const clientName = row.clientBusinessName ?? row.clientId;
      const period = `${row.periodStart} to ${row.periodEnd}`;
      const error = row.lastErrorCode ?? row.lastErrorMessage ?? 'unknown';
      return `<li><strong>${clientName}</strong> (${period}) — attempts: ${row.attemptCount}, last error: ${error}</li>`;
    })
    .join('');

  for (const owner of owners) {
    if (!owner.email) continue;
    const result = await sendEmail({
      to: owner.email,
      subject: `[Alert] Report delivery terminal failures (${terminalRows.length})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Report Delivery Terminal Failures</h2>
          <p>${terminalRows.length} report delivery record(s) reached retry exhaustion.</p>
          <ul>${rowsHtml || '<li>No rows</li>'}</ul>
          <p>Action: use Admin Reports delivery panel to fix and manually retry failed rows.</p>
        </div>
      `,
    });
    if (result.success) {
      sent++;
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: TERMINAL_ALERT_SETTING_KEY,
      value: today,
      description: 'Last date terminal report delivery alert digest was sent',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: today,
        updatedAt: new Date(),
      },
    });

  return { sent, skipped: false };
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
      lastErrorMessage: reportDeliveries.lastErrorMessage,
      recipient: reportDeliveries.recipient,
      periodStart: reportDeliveries.periodStart,
      periodEnd: reportDeliveries.periodEnd,
      clientBusinessName: clients.businessName,
    })
    .from(reportDeliveries)
    .leftJoin(clients, eq(clients.id, reportDeliveries.clientId))
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
  const terminalRows: ReportDeliveryCandidate[] = [];

  for (const delivery of failedDeliveries) {
    const result = await executeReportDeliveryRetry(delivery, {
      now,
      trigger: 'cron_retry',
    });

    if (result.status === 'sent') {
      retried++;
      sent++;
      continue;
    }

    if (result.status === 'failed') {
      retried++;
      failed++;
      continue;
    }

    if (result.status === 'backoff_pending') {
      backoffPending++;
      continue;
    }

    if (result.status === 'terminal') {
      terminal++;
      terminalRows.push(delivery);
      continue;
    }

    skipped++;
  }

  const terminalAlert = await sendTerminalFailureAlert(terminalRows, now).catch(
    (error) => {
      console.error('[ReportDeliveryRetry] Terminal alert send failed', error);
      return { sent: 0, skipped: true };
    }
  );

  return {
    scanned: failedDeliveries.length,
    retried,
    sent,
    failed,
    backoffPending,
    terminal,
    skipped,
    terminalAlert,
    policy: REPORT_DELIVERY_RETRY_POLICY,
  };
}

export async function retryReportDeliveryById(
  deliveryId: string,
  options: { force?: boolean; now?: Date } = {}
) {
  const now = options.now ?? new Date();
  const force = options.force ?? true;
  const delivery = await getReportDeliveryCandidateById(deliveryId);

  if (!delivery) {
    return { ok: false as const, reason: 'not_found' as const };
  }

  if (delivery.state !== 'failed') {
    return { ok: false as const, reason: 'not_failed' as const };
  }

  const result = await executeReportDeliveryRetry(delivery, {
    now,
    trigger: 'operator_retry',
    forceBackoff: force,
    forceTerminal: force,
  });

  if (result.status === 'backoff_pending') {
    return { ok: false as const, reason: 'backoff_pending' as const };
  }

  if (result.status === 'terminal') {
    return { ok: false as const, reason: 'retry_exhausted' as const };
  }

  if (result.status === 'skipped') {
    return { ok: false as const, reason: 'concurrent_claim' as const };
  }

  return {
    ok: true as const,
    status: result.status,
  };
}

export async function listReportDeliveryOpsRows(input: {
  view?: 'all' | 'failed' | 'pending_retry' | 'terminal' | 'sent';
  limit?: number;
  now?: Date;
} = {}) {
  const db = getDb();
  const view = input.view ?? 'all';
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);

  const rawRows = await db
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
      lastErrorMessage: reportDeliveries.lastErrorMessage,
      recipient: reportDeliveries.recipient,
      periodStart: reportDeliveries.periodStart,
      periodEnd: reportDeliveries.periodEnd,
      clientBusinessName: clients.businessName,
      reportTitle: reports.title,
    })
    .from(reportDeliveries)
    .leftJoin(clients, eq(clients.id, reportDeliveries.clientId))
    .leftJoin(reports, eq(reports.id, reportDeliveries.reportId))
    .where(
      and(
        eq(reportDeliveries.channel, 'email'),
        eq(reportDeliveries.reportType, 'bi-weekly')
      )
    )
    .orderBy(desc(reportDeliveries.lastStateAt))
    .limit(limit);

  const mapped = rawRows.map((row) =>
    mapDeliveryToOpsRow(
      {
        id: row.id,
        clientId: row.clientId,
        reportId: row.reportId,
        reportType: row.reportType,
        state: row.state,
        attemptCount: row.attemptCount,
        failedAt: row.failedAt,
        lastStateAt: row.lastStateAt,
        lastErrorCode: row.lastErrorCode,
        lastErrorMessage: row.lastErrorMessage,
        recipient: row.recipient,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        clientBusinessName: row.clientBusinessName,
      },
      row.reportTitle,
      now
    )
  );

  const filtered = mapped.filter((row) => {
    if (view === 'all') return true;
    if (view === 'sent') return row.state === 'sent';
    if (view === 'failed') return row.state === 'failed';
    if (view === 'pending_retry') {
      return row.state === 'failed' && (row.retryReason === 'eligible' || row.retryReason === 'backoff_pending');
    }
    if (view === 'terminal') return row.state === 'failed' && row.retryReason === 'retry_exhausted';
    return true;
  });

  const summary = {
    total: mapped.length,
    sent: mapped.filter((row) => row.state === 'sent').length,
    failed: mapped.filter((row) => row.state === 'failed').length,
    pendingRetry: mapped.filter(
      (row) =>
        row.state === 'failed' &&
        (row.retryReason === 'eligible' || row.retryReason === 'backoff_pending')
    ).length,
    terminal: mapped.filter(
      (row) => row.state === 'failed' && row.retryReason === 'retry_exhausted'
    ).length,
  };

  return {
    rows: filtered,
    summary,
    view,
  };
}
