/**
 * Cancellation Reminders Service
 *
 * Sends grace-period reminder emails to clients with active cancellation
 * requests, and a post-cancellation win-back email 7 days after grace
 * period ends.
 *
 * Grace-period reminder schedule (days remaining):
 *   - 20 days left: heads-up with reinstatement offer
 *   -  7 days left: data export notice
 *   -  3 days left: final warning — automations will stop
 *
 * Post-cancellation:
 *   - 7 days after gracePeriodEnds: single "we would love to have you back" email
 *
 * All reminders are deduplicated via audit_log action keys so they fire at
 * most once per client per milestone, even if the cron runs multiple times
 * on the same day.
 *
 * Runs daily via the cron orchestrator.
 */

import { getDb } from '@/db';
import { clients, cancellationRequests, auditLog } from '@/db/schema';
import { eq, and, gt, lte, gte, isNotNull, inArray } from 'drizzle-orm';
import { sendEmail } from './resend';
import type { ValueSummary } from './cancellation';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CancellationReminderResult {
  processed: number;
  sent: number;
  errors: number;
  postCancellationSent: number;
}

// Audit action keys — one per milestone, unique per client per lifecycle
const AUDIT_ACTIONS = {
  gracePeriod20: 'cancellation_reminder_grace_20',
  gracePeriod7: 'cancellation_reminder_grace_7',
  gracePeriod3: 'cancellation_reminder_grace_3',
  winBack: 'cancellation_reminder_win_back',
} as const;

// ─────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────

