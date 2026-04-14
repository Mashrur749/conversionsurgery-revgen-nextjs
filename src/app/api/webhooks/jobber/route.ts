import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { integrationWebhooks, leads } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { computeWebhookSignature } from '@/lib/services/integration-events';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** Zod schema for inbound Jobber job_completed events */
const jobberEventSchema = z.object({
  event: z.literal('job_completed'),
  job: z.object({
    id: z.string(),
    completedAt: z.string(),
    value: z.number().optional(),
  }),
  lead: z.object({
    phone: z.string(),
    name: z.string().optional(),
    email: z.string().optional(),
  }),
});

/** POST /api/webhooks/jobber
 *
 * Accepts job_completed events from Jobber (or Zapier acting as Jobber).
 * Validates the HMAC-SHA256 signature, looks up the matching lead, and
 * triggers the review-request automation when the job is completed.
 */
export async function POST(request: Request) {
  // Read body as text first so we can verify the signature before parsing
  let body: string;
  try {
    body = await request.text();
  } catch (err) {
    return safeErrorResponse('[Jobber][webhook.read]', err, 'Failed to read request body', 400);
  }

  const signature = request.headers.get('x-cs-signature');
  const clientId = request.headers.get('x-cs-client-id');

  if (!clientId) {
    return NextResponse.json({ error: 'Missing X-CS-Client-Id header' }, { status: 400 });
  }

  if (!signature) {
    return NextResponse.json({ error: 'Missing X-CS-Signature header' }, { status: 401 });
  }

  // Look up the inbound Jobber webhook config for this client
  const db = getDb();

  let webhookRow: (typeof integrationWebhooks.$inferSelect) | undefined;

  try {
    const rows = await db
      .select()
      .from(integrationWebhooks)
      .where(
        and(
          eq(integrationWebhooks.clientId, clientId),
          eq(integrationWebhooks.provider, 'jobber'),
          eq(integrationWebhooks.direction, 'inbound'),
          eq(integrationWebhooks.enabled, true)
        )
      )
      .limit(1);

    webhookRow = rows[0];
  } catch (err) {
    return safeErrorResponse('[Jobber][webhook.lookup]', err, 'Internal server error', 500);
  }

  if (!webhookRow) {
    return NextResponse.json(
      { error: 'No active Jobber integration found for this client' },
      { status: 404 }
    );
  }

  // Verify HMAC-SHA256 signature (XDOM-24: always required — never accept unauthenticated payloads)
  if (!webhookRow.secretKey) {
    return NextResponse.json(
      { error: 'Webhook secret key not configured — integration setup incomplete' },
      { status: 401 }
    );
  }

  const expectedSignature = computeWebhookSignature(body, webhookRow.secretKey);
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse and validate the event payload
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = jobberEventSchema.safeParse(parsedBody);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid event payload', details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { lead: leadInput } = result.data;

  // Normalize phone number for consistent lookup
  const normalizedPhone = normalizePhoneNumber(leadInput.phone);

  // Look up the lead by phone number within this client
  let leadRow: (typeof leads.$inferSelect) | undefined;

  try {
    const leadRows = await db
      .select()
      .from(leads)
      .where(and(eq(leads.clientId, clientId), eq(leads.phone, normalizedPhone)))
      .limit(1);

    leadRow = leadRows[0];
  } catch (err) {
    return safeErrorResponse('[Jobber][webhook.lead-lookup]', err, 'Internal server error', 500);
  }

  if (!leadRow) {
    // Log but return 200 — Jobber should not retry on our data gap
    console.warn(
      `[Jobber][webhook] No lead found for phone ${normalizedPhone} (client ${clientId}) — skipping review trigger`
    );
    await updateLastTriggered(db, webhookRow.id);
    return NextResponse.json({ success: true });
  }

  // Only trigger review request for leads in a relevant status
  const eligibleStatuses = new Set(['won', 'appointment_scheduled', 'completed']);
  if (!leadRow.status || !eligibleStatuses.has(leadRow.status)) {
    console.warn(
      `[Jobber][webhook] Lead ${leadRow.id} has status '${leadRow.status}' — not eligible for review trigger`
    );
    await updateLastTriggered(db, webhookRow.id);
    return NextResponse.json({ success: true });
  }

  try {
    // Update lead status to 'completed' if not already
    if (leadRow.status !== 'completed') {
      await db
        .update(leads)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(leads.id, leadRow.id));
    }

    // Trigger review generation automation
    const { startReviewRequest } = await import('@/lib/automations/review-request');
    await startReviewRequest({ leadId: leadRow.id, clientId });
  } catch (err) {
    logSanitizedConsoleError(
      '[Jobber][webhook.review-trigger]',
      err instanceof Error ? err : new Error(String(err))
    );
    // Still return 200 to prevent Jobber retries — the lead was found and status updated
  }

  await updateLastTriggered(db, webhookRow.id);

  return NextResponse.json({ success: true });
}

/** Update lastTriggeredAt on the webhook row after processing */
async function updateLastTriggered(
  db: ReturnType<typeof getDb>,
  webhookId: string
): Promise<void> {
  try {
    await db
      .update(integrationWebhooks)
      .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
      .where(eq(integrationWebhooks.id, webhookId));
  } catch (err) {
    logSanitizedConsoleError(
      '[Jobber][webhook.update-triggered]',
      err instanceof Error ? err : new Error(String(err))
    );
  }
}
