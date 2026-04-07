import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { integrationWebhooks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z
  .object({
    webhookUrl: z.string().url().optional(),
    secretKey: z.string().max(255).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const PATCH = adminClientRoute<{ id: string; webhookId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { webhookId } = params;

    const body = await request.json();
    const data = updateSchema.parse(body);

    const db = getDb();

    const updateValues: Partial<{
      webhookUrl: string | null;
      secretKey: string | null;
      enabled: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (data.webhookUrl !== undefined) {
      updateValues.webhookUrl = data.webhookUrl;
    }
    if (data.secretKey !== undefined) {
      updateValues.secretKey = data.secretKey;
    }
    if (data.enabled !== undefined) {
      updateValues.enabled = data.enabled;
    }

    const [updated] = await db
      .update(integrationWebhooks)
      .set(updateValues)
      .where(
        and(
          eq(integrationWebhooks.id, webhookId),
          eq(integrationWebhooks.clientId, clientId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ webhook: updated });
  }
);

export const DELETE = adminClientRoute<{ id: string; webhookId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ params, clientId }) => {
    const { webhookId } = params;

    const db = getDb();

    const [deleted] = await db
      .delete(integrationWebhooks)
      .where(
        and(
          eq(integrationWebhooks.id, webhookId),
          eq(integrationWebhooks.clientId, clientId)
        )
      )
      .returning({ id: integrationWebhooks.id });

    if (!deleted) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