export async function processCancellationReminders(): Promise<CancellationReminderResult> {
  const db = getDb();
  const result: CancellationReminderResult = {
    processed: 0,
    sent: 0,
    errors: 0,
    postCancellationSent: 0,
  };

  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

  // ─────────────────────────────────────────────────────────────
  // 1. Grace-period reminders — gracePeriodEnds is in the future
  // ─────────────────────────────────────────────────────────────

  const activeCancellations = await db
    .select({
      requestId: cancellationRequests.id,
      clientId: cancellationRequests.clientId,
      gracePeriodEnds: cancellationRequests.gracePeriodEnds,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
    })
    .from(cancellationRequests)
    .innerJoin(clients, eq(cancellationRequests.clientId, clients.id))
    .where(
      and(
        eq(cancellationRequests.status, 'pending'),
        isNotNull(cancellationRequests.gracePeriodEnds),
        gt(cancellationRequests.gracePeriodEnds, now)
      )
    );

  if (activeCancellations.length > 0) {
    const clientIds = activeCancellations.map((r) => r.clientId);

    // Bulk-fetch all cancellation audit events for these clients
    const existingLogs = await db
      .select({ clientId: auditLog.clientId, action: auditLog.action })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.clientId, clientIds),
          inArray(auditLog.action, Object.values(AUDIT_ACTIONS))
        )
      );

    // Build a Set of "clientId|action" strings for O(1) lookup
    const sentSet = new Set(existingLogs.map((row) => `${row.clientId}|${row.action}`));

    for (const req of activeCancellations) {
      result.processed++;

      const gracePeriodEnds = req.gracePeriodEnds!;
      const msLeft = gracePeriodEnds.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      // Determine which milestone applies today
      const milestone = resolveMilestone(daysLeft);
      if (!milestone) continue;

      const auditKey = `${req.clientId}|${milestone.auditAction}`;
      if (sentSet.has(auditKey)) continue; // already sent

      const email = formatGracePeriodEmail(
        req.businessName,
        req.ownerName,
        daysLeft,
        appUrl
      );

      const sent = await sendEmail({
        to: req.email,
        subject: email.subject,
        html: email.html,
      });

      if (sent.success) {
        result.sent++;
        // Record in audit_log so this milestone never fires again
        await db.insert(auditLog).values({
          clientId: req.clientId,
          action: milestone.auditAction,
          resourceType: 'cancellation_request',
          resourceId: req.requestId,
          metadata: { daysLeft, gracePeriodEnds: gracePeriodEnds.toISOString() },
          personId: null,
        });
      } else {
        result.errors++;
        console.error(`[CancellationReminder] Failed to send grace-period email to ${req.email}:`, sent.error);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Post-cancellation win-back — gracePeriodEnds was 7 days ago
  // ─────────────────────────────────────────────────────────────

  const winBackWindowStart = new Date(now);
  winBackWindowStart.setDate(winBackWindowStart.getDate() - 8);
  winBackWindowStart.setHours(0, 0, 0, 0);

  const winBackWindowEnd = new Date(now);
  winBackWindowEnd.setDate(winBackWindowEnd.getDate() - 7);
  winBackWindowEnd.setHours(23, 59, 59, 999);

  const expiredCancellations = await db
    .select({
      requestId: cancellationRequests.id,
      clientId: cancellationRequests.clientId,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
      valueShown: cancellationRequests.valueShown,
    })
    .from(cancellationRequests)
    .innerJoin(clients, eq(cancellationRequests.clientId, clients.id))
    .where(
      and(
        isNotNull(cancellationRequests.gracePeriodEnds),
        gte(cancellationRequests.gracePeriodEnds, winBackWindowStart),
        lte(cancellationRequests.gracePeriodEnds, winBackWindowEnd)
      )
    );

  if (expiredCancellations.length > 0) {
    const expiredClientIds = expiredCancellations.map((r) => r.clientId);

    const winBackLogs = await db
      .select({ clientId: auditLog.clientId })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.clientId, expiredClientIds),
          eq(auditLog.action, AUDIT_ACTIONS.winBack)
        )
      );

    const winBackSentIds = new Set(winBackLogs.map((r) => r.clientId));

    for (const req of expiredCancellations) {
      if (winBackSentIds.has(req.clientId)) continue; // already sent

      const valueSummary = req.valueShown != null
        ? (req.valueShown as unknown as ValueSummary)
        : null;
      const email = formatWinBackEmail(req.businessName, req.ownerName, appUrl, valueSummary);

      const sent = await sendEmail({
        to: req.email,
        subject: email.subject,
        html: email.html,
      });

      if (sent.success) {
        result.postCancellationSent++;
        await db.insert(auditLog).values({
          clientId: req.clientId,
          action: AUDIT_ACTIONS.winBack,
          resourceType: 'cancellation_request',
          resourceId: req.requestId,
          metadata: { sentAt: now.toISOString() },
          personId: null,
        });
      } else {
        result.errors++;
        console.error(`[CancellationReminder] Failed to send win-back email to ${req.email}:`, sent.error);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

interface Milestone {
  auditAction: string;
}

/**
 * Map a daysLeft value to the appropriate reminder milestone.
 * Returns null if no milestone applies today (e.g. daysLeft = 10).
 * Uses a 1-day window around each target so slight timing differences
 * don't cause a reminder to be skipped.
 */
function resolveMilestone(daysLeft: number): Milestone | null {
  if (daysLeft >= 19 && daysLeft <= 21) {
    return { auditAction: AUDIT_ACTIONS.gracePeriod20 };
  }
  if (daysLeft >= 6 && daysLeft <= 8) {
    return { auditAction: AUDIT_ACTIONS.gracePeriod7 };
  }
  if (daysLeft >= 2 && daysLeft <= 4) {
    return { auditAction: AUDIT_ACTIONS.gracePeriod3 };
  }
  return null;
}

function formatGracePeriodEmail(
  businessName: string,
  ownerName: string,
  daysLeft: number,
  appUrl: string
): { subject: string; html: string } {
  if (daysLeft <= 4) {
    // 3 days left — final warning
    return {
      subject: `${businessName} — Your ConversionSurgery service ends in ${daysLeft} days`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C15B2E;">Your service ends in ${daysLeft} days</h2>
          <p>Hi ${ownerName},</p>
          <p>Your ConversionSurgery service for <strong>${businessName}</strong> ends in ${daysLeft} days. All automations, missed call recovery, and lead follow-ups will stop at that point.</p>
          <p>If you would like to continue, contact us and we can reinstate your service immediately.</p>
          <a href="mailto:support@conversionsurgery.com" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Contact Us to Continue</a>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">If you have questions about your data, we will prepare a full export within 5 business days after your service ends.</p>
        </div>
      `,
    };
  }

  if (daysLeft <= 8) {
    // 7 days left — data export notice
    return {
      subject: `${businessName} — 7 days remaining on your ConversionSurgery service`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #D4754A;">7 days remaining on your service</h2>
          <p>Hi ${ownerName},</p>
          <p>Your ConversionSurgery service for <strong>${businessName}</strong> ends in ${daysLeft} days. Your data export will be prepared within 5 business days after your service ends.</p>
          <p>Changed your mind? Contact us to reinstate your service.</p>
          <a href="mailto:support@conversionsurgery.com" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Reinstate My Service</a>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email anytime with questions.</p>
        </div>
      `,
    };
  }

  // 20 days left — heads-up with reinstatement offer
  return {
    subject: `${businessName} — You have ${daysLeft} days remaining on your ConversionSurgery service`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">20 days remaining on your service</h2>
        <p>Hi ${ownerName},</p>
        <p>You have ${daysLeft} days remaining on your ConversionSurgery service for <strong>${businessName}</strong>.</p>
        <p>Changed your mind? Contact us to reinstate your service — we would be glad to have you back.</p>
        <a href="mailto:support@conversionsurgery.com" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Contact Us to Reinstate</a>
        <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">If you have questions, reply to this email anytime.</p>
      </div>
    `,
  };
}

function formatWinBackEmail(
  businessName: string,
  ownerName: string,
  appUrl: string,
  valueSummary: ValueSummary | null
): { subject: string; html: string } {
  // Build personalized stats block when valueShown data is available
  let statsHtml = '';
  if (
    valueSummary != null &&
    typeof valueSummary.monthsActive === 'number' &&
    typeof valueSummary.totalLeads === 'number' &&
    typeof valueSummary.totalMessages === 'number'
  ) {
    const { monthsActive, totalLeads, totalMessages, estimatedRevenue } = valueSummary;
    const monthLabel = monthsActive === 1 ? 'month' : 'months';

    const leadLine = `During your ${monthsActive} ${monthLabel} with us, we captured ${totalLeads.toLocaleString()} lead${totalLeads === 1 ? '' : 's'} and sent ${totalMessages.toLocaleString()} message${totalMessages === 1 ? '' : 's'} on your behalf.`;

    const revenueLine =
      typeof estimatedRevenue === 'number' && estimatedRevenue > 0
        ? `Your platform tracked $${estimatedRevenue.toLocaleString()} in confirmed revenue.`
        : null;

    const pipelineLine =
      typeof estimatedRevenue === 'number' && estimatedRevenue > 0
        ? 'Your pipeline activity suggests additional revenue that was not logged.'
        : null;

    statsHtml = `
      <div style="background: #F0F4EF; border-left: 4px solid #6B7E54; padding: 16px 20px; margin: 24px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0 0 8px; color: #1B2F26; font-size: 15px;">${leadLine}</p>
        ${revenueLine ? `<p style="margin: 0 0 8px; color: #1B2F26; font-size: 15px;">${revenueLine}</p>` : ''}
        ${pipelineLine ? `<p style="margin: 0; color: #6B7E54; font-size: 14px;">${pipelineLine}</p>` : ''}
      </div>`;
  }

  return {
    subject: `${businessName} — We would love to have you back`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">We would love to have you back</h2>
        <p>Hi ${ownerName},</p>
        <p>Your ConversionSurgery service for <strong>${businessName}</strong> has ended. We hope it made a difference while you were with us.</p>
        ${statsHtml}
        <p>If the timing wasn&apos;t right or anything could have been better, we are happy to talk. If you are ready to restart, sign up below and we will have everything running again within 24 hours.</p>
        <a href="${appUrl}/signup" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Restart My Service</a>
        <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email anytime — we are here.</p>
      </div>
    `,
  };
}
