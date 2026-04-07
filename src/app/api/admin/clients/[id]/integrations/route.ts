import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { integrationWebhooks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();

    const webhooks = await db
      .select()
      .from(integrationWebhooks)
      .where(eq(integrationWebhooks.clientId, clientId))
      .orderBy(desc(integrationWebhooks.createdAt));

    return NextResponse.json({ webhooks });
  }
);

const createSchema = z
  .object({
    provider: z.enum(['jobber', 'servicetitan', 'housecall_pro', 'zapier', 'generic']),
    direction: z.enum(['outbound', 'inbound']),
    eventType: z.string().min(1).max(100),
    webhookUrl: z.string().url().optional(),
    secretKey: z.string().max(255).optional(),
  })
  .strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = createSchema.parse(body);

    const db = getDb();

    const [webhook] = await db
      .insert(integrationWebhooks)
      .values({
        clientId,
        provider: data.provider,
        direction: data.direction,
        eventType: data.eventType,
        webhookUrl: data.webhookUrl ?? null,
        secretKey: data.secretKey ?? null,
      })
      .returning();

    return NextResponse.json({ webhook });
  }
);
