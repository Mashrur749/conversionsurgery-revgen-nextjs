import { getDb, notificationPreferences, clients } from '@/db';
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
  /**
   * Decision F (Wave A Hardening, Phase 2): when TRUE, internal SMS alerts
   * addressed to this contractor's own phone are blocked during platform
   * quiet hours (9pm-10am in their timezone) instead of sending immediately.
   * Default FALSE = exempt (alerts always go through). Persisted on the
   * `clients` table, not `notification_preferences`.
   */
  contractorAlertQuietHoursEnabled: boolean;
}

// Defaults for the `notification_preferences`-backed app-level notification
// settings. The Decision F flag lives on `clients` and is excluded here.
const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPrefs, 'contractorAlertQuietHoursEnabled'> = {
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

const DEFAULT_PREFS: NotificationPrefs = {
  ...DEFAULT_NOTIFICATION_PREFS,
  contractorAlertQuietHoursEnabled: false,
};

/** Fetch notification preferences for a client, creating defaults if none exist. */
export async function getNotificationPrefs(clientId: string): Promise<NotificationPrefs> {
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.clientId, clientId))
    .limit(1);

  const [clientRow] = await db
    .select({
      contractorAlertQuietHoursEnabled: clients.contractorAlertQuietHoursEnabled,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const contractorAlertQuietHoursEnabled =
    clientRow?.contractorAlertQuietHoursEnabled ?? false;

  if (!prefs) {
    await db.insert(notificationPreferences).values({
      clientId,
      ...DEFAULT_NOTIFICATION_PREFS,
    });
    return { ...DEFAULT_PREFS, contractorAlertQuietHoursEnabled };
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
    contractorAlertQuietHoursEnabled,
  };
}

/** Update notification preferences for a client, upserting if none exist. */
export async function updateNotificationPrefs(
  clientId: string,
  updates: Partial<NotificationPrefs>
): Promise<void> {
  const db = getDb();
  const { contractorAlertQuietHoursEnabled, ...notificationUpdates } = updates;

  if (Object.keys(notificationUpdates).length > 0) {
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.clientId, clientId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(notificationPreferences).values({
        clientId,
        ...DEFAULT_NOTIFICATION_PREFS,
        ...notificationUpdates,
      });
    } else {
      await db
        .update(notificationPreferences)
        .set({ ...notificationUpdates, updatedAt: new Date() })
        .where(eq(notificationPreferences.clientId, clientId));
    }
  }

  // Decision F: the contractor-alert quiet-hours flag lives on the `clients`
  // table because the gateway sentinel (sendInternalSMS) reads it directly,
  // and we don't want to take a JOIN on every internal SMS.
  if (typeof contractorAlertQuietHoursEnabled === 'boolean') {
    await db
      .update(clients)
      .set({ contractorAlertQuietHoursEnabled, updatedAt: new Date() })
      .where(eq(clients.id, clientId));
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
