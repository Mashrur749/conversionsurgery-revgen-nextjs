/**
 * Forwarding Verification Service (FMA 4.5)
 *
 * Places a test outbound call from the client's Twilio number to their
 * business number to verify that call forwarding is configured correctly.
 *
 * The call flows: Twilio number → contractor's business number → should
 * forward back to the Twilio number. The AMD result and call status are
 * reported to /api/webhooks/twilio/verification-status.
 */

import { getDb } from '@/db';
import { clients, clientPhoneNumbers, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTwilioClient } from '@/lib/services/twilio';
import { resolveFeatureFlag } from '@/lib/services/feature-flags';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

const VERIFICATION_TWIML = `<Response><Say voice="alice">This is an automated test call from Conversion Surgery to verify your call forwarding. No action needed.</Say><Hangup/></Response>`;

/**
 * Initiate a verification call for a client's call forwarding setup.
 *
 * Places a call from the client's Twilio number to their business number.
 * If forwarding is configured correctly the call will loop back through
 * the Twilio number and AMD will detect a human/unknown answer.
 */
export async function initiateVerificationCall(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Step 1: look up the client's business phone
  const [client] = await db
    .select({ phone: clients.phone })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return { success: false, error: 'Client not found' };
  }

  if (!client.phone) {
    return { success: false, error: 'Client has no business phone number' };
  }

  // Step 2: look up the client's primary active Twilio number
  const [phoneRecord] = await db
    .select({ phoneNumber: clientPhoneNumbers.phoneNumber })
    .from(clientPhoneNumbers)
    .where(
      and(
        eq(clientPhoneNumbers.clientId, clientId),
        eq(clientPhoneNumbers.isPrimary, true),
        eq(clientPhoneNumbers.isActive, true)
      )
    )
    .limit(1);

  if (!phoneRecord) {
    return { success: false, error: 'No Twilio number assigned' };
  }

  const twilioNumber = phoneRecord.phoneNumber;
  const businessPhone = client.phone;

  // Step 3: check feature flag
  const enabled = await resolveFeatureFlag(clientId, 'forwardingVerification');
  if (!enabled) {
    return { success: false, error: 'Forwarding verification feature is disabled' };
  }

  // Step 4: mark status as pending
  await db
    .update(clients)
    .set({ forwardingVerificationStatus: 'pending', updatedAt: new Date() })
    .where(eq(clients.id, clientId));

  // Step 5: place the outbound verification call
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const statusCallback = `${appUrl}/api/webhooks/twilio/verification-status`;

  let callSid: string;
  try {
    const twilioClient = getTwilioClient();
    const call = await twilioClient.calls.create({
      from: twilioNumber,
      to: businessPhone,
      twiml: VERIFICATION_TWIML,
      statusCallback,
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed', 'canceled'],
      machineDetection: 'Enable',
      timeout: 20,
    });
    callSid = call.sid;
    console.log('[ForwardingVerification] Verification call placed:', callSid, { clientId });
  } catch (error) {
    logSanitizedConsoleError('[ForwardingVerification] Failed to place verification call', error, {
      clientId,
    });
    // Reset status since the call did not go out
    await db
      .update(clients)
      .set({ forwardingVerificationStatus: 'failed', updatedAt: new Date() })
      .where(eq(clients.id, clientId));
    return { success: false, error: 'Failed to place verification call' };
  }

  // Step 6: write audit log
  await db.insert(auditLog).values({
    clientId,
    action: 'forwarding_verification_attempt',
    metadata: { callSid, twilioNumber, businessPhone },
  });

  return { success: true };
}
