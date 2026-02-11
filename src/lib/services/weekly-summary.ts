import { getDb, clients, dailyStats, escalationClaims, teamMembers } from '@/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail } from '@/lib/services/resend';
import { createMagicLink } from '@/lib/services/magic-link';

interface WeeklyStats {
  leadsCapture: number;
  messagesSent: number;
  appointmentsBooked: number;
  escalationsClaimed: number;
  topTeamMember: string | null;
  topTeamMemberClaims: number;
}

/**
 * Retrieves weekly statistics for a client from the last 7 days.
 * @param clientId - The client UUID to fetch stats for
 * @returns Weekly statistics including leads, messages, appointments, and top team member
 */
export async function getWeeklyStats(clientId: string): Promise<WeeklyStats> {
  const db = getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [stats] = await db
    .select({
      leadsCapture: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
      appointmentsBooked: sql<number>`COALESCE(SUM(${dailyStats.appointmentsReminded}), 0)`,
    })
    .from(dailyStats)
    .where(and(
      eq(dailyStats.clientId, clientId),
      gte(dailyStats.date, sevenDaysAgo.toISOString().split('T')[0])
    ));

  // Get top escalation claimer
  const escalationStats = await db
    .select({
      teamMemberName: teamMembers.name,
      claims: sql<number>`COUNT(*)`,
    })
    .from(escalationClaims)
    .innerJoin(teamMembers, eq(escalationClaims.claimedBy, teamMembers.id))
    .where(and(
      eq(escalationClaims.clientId, clientId),
      gte(escalationClaims.claimedAt, sevenDaysAgo)
    ))
    .groupBy(teamMembers.id, teamMembers.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1);

  const topMember = escalationStats[0];

  return {
    leadsCapture: Number(stats?.leadsCapture || 0),
    messagesSent: Number(stats?.messagesSent || 0),
    appointmentsBooked: Number(stats?.appointmentsBooked || 0),
    escalationsClaimed: Number(topMember?.claims || 0),
    topTeamMember: topMember?.teamMemberName || null,
    topTeamMemberClaims: Number(topMember?.claims || 0),
  };
}

/**
 * Formats weekly statistics into an SMS message for clients.
 * @param businessName - The client's business name
 * @param stats - Weekly statistics to include in the message
 * @param dashboardLink - Magic link URL to the dashboard
 * @returns Formatted SMS message string
 */
export function formatWeeklySMS(
  businessName: string,
  stats: WeeklyStats,
  dashboardLink: string
): string {
  let message = `Weekly Recap for ${businessName}\n\n`;
  message += `${stats.leadsCapture} leads captured\n`;
  message += `${stats.messagesSent} messages sent\n`;

  if (stats.appointmentsBooked > 0) {
    message += `${stats.appointmentsBooked} appointments\n`;
  }

  if (stats.topTeamMember) {
    message += `\nTop: ${stats.topTeamMember} (${stats.topTeamMemberClaims} claims)\n`;
  }

  message += `\nFull stats: ${dashboardLink}`;

  return message;
}

/**
 * Formats weekly statistics into an HTML email for clients.
 * @param businessName - The client's business name
 * @param ownerName - The client owner's name for personalization
 * @param stats - Weekly statistics to include in the email
 * @param dashboardLink - Magic link URL to the dashboard
 * @returns Object containing email subject and HTML body
 */
export function formatWeeklyEmail(
  businessName: string,
  ownerName: string,
  stats: WeeklyStats,
  dashboardLink: string
): { subject: string; html: string } {
  const subject = `Your Week with ConversionSurgery - ${stats.leadsCapture} Leads Captured`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${ownerName},</h2>

      <p>Here's what happened at <strong>${businessName}</strong> this week:</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">LEADS CAPTURED</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.leadsCapture}</p>

        <h3>MESSAGES SENT</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.messagesSent}</p>

        ${stats.appointmentsBooked > 0 ? `
          <h3>APPOINTMENTS</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.appointmentsBooked}</p>
        ` : ''}
      </div>

      ${stats.topTeamMember ? `
        <p><strong>Top performer:</strong> ${stats.topTeamMember} claimed ${stats.topTeamMemberClaims} leads</p>
      ` : ''}

      <p>
        <a href="${dashboardLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Full Dashboard
        </a>
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <p style="color: #666; font-size: 14px;">
        Questions? Reply to this email or text us anytime.
      </p>
    </div>
  `;

  return { subject, html };
}

/**
 * Sends weekly summary via SMS and email to a single client.
 * @param clientId - The client UUID to send the summary to
 */
export async function sendWeeklySummary(clientId: string): Promise<void> {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client || !client.weeklySummaryEnabled) return;

  const stats = await getWeeklyStats(clientId);
  const dashboardLink = await createMagicLink(clientId);

  // Send SMS
  if (client.phone && client.twilioNumber) {
    const smsContent = formatWeeklySMS(client.businessName, stats, dashboardLink);
    await sendSMS(client.phone, client.twilioNumber, smsContent);
  }

  // Send Email
  if (client.email) {
    const emailContent = formatWeeklyEmail(
      client.businessName,
      client.ownerName,
      stats,
      dashboardLink
    );
    await sendEmail({ to: client.email, subject: emailContent.subject, html: emailContent.html });
  }

  // Update last sent
  await db
    .update(clients)
    .set({ lastWeeklySummaryAt: new Date() })
    .where(eq(clients.id, clientId));
}

/**
 * Processes weekly summaries for all eligible clients based on their schedule.
 * Checks day of week, time of day, and last sent timestamp.
 * @returns Number of summaries successfully sent
 */
export async function processWeeklySummaries(): Promise<number> {
  const db = getDb();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentHour = now.getHours();

  // Find clients who should receive summary now
  const eligibleClients = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.status, 'active'),
      eq(clients.weeklySummaryEnabled, true),
      eq(clients.weeklySummaryDay, dayOfWeek)
    ));

  let sent = 0;
  for (const client of eligibleClients) {
    const summaryTime = client.weeklySummaryTime || '08:00';
    const summaryHour = parseInt(summaryTime.split(':')[0]);

    // Check if it's the right hour
    if (summaryHour !== currentHour) continue;

    // Check if already sent this week
    if (client.lastWeeklySummaryAt) {
      const lastSent = new Date(client.lastWeeklySummaryAt);
      const daysSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 6) continue;
    }

    try {
      await sendWeeklySummary(client.id);
      sent++;
    } catch (error) {
      console.error(`[WeeklySummary] Failed to send weekly summary to ${client.id}:`, error);
    }
  }

  return sent;
}
