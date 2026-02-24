import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { clients } from '@/db/schema';
import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import {
  clearOnboardingQualityOverride,
  getLatestOnboardingQualitySnapshot,
  getOnboardingQualityReadiness,
  setOnboardingQualityOverride,
} from '@/lib/services/onboarding-quality';

const setOverrideSchema = z.object({
  action: z.literal('set_override'),
  reason: z.string().min(10).max(2000),
  allowAutonomousMode: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  enableAutonomousModeNow: z.boolean().optional(),
});

const clearOverrideSchema = z.object({
  action: z.literal('clear_override'),
  reason: z.string().max(500).optional(),
});

const reevaluateSchema = z.object({
  action: z.literal('reevaluate'),
});

const patchSchema = z.discriminatedUnion('action', [
  setOverrideSchema,
  clearOverrideSchema,
  reevaluateSchema,
]);

/** GET /api/admin/clients/[id]/onboarding/quality */
export const GET = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_VIEW,
    clientIdFrom: (params) => params.id,
  },
  async ({ clientId, session }) => {
    const readiness = await getOnboardingQualityReadiness({
      clientId,
      source: 'admin_view',
      evaluatedByPersonId: session.personId,
      persistSnapshot: true,
    });
    const latestSnapshot = await getLatestOnboardingQualitySnapshot(clientId);

    return NextResponse.json({
      success: true,
      ...readiness,
      latestSnapshot,
    });
  }
);

/** PATCH /api/admin/clients/[id]/onboarding/quality */
export const PATCH = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_EDIT,
    clientIdFrom: (params) => params.id,
  },
  async ({ request, clientId, session }) => {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const db = getDb();

    if (body.action === 'set_override') {
      await setOnboardingQualityOverride({
        clientId,
        approvedByPersonId: session.personId,
        reason: body.reason,
        allowAutonomousMode: body.allowAutonomousMode ?? true,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      });

      if (body.enableAutonomousModeNow === true && (body.allowAutonomousMode ?? true)) {
        await db
          .update(clients)
          .set({
            aiAgentMode: 'autonomous',
            updatedAt: new Date(),
          })
          .where(eq(clients.id, clientId));
      }
    }

    if (body.action === 'clear_override') {
      await clearOnboardingQualityOverride({
        clientId,
        clearedByPersonId: session.personId,
        reason: body.reason,
      });
    }

    const readiness = await getOnboardingQualityReadiness({
      clientId,
      source: body.action === 'reevaluate' ? 'admin_reevaluate' : 'admin_update',
      evaluatedByPersonId: session.personId,
      persistSnapshot: true,
    });
    const latestSnapshot = await getLatestOnboardingQualitySnapshot(clientId);

    return NextResponse.json({
      success: true,
      ...readiness,
      latestSnapshot,
    });
  }
);
