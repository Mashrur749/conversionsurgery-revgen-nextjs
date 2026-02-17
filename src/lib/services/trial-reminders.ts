/**
 * Trial Reminders Service
 *
 * Sends reminder emails to clients approaching the end of their trial.
 * Triggered daily by cron. Sends at day 7, 12, and 14 (last day) of a 14-day trial.
 *
 * Uses createdAt as trial start — no schema change needed.
 */

import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sendEmail } from './resend';

const TRIAL_DAYS = 14;
const REMINDER_DAYS = [7, 12, 14]; // days since createdAt

interface TrialReminderResult {
  processed: number;
  sent: number;
  errors: number;
}

/** Process all trial reminders for today. */
export async function processTrialReminders(): Promise<TrialReminderResult> {
  const db = getDb();
  const result: TrialReminderResult = { processed: 0, sent: 0, errors: 0 };

  // Find active clients — trial status is implicit: created within last 14 days
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
        console.error(`[TrialReminder] Failed to send to ${client.email}:`, sent.error);
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
    // Last day — trial expiring today
    return {
      subject: `${businessName} — Your trial ends today`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #C15B2E;">Your trial ends today</h2>
          <p>Hi ${ownerName},</p>
          <p>Your 14-day trial of ConversionSurgery for <strong>${businessName}</strong> ends today.</p>
          <p>To keep your missed call recovery, automated follow-ups, and lead management running, upgrade to a paid plan.</p>
          <a href="${appUrl}/client/billing" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Upgrade Now</a>
          <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">If you've already upgraded, you can ignore this email.</p>
        </div>
      `,
    };
  }

  if (daysLeft <= 2) {
    // Urgency reminder (day 12)
    return {
      subject: `${businessName} — ${daysLeft} days left in your trial`,
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #D4754A;">${daysLeft} days left in your trial</h2>
          <p>Hi ${ownerName},</p>
          <p>Your ConversionSurgery trial for <strong>${businessName}</strong> ends in ${daysLeft} days.</p>
          <p>So far, we've been handling your missed calls, following up with leads, and booking appointments automatically. Don't lose that momentum.</p>
          <a href="${appUrl}/client/billing" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Plans</a>
        </div>
      `,
    };
  }

  // Mid-trial check-in (day 7)
  return {
    subject: `${businessName} — How's your first week going?`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">One week in!</h2>
        <p>Hi ${ownerName},</p>
        <p>You've been using ConversionSurgery for <strong>${businessName}</strong> for ${dayNumber} days. Here's a quick reminder of what's running for you:</p>
        <ul style="color: #1B2F26; line-height: 1.8;">
          <li>Missed call recovery — instant text to every missed caller</li>
          <li>AI-powered lead follow-ups</li>
          <li>Automated appointment booking</li>
          <li>Weekly performance reports</li>
        </ul>
        <p>You have <strong>${daysLeft} days</strong> left in your trial.</p>
        <a href="${appUrl}/client" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Your Dashboard</a>
        <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email anytime — we're here to help.</p>
      </div>
    `,
  };
}
