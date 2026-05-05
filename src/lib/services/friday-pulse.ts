import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toZonedTime } from 'date-fns-tz';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { getWeeklyStats, type DigestStats } from '@/lib/services/weekly-digest';

/**
 * Friday Pulse: trust-accelerant SMS that auto-fires every Friday 4pm in the
 * client's local timezone. Message is fixed-template — three numbers and a
 * one-line statement that the system worked.
 *
 * Distinct from the Monday Pipeline Pulse (`weekly-digest.ts`), which adapts
 * its template based on activity level (active / quiet / reassurance).
 */

/** Result row for a single client's Friday Pulse run. */
export interface FridayPulseResult {
  clientId: string;
  businessName: string;
  action: 'sent' | 'skipped_disabled' | 'skipped_inactive' | 'skipped_not_friday_4pm' | 'error';
  message?: string;
}

/** Returns true when `now` is Friday 16:00–16:04 in the given IANA timezone. */
export function isFridayPulseTime(now: Date, timezone: string): boolean {
  const local = toZonedTime(now, timezone);
  const day = local.getDay(); // 0=Sun … 5=Fri … 6=Sat
  const hour = local.getHours();
  const minute = local.getMinutes();
  return day === 5 && hour === 16 && minute < 5;
}

/**
 * Build the Friday Pulse SMS body from weekly stats.
 *
 * Template (exact):
 *   "This week — {N} new leads, {N} booked, ${X} probable pipeline. Your system
 *    worked while you were on site. Reply with any questions."
 *
 * `${X}` is whole dollars (not abbreviated K) so it reads as a concrete number
 * even on quiet weeks. Template fires regardless of activity level — the value
 * of this artifact is the *cadence*, not the content variation.
 */
export function buildFridayPulseMessage(stats: DigestStats): string {
  const probableDollars = stats.probablePipelineValueDollars.toLocaleString();
  return (
    `This week — ${stats.newLeads} new leads, ${stats.appointmentsBooked} booked, ` +
    `$${probableDollars} probable pipeline. Your system worked while you were on site. ` +
    `Reply with any questions.`
  );
}

/**
 * Send Friday Pulse SMS to all eligible active clients whose local time is
 * currently Friday 4:00–4:04pm. Designed to run from the every-5-minute cron
 * orchestrator; the timezone gate makes it a no-op in all other windows.
 */
export async function sendFridayPulses(now: Date = new Date()): Promise<{
  sent: number;
  skipped: number;
  errors: number;
  details: FridayPulseResult[];
}> {
  const db = getDb();

  const allClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      phone: clients.phone,
      twilioNumber: clients.twilioNumber,
      timezone: clients.timezone,
      weeklyDigestEnabled: clients.weeklyDigestEnabled,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const details: FridayPulseResult[] = [];

  for (const client of allClients) {
    try {
      if (!client.weeklyDigestEnabled) {
        skipped++;
        details.push({
          clientId: client.id,
          businessName: client.businessName,
          action: 'skipped_disabled',
        });
        continue;
      }

      if (!client.phone || !client.twilioNumber) {
        skipped++;
        details.push({
          clientId: client.id,
          businessName: client.businessName,
          action: 'skipped_inactive',
        });
        continue;
      }

      const timezone = client.timezone ?? 'America/New_York';
      if (!isFridayPulseTime(now, timezone)) {
        skipped++;
        details.push({
          clientId: client.id,
          businessName: client.businessName,
          action: 'skipped_not_friday_4pm',
        });
        continue;
      }

      const stats = await getWeeklyStats(client.id);
      const body = buildFridayPulseMessage(stats);

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

      sent++;
      details.push({
        clientId: client.id,
        businessName: client.businessName,
        action: 'sent',
        message: body,
      });
    } catch (err) {
      logSanitizedConsoleError('[FridayPulse] Failed for client:', err, { clientId: client.id });
      errors++;
      details.push({
        clientId: client.id,
        businessName: client.businessName,
        action: 'error',
      });
    }
  }

  console.log(`[FridayPulse] Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
  return { sent, skipped, errors, details };
}
