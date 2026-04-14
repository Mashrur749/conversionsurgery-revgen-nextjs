/**
 * Onboarding Call Reminder Automation
 *
 * Sends a reminder SMS to contractors 2 hours before their scheduled onboarding call.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendAlert (agency
 * channel), NOT the compliance gateway.
 *
 * Runs every 30 minutes via the cron orchestrator.
 *
 * Rules:
 * - Client must be active
 * - Client must have scheduledOnboardingCallAt set (not null)
 * - Call must be 1.5-2.5 hours from now (90-150 minute window)
 * - At most one reminder per client ever (checked via audit_log action = 'onboarding_call_reminder')
 */

import { getDb } from '@/db';
import { clients, auditLog } from '@/db/schema';
import { eq, and, gte, lte, isNotNull, inArray } from 'drizzle-orm';
import { sendAlert } from '@/lib/services/agency-communication';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const WINDOW_MIN_MINUTES = 90;  // 1.5 hours
const WINDOW_MAX_MINUTES = 150; // 2.5 hours
const AUDIT_ACTION = 'onboarding_call_reminder';

export interface OnboardingReminderResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: string[];
}

function formatCallTime(callAt: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(callAt);
  } catch {
    // Fallback if timezone is invalid
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    }).format(callAt);
  }
}

export async function runOnboardingReminder(): Promise<OnboardingReminderResult> {
  const db = getDb();
  const errors: string[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_MIN_MINUTES * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_MAX_MINUTES * 60 * 1000);

  // Find active clients with a scheduled call in the 1.5-2.5h window
  const candidateClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      scheduledOnboardingCallAt: clients.scheduledOnboardingCallAt,
      timezone: clients.timezone,
    })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        isNotNull(clients.scheduledOnboardingCallAt),
        gte(clients.scheduledOnboardingCallAt, windowStart),
        lte(clients.scheduledOnboardingCallAt, windowEnd)
      )
    );

  if (candidateClients.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, errors: [] };
  }

  scanned = candidateClients.length;
  const candidateIds = candidateClients.map((c) => c.id);

  // Dedup: find clients that already received this reminder
  const alreadySent = await db
    .select({ clientId: auditLog.clientId })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, candidateIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  const alreadySentIds = new Set(alreadySent.map((row) => row.clientId));

  for (const client of candidateClients) {
    if (alreadySentIds.has(client.id)) {
      skipped++;
      continue;
    }

    // scheduledOnboardingCallAt is guaranteed non-null by the WHERE clause above
    const callAt = client.scheduledOnboardingCallAt as Date;
    const timezone = client.timezone ?? 'America/New_York';
    const formattedTime = formatCallTime(callAt, timezone);

    try {
      await sendAlert({
        clientId: client.id,
        message: `Quick reminder \u2014 setup call at ${formattedTime} today. Takes 30 min. If now doesn\u2019t work, reply with a better time.`,
      });

      // Log to audit_log to prevent duplicate reminders
      await db.insert(auditLog).values({
        clientId: client.id,
        action: AUDIT_ACTION,
        resourceType: 'client',
        metadata: { scheduledOnboardingCallAt: callAt.toISOString() },
      });

      sent++;
      console.log(`[OnboardingReminder] Sent reminder to client ${client.businessName} (callAt=${callAt.toISOString()})`);
    } catch (error) {
      logSanitizedConsoleError('[OnboardingReminder] Failed to send reminder:', error, {
        clientId: client.id,
      });
      errors.push(`Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`[OnboardingReminder] Done. scanned=${scanned}, sent=${sent}, skipped=${skipped}, errors=${errors.length}`);
  return { scanned, sent, skipped, errors };
}
