import { getDb } from '@/db';
import { funnelEvents } from '@/db/schema';
import { attributeFunnelEvent } from './ai-attribution';

export type FunnelEventType =
  | 'lead_created'
  | 'first_response'
  | 'qualified'
  | 'appointment_booked'
  | 'quote_requested'
  | 'quote_sent'
  | 'quote_accepted'
  | 'job_won'
  | 'job_lost'
  | 'payment_received'
  | 'review_requested'
  | 'review_received';

interface TrackFunnelEventParams {
  clientId: string;
  leadId: string;
  eventType: FunnelEventType;
  valueCents?: number;
  source?: string;
  campaign?: string;
  eventData?: Record<string, unknown>;
}

interface TrackFunnelEventResult {
  funnelEventId: string;
  agentDecisionId: string | null;
}

/**
 * Track a funnel event with automatic AI attribution.
 *
 * After inserting the event, looks for the most recent agent decision
 * for this lead and links them. Also updates the decision&apos;s outcome
 * based on the event type (positive for bookings/wins, negative for losses).
 *
 * @param params - Event parameters including clientId, leadId, eventType
 * @returns The created funnel event ID and attributed agent decision ID (if any)
 */
export async function trackFunnelEvent(
  params: TrackFunnelEventParams
): Promise<TrackFunnelEventResult> {
  const db = getDb();
  const [inserted] = await db
    .insert(funnelEvents)
    .values({
      clientId: params.clientId,
      leadId: params.leadId,
      eventType: params.eventType,
      valueCents: params.valueCents,
      source: params.source,
      campaign: params.campaign,
      eventData: params.eventData,
    })
    .returning({ id: funnelEvents.id });

  // Auto-attribute to the most recent agent decision for this lead
  let agentDecisionId: string | null = null;
  try {
    agentDecisionId = await attributeFunnelEvent(
      inserted.id,
      params.leadId,
      params.eventType
    );
  } catch {
    // Attribution is best-effort — never block funnel event creation
  }

  return { funnelEventId: inserted.id, agentDecisionId };
}

/**
 * Helper functions for common events
 */

/**
 * Track lead creation event
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param source - Lead source (e.g., 'missed_call', 'form', 'referral')
 */
export const trackLeadCreated = (
  clientId: string,
  leadId: string,
  source?: string
) => trackFunnelEvent({ clientId, leadId, eventType: 'lead_created', source });

/**
 * Track first response to a lead
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param responseTimeSeconds - Time to first response in seconds
 */
export const trackFirstResponse = (
  clientId: string,
  leadId: string,
  responseTimeSeconds: number
) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'first_response',
    eventData: { responseTimeSeconds },
  });

/**
 * Track appointment booking
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param appointmentDate - Appointment date string (optional)
 */
export const trackAppointmentBooked = (
  clientId: string,
  leadId: string,
  appointmentDate?: string
) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'appointment_booked',
    eventData: { appointmentDate },
  });

/**
 * Track job won
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param valueCents - Job value in cents
 */
export const trackJobWon = (
  clientId: string,
  leadId: string,
  valueCents: number
) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'job_won',
    valueCents,
  });

/**
 * Track payment received
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param amountCents - Payment amount in cents
 */
export const trackPaymentReceived = (
  clientId: string,
  leadId: string,
  amountCents: number
) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'payment_received',
    valueCents: amountCents,
  });

/**
 * Track review received
 * @param clientId - Client UUID
 * @param leadId - Lead UUID
 * @param rating - Review rating (1-5)
 * @param platform - Review platform name
 */
export const trackReviewReceived = (
  clientId: string,
  leadId: string,
  rating: number,
  platform: string
) =>
  trackFunnelEvent({
    clientId,
    leadId,
    eventType: 'review_received',
    eventData: { rating, platform },
  });
