/**
 * Trial Reminders Service
 *
 * Sends reminder emails (and SMS for critical days) to clients approaching
 * the end of their free month. Triggered daily by cron.
 *
 * Schedule: day 7 (week 1 check-in), day 14 (two-week milestone),
 * day 25 (5 days left), day 28 (urgent — 3 days left), day 30 (last day).
 *
 * Uses createdAt as trial start — no schema change needed.
 */

import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sendEmail } from './resend';

const TRIAL_DAYS = 30;
const REMINDER_DAYS = [7, 14, 25, 28, 30]; // days since createdAt

interface TrialReminderResult {
  processed: number;
  sent: number;
  errors: number;
}

/** Process all trial reminders for today. */
export async function processTrialReminders(): Promise<TrialReminderResult> {
  const db = getDb();
  const result: TrialReminderResult = { processed: 0, sent: 0, errors: 0 };

  // Find active clients — trial status is implicit: created within last 30 days
  // For each reminder day, find clients whose createdAt falls on that day
  for (const dayNumber of REMINDER_DAYS) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayNumber);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const trialClients = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.status, 'active'),
        gte(clients.createdAt, dayStart),
        lte(clients.createdAt, dayEnd)
      ));

    for (const client of trialClients) {
      result.processed++;
      const daysLeft = TRIAL_DAYS - dayNumber;
      const email = formatTrialEmail(client.businessName, client.ownerName, daysLeft, dayNumber);

      const sent = await sendEmail({
        to: client.email,
        subject: email.subject,
        html: email.html,
      });

      if (sent.success) {
        result.sent++;
      } else {
        result.errors++;
        console.error(`[TrialReminder] Failed to send email to ${client.email}:`, sent.error);
      }

      // SMS for critical reminder days (28 and 30)
      if (dayNumber >= 28) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';
        try {
          const { sendAlert } = await import('@/lib/services/agency-communication');
          await sendAlert({
            clientId: client.id,
            message: daysLeft === 0
              ? `${client.businessName}: Your free month ends today. Set up payment to keep your leads flowing: ${appUrl}/client/billing`
              : `${client.businessName}: ${daysLeft} days left in your free month. Set up payment: ${appUrl}/client/billing`,
          });
        } catch { /* fire-and-forget */ }
      }
    }
  }

  return result;
}

function formatTrialEmail(
  businessName: string,
  ownerName: string,
  daysLeft: number,
  dayNumber: number
): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

  if (daysLeft === 0) {
    // Day 30 — last day of free month
    return {
      subject: `${businessName} — Your free month ends today`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C15B2E;">Your free month ends today</h2>
          <p>Hi ${ownerName},</p>
          <p>Your free month of ConversionSurgery for <strong>${businessName}</strong> ends today.</p>
          <p>To keep your missed call recovery, automated follow-ups, and lead management running, set up a payment method to continue without interruption.</p>
          <a href="${appUrl}/client/billing" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Set Up Payment</a>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">If you have already set up payment, you can ignore this email.</p>
        </div>
      `,
    };
  }

  if (daysLeft <= 5) {
    // Day 25 (5 days left) or Day 28 (3 days left) — urgency reminders
    const isUrgent = daysLeft <= 3;
    return {
      subject: `${businessName} — ${daysLeft} days left in your free month`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #D4754A;">${daysLeft} days left in your free month</h2>
          <p>Hi ${ownerName},</p>
          <p>Your ConversionSurgery free month for <strong>${businessName}</strong> ends in ${daysLeft} days.</p>
          ${isUrgent
            ? `<p>Set up payment now to keep your service running without interruption. Your automations, lead follow-ups, and missed call recovery will continue seamlessly.</p>`
            : `<p>So far, we have been handling your missed calls, following up with leads, and booking appointments automatically. Set up payment to keep that momentum going after your free month.</p>`
          }
          <a href="${appUrl}/client/billing" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Set Up Payment</a>
        </div>
      `,
    };
  }

  if (dayNumber === 14) {
    // Two-week milestone
    return {
      subject: `${businessName} — Two weeks into your free month`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B2F26;">Two weeks in</h2>
          <p>Hi ${ownerName},</p>
          <p>You are halfway through your free month of ConversionSurgery for <strong>${businessName}</strong>. Here is a quick summary of what has been running for you:</p>
          <ul style="color: #1B2F26; line-height: 1.8;">
            <li>Missed call recovery — instant text to every missed caller</li>
            <li>AI-powered lead follow-ups</li>
            <li>Automated appointment booking</li>
            <li>Weekly performance reports</li>
          </ul>
          <p>You have <strong>${daysLeft} days</strong> left in your free month. Billing starts on day 31.</p>
          <a href="${appUrl}/client" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Your Dashboard</a>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email anytime — we are here to help.</p>
        </div>
      `,
    };
  }

  // Day 7 — mid-trial check-in
  return {
    subject: `${businessName} — How is your first week going?`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">One week in!</h2>
        <p>Hi ${ownerName},</p>
        <p>You have been using ConversionSurgery for <strong>${businessName}</strong> for ${dayNumber} days. Here is a quick reminder of what is running for you:</p>
        <ul style="color: #1B2F26; line-height: 1.8;">
          <li>Missed call recovery — instant text to every missed caller</li>
          <li>AI-powered lead follow-ups</li>
          <li>Automated appointment booking</li>
          <li>Weekly performance reports</li>
        </ul>
        <p>You have <strong>${daysLeft} days</strong> left in your free month. Billing starts on day 31.</p>
        <a href="${appUrl}/client" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Your Dashboard</a>
        <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email anytime — we are here to help.</p>
      </div>
    `,
  };
}
