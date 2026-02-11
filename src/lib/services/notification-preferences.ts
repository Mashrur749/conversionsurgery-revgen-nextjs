import { getDb, notificationPreferences } from '@/db';
import { eq } from 'drizzle-orm';

export interface NotificationPrefs {
  smsNewLead: boolean;
  smsEscalation: boolean;
  smsWeeklySummary: boolean;
  smsFlowApproval: boolean;
  smsNegativeReview: boolean;
  emailNewLead: boolean;
  emailDailySummary: boolean;
  emailWeeklySummary: boolean;
  emailMonthlyReport: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  urgentOverride: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  smsNewLead: true,
  smsEscalation: true,
  smsWeeklySummary: true,
  smsFlowApproval: true,
  smsNegativeReview: true,
  emailNewLead: false,
  emailDailySummary: false,
  emailWeeklySummary: true,
  emailMonthlyReport: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  urgentOverride: true,
};

/** Fetch notification preferences for a client, creating defaults if none exist. */
export async function getNotificationPrefs(clientId: string): Promise<NotificationPrefs> {
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (!prefs) {
    await db.insert(notificationPreferences).values({
      clientId,
      ...DEFAULT_PREFS,
    });
    return DEFAULT_PREFS;
  }

  return {
    smsNewLead: prefs.smsNewLead,
    smsEscalation: prefs.smsEscalation,
    smsWeeklySummary: prefs.smsWeeklySummary,
    smsFlowApproval: prefs.smsFlowApproval,
    smsNegativeReview: prefs.smsNegativeReview,
    emailNewLead: prefs.emailNewLead,
    emailDailySummary: prefs.emailDailySummary,
    emailWeeklySummary: prefs.emailWeeklySummary,
    emailMonthlyReport: prefs.emailMonthlyReport,
    quietHoursEnabled: prefs.quietHoursEnabled,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
    urgentOverride: prefs.urgentOverride,
  };
}

/** Update notification preferences for a client, upserting if none exist. */
export async function updateNotificationPrefs(
  clientId: string,
  updates: Partial<NotificationPrefs>
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(notificationPreferences).values({
      clientId,
      ...DEFAULT_PREFS,
      ...updates,
    });
  } else {
    await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.clientId, clientId));
  }
}

/** Check if the current time falls within the client's quiet hours. */
export function isInQuietHours(prefs: NotificationPrefs): boolean {
  if (!prefs.quietHoursEnabled) return false;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const start = prefs.quietHoursStart;
  const end = prefs.quietHoursEnd;

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

/** Determine whether a notification should be sent based on preferences, quiet hours, and urgency. */
export async function shouldNotify(
  clientId: string,
  type: keyof NotificationPrefs,
  isUrgent: boolean = false
): Promise<boolean> {
  const prefs = await getNotificationPrefs(clientId);

  if (!prefs[type]) return false;

  if (isInQuietHours(prefs)) {
    if (isUrgent && prefs.urgentOverride) return true;
    return false;
  }

  return true;
}
