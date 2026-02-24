import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AI_ASSIST_CATEGORIES, AI_ASSIST_CATEGORY } from '@/lib/services/ai-send-policy';

// Subset of feature flags safe for client self-service
const CLIENT_SAFE_TOGGLES = [
  'missedCallSmsEnabled',
  'aiResponseEnabled',
  'smartAssistEnabled',
  'smartAssistDelayMinutes',
  'smartAssistManualCategories',
  'photoRequestsEnabled',
  'notificationEmail',
  'notificationSms',
] as const;

type ClientFeatureUpdates = {
  missedCallSmsEnabled?: boolean;
  aiResponseEnabled?: boolean;
  smartAssistEnabled?: boolean;
  smartAssistDelayMinutes?: number;
  smartAssistManualCategories?: string[];
  photoRequestsEnabled?: boolean;
  notificationEmail?: boolean;
  notificationSms?: boolean;
};

/** GET /api/client/features - Fetch safe feature toggles for the authenticated client. */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, session.clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const toggles: Record<string, boolean | number | string[]> = {};
    for (const key of CLIENT_SAFE_TOGGLES) {
      if (key === 'smartAssistDelayMinutes') {
        toggles[key] = client.smartAssistDelayMinutes ?? 5;
        continue;
      }
      if (key === 'smartAssistManualCategories') {
        const raw = client.smartAssistManualCategories;
        toggles[key] = Array.isArray(raw)
          ? raw.filter((item): item is string => typeof item === 'string')
          : [AI_ASSIST_CATEGORY.ESTIMATE_FOLLOWUP, AI_ASSIST_CATEGORY.PAYMENT];
        continue;
      }
      toggles[key] = (client[key] as boolean | null) ?? true;
    }

    return NextResponse.json(toggles);
  }
);

const updateSchema = z.object({
  missedCallSmsEnabled: z.boolean().optional(),
  aiResponseEnabled: z.boolean().optional(),
  smartAssistEnabled: z.boolean().optional(),
  smartAssistDelayMinutes: z.number().int().min(1).max(60).optional(),
  smartAssistManualCategories: z.array(z.enum(AI_ASSIST_CATEGORIES)).optional(),
  photoRequestsEnabled: z.boolean().optional(),
  notificationEmail: z.boolean().optional(),
  notificationSms: z.boolean().optional(),
}).strict();

/** PUT /api/client/features - Update safe feature toggles for the authenticated client. */
export const PUT = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session }) => {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Only allow the safe subset
    const updates: ClientFeatureUpdates = {};

    if (parsed.data.missedCallSmsEnabled !== undefined) {
      updates.missedCallSmsEnabled = parsed.data.missedCallSmsEnabled;
    }
    if (parsed.data.aiResponseEnabled !== undefined) {
      updates.aiResponseEnabled = parsed.data.aiResponseEnabled;
    }
    if (parsed.data.smartAssistEnabled !== undefined) {
      updates.smartAssistEnabled = parsed.data.smartAssistEnabled;
    }
    if (parsed.data.smartAssistDelayMinutes !== undefined) {
      updates.smartAssistDelayMinutes = parsed.data.smartAssistDelayMinutes;
    }
    if (parsed.data.smartAssistManualCategories !== undefined) {
      updates.smartAssistManualCategories = parsed.data.smartAssistManualCategories;
    }
    if (parsed.data.photoRequestsEnabled !== undefined) {
      updates.photoRequestsEnabled = parsed.data.photoRequestsEnabled;
    }
    if (parsed.data.notificationEmail !== undefined) {
      updates.notificationEmail = parsed.data.notificationEmail;
    }
    if (parsed.data.notificationSms !== undefined) {
      updates.notificationSms = parsed.data.notificationSms;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const db = getDb();
    await db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, session.clientId));

    return NextResponse.json({ ok: true });
  }
);
