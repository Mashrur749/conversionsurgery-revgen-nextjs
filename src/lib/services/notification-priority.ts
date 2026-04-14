/**
 * Notification Priority Tier System (FMA 3.1)
 *
 * Classifies contractor notifications into P0–P3 tiers and enforces
 * per-client daily caps on P1 (time-sensitive) messages.
 *
 * Tier definitions:
 *   P0 — critical, always immediate: opt-out confirmations, compliance, PAUSE/RESUME
 *   P1 — time-sensitive, max 2/day: booking confirmations, escalation, billing reminders
 *   P2 — batched daily digest: KB gaps, probable wins, stuck estimates, quote prompts
 *   P3 — weekly digest: pipeline SMS, report notifications
 */

import { getDb } from '@/db';
import { agencyMessages } from '@/db/schema';
import { and, eq, gte, inArray, count } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export type NotificationType =
  // P0 — critical / compliance
  | 'opt_out_confirmation'
  | 'compliance_alert'
  | 'pause_notification'
  | 'resume_notification'
  // P1 — time-sensitive
  | 'booking_confirmation'
  | 'escalation_needs_contractor'
  | 'hot_transfer_missed'
  | 'billing_reminder'
  | 'onboarding_reminder'
  // P2 — daily digest
  | 'kb_gap_detected'
  | 'probable_win'
  | 'stuck_estimate'
  | 'quote_prompt'
  // P3 — weekly digest
  | 'pipeline_sms'
  | 'report_notification';

// ---------------------------------------------------------------------------
// Priority classification map
// ---------------------------------------------------------------------------

const PRIORITY_MAP: Record<NotificationType, Priority> = {
  // P0
  opt_out_confirmation: 'P0',
  compliance_alert: 'P0',
  pause_notification: 'P0',
  resume_notification: 'P0',
  // P1
  booking_confirmation: 'P1',
  escalation_needs_contractor: 'P1',
  hot_transfer_missed: 'P1',
  billing_reminder: 'P1',
  onboarding_reminder: 'P1',
  // P2
  kb_gap_detected: 'P2',
  probable_win: 'P2',
  stuck_estimate: 'P2',
  quote_prompt: 'P2',
  // P3
  pipeline_sms: 'P3',
  report_notification: 'P3',
};

/**
 * The prompt types stored in `agencyMessages.promptType` that correspond to
 * P1 sends. Used for the daily cap count query.
 */
const P1_PROMPT_TYPES: string[] = [
  'booking_confirmation',
  'escalation_needs_contractor',
  'hot_transfer_missed',
  'billing_reminder',
  'onboarding_reminder',
];

/** Maximum P1 messages allowed per client per calendar day. */
const P1_DAILY_CAP = 2;

// ---------------------------------------------------------------------------
// Pure classification (no I/O)
// ---------------------------------------------------------------------------

/**
 * Returns the priority tier for a given notification type.
 * Pure function — no DB access, safe to call anywhere.
 */
export function classifyPriority(type: NotificationType): Priority {
  return PRIORITY_MAP[type];
}

// ---------------------------------------------------------------------------
// Cap check
// ---------------------------------------------------------------------------

/**
 * Returns the start-of-today timestamp in UTC for use in DB comparisons.
 * Extracted so tests can verify the boundary without time-zone drift.
 */
function getTodayStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/**
 * Determines whether a notification can be sent immediately.
 *
 * - P0: always true
 * - P1: true only when today's P1 send count for the client is < 2
 * - P2 / P3: always false (queued for digest)
 */
export async function canSendImmediate(
  clientId: string,
  priority: Priority
): Promise<boolean> {
  if (priority === 'P0') return true;
  if (priority === 'P2' || priority === 'P3') return false;

  // P1 — check daily cap
  const db = getDb();
  const todayStart = getTodayStart();

  const [row] = await db
    .select({ total: count() })
    .from(agencyMessages)
    .where(
      and(
        eq(agencyMessages.clientId, clientId),
        gte(agencyMessages.createdAt, todayStart),
        inArray(agencyMessages.promptType, P1_PROMPT_TYPES)
      )
    );

  const sent = row?.total ?? 0;
  return sent < P1_DAILY_CAP;
}

// ---------------------------------------------------------------------------
// Record send
// ---------------------------------------------------------------------------

/**
 * Records a sent notification by inserting a minimal `agencyMessages` row.
 * Only P1 sends affect the daily cap, but all priorities are recorded for
 * observability. Callers should pass the actual `content` used in the message.
 *
 * NOTE: For P0/P1 sends that go through `sendActionPrompt` or `sendAlert`,
 * those functions already create their own `agencyMessages` rows. Call
 * `recordSend` only for sends that do NOT go through those functions (i.e.,
 * lightweight digest / cap-tracking paths).
 */
export async function recordSend(
  clientId: string,
  priority: Priority,
  type: NotificationType
): Promise<void> {
  const db = getDb();

  const category =
    priority === 'P0' || priority === 'P1'
      ? 'alert'
      : priority === 'P2'
        ? 'action_prompt'
        : 'weekly_digest';

  await db.insert(agencyMessages).values({
    clientId,
    direction: 'outbound',
    channel: 'sms',
    content: `[${priority}] ${type}`,
    category,
    promptType: type,
    actionStatus: null,
  });
}
