import { createHmac } from 'crypto';
import { getDb } from '@/db';
import { integrationWebhooks } from '@/db/schema';
import type { IntegrationWebhook } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/** Auto-disable threshold: webhooks with this many consecutive failures are turned off */
const MAX_FAILURE_COUNT = 10;

/**
 * Compute an HMAC-SHA256 signature for a webhook payload.
 *
 * @param payload - The raw JSON string to sign
 * @param secret  - The shared secret key
 * @returns Hex-encoded HMAC-SHA256 digest
 */
export function computeWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Dispatch an integration event to all enabled outbound webhooks configured
 * for the given client and event type.
 *
 * Fire-and-forget: failures are logged and failure counts incremented, but
 * this function never throws. The caller is not blocked by delivery errors.
 *
 * @param clientId  - UUID of the client whose webhooks to target
 * @param eventType - Event identifier (e.g. 'appointment_booked', 'job_completed')
 * @param payload   - Event data to serialize and POST
 */
export async function dispatchIntegrationEvent(
  clientId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();

  let webhooks: IntegrationWebhook[];

  try {
    webhooks = await db
      .select()
      .from(integrationWebhooks)
      .where(
        and(
          eq(integrationWebhooks.clientId, clientId),
          eq(integrationWebhooks.eventType, eventType),
          eq(integrationWebhooks.direction, 'outbound'),
          eq(integrationWebhooks.enabled, true)
        )
      );
  } catch (err) {
    logSanitizedConsoleError(
      '[IntegrationEvents][dispatch.query]',
      err instanceof Error ? err : new Error(String(err))
    );
    return;
  }

  if (webhooks.length === 0) return;

  const body = JSON.stringify({ event: eventType, ...payload });

  await Promise.allSettled(
    webhooks.map((webhook) => deliverWebhook(webhook, eventType, body))
  );
}

/**
 * Deliver a single outbound webhook POST and update delivery metadata.
 * Internal helper — not exported.
 */
async function deliverWebhook(
  webhook: IntegrationWebhook,
  eventType: string,
  body: string
): Promise<void> {
  const db = getDb();

  if (!webhook.webhookUrl) {
    console.warn(`[IntegrationEvents] Webhook ${webhook.id} has no webhookUrl — skipping`);
    return;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CS-Event': eventType,
  };

  if (webhook.secretKey) {
    headers['X-CS-Signature'] = computeWebhookSignature(body, webhook.secretKey);
  }

  try {
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // Success — update lastTriggeredAt and reset failure count
    await db
      .update(integrationWebhooks)
      .set({
        lastTriggeredAt: new Date(),
        failureCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(integrationWebhooks.id, webhook.id));
  } catch (err) {
    const newFailureCount = (webhook.failureCount ?? 0) + 1;
    const shouldDisable = newFailureCount >= MAX_FAILURE_COUNT;

    console.warn(
      `[IntegrationEvents] Delivery failed for webhook ${webhook.id} (failure ${newFailureCount}/${MAX_FAILURE_COUNT})${shouldDisable ? ' — auto-disabling' : ''}:`,
      err instanceof Error ? err.message : String(err)
    );

    await db
      .update(integrationWebhooks)
      .set({
        failureCount: newFailureCount,
        ...(shouldDisable ? { enabled: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(integrationWebhooks.id, webhook.id));
  }
}
