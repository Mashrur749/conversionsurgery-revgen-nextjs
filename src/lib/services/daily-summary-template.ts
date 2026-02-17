import { formatPhoneNumber } from '@/lib/utils/phone';

interface DailyStats {
  newLeads: number;
  messagesSent: number;
  messagesReceived: number;
  appointmentsBooked: number;
  missedCalls: number;
}

interface LeadNeedingAttention {
  id: string;
  name: string | null;
  phone: string;
  lastMessageAt: Date | null;
}

interface TodayAppointment {
  leadName: string | null;
  leadPhone: string;
  time: string;
  status: string | null;
}

export function formatDailySummaryEmail(
  businessName: string,
  ownerName: string,
  stats: DailyStats,
  needsAttention: LeadNeedingAttention[],
  todayAppointments: TodayAppointment[],
  dashboardLink: string
): { subject: string; html: string } {
  const subject = `Daily Update: ${stats.newLeads} new lead${stats.newLeads !== 1 ? 's' : ''} — ${businessName}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  const attentionRows = needsAttention.map((lead) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        <a href="${appUrl}/leads/${lead.id}" style="color: #1B2F26; text-decoration: none;">
          ${lead.name || formatPhoneNumber(lead.phone)}
        </a>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        ${formatPhoneNumber(lead.phone)}
      </td>
    </tr>
  `).join('');

  const appointmentRows = todayAppointments.map((appt) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        ${appt.time}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        ${appt.leadName || formatPhoneNumber(appt.leadPhone)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
        ${appt.status || 'scheduled'}
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">

  <div style="background: #6B7E54; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">Good morning, ${ownerName}!</h2>
    <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Here's your daily update for ${businessName}</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">

    <!-- Today's Snapshot -->
    <h3 style="margin: 0 0 16px; font-size: 16px; color: #1B2F26;">Yesterday's Snapshot</h3>
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #e3e9e1; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #1B2F26;">${stats.newLeads}</div>
        <div style="font-size: 12px; color: #6b6762; margin-top: 4px;">New Leads</div>
      </div>
      <div style="flex: 1; background: #E8F5E9; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #3D7A50;">${stats.messagesSent}</div>
        <div style="font-size: 12px; color: #6b6762; margin-top: 4px;">Messages Sent</div>
      </div>
      <div style="flex: 1; background: #FFF3E0; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #D4754A;">${stats.appointmentsBooked}</div>
        <div style="font-size: 12px; color: #6b6762; margin-top: 4px;">Appointments</div>
      </div>
    </div>

    <table style="width: 100%; font-size: 13px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 4px 0; color: #6b6762;">Messages received</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.messagesReceived}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #6b6762;">Missed calls captured</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.missedCalls}</td>
      </tr>
    </table>

    ${needsAttention.length > 0 ? `
    <!-- Leads Needing Attention -->
    <div style="background: #FDEAE4; border: 1px solid #C15B2E40; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #C15B2E;">Leads Needing Attention (${needsAttention.length})</h3>
      <p style="font-size: 13px; color: #6b6762; margin: 0 0 8px;">No response in 2+ hours</p>
      <table style="width: 100%; font-size: 13px;">
        ${attentionRows}
      </table>
    </div>
    ` : ''}

    ${todayAppointments.length > 0 ? `
    <!-- Today's Appointments -->
    <h3 style="margin: 0 0 12px; font-size: 14px; color: #1B2F26;">Today's Appointments (${todayAppointments.length})</h3>
    <table style="width: 100%; font-size: 13px; margin-bottom: 24px; border-collapse: collapse;">
      <thead>
        <tr style="background: #F8F9FA;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b6762;">Time</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b6762;">Customer</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b6762;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${appointmentRows}
      </tbody>
    </table>
    ` : ''}

    <div style="text-align: center; margin-top: 24px;">
      <a href="${dashboardLink}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Dashboard
      </a>
    </div>

  </div>

  <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
    You're receiving this because daily email summaries are enabled.
    <br>Manage in Settings > Notifications.
  </p>

</body>
</html>
`;

  return { subject, html };
}
