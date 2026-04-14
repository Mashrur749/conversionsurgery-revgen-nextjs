/**
 * Daily Digest Cron Runner
 *
 * Sends a single daily SMS to each contractor at 10am LOCAL time,
 * aggregating all pending P2 items (KB gaps, stale estimates, won/lost prompts).
 *
 * Replaces 40-60 individual SMS/month with one daily batch per contractor.
 *
 * This is an OPERATOR-to-CONTRACTOR notification — uses sendActionPrompt
 * (agency channel), NOT the compliance gateway.
 *
 * Runs hourly via the cron orchestrator. For each active client, checks if
 * current UTC time maps to 10:00-10:59 in the client's timezone. Dedup via
 * audit_log action 'daily_digest' with today's date (client local timezone).
 *
 * Rules:
 * - Client must be active
 * - Feature flag 'dailyDigest' must be enabled
 * - 10am local time window (10:00-10:59)
 * - Max 8 items per digest
 * - Empty digest = no SMS
 * - Dedup by audit_log action + today's date in client timezone
 */

import { getDb } from '@/db';
import { clients, auditLog } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendActionPrompt } from '@/lib/services/agency-communication';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';
import {
  buildDigest,
  formatDigestSms,
  buildDigestActionPayload,
} from '@/lib/services/contractor-digest';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIT_ACTION = 'daily_digest';
const TARGET_LOCAL_HOUR = 10;
const PROMPT_TYPE = 'daily_digest';
const EXPIRES_HOURS = 24;

// ── Result type ───────────────────────────────────────────────────────────────

export interface DailyDigestResult {
  scanned: number;
  sent: number;
  skipped: number;
  empty: number;
  errors: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get the current local hour for a timezone.
 * Returns the hour (0-23) and today's date string (YYYY-MM-DD) in that timezone.
 */
function getLocalTime(timezone: string, now: Date): { localHour: number; localDate: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';

    return {
      localHour: hour,
      localDate: `${year}-${month}-${day}`,
    };
  } catch {
    // Invalid timezone — fall back to UTC
    return {
      localHour: now.getUTCHours(),
      localDate: now.toISOString().split('T')[0],
    };
  }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runDailyDigest(): Promise<DailyDigestResult> {
  const db = getDb();
  const now = new Date();
  const errors: string[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let empty = 0;

  // ── Step 1: Find all active clients ─────────────────────────────────────
  const activeClients = await db
    .select({
      id: clients.id,
      businessName: clients.businessName,
      timezone: clients.timezone,
    })
    .from(clients)
    .where(eq(clients.status, 'active'));

  if (activeClients.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, empty: 0, errors: [] };
  }

  // ── Step 2: Filter to clients in 10am local window ──────────────────────
  const eligibleClients: typeof activeClients = [];
  const clientLocalDates = new Map<string, string>();

  for (const client of activeClients) {
    const tz = client.timezone ?? 'America/New_York';
    const { localHour, localDate } = getLocalTime(tz, now);

    if (localHour === TARGET_LOCAL_HOUR) {
      eligibleClients.push(client);
      clientLocalDates.set(client.id, localDate);
    }
  }

  if (eligibleClients.length === 0) {
    return { scanned: 0, sent: 0, skipped: 0, empty: 0, errors: [] };
  }

  scanned = eligibleClients.length;
  const eligibleIds = eligibleClients.map((c) => c.id);

  // ── Step 3: Dedup — check audit_log for today's digest per client ───────
  // We store the local date in metadata.date to dedup per-day
  const alreadySentRows = await db
    .select({ clientId: auditLog.clientId, metadata: auditLog.metadata })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.clientId, eligibleIds),
        eq(auditLog.action, AUDIT_ACTION)
      )
    );

  // Build set of "clientId:date" combos that already ran
  const alreadySentSet = new Set<string>();
  for (const row of alreadySentRows) {
    const meta = row.metadata as Record<string, unknown> | null;
    const date = meta?.date as string | undefined;
    if (row.clientId && date) {
      alreadySentSet.add(`${row.clientId}:${date}`);
    }
  }

  // ── Step 4: Process each eligible client ────────────────────────────────
  for (const client of eligibleClients) {
    const localDate = clientLocalDates.get(client.id)!;

    // Already sent today?
    if (alreadySentSet.has(`${client.id}:${localDate}`)) {
      skipped++;
      continue;
    }

    // Feature flag check
    try {
      const enabled = await resolveFeatureFlag(client.id, 'dailyDigest');
      if (!enabled) {
        skipped++;
        continue;
      }
    } catch (error) {
      logSanitizedConsoleError('[DailyDigest] Feature flag check failed:', error, {
        clientId: client.id,
      });
      skipped++;
      continue;
    }

    // Build digest
    try {
      const digest = await buildDigest(client.id);

      if (!digest) {
        empty++;
        continue;
      }

      const message = formatDigestSms(client.businessName, digest.items);
      const payload = buildDigestActionPayload(digest.items);

      const messageId = await sendActionPrompt({
        clientId: client.id,
        promptType: PROMPT_TYPE,
        message,
        actionPayload: payload,
        expiresInHours: EXPIRES_HOURS,
      });

      if (messageId) {
        // Log to audit_log for dedup
        await db.insert(auditLog).values({
          clientId: client.id,
          action: AUDIT_ACTION,
          resourceType: 'client',
          metadata: {
            date: localDate,
            itemCount: digest.items.length,
            itemIds: digest.items.map((i) => i.id),
          },
        });

        sent++;
        console.log(
          `[DailyDigest] Sent digest to ${client.businessName} (${digest.items.length} items)`
        );
      } else {
        skipped++;
      }
    } catch (error) {
      logSanitizedConsoleError('[DailyDigest] Failed to send digest:', error, {
        clientId: client.id,
      });
      errors.push(`Client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(
    `[DailyDigest] Done. scanned=${scanned}, sent=${sent}, skipped=${skipped}, empty=${empty}, errors=${errors.length}`
  );

  return { scanned, sent, skipped, empty, errors };
}
