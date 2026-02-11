import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getNotificationPrefs, updateNotificationPrefs } from '@/lib/services/notification-preferences';

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

export async function GET() {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prefs = await getNotificationPrefs(clientId);
    return NextResponse.json({ prefs });
  } catch (error) {
    console.error('Get notification prefs error:', error);
    return NextResponse.json({ error: 'Failed to get preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
  } catch (error) {
    console.error('Update notification prefs error:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
