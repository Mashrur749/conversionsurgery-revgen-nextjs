/**
 * Dormant Re-Engagement Automation (GAP-03)
 *
 * Sends a single light re-engagement message to leads that have been dormant
 * for 180-210 days (6-7 month window). This is a SECOND touchpoint — distinct
 * from the win-back sequence which targets 25-35 day stale leads.
 *
 * Runs weekly (Wednesday) via the cron orchestrator.
 *
 * Rules:
 * - One message per lead, ever (180-210 day window ensures this)
 * - Does NOT change lead status — only inbound replies trigger transitions
 * - Sends only 10am-2pm weekdays, never Monday before 11am / Friday after 1pm
 * - Max 20 leads per client per run
 */

import { getDb } from '@/db';
import { leads, clients, conversations, consentRecords } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { addMonths } from 'date-fns';
import { ComplianceService } from '@/lib/compliance/compliance-service';

// ── Timing constants ──────────────────────────────────────────────────────────

const DORMANT_MIN_DAYS = 180;
const DORMANT_MAX_DAYS = 210;
const MAX_PER_CLIENT = 20;

// ── Message builder ───────────────────────────────────────────────────────────

function buildReengagementMessage(params: {
  firstName: string;
  businessName: string;
  projectType: string | null;
}): string {
  const { firstName, businessName, projectType } = params;

  if (projectType) {
    return (
      `Hi ${firstName}, this is ${businessName}. It's been a while since we connected about ` +
      `your ${projectType} project. If you're still thinking about it, we'd love to help. ` +
      `No pressure — just let us know.`
    );
  }

  return (
    `Hi ${firstName}, this is ${businessName}. It's been a while since we were last in touch. ` +
    `If there's anything we can help you with, we'd love to reconnect. No pressure — just reach out whenever.`
  );
}

// ── Timing guard (same pattern as win-back) ───────────────────────────────────

function isWithinSendWindow(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat

  if (day === 0 || day === 6) return false; // No weekends
  if (hour < 10 || hour >= 14) return false; // 10am-2pm only
  if (day === 1 && hour < 11) return false; // No Monday before 11am
  if (day === 5 && hour >= 13) return false; // No Friday after 1pm

  return true;
}

// ── Main runner ───────────────────────────────────────────────────────────────

export interface DormantReengagementResult {
  eligible: number;
  messaged: number;
  skipped: number;
  errors: string[];
}

/**
 * Finds dormant leads in the 180-210 day window and sends one re-engagement
 * message per lead. Caps at MAX_PER_CLIENT per client per run.
 */
export async function runDormantReengagement(): Promise<DormantReengagementResult> {
  if (!isWithinSendWindow()) {
    return { eligible: 0, messaged: 0, skipped: 0, errors: [] };
  }

  const db = getDb();
  const errors: string[] = [];
  let eligible = 0;
  let messaged = 0;
  let skipped = 0;

  // updatedAt window: between 180 and 210 days ago
  const now = new Date();
  const cutoffOld = new Date(now.getTime() - DORMANT_MAX_DAYS * 24 * 60 * 60 * 1000);
  const cutoffRecent = new Date(now.getTime() - DORMANT_MIN_DAYS * 24 * 60 * 60 * 1000);

  const dormantLeads = await db
    .select({
      lead: leads,
      client: {
        id: clients.id,
        businessName: clients.businessName,
        twilioNumber: clients.twilioNumber,
        status: clients.status,
      },
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .where(
      and(
        eq(leads.status, 'dormant'),
        eq(leads.optedOut, false),
        eq(clients.status, 'active'),
        gte(leads.updatedAt, cutoffOld),
        lte(leads.updatedAt, cutoffRecent)
      )
    );

  // Filter out leads with no phone (already enforced by schema but be explicit)
  const actionable = dormantLeads.filter(({ lead, client }) => {
    if (!lead.phone) {
      skipped++;
      return false;
    }
    if (!client.twilioNumber) {
      skipped++;
      return false;
    }
    return true;
  });

  eligible = actionable.length;

  if (eligible === 0) {
    return { eligible: 0, messaged: 0, skipped, errors };
  }

  // ── Group by client and apply per-client cap ──────────────────────────────

  const byClient = new Map<
    string,
    Array<{ lead: typeof leads.$inferSelect; client: { id: string; businessName: string; twilioNumber: string | null; status: string | null } }>
  >();

  for (const row of actionable) {
    const existing = byClient.get(row.client.id) ?? [];
    existing.push(row);
    byClient.set(row.client.id, existing);
  }

  // ── Process each client batch ─────────────────────────────────────────────

  for (const [, rows] of byClient) {
    const capped = rows.slice(0, MAX_PER_CLIENT);

    const results = await Promise.allSettled(
      capped.map(async ({ lead, client }) => {
        // COMP-03: Check implied consent expiry before sending.
        // Dormant leads are 180-210 days old — exactly when CASL implied consent
        // from a missed call or form submission expires (6 calendar months).
        // Skip rather than send into expired consent territory.
        if (lead.phone) {
          const phoneHash = ComplianceService.hashPhoneNumber(lead.phone);
          const consentRecord = await db.query.consentRecords.findFirst({
            where: and(
              eq(consentRecords.clientId, client.id),
              eq(consentRecords.phoneNumberHash, phoneHash),
              eq(consentRecords.isActive, true)
            ),
            orderBy: (records, { desc }) => [desc(records.consentTimestamp)],
          });

          if (consentRecord && consentRecord.consentType === 'implied') {
            const isCustomerConsent = consentRecord.consentSource === 'existing_customer';
            const expiryDate = isCustomerConsent
              ? new Date(consentRecord.consentTimestamp.getTime() + 2 * 365 * 24 * 60 * 60 * 1000)
              : addMonths(consentRecord.consentTimestamp, 6);

            if (new Date() > expiryDate) {
              console.log(
                `[DormantReengagement] Dormant re-engagement skipped — consent expired for lead ${lead.id}`
              );
              skipped++;
              return;
            }
          }
        }

        const firstName = lead.name ? lead.name.split(' ')[0] : 'there';

        const body = buildReengagementMessage({
          firstName,
          businessName: client.businessName,
          projectType: lead.projectType ?? null,
        });

        const result = await sendCompliantMessage({
          clientId: client.id,
          to: lead.phone,
          from: client.twilioNumber as string,
          body,
          messageClassification: 'proactive_outreach',
          messageCategory: 'marketing',
          consentBasis: { type: 'existing_consent' },
          leadId: lead.id,
          queueOnQuietHours: false, // already guarded by isWithinSendWindow()
          metadata: { source: 'dormant_reengagement' },
        });

        if (result.sent || result.queued) {
          messaged++;

          if (result.sent) {
            // Record the outbound message in conversations
            await db.insert(conversations).values({
              leadId: lead.id,
              clientId: client.id,
              direction: 'outbound',
              messageType: 'ai_response',
              content: body,
            });
          }

          // Bump updatedAt so this lead won't re-enter the 180-210 day window
          await db
            .update(leads)
            .set({ updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
        } else if (result.blocked) {
          skipped++;
        }
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`Batch error: ${reason}`);
        logSanitizedConsoleError('[DormantReengagement] Batch error:', result.reason);
      }
    }
  }

  return { eligible, messaged, skipped, errors };
}
