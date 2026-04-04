import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const patchAgentSettingsSchema = z
  .object({
    canDiscussPricing: z.boolean().optional(),
    canScheduleAppointments: z.boolean().optional(),
    canSendPaymentLinks: z.boolean().optional(),
  })
  .strict();

export const PATCH = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const data = patchAgentSettingsSchema.parse(body);

    const db = getDb();

    const [existing] = await db
      .select({ id: clientAgentSettings.id })
      .from(clientAgentSettings)
      .where(eq(clientAgentSettings.clientId, clientId))
      .limit(1);

    if (!existing) {
      // Insert a new row with defaults + the incoming values
      const [inserted] = await db
        .insert(clientAgentSettings)
        .values({ clientId, ...data, updatedAt: new Date() })
        .returning();
      return NextResponse.json({ agentSettings: inserted });
    }

    const [updated] = await db
      .update(clientAgentSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clientAgentSettings.clientId, clientId))
      .returning();

    return NextResponse.json({ agentSettings: updated });
  }
);
