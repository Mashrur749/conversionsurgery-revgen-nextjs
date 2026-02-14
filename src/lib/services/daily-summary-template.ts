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
        <a href="${appUrl}/leads/${lead.id}" style="color: #2563eb; text-decoration: none;">
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">

  <div style="background: #2563eb; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">Good morning, ${ownerName}!</h2>
    <p style="margin: 4px 0 0; opacity: 0.9; font-size: 14px;">Here's your daily update for ${businessName}</p>
  </div>

  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">

    <!-- Today's Snapshot -->
    <h3 style="margin: 0 0 16px; font-size: 16px; color: #111;">Yesterday's Snapshot</h3>
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #f0f9ff; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${stats.newLeads}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">New Leads</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${stats.messagesSent}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Messages Sent</div>
      </div>
      <div style="flex: 1; background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #d97706;">${stats.appointmentsBooked}</div>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Appointments</div>
      </div>
    </div>

    <table style="width: 100%; font-size: 13px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 4px 0; color: #666;">Messages received</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.messagesReceived}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #666;">Missed calls captured</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 600;">${stats.missedCalls}</td>
      </tr>
    </table>

    ${needsAttention.length > 0 ? `
    <!-- Leads Needing Attention -->
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 14px; color: #dc2626;">Leads Needing Attention (${needsAttention.length})</h3>
      <p style="font-size: 13px; color: #666; margin: 0 0 8px;">No response in 2+ hours</p>
      <table style="width: 100%; font-size: 13px;">
        ${attentionRows}
      </table>
    </div>
    ` : ''}

    ${todayAppointments.length > 0 ? `
    <!-- Today's Appointments -->
    <h3 style="margin: 0 0 12px; font-size: 14px; color: #111;">Today's Appointments (${todayAppointments.length})</h3>
    <table style="width: 100%; font-size: 13px; margin-bottom: 24px; border-collapse: collapse;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #666;">Time</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #666;">Customer</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #666;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${appointmentRows}
      </tbody>
    </table>
    ` : ''}

    <div style="text-align: center; margin-top: 24px;">
      <a href="${dashboardLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Dashboard
      </a>
    </div>

  </div>

  <p style="text-align: center; color: #999; font-size: 12px; margin-top: 16px;">
    You're receiving this because daily email summaries are enabled.
    <br>Manage in Settings > Notifications.
  </p>

</body>
</html>
`;

  return { subject, html };
}
