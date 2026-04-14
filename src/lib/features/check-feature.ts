import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Legacy per-client feature flags — resolved directly from a client boolean column.
 * These never fall back to system defaults; null/missing → false.
 */
export type LegacyFeatureFlag =
  | 'missedCallSms'
  | 'aiResponse'
  | 'aiAgent'
  | 'autoEscalation'
  | 'voice'
  | 'flows'
  | 'leadScoring'
  | 'reputationMonitoring'
  | 'autoReviewResponse'
  | 'calendarSync'
  | 'hotTransfer'
  | 'paymentLinks'
  | 'photoRequests'
  | 'multiLanguage';

/**
 * FMA-wave feature flags — resolved via resolveFeatureFlag() which checks:
 * 1. Client column (if not null)
 * 2. system_settings row (key: `feature.<flag>.enabled`)
 * 3. Hardcoded default (false)
 *
 * Wave 1 (client columns exist): dailyDigest, billingReminder
 * Wave 2+ (system-settings only until columns added): all others
 */
export type SystemFeatureFlag =
  | 'dailyDigest'
  | 'billingReminder'
  | 'engagementSignals'
  | 'autoResolve'
  | 'forwardingVerification'
  | 'opsHealthMonitor'
  | 'callPrep'
  | 'capacityTracking';

/** Union of all feature flags in the platform */
export type FeatureFlag = LegacyFeatureFlag | SystemFeatureFlag;

const featureToColumn: Record<LegacyFeatureFlag, keyof typeof clients.$inferSelect> = {
  missedCallSms: 'missedCallSmsEnabled',
  aiResponse: 'aiResponseEnabled',
  aiAgent: 'aiAgentEnabled',
  autoEscalation: 'autoEscalationEnabled',
  voice: 'voiceEnabled',
  flows: 'flowsEnabled',
  leadScoring: 'leadScoringEnabled',
  reputationMonitoring: 'reputationMonitoringEnabled',
  autoReviewResponse: 'autoReviewResponseEnabled',
  calendarSync: 'calendarSyncEnabled',
  hotTransfer: 'hotTransferEnabled',
  paymentLinks: 'paymentLinksEnabled',
  photoRequests: 'photoRequestsEnabled',
  multiLanguage: 'multiLanguageEnabled',
};

/**
 * Wave 1 system flags that also have a nullable client column override.
 * Keyed by SystemFeatureFlag — only flags with columns listed here.
 * Exported for use by resolveFeatureFlag() in @/lib/services/feature-flags.
 */
export const systemFlagToColumn: Partial<Record<SystemFeatureFlag, keyof typeof clients.$inferSelect>> = {
  dailyDigest: 'dailyDigestEnabled',
  billingReminder: 'billingReminderEnabled',
};

function isLegacyFlag(flag: FeatureFlag): flag is LegacyFeatureFlag {
  return flag in featureToColumn;
}

/**
 * Check if a legacy per-client feature is enabled.
 * For system-level flags (FMA waves), use resolveFeatureFlag() from @/lib/services/feature-flags instead.
 */
export async function isFeatureEnabled(
  clientId: string,
  feature: LegacyFeatureFlag
): Promise<boolean> {
  const db = getDb();
  const column = featureToColumn[feature];

  const [client] = await db
    .select({ enabled: clients[column] })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  return (client?.enabled as boolean) ?? false;
}

/**
 * Check multiple features at once.
 * Accepts both legacy and system flags. System flags without a client column resolve to false.
 * Does NOT check globalAutomationPause and does NOT fall back to system_settings defaults.
 * Use resolveFeatureFlag() or resolveFeatureFlags() for system-default + global pause resolution.
 */
export async function getEnabledFeatures(
  clientId: string,
  features: FeatureFlag[]
): Promise<Record<FeatureFlag, boolean>> {
  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  return features.reduce(
    (acc, feature) => {
      if (isLegacyFlag(feature)) {
        const col = featureToColumn[feature] as keyof typeof client;
        acc[feature] = (client?.[col] as boolean) ?? false;
      } else {
        const col = systemFlagToColumn[feature];
        if (col) {
          const val = client?.[col as keyof typeof client];
          acc[feature] = (val as boolean | null) ?? false;
        } else {
          acc[feature] = false;
        }
      }
      return acc;
    },
    {} as Record<FeatureFlag, boolean>
  );
}

/**
 * Require a legacy feature to be enabled, throw if not.
 * For system-level flags use resolveFeatureFlag() first, then throw manually.
 */
export async function requireFeature(
  clientId: string,
  feature: LegacyFeatureFlag,
  errorMessage?: string
): Promise<void> {
  const enabled = await isFeatureEnabled(clientId, feature);

  if (!enabled) {
    throw new Error(
      errorMessage ?? `Feature '${feature}' is not enabled for this client`
    );
  }
}
