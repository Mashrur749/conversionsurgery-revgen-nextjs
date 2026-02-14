import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

/**
 * Send an SMS message via Twilio
 * @param to - Recipient phone number in E.164 format
 * @param body - Message content
 * @param from - Sender phone number (Twilio number)
 * @returns Message SID from Twilio
 */
export async function sendSMS(
  to: string,
  body: string,
  from: string,
  options?: { mediaUrl?: string[] }
): Promise<string> {
  try {
    const statusCallback = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status`
      : undefined;
    const message = await client.messages.create({
      to,
      from,
      body,
      statusCallback,
      ...(options?.mediaUrl?.length ? { mediaUrl: options.mediaUrl } : {}),
    });
    console.log('[Messaging] SMS sent:', message.sid);
    return message.sid;
  } catch (error) {
    console.error('[Messaging] Twilio SMS error:', error);
    throw error;
  }
}

/**
 * Send a tracked SMS message with metadata
 * @param to - Recipient phone number in E.164 format
 * @param body - Message content
 * @param from - Sender phone number (Twilio number)
 * @param metadata - Additional metadata to track with the message
 * @returns Message SID from Twilio
 */
export async function sendTrackedSMS(
  to: string,
  body: string,
  from: string,
  metadata: Record<string, any>
): Promise<string> {
  try {
    const message = await client.messages.create({
      to,
      from,
      body,
      statusCallback: metadata.statusCallback,
    });
    console.log('[Messaging] Tracked SMS sent:', message.sid, metadata);
    return message.sid;
  } catch (error) {
    console.error('[Messaging] Twilio tracked SMS error:', error);
    throw error;
  }
}

/**
 * Validate a Twilio webhook request signature
 * @param request - The incoming HTTP request
 * @returns True if the signature is valid
 */
export function validateTwilioWebhook(request: Request): boolean {
  try {
    const signature = request.headers.get('X-Twilio-Signature');
    if (!signature) {
      console.error('[Messaging] Missing Twilio signature header');
      return false;
    }

    const url = request.url;
    // For form data, we'd need to parse the body, but this is a simplified version
    // In production, you'd extract params from the request body
    const params: Record<string, string> = {};

    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params
    );

    if (!isValid) {
      console.error('[Messaging] Invalid Twilio webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('[Messaging] Webhook validation error:', error);
    return false;
  }
}
