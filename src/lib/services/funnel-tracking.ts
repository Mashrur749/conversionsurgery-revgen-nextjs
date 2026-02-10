import { getDb, funnelEvents } from '@/db';

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
export const trackLeadCreated = (
  clientId: string,
  leadId: string,
  source?: string
) => trackFunnelEvent({ clientId, leadId, eventType: 'lead_created', source });

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
