import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: unknown;
}

/**
 * Send an email via Resend
 * @param options - Email options: to, subject, html
 * @returns Result with success status and optional message ID
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Resend] RESEND_API_KEY is not set');
    return { success: false, error: 'Email service not configured' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error('[Resend] API error:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('[Resend] Send failed:', error instanceof Error ? error.message : error);
    return { success: false, error };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/** Generate a new lead notification email. Returns `{ subject, html }`. */
export function newLeadEmail(data: {
  businessName: string;
  leadPhone: string;
  leadName?: string;
  source: string;
  dashboardUrl: string;
}) {
  return {
    subject: `New Lead — ${data.leadName || data.leadPhone}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">New Lead for ${data.businessName}</h2>
        <p><strong>Phone:</strong> ${data.leadPhone}</p>
        ${data.leadName ? `<p><strong>Name:</strong> ${data.leadName}</p>` : ''}
        <p><strong>Source:</strong> ${data.source}</p>
        <p style="color: #6b6762;">We've sent an instant text response.</p>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View in Dashboard</a>
      </div>
    `,
  };
}

/** Generate an action-required escalation email. Returns `{ subject, html }`. */
export function actionRequiredEmail(data: {
  businessName: string;
  leadName?: string;
  leadPhone: string;
  reason: string;
  lastMessage: string;
  dashboardUrl: string;
}) {
  return {
    subject: `⚠️ Action Required — ${data.leadName || data.leadPhone}`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #C15B2E;">⚠️ Action Required</h2>
        <p><strong>${data.leadName || data.leadPhone}</strong> needs your response.</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
        <div style="background: #F8F9FA; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #1B2F26;"><strong>Their message:</strong></p>
          <p style="margin: 8px 0 0 0; color: #1B2F26;">"${data.lastMessage}"</p>
        </div>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #C15B2E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Respond Now</a>
      </div>
    `,
  };
}

/** Generate an onboarding welcome email for new clients. Returns `{ subject, html }`. */
export function onboardingWelcomeEmail(data: {
  ownerName: string;
  businessName: string;
  loginUrl: string;
}) {
  return {
    subject: `Welcome to ConversionSurgery — ${data.businessName} is Live!`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">Welcome, ${data.ownerName}!</h2>
        <p>Your account for <strong>${data.businessName}</strong> is now active on ConversionSurgery.</p>
        <p>Here's what we're handling for you:</p>
        <ul style="color: #1B2F26; line-height: 1.8;">
          <li>Missed call recovery — instant text to every caller</li>
          <li>Lead follow-ups — automated sequences that book appointments</li>
          <li>Review requests — grow your Google reviews on autopilot</li>
          <li>Weekly performance digests — know exactly what's working</li>
        </ul>
        <a href="${data.loginUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Log In to Your Dashboard</a>
        <p style="color: #9ca3af; margin-top: 24px; font-size: 14px;">Reply to this email or text us anytime for support.</p>
      </div>
    `,
  };
}

/** Generate an agency weekly digest email. Returns `{ subject, html }`. */
export function agencyWeeklyDigestEmail(data: {
  ownerName: string;
  businessName: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    totalLeads: number;
    totalMessages: number;
    totalAppointments: number;
    conversionRate: string;
    missedCalls: number;
    formsResponded: number;
    estimatesFollowed: number;
    reviewsRequested: number;
  };
  trend: string;
  hasActionItems: boolean;
  dashboardUrl: string;
}) {
  const actionSection = data.hasActionItems
    ? `<div style="background: #FFF3E0; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4754A;">
        <p style="margin: 0; color: #C15B2E; font-weight: 600;">Action Needed</p>
        <p style="margin: 8px 0 0 0; color: #C15B2E;">You have leads without automated follow-up sequences. Reply YES to the SMS we sent to start them.</p>
      </div>`
    : '';

  return {
    subject: `${data.businessName} — Weekly Digest (${data.weekStart} - ${data.weekEnd})`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">Weekly Performance Digest</h2>
        <p style="color: #6b6762;">${data.weekStart} — ${data.weekEnd} for ${data.businessName}</p>

        <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1B2F26;">Overview</h3>
          <p style="margin: 8px 0;">Leads captured: <strong>${data.stats.totalLeads}</strong>${data.trend}</p>
          <p style="margin: 8px 0;">Messages sent: <strong>${data.stats.totalMessages}</strong></p>
          <p style="margin: 8px 0;">Appointments: <strong>${data.stats.totalAppointments}</strong></p>
          <p style="margin: 8px 0;">Conversion rate: <strong>${data.stats.conversionRate}%</strong></p>
        </div>

        <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1B2F26;">Breakdown</h3>
          <p style="margin: 8px 0;">Missed calls recovered: <strong>${data.stats.missedCalls}</strong></p>
          <p style="margin: 8px 0;">Forms responded: <strong>${data.stats.formsResponded}</strong></p>
          <p style="margin: 8px 0;">Estimate follow-ups: <strong>${data.stats.estimatesFollowed}</strong></p>
          <p style="margin: 8px 0;">Review requests: <strong>${data.stats.reviewsRequested}</strong></p>
        </div>

        ${actionSection}

        <a href="${data.dashboardUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Full Dashboard</a>
      </div>
    `,
  };
}

/** Generate a weekly summary email. Returns `{ subject, html }`. */
export function weeklySummaryEmail(data: {
  businessName: string;
  weekStart: string;
  weekEnd: string;
  stats: {
    missedCallsCaptured: number;
    formsResponded: number;
    appointmentsReminded: number;
    estimatesFollowedUp: number;
    reviewsRequested: number;
    paymentsReminded: number;
    totalMessages: number;
  };
  dashboardUrl: string;
}) {
  return {
    subject: `${data.businessName} — Weekly Summary (${data.weekStart} - ${data.weekEnd})`,
    html: `
      <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1B2F26;">Weekly Performance Summary</h2>
        <p style="color: #6b6762;">${data.weekStart} — ${data.weekEnd}</p>

        <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1B2F26;">Leads Captured</h3>
          <p style="margin: 8px 0;">📞 Missed Calls Recovered: <strong>${data.stats.missedCallsCaptured}</strong></p>
          <p style="margin: 8px 0;">📝 Forms Responded: <strong>${data.stats.formsResponded}</strong></p>
        </div>

        <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1B2F26;">Follow-ups Sent</h3>
          <p style="margin: 8px 0;">📅 Appointment Reminders: <strong>${data.stats.appointmentsReminded}</strong></p>
          <p style="margin: 8px 0;">💰 Estimate Follow-ups: <strong>${data.stats.estimatesFollowedUp}</strong></p>
          <p style="margin: 8px 0;">⭐ Review Requests: <strong>${data.stats.reviewsRequested}</strong></p>
          <p style="margin: 8px 0;">💵 Payment Reminders: <strong>${data.stats.paymentsReminded}</strong></p>
        </div>

        <p style="font-size: 18px;"><strong>Total Messages Sent:</strong> ${data.stats.totalMessages}</p>

        <a href="${data.dashboardUrl}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Full Dashboard</a>
      </div>
    `,
  };
}
