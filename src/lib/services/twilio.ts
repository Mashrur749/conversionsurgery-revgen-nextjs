import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

interface SMSResult {
  success: boolean;
  sid?: string;
  error?: unknown;
}

export async function sendSMS(to: string, from: string, body: string): Promise<SMSResult> {
  try {
    const message = await client.messages.create({ to, from, body });
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('Twilio SMS error:', error);
    return { success: false, error };
  }
}

export function validateTwilioWebhook(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}
