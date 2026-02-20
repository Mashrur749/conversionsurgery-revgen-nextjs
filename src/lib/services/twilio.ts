import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const SMS_MAX_RETRIES = 3;
const SMS_RETRY_BASE_DELAY_MS = 1000;

/**
 * Check if a Twilio error is retryable (transient network/server issues).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Twilio REST API errors with retryable status codes
    if ('status' in error) {
      const status = (error as { status: number }).status;
      // 429 = rate limited, 500+ = server errors
      return status === 429 || status >= 500;
    }
    // Network-level failures
    if (message.includes('econnreset') || message.includes('etimedout') ||
        message.includes('enotfound') || message.includes('socket hang up') ||
        message.includes('fetch failed')) {
      return true;
    }
  }
  return false;
}

/**
 * Send an SMS message via Twilio with retry logic.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s) for transient failures.
 * Non-retryable errors (invalid number, auth failure) throw immediately.
 *
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const statusCallback =
    appUrl && !appUrl.includes('localhost')
      ? `${appUrl}/api/webhooks/twilio/status`
      : undefined;

  let lastError: unknown;

  for (let attempt = 1; attempt <= SMS_MAX_RETRIES; attempt++) {
    try {
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
      lastError = error;

      if (!isRetryableError(error) || attempt === SMS_MAX_RETRIES) {
        console.error(`[Messaging] Twilio SMS error (attempt ${attempt}/${SMS_MAX_RETRIES}):`, error);
        throw error;
      }

      const delay = SMS_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`[Messaging] SMS attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
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
 * Validate a Twilio webhook request signature.
 * Must be called with the parsed form body params for accurate HMAC verification.
 * @param url - The full URL Twilio sent the request to
 * @param params - The parsed form body parameters (key-value pairs from the POST body)
 * @param signature - The X-Twilio-Signature header value
 * @returns True if the signature is valid
 */
export function validateTwilioWebhook(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[Messaging] TWILIO_AUTH_TOKEN not set — cannot validate webhook');
    return false;
  }

  try {
    const isValid = twilio.validateRequest(authToken, signature, url, params);

    if (!isValid) {
      console.error('[Messaging] Invalid Twilio webhook signature');
    }

    return isValid;
  } catch (error) {
    console.error('[Messaging] Webhook validation error:', error);
    return false;
  }
}

/**
 * Helper to extract and validate a Twilio webhook from a NextRequest.
 * Parses the form body, validates the signature, and returns the params if valid.
 * Returns null if validation fails.
 */
export async function validateAndParseTwilioWebhook(
  request: Request
): Promise<Record<string, string> | null> {
  const signature = request.headers.get('X-Twilio-Signature');
  if (!signature) {
    console.error('[Messaging] Missing Twilio signature header');
    return null;
  }

  // Twilio sends application/x-www-form-urlencoded
  const body = await request.text();
  const urlParams = new URLSearchParams(body);
  const params: Record<string, string> = {};
  urlParams.forEach((value, key) => {
    params[key] = value;
  });

  // Use the public-facing URL for validation (Twilio signs against the URL it sends to)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const requestUrl = new URL(request.url);
  const validationUrl = appUrl
    ? `${appUrl}${requestUrl.pathname}${requestUrl.search}`
    : request.url;

  if (!validateTwilioWebhook(validationUrl, params, signature)) {
    return null;
  }

  return params;
}
