import { getDb } from '@/db';
import { clients, leads, appointments, flowExecutions } from '@/db/schema';
import { eq, and, gte, sql, ne, count as countFn } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { getAgency } from '@/lib/services/agency-settings';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/** How many consecutive zero-activity weeks before switching to monthly reassurance. */
const SLOW_PERIOD_THRESHOLD = 3;

interface DigestStats {
  newLeads: number;
  appointmentsBooked: number;
  estimatesInFollowUp: number;
  jobsWonThisWeek: number;
  revenueWonThisWeek: number; // cents
  jobsToCloseOut: number;
}

interface DigestResult {
  clientId: string;
  businessName: string;
  action: 'sent' | 'skipped_onboarding' | 'skipped_disabled' | 'skipped_inactive' | 'skipped_biweekly' | 'skipped_monthly_not_due' | 'error';
  message?: string;
}

/**
 * Compute weekly activity stats for a client.
 */
async function getWeeklyStats(clientId: string): Promise<DigestStats> {
  const db = getDb();
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [newLeadsRow] = await db
    .select({ count: countFn() })
    .from(leads)
    .where(and(eq(leads.clientId, clientId), gte(leads.createdAt, oneWeekAgo)));

  const [appointmentsRow] = await db
    .select({ count: countFn() })
    .from(appointments)
    .where(and(
      eq(appointments.clientId, clientId),
      ne(appointments.status, 'cancelled'),
      gte(appointments.createdAt, oneWeekAgo)
    ));

  const [followUpsRow] = await db
    .select({ count: countFn() })
    .from(flowExecutions)
    .where(and(eq(flowExecutions.clientId, clientId), eq(flowExecutions.status, 'active')));

  const [wonRow] = await db
    .select({
      count: countFn(),
      revenue: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
    })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.status, 'won'),
      gte(leads.updatedAt, oneWeekAgo)
    ));

  // Jobs to close out: status = 'won' but not 'completed'
  const [closeOutRow] = await db
    .select({ count: countFn() })
    .from(leads)
    .where(and(
      eq(leads.clientId, clientId),
      eq(leads.status, 'won')
    ));

  return {
    newLeads: Number(newLeadsRow?.count ?? 0),
    appointmentsBooked: Number(appointmentsRow?.count ?? 0),
    estimatesInFollowUp: Number(followUpsRow?.count ?? 0),
    jobsWonThisWeek: Number(wonRow?.count ?? 0),
    revenueWonThisWeek: Number(wonRow?.revenue ?? 0),
    jobsToCloseOut: Number(closeOutRow?.count ?? 0),
  };
}

/**
 * Build the SMS message based on activity level.
 */
function buildDigestMessage(
  ownerName: string,
  stats: DigestStats,
  consecutiveZeroWeeks: number
): { body: string; type: 'active' | 'quiet' | 'reassurance' } {
  const firstName = ownerName.split(' ')[0];
  const hasActivity = stats.newLeads > 0 || stats.appointmentsBooked > 0;

  // Slow period reassurance (3+ weeks zero new leads)
  if (consecutiveZeroWeeks >= SLOW_PERIOD_THRESHOLD) {
    return {
      body: `Hey ${firstName}, leads have been slow this month. Your AI is still responding instantly to every inquiry. When volume picks back up, you won't miss a beat.`,
      type: 'reassurance',
    };
  }

  // Quiet week (no new leads but has active follow-ups)
  if (!hasActivity && stats.estimatesInFollowUp > 0) {
    return {
      body: `Hey ${firstName}, quiet week for new leads — ${stats.estimatesInFollowUp} ${stats.estimatesInFollowUp === 1 ? 'estimate' : 'estimates'} still being followed up automatically. The system is ready when leads come in.`,
      type: 'quiet',
    };
  }

  // Active week — build full digest
  const parts: string[] = [`Hey ${firstName}, your week:`];

  if (stats.newLeads > 0) {
    parts.push(`${stats.newLeads} new ${stats.newLeads === 1 ? 'lead' : 'leads'}`);
  }
  if (stats.appointmentsBooked > 0) {
    parts.push(`${stats.appointmentsBooked} ${stats.appointmentsBooked === 1 ? 'appointment' : 'appointments'} booked`);
  }
  if (stats.estimatesInFollowUp > 0) {
    parts.push(`${stats.estimatesInFollowUp} ${stats.estimatesInFollowUp === 1 ? 'estimate' : 'estimates'} in follow-up`);
  }

  let body = parts[0] + ' ' + parts.slice(1).join(', ') + '.';

  // Won jobs line (only if any)
  if (stats.jobsWonThisWeek > 0) {
    const revenue = Math.round(stats.revenueWonThisWeek / 100);
    body += ` Won: $${revenue.toLocaleString()} from ${stats.jobsWonThisWeek} ${stats.jobsWonThisWeek === 1 ? 'job' : 'jobs'}.`;
  }

  // Jobs to close out (drives review engine)
  if (stats.jobsToCloseOut > 0) {
    body += ` ${stats.jobsToCloseOut} ${stats.jobsToCloseOut === 1 ? 'job' : 'jobs'} to mark complete for review requests.`;
  }

  return { body, type: 'active' };
}

