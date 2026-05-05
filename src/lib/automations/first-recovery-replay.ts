import { getDb, clients, leads, conversations, subscriptions } from '@/db';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { eq, and } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import type { Lead, Client } from '@/db/schema';

/**
 * First Missed Lead Replay SMS — fires ONCE per client within 30 days post go-live
 * the first time the system rescues a lead the contractor would have lost.
 *
 * Trust play: vendors disappear after payment. This proves the system works
 * by surfacing a real recovery to the contractor without making them log into
 * the dashboard.
 */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * True if `now` falls within the 30-day onboarding window after `serviceStartDate`.
 * Returns false if `serviceStartDate` is null (no go-live anchor recorded).
 */
export function isWithinReplayWindow(
  serviceStartDate: Date | null,
  now: Date = new Date()
): boolean {
  if (!serviceStartDate) return false;
  const elapsed = now.getTime() - serviceStartDate.getTime();
  return elapsed >= 0 && elapsed <= THIRTY_DAYS_MS;
}

/**
 * Recovery event criteria — confirms the reply represents a lead the
 * contractor would have lost.
 *
 * - Lead status is `new` or `contacted` (not yet manually engaged)
 * - Original inquiry (lead.createdAt) was 24+ hours before the reply
 * - Reply landed within 7 days of the original inquiry (so the lead
 *   wasn't truly dormant — it's a system recovery, not a long-tail miracle)
 */
export function qualifiesAsRecoveryEvent(input: {
  leadStatus: string;
  leadCreatedAt: Date;
  replyAt: Date;
}): boolean {
  const { leadStatus, leadCreatedAt, replyAt } = input;

  if (leadStatus !== 'new' && leadStatus !== 'contacted') return false;

  const gapMs = replyAt.getTime() - leadCreatedAt.getTime();
  if (gapMs < ONE_DAY_MS) return false;
  if (gapMs > SEVEN_DAYS_MS) return false;

  return true;
}

/**
 * Build the SMS body sent to the contractor.
 */
export function buildReplayMessage(input: {
  firstName: string | null;
  daysSinceOriginalContact: number;
  portalLink: string;
}): string {
  const firstName = input.firstName?.trim() || 'A lead';
  const days = Math.max(1, input.daysSinceOriginalContact);
  const dayLabel = days === 1 ? '1 day' : `${days} days`;

  return `Caught one. ${firstName}, called ${dayLabel} ago, no response. System followed up. He replied. Look at the thread when you get a chance: ${input.portalLink}`;
}

interface ReplayResult {
  sent: boolean;
  reason?:
    | 'already_sent'
    | 'outside_window'
    | 'no_service_start'
    | 'lead_not_found'
    | 'no_reply_yet'
    | 'not_recovery_event'
    | 'no_owner_phone'
    | 'no_twilio_number'
    | 'compliance_blocked';
  blockReason?: string;
}

/**
 * Check whether this client+lead pair triggers the first recovery replay SMS,
 * and send it if so. Idempotent — once `firstRecoveryReplaySentAt` is set,
 * subsequent calls return early.
 */
export async function checkAndSendFirstRecoveryReplay(
  clientId: string,
  leadId: string
): Promise<ReplayResult> {
  const db = getDb();

  // 1. Load client + already-sent guard
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return { sent: false, reason: 'lead_not_found' };
  }

  if (client.firstRecoveryReplaySentAt) {
    return { sent: false, reason: 'already_sent' };
  }

  // 2. Resolve service start date (guarantee start = go-live anchor;
  //    fall back to client.createdAt when no subscription is recorded yet).
  const [sub] = await db
    .select({ guaranteeStartAt: subscriptions.guaranteeStartAt })
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .limit(1);

  const serviceStartDate: Date | null = sub?.guaranteeStartAt ?? client.createdAt ?? null;
  const now = new Date();

  if (!serviceStartDate) {
    return { sent: false, reason: 'no_service_start' };
  }

  if (!isWithinReplayWindow(serviceStartDate, now)) {
    return { sent: false, reason: 'outside_window' };
  }

  // 3. Load lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.clientId, clientId)))
    .limit(1);

  if (!lead) {
    return { sent: false, reason: 'lead_not_found' };
  }

  // 4. Find the most recent inbound reply (proof of recovery)
  const inboundMessages = await db
    .select({ createdAt: conversations.createdAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        eq(conversations.direction, 'inbound')
      )
    );

  if (inboundMessages.length === 0) {
    return { sent: false, reason: 'no_reply_yet' };
  }

  const replyAt = inboundMessages.reduce<Date>((latest, row) => {
    return row.createdAt > latest ? row.createdAt : latest;
  }, inboundMessages[0].createdAt);

  if (
    !qualifiesAsRecoveryEvent({
      leadStatus: lead.status ?? 'new',
      leadCreatedAt: lead.createdAt,
      replyAt,
    })
  ) {
    return { sent: false, reason: 'not_recovery_event' };
  }

  // 5. Resolve recipient + sender
  if (!client.phone) {
    return { sent: false, reason: 'no_owner_phone' };
  }
  if (!client.twilioNumber) {
    return { sent: false, reason: 'no_twilio_number' };
  }

  // 6. Compose message
  const firstName = extractFirstName(lead);
  const daysSinceOriginalContact = Math.max(
    1,
    Math.floor((replyAt.getTime() - lead.createdAt.getTime()) / ONE_DAY_MS)
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';
  const portalLink = `${appUrl}/client/conversations/${lead.id}`;

  const body = buildReplayMessage({
    firstName,
    daysSinceOriginalContact,
    portalLink,
  });

  // 7. Send via compliance gateway
  try {
    const result = await sendCompliantMessage({
      clientId: client.id,
      to: client.phone,
      from: client.twilioNumber,
      body,
      messageClassification: 'proactive_outreach',
      messageCategory: 'transactional',
      consentBasis: { type: 'existing_customer' },
      queueOnQuietHours: true,
      metadata: {
        source: 'first_recovery_replay',
        leadId: lead.id,
      },
    });

    if (result.blocked) {
      return {
        sent: false,
        reason: 'compliance_blocked',
        blockReason: result.blockReason,
      };
    }

    // 8. Mark as sent (also covers queued — we only fire once regardless of delivery)
    await db
      .update(clients)
      .set({ firstRecoveryReplaySentAt: now, updatedAt: now })
      .where(eq(clients.id, clientId));

    return { sent: true };
  } catch (error) {
    logSanitizedConsoleError('[FirstRecoveryReplay] Send failed', error, {
      clientId,
      leadId,
    });
    return { sent: false, reason: 'compliance_blocked' };
  }
}

function extractFirstName(lead: Lead): string | null {
  if (!lead.name) return null;
  const trimmed = lead.name.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

// Re-exports for typing in callers
export type { Lead, Client };
