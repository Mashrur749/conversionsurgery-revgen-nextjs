import { getDb } from '@/db';
import { clients, webhookLog } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Dispatch a webhook event to a client's configured webhook URL.
 * Includes HMAC signature, retry logic (3 attempts), and logging.
 */
export async function dispatchWebhook(
  clientId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<{ sent: boolean; statusCode?: number }> {
  const db = getDb();

  const [client] = await db
    .select({
      webhookUrl: clients.webhookUrl,
      webhookEvents: clients.webhookEvents,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.webhookUrl) return { sent: false };

  // Check if client subscribes to this event type
  const events = (client.webhookEvents as string[] | null) ?? [];
  if (events.length > 0 && !events.includes(eventType)) {
    return { sent: false };
  }

  const payload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);
  const webhookSecret = process.env.FORM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Webhook] FORM_WEBHOOK_SECRET is not configured — skipping webhook dispatch');
    return { sent: false };
  }

  const signature = createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  let lastStatus = 0;
  let success = false;

  // Retry up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(client.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = res.status;

      if (res.ok) {
        success = true;
        break;
      }
    } catch (error) {
      console.error(`[Webhook] Attempt ${attempt} failed for ${clientId}:`, error);
    }

    // Wait before retry (1s, 2s)
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }

  // Log delivery
  try {
    await db.insert(webhookLog).values({
      clientId,
      eventType,
      payload: data,
      responseStatus: lastStatus,
      responseBody: success ? 'OK' : 'Failed after 3 attempts',
    });
  } catch {
    // Don't fail the main flow if logging fails
  }

  return { sent: success, statusCode: lastStatus };
}