/**
 * Send weekly activity digests to all eligible clients.
 * Called by the Monday morning cron.
 */
export async function sendWeeklyDigests(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
  details: DigestResult[];
}> {
  const db = getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const agency = await getAgency();

  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      phone: clients.phone,
      twilioNumber: clients.twilioNumber,
      status: clients.status,
      createdAt: clients.createdAt,
      weeklyDigestEnabled: clients.weeklyDigestEnabled,
      weeklyDigestLastSentAt: clients.weeklyDigestLastSentAt,
      weeklyDigestConsecutiveZeroWeeks: clients.weeklyDigestConsecutiveZeroWeeks,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const details: DigestResult[] = [];

  for (const client of allClients) {
    try {
      // Skip: digest disabled
      if (!client.weeklyDigestEnabled) {
        skipped++;
        details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_disabled' });
        continue;
      }

      // Skip: first 7 days (onboarding phase)
      const clientAge = now.getTime() - new Date(client.createdAt!).getTime();
      if (clientAge < 7 * 24 * 60 * 60 * 1000) {
        skipped++;
        details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_onboarding' });
        continue;
      }

      // Skip: no phone or Twilio number
      if (!client.phone || !client.twilioNumber) {
        skipped++;
        details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_inactive' });
        continue;
      }

      const stats = await getWeeklyStats(client.id);
      const hasAnyActivity = stats.newLeads > 0 || stats.appointmentsBooked > 0;
      const hasFollowUps = stats.estimatesInFollowUp > 0;
      const consecutiveZero = client.weeklyDigestConsecutiveZeroWeeks ?? 0;

      // Track consecutive zero weeks
      const newConsecutiveZero = hasAnyActivity ? 0 : consecutiveZero + 1;

      // Cadence logic:
      // - Active week: send weekly
      // - Quiet week (has follow-ups but no new leads): send biweekly
      // - Slow period (3+ zero weeks): send monthly (every 4th week)
      // - Zero everything + no follow-ups: don't send, just track

      if (!hasAnyActivity && !hasFollowUps) {
        // Zero everything — don't send, update tracker
        await db
          .update(clients)
          .set({ weeklyDigestConsecutiveZeroWeeks: newConsecutiveZero, updatedAt: now })
          .where(eq(clients.id, client.id));
        skipped++;
        details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_inactive' });
        continue;
      }

      // Biweekly cadence for quiet weeks
      if (!hasAnyActivity && hasFollowUps) {
        const lastSent = client.weeklyDigestLastSentAt;
        if (lastSent && (now.getTime() - lastSent.getTime()) < 13 * 24 * 60 * 60 * 1000) {
          await db
            .update(clients)
            .set({ weeklyDigestConsecutiveZeroWeeks: newConsecutiveZero, updatedAt: now })
            .where(eq(clients.id, client.id));
          skipped++;
          details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_biweekly' });
          continue;
        }
      }

      // Monthly cadence for slow period reassurance
      if (newConsecutiveZero >= SLOW_PERIOD_THRESHOLD) {
        const lastSent = client.weeklyDigestLastSentAt;
        if (lastSent && (now.getTime() - lastSent.getTime()) < 27 * 24 * 60 * 60 * 1000) {
          await db
            .update(clients)
            .set({ weeklyDigestConsecutiveZeroWeeks: newConsecutiveZero, updatedAt: now })
            .where(eq(clients.id, client.id));
          skipped++;
          details.push({ clientId: client.id, businessName: client.businessName, action: 'skipped_monthly_not_due' });
          continue;
        }
      }

      // Build and send
      const { body } = buildDigestMessage(client.ownerName, stats, newConsecutiveZero);

      await sendCompliantMessage({
        clientId: client.id,
        to: client.phone,
        from: client.twilioNumber,
        body,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_consent' },
        queueOnQuietHours: true,
      });

      // Update tracking
      await db
        .update(clients)
        .set({
          weeklyDigestLastSentAt: now,
          weeklyDigestConsecutiveZeroWeeks: newConsecutiveZero,
          updatedAt: now,
        })
        .where(eq(clients.id, client.id));

      sent++;
      details.push({ clientId: client.id, businessName: client.businessName, action: 'sent', message: body });
    } catch (err) {
      logSanitizedConsoleError('[WeeklyDigest] Failed for client:', err, { clientId: client.id });
      errors++;
      details.push({ clientId: client.id, businessName: client.businessName, action: 'error' });
    }
  }

  console.log(`[WeeklyDigest] Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
  return { sent, skipped, errors, details };
}
