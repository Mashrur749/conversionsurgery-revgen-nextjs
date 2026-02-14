import twilio from 'twilio';
import { trackUsage } from '@/lib/services/usage-tracking';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface SendSMSParams {
  clientId: string;
  to: string;
  from: string;
  body: string;
  leadId?: string;
  mediaUrl?: string[];
}

/**
 * Send SMS with usage tracking
 */
export async function sendTrackedSMS(params: SendSMSParams) {
  const { clientId, to, from, body, leadId, mediaUrl } = params;

  const statusCallback = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status`
    : undefined;
  const message = await twilioClient.messages.create({
    to,
    from,
    body,
    mediaUrl,
    statusCallback,
  });

  // Calculate segments (SMS = 160 chars, with special chars = 70)
  const hasUnicode = /[^\x00-\x7F]/.test(body);
  const charsPerSegment = hasUnicode ? 70 : 160;
  const segments = Math.ceil(body.length / charsPerSegment);

  const operation = mediaUrl?.length ? 'mms_outbound' : 'outbound';

  // Track usage
  trackUsage({
    clientId,
    service: 'twilio_sms',
    operation,
    units: segments,
    leadId,
    externalId: message.sid,
    metadata: {
      to,
      from,
      segments,
      status: message.status,
    },
  }).catch(err => console.error('Usage tracking error:', err));

  return message;
}

/**
 * Track inbound SMS (called from webhook)
 */
export async function trackInboundSMS(params: {
  clientId: string;
  leadId?: string;
  messageSid: string;
  numSegments: number;
  numMedia: number;
}) {
  const operation = params.numMedia > 0 ? 'mms_inbound' : 'inbound';

  await trackUsage({
    clientId: params.clientId,
    service: 'twilio_sms',
    operation,
    units: params.numSegments,
    leadId: params.leadId,
    externalId: params.messageSid,
    metadata: {
      numMedia: params.numMedia,
    },
  });
}

/**
 * Track phone number provisioning
 */
export async function trackPhoneProvisioning(params: {
  clientId: string;
  phoneNumber: string;
  type: 'local' | 'toll_free';
}) {
  await trackUsage({
    clientId: params.clientId,
    service: 'twilio_phone',
    operation: params.type,
    units: 1,
    externalId: params.phoneNumber,
  });
}

// Re-export client for direct access if needed
export { twilioClient };
