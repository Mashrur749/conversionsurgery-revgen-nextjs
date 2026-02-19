import { NextRequest, NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/** GET /api/client/ai-settings - Fetch AI settings for the authenticated client. */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.SETTINGS_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const [settings] = await db
    .select()
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, session.clientId))
    .limit(1);

  if (!settings) {
    return NextResponse.json({
      agentTone: 'professional',
      useEmojis: false,
      signMessages: false,
      primaryGoal: 'book_appointment',
      canScheduleAppointments: true,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
    });
  }

  return NextResponse.json({
    agentTone: settings.agentTone,
    useEmojis: settings.useEmojis,
    signMessages: settings.signMessages,
    primaryGoal: settings.primaryGoal,
    canScheduleAppointments: settings.canScheduleAppointments,
    quietHoursEnabled: settings.quietHoursEnabled,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
  });
}

const updateSchema = z.object({
  agentTone: z.enum(['professional', 'friendly', 'casual']).optional(),
  useEmojis: z.boolean().optional(),
  signMessages: z.boolean().optional(),
  primaryGoal: z.enum(['book_appointment', 'get_quote_request', 'collect_info']).optional(),
  canScheduleAppointments: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
}).strict();

/** PUT /api/client/ai-settings - Update AI settings for the authenticated client. */
export async function PUT(request: NextRequest) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.SETTINGS_AI);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: clientAgentSettings.id })
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, session.clientId))
    .limit(1);

  if (existing) {
    await db
      .update(clientAgentSettings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(clientAgentSettings.clientId, session.clientId));
  } else {
    await db
      .insert(clientAgentSettings)
      .values({ clientId: session.clientId, ...parsed.data });
  }

  return NextResponse.json({ ok: true });
}
