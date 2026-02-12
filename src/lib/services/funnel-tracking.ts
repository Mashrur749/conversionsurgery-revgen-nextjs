import { getDb } from '@/db';
import { funnelEvents } from '@/db/schema';

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

/**
 * Track a funnel event
 * Records lead progression through the conversion funnel
 * @param params - Event parameters including clientId, leadId, eventType
 */
export async function trackFunnelEvent(
  params: TrackFunnelEventParams
): Promise<void> {
  const db = getDb();
  await db.insert(funnelEvents).values({
    clientId: params.clientId,
    leadId: params.leadId,
    eventType: params.eventType,
    valueCents: params.valueCents,
    source: params.source,
    campaign: params.campaign,
    eventData: params.eventData,
  });
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
