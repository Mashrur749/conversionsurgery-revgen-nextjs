import { getDb } from '@/db';
import { agentDecisions, funnelEvents } from '@/db/schema';
import { eq, and, desc, lt, gte } from 'drizzle-orm';
import type { FunnelEventType } from './funnel-tracking';

/**
 * Maximum time window (in days) to look back for a preceding agent decision.
 * If an agent decision is older than this relative to the funnel event,
 * it's not considered a contributing decision.
 */
const ATTRIBUTION_WINDOW_DAYS = 7;

/**
 * Funnel event types that represent positive outcomes.
 * When these events are attributed to an agent decision,
 * the decision's outcome is updated to 'positive'.
 */
const POSITIVE_OUTCOME_EVENTS: ReadonlySet<FunnelEventType> = new Set([
  'appointment_booked',
  'quote_accepted',
  'job_won',
  'payment_received',
  'review_received',
]);

/**
 * Funnel event types that represent negative outcomes.
 */
const NEGATIVE_OUTCOME_EVENTS: ReadonlySet<FunnelEventType> = new Set([
  'job_lost',
]);

/**
 * Funnel event types that represent neutral/informational progression.
 */
const NEUTRAL_OUTCOME_EVENTS: ReadonlySet<FunnelEventType> = new Set([
  'lead_created',
  'first_response',
  'qualified',
  'quote_requested',
  'quote_sent',
  'review_requested',
]);

/**
 * Determines the outcome classification for an agent decision
 * based on the funnel event type that was attributed to it.
 */
export function classifyOutcome(
  eventType: FunnelEventType
): 'positive' | 'negative' | 'neutral' {
  if (POSITIVE_OUTCOME_EVENTS.has(eventType)) return 'positive';
  if (NEGATIVE_OUTCOME_EVENTS.has(eventType)) return 'negative';
  return 'neutral';
}

/**
 * Finds the most recent agent decision for a lead within the attribution window.
 * This is the decision most likely to have contributed to the funnel event.
 *
 * @param leadId - The lead ID to look up
 * @param beforeTimestamp - Only consider decisions before this time (defaults to now)
 * @returns The most recent agent decision ID, or null if none found
 */
export async function findRecentAgentDecision(
  leadId: string,
  beforeTimestamp?: Date
): Promise<string | null> {
  const db = getDb();
  const cutoff = beforeTimestamp ?? new Date();
  const windowStart = new Date(
    cutoff.getTime() - ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const [decision] = await db
    .select({ id: agentDecisions.id })
    .from(agentDecisions)
    .where(
      and(
        eq(agentDecisions.leadId, leadId),
        lt(agentDecisions.createdAt, cutoff),
        gte(agentDecisions.createdAt, windowStart)
      )
    )
    .orderBy(desc(agentDecisions.createdAt))
    .limit(1);

  return decision?.id ?? null;
}

/**
 * Updates an agent decision's outcome based on a funnel event.
 * Only upgrades outcomes: neutral → positive, but never positive → neutral.
 * Negative always overrides.
 *
 * @param agentDecisionId - The decision to update
 * @param eventType - The funnel event type that triggered this update
 * @param eventDetails - Optional description of what happened
 */
export async function updateDecisionOutcome(
  agentDecisionId: string,
  eventType: FunnelEventType,
  eventDetails?: string
): Promise<void> {
  const db = getDb();
  const newOutcome = classifyOutcome(eventType);

  // Fetch current outcome to avoid downgrading
  const [current] = await db
    .select({ outcome: agentDecisions.outcome })
    .from(agentDecisions)
    .where(eq(agentDecisions.id, agentDecisionId))
    .limit(1);

  if (!current) return;

  // Only upgrade: null → any, neutral → positive, any → negative
  const shouldUpdate =
    current.outcome === null ||
    current.outcome === 'pending' ||
    (current.outcome === 'neutral' && newOutcome === 'positive') ||
    newOutcome === 'negative';

  if (!shouldUpdate) return;

  await db
    .update(agentDecisions)
    .set({
      outcome: newOutcome,
      outcomeDetails: eventDetails ?? `Funnel event: ${eventType}`,
    })
    .where(eq(agentDecisions.id, agentDecisionId));
}

/**
 * Performs attribution for a funnel event:
 * 1. Finds the most recent agent decision for the lead
 * 2. Links the funnel event to that decision
 * 3. Updates the decision's outcome based on the event type
 *
 * @param funnelEventId - The newly created funnel event ID
 * @param leadId - The lead this event is for
 * @param eventType - The type of funnel event
 * @returns The attributed agent decision ID, or null if no decision found
 */
export async function attributeFunnelEvent(
  funnelEventId: string,
  leadId: string,
  eventType: FunnelEventType
): Promise<string | null> {
  const agentDecisionId = await findRecentAgentDecision(leadId);

  if (!agentDecisionId) return null;

  const db = getDb();

  // Link funnel event to agent decision
  await db
    .update(funnelEvents)
    .set({ agentDecisionId })
    .where(eq(funnelEvents.id, funnelEventId));

  // Update the decision's outcome
  await updateDecisionOutcome(agentDecisionId, eventType);

  return agentDecisionId;
}
