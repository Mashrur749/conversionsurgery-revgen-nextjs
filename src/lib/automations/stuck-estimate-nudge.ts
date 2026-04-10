/**
 * Stuck Estimate Nudge Automation (F1)
 *
 * Alerts contractors when leads have been in `estimate_sent` status for over
 * 21 days without progressing. Sends an SMS to the contractor (client.phone)
 * listing the stalled leads by name so they can take action and keep ROI
 * reporting accurate.
 *
 * Runs weekly (Wednesday) via the cron orchestrator, same slot as dormant
 * re-engagement.
 *
 * Rules:
 * - Targets leads with status = 'estimate_sent' and updatedAt < 21 days ago
 * - Skips opted-out leads
 * - Skips paused or cancelled clients, or clients missing a Twilio number
 * - Lists up to 3 lead names in the SMS; appends "and X more" when exceeded
 * - Message goes to client.phone (the contractor), not the homeowner
 */

import { getDb } from '@/db';
import { leads, clients } from '@/db/schema';
import { eq, and, lt, ne } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Constants ─────────────────────────────────────────────────────────────────

const STUCK_THRESHOLD_DAYS = 21;
const MAX_NAMES_IN_SMS = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

interface StuckLead {
  id: string;
  name: string | null;
}

interface ClientNudgeResult {
  clientId: string;
  businessName: string;
  action: 'sent' | 'skipped_no_leads' | 'skipped_inactive' | 'error';
  stuckCount?: number;
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildNudgeMessage(stuckLeads: StuckLead[]): string {
  const count = stuckLeads.length;
  const names = stuckLeads
    .slice(0, MAX_NAMES_IN_SMS)
    .map((l) => l.name ?? 'Unknown')
    .join(', ');

  const overflowCount = count - MAX_NAMES_IN_SMS;
  const nameList = overflowCount > 0 ? `${names}, and ${overflowCount} more` : names;

  return (
    `You have ${count} ${count === 1 ? 'estimate' : 'estimates'} over 3 weeks old with no update: ` +
    `${nameList}. Mark them won or lost in your dashboard so your ROI stays accurate.`
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Query all leads stuck in `estimate_sent` for 21+ days, group by client, and
 * send a nudge SMS to each eligible contractor.
 */
export async function processStuckEstimateNudges(): Promise<{
  sent: number;
  skipped: number;
  errors: number;
  details: ClientNudgeResult[];
}> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // Fetch all active clients with the fields we need for filtering and sending
  const activeClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      phone: clients.phone,
      twilioNumber: clients.twilioNumber,
      status: clients.status,
    })
    .from(clients)
    .where(
      and(
        ne(clients.status, 'paused'),
        ne(clients.status, 'cancelled')
      )
    );

  // Fetch all stuck estimates across all eligible clients in one query
  const stuckLeads = await db
    .select({
      id: leads.id,
      clientId: leads.clientId,
      name: leads.name,
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, 'estimate_sent'),
        lt(leads.updatedAt, cutoff),
        eq(leads.optedOut, false)
      )
    );

  // Group stuck leads by clientId
  const leadsByClient = new Map<string, StuckLead[]>();
  for (const lead of stuckLeads) {
    const existing = leadsByClient.get(lead.clientId) ?? [];
    existing.push({ id: lead.id, name: lead.name });
    leadsByClient.set(lead.clientId, existing);
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const details: ClientNudgeResult[] = [];

  for (const client of activeClients) {
    try {
      // Skip: no phone or Twilio number
      if (!client.phone || !client.twilioNumber) {
        skipped++;
        details.push({
          clientId: client.id,
          businessName: client.businessName,
          action: 'skipped_inactive',
        });
        continue;
      }

      const clientStuckLeads = leadsByClient.get(client.id) ?? [];

      // Skip: no stuck estimates for this client
      if (clientStuckLeads.length === 0) {
        skipped++;
        details.push({
          clientId: client.id,
          businessName: client.businessName,
          action: 'skipped_no_leads',
        });
        continue;
      }

      const body = buildNudgeMessage(clientStuckLeads);

      await sendCompliantMessage({
        clientId: client.id,
        to: client.phone,
        from: client.twilioNumber,
        body,
        messageClassification: 'proactive_outreach',
        messageCategory: 'transactional',
        consentBasis: { type: 'existing_customer' },
        queueOnQuietHours: true,
      });

      sent++;
      details.push({
        clientId: client.id,
        businessName: client.businessName,
        action: 'sent',
        stuckCount: clientStuckLeads.length,
      });
    } catch (err) {
      logSanitizedConsoleError('[StuckEstimateNudge] Failed for client:', err, {
        clientId: client.id,
      });
      errors++;
      details.push({
        clientId: client.id,
        businessName: client.businessName,
        action: 'error',
      });
    }
  }

  console.log(
    `[StuckEstimateNudge] Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`
  );
  return { sent, skipped, errors, details };
}
