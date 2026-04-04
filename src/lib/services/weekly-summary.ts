import { getDb, clients, dailyStats, escalationClaims, clientMemberships, people, leads } from '@/db';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { sendEmail } from '@/lib/services/resend';
import { createMagicLink } from '@/lib/services/magic-link';
import {
  calculateProbablePipelineValueCents,
  calculateConfirmedRevenueCents,
} from '@/lib/services/pipeline-value';

interface WeeklyStats {
  leadsCapture: number;
  messagesSent: number;
  appointmentsBooked: number;
  escalationsClaimed: number;
  topTeamMember: string | null;
  topTeamMemberClaims: number;
  probablePipelineValue: number; // dollars
  confirmedRevenue: number; // dollars
  needsAttentionCount: number; // unresolved escalations + action-required leads
}

/**
 * Retrieves weekly statistics for a client from the last 7 days.
 * @param clientId - The client UUID to fetch stats for
 * @returns Weekly statistics including leads, messages, appointments, and top team member
 */
export async function getWeeklyStats(clientId: string): Promise<WeeklyStats> {
  const db = getDb();
  const now = new Date();
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
      teamMemberName: people.name,
      claims: sql<number>`COUNT(*)`,
    })
    .from(escalationClaims)
    .innerJoin(clientMemberships, eq(escalationClaims.claimedBy, clientMemberships.id))
    .innerJoin(people, eq(clientMemberships.personId, people.id))
    .where(and(
      eq(escalationClaims.clientId, clientId),
      gte(escalationClaims.claimedAt, sevenDaysAgo)
    ))
    .groupBy(clientMemberships.id, people.name)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1);

  const topMember = escalationStats[0];

  // Count action-required leads for this client
  const [actionRequiredRow] = await db
    .select({ total: count(leads.id) })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.actionRequired, true)
    ));
  const actionRequiredCount = actionRequiredRow?.total ?? 0;

  // Count unresolved escalations (pending or claimed but not resolved)
  const [unresolvedEscalationsRow] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(escalationClaims)
    .where(and(
      eq(escalationClaims.clientId, clientId),
      sql`${escalationClaims.status} IN ('pending', 'claimed')`
    ));
  const unresolvedEscalationsCount = Number(unresolvedEscalationsRow?.total ?? 0);

  const needsAttentionCount = actionRequiredCount + unresolvedEscalationsCount;

  // Pipeline values for the last 7 days (cents → dollars)
  const probablePipelineValueCents = await calculateProbablePipelineValueCents(
    clientId,
    sevenDaysAgo,
    now
  );
  const confirmedRevenueCents = await calculateConfirmedRevenueCents(
    clientId,
    sevenDaysAgo,
    now
  );

  return {
    leadsCapture: Number(stats?.leadsCapture || 0),
    messagesSent: Number(stats?.messagesSent || 0),
    appointmentsBooked: Number(stats?.appointmentsBooked || 0),
    escalationsClaimed: Number(topMember?.claims || 0),
    topTeamMember: topMember?.teamMemberName || null,
    topTeamMemberClaims: Number(topMember?.claims || 0),
    probablePipelineValue: Math.round(probablePipelineValueCents / 100),
    confirmedRevenue: Math.round(confirmedRevenueCents / 100),
    needsAttentionCount,
  };
}

/**
 * Formats a dollar value as a compact string: $XK (rounded to 1 decimal) or $X if < $1000.
 */
function formatDollarsCompact(dollars: number): string {
  if (dollars < 1000) {
    return `$${dollars}`;
  }
  const k = Math.round((dollars / 1000) * 10) / 10;
  return `$${k}K`;
}

/**
 * Formats weekly statistics into an SMS message for clients.
 * Stays under 320 characters.
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
  message += `${stats.leadsCapture} leads captured | ${stats.appointmentsBooked} appointments\n`;

  const hasPipelineData = stats.probablePipelineValue > 0 || stats.confirmedRevenue > 0;
  if (hasPipelineData) {
    message += `Pipeline: ${formatDollarsCompact(stats.probablePipelineValue)} probable | ${formatDollarsCompact(stats.confirmedRevenue)} confirmed\n`;
  }

  if (stats.needsAttentionCount > 0) {
    message += `${stats.needsAttentionCount} leads need attention\n`;
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

  const hasPipelineData = stats.probablePipelineValue > 0 || stats.confirmedRevenue > 0;

  const pipelineSection = hasPipelineData ? `
        <h3>PIPELINE VALUE</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;">
              <span style="color: #6b6762; font-size: 13px;">PROBABLE</span><br />
              <span style="font-size: 22px; font-weight: bold;">${formatDollarsCompact(stats.probablePipelineValue)}</span>
            </td>
            <td style="padding: 8px 0;">
              <span style="color: #6b6762; font-size: 13px;">CONFIRMED</span><br />
              <span style="font-size: 22px; font-weight: bold;">${formatDollarsCompact(stats.confirmedRevenue)}</span>
            </td>
          </tr>
        </table>
  ` : '';

  const attentionSection = stats.needsAttentionCount > 0 ? `
      <div style="background: #FFF3E0; border-left: 4px solid #C15B2E; padding: 12px 16px; border-radius: 4px; margin: 16px 0;">
        <strong>${stats.needsAttentionCount} lead${stats.needsAttentionCount === 1 ? '' : 's'} need${stats.needsAttentionCount === 1 ? 's' : ''} attention</strong> &mdash;
        <a href="${dashboardLink}" style="color: #C15B2E;">Review now</a>
      </div>
  ` : '';

  const html = `
    <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${ownerName},</h2>

      <p>Here&apos;s what happened at <strong>${businessName}</strong> this week:</p>

      <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">LEADS CAPTURED</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.leadsCapture}</p>

        <h3>MESSAGES SENT</h3>
        <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.messagesSent}</p>

        ${stats.appointmentsBooked > 0 ? `
          <h3>APPOINTMENTS</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 0;">${stats.appointmentsBooked}</p>
        ` : ''}

        ${pipelineSection}
      </div>

      ${attentionSection}

      ${stats.topTeamMember ? `
        <p><strong>Top performer:</strong> ${stats.topTeamMember} claimed ${stats.topTeamMemberClaims} leads</p>
      ` : ''}

      <p>
        <a href="${dashboardLink}" style="display: inline-block; background: #6B7E54; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Full Dashboard
        </a>
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />

      <p style="color: #6b6762; font-size: 14px;">
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
    await sendSMS(client.phone, smsContent, client.twilioNumber);
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
