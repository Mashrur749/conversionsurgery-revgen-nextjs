import { ComplianceService } from './compliance-service';
import { getDb, leads } from '@/db';
import { eq, and } from 'drizzle-orm';

interface InboundMessage {
  from: string;
  to: string;
  body: string;
  messageId: string;
  clientId: string;
}

interface OptOutResponse {
  isOptOut: boolean;
  isOptIn: boolean;
  handled: boolean;
  responseMessage?: string;
}

export async function handleInboundMessage(
  message: InboundMessage
): Promise<OptOutResponse> {
  const { from, body, messageId, clientId } = message;

  // Check for opt-out keywords
  if (ComplianceService.isOptOutMessage(body)) {
    await ComplianceService.recordOptOut(
      clientId,
      from,
      'stop_keyword',
      body,
      messageId
    );

    // Update lead status if exists
    const db = getDb();
    const normalizedPhone = ComplianceService.normalizePhoneNumber(from);
    await db
      .update(leads)
      .set({
        status: 'opted_out',
        optedOut: true,
        optedOutAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(leads.clientId, clientId), eq(leads.phone, normalizedPhone))
      );

    return {
      isOptOut: true,
      isOptIn: false,
      handled: true,
      responseMessage:
        'You have been unsubscribed and will no longer receive messages from us. Reply START to resubscribe.',
    };
  }

  // Check for opt-in keywords
  if (ComplianceService.isOptInMessage(body)) {
    // Re-consent via text opt-in
    await ComplianceService.recordConsent(clientId, from, {
      type: 'express_written',
      source: 'text_optin',
      scope: {
        marketing: true,
        transactional: true,
        promotional: true,
        reminders: true,
      },
      language:
        'By replying START, you consent to receive automated text messages from us. Reply STOP to unsubscribe.',
    });

    // Update lead status
    const db = getDb();
    const normalizedPhone = ComplianceService.normalizePhoneNumber(from);
    await db
      .update(leads)
      .set({
        status: 'active',
        optedOut: false,
        optedOutAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(leads.clientId, clientId), eq(leads.phone, normalizedPhone))
      );

    return {
      isOptOut: false,
      isOptIn: true,
      handled: true,
      responseMessage:
        'You have been resubscribed! You will now receive messages from us. Reply STOP to unsubscribe.',
    };
  }

  return {
    isOptOut: false,
    isOptIn: false,
    handled: false,
  };
}
