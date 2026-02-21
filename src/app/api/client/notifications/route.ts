import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getNotificationPrefs, updateNotificationPrefs } from '@/lib/services/notification-preferences';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

const updateSchema = z.object({
  smsNewLead: z.boolean().optional(),
  smsEscalation: z.boolean().optional(),
  smsWeeklySummary: z.boolean().optional(),
  smsFlowApproval: z.boolean().optional(),
  smsNegativeReview: z.boolean().optional(),
  emailNewLead: z.boolean().optional(),
  emailDailySummary: z.boolean().optional(),
  emailWeeklySummary: z.boolean().optional(),
  emailMonthlyReport: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  urgentOverride: z.boolean().optional(),
});

export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
  async ({ session }) => {
    const { clientId } = session;

    try {
      const prefs = await getNotificationPrefs(clientId);
      return NextResponse.json({ prefs });
    } catch (error) {
      console.error('Get notification prefs error:', error);
      return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
    }
  }
);

export const PUT = portalRoute(
  { permission: PORTAL_PERMISSIONS.SETTINGS_EDIT },
  async ({ request, session }) => {
    const { clientId } = session;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await updateNotificationPrefs(clientId, parsed.data);
    return NextResponse.json({ success: true });
  }
);
