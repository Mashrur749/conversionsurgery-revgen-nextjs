import { getDb } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type FeatureFlag =
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

const featureToColumn: Record<FeatureFlag, keyof typeof clients.$inferSelect> = {
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
 * Check if a feature is enabled for a client
 */
export async function isFeatureEnabled(
  clientId: string,
  feature: FeatureFlag
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
 * Check multiple features at once
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
      const col = featureToColumn[feature] as keyof typeof client;
      acc[feature] = (client?.[col] as boolean) ?? false;
      return acc;
    },
    {} as Record<FeatureFlag, boolean>
  );
}

/**
 * Require a feature to be enabled, throw if not
 */
export async function requireFeature(
  clientId: string,
  feature: FeatureFlag,
  errorMessage?: string
): Promise<void> {
  const enabled = await isFeatureEnabled(clientId, feature);

  if (!enabled) {
    throw new Error(
      errorMessage ?? `Feature '${feature}' is not enabled for this client`
    );
  }
}
