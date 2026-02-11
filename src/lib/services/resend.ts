import { Resend } from 'resend';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/** Send an email via Resend. Accepts an options object `{ to, subject, html }`. */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">New Lead for ${data.businessName}</h2>
        <p><strong>Phone:</strong> ${data.leadPhone}</p>
        ${data.leadName ? `<p><strong>Name:</strong> ${data.leadName}</p>` : ''}
        <p><strong>Source:</strong> ${data.source}</p>
        <p style="color: #666;">We've sent an instant text response.</p>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View in Dashboard</a>
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Action Required</h2>
        <p><strong>${data.leadName || data.leadPhone}</strong> needs your response.</p>
        <p><strong>Reason:</strong> ${data.reason}</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #374151;"><strong>Their message:</strong></p>
          <p style="margin: 8px 0 0 0; color: #1f2937;">"${data.lastMessage}"</p>
        </div>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Respond Now</a>
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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Weekly Performance Summary</h2>
        <p style="color: #666;">${data.weekStart} — ${data.weekEnd}</p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Leads Captured</h3>
          <p style="margin: 8px 0;">📞 Missed Calls Recovered: <strong>${data.stats.missedCallsCaptured}</strong></p>
          <p style="margin: 8px 0;">📝 Forms Responded: <strong>${data.stats.formsResponded}</strong></p>
        </div>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Follow-ups Sent</h3>
          <p style="margin: 8px 0;">📅 Appointment Reminders: <strong>${data.stats.appointmentsReminded}</strong></p>
          <p style="margin: 8px 0;">💰 Estimate Follow-ups: <strong>${data.stats.estimatesFollowedUp}</strong></p>
          <p style="margin: 8px 0;">⭐ Review Requests: <strong>${data.stats.reviewsRequested}</strong></p>
          <p style="margin: 8px 0;">💵 Payment Reminders: <strong>${data.stats.paymentsReminded}</strong></p>
        </div>

        <p style="font-size: 18px;"><strong>Total Messages Sent:</strong> ${data.stats.totalMessages}</p>

        <a href="${data.dashboardUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">View Full Dashboard</a>
      </div>
    `,
  };
}
