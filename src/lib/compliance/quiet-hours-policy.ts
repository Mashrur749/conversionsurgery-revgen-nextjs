import { getDb, clients, quietHoursConfig, systemSettings } from '@/db';
import { eq, isNotNull } from 'drizzle-orm';
import { ComplianceService } from '@/lib/compliance/compliance-service';

export const QUIET_HOURS_POLICY_MODES = {
  STRICT_ALL_OUTBOUND_QUEUE: 'STRICT_ALL_OUTBOUND_QUEUE',
  INBOUND_REPLY_ALLOWED: 'INBOUND_REPLY_ALLOWED',
} as const;

export type QuietHoursPolicyMode =
  (typeof QUIET_HOURS_POLICY_MODES)[keyof typeof QUIET_HOURS_POLICY_MODES];

export const QUIET_HOURS_MESSAGE_CLASSIFICATIONS = {
  INBOUND_REPLY: 'inbound_reply',
  PROACTIVE_OUTREACH: 'proactive_outreach',
} as const;

export type QuietHoursMessageClassification =
  (typeof QUIET_HOURS_MESSAGE_CLASSIFICATIONS)[keyof typeof QUIET_HOURS_MESSAGE_CLASSIFICATIONS];

export type QuietHoursDecision = 'send' | 'queue' | 'block';

export interface QuietHoursPolicyResolution {
  mode: QuietHoursPolicyMode;
  source: 'env_default' | 'client_override';
  environmentMode: QuietHoursPolicyMode;
  clientOverrideMode: QuietHoursPolicyMode | null;
}

export interface QuietHoursPolicyDiagnostics {
  environmentMode: QuietHoursPolicyMode;
  overrideCount: number;
  overrides: Array<{
    clientId: string;
    businessName: string | null;
    mode: QuietHoursPolicyMode;
    updatedAt: string;
  }>;
}

export interface QuietHoursDecisionInput {
  isQuietHours: boolean;
  queueOnQuietHours: boolean;
  policyMode: QuietHoursPolicyMode;
  messageClassification?: QuietHoursMessageClassification | null;
}

export interface QuietHoursDecisionResult {
  decision: QuietHoursDecision;
  reason?: string;
}

const DEFAULT_QUIET_HOURS_POLICY = QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE;
const ENV_KEY = 'QUIET_HOURS_POLICY_MODE';

function parsePolicyMode(value: string | null | undefined): QuietHoursPolicyMode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE) {
    return QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE;
  }
  if (normalized === QUIET_HOURS_POLICY_MODES.INBOUND_REPLY_ALLOWED) {
    return QUIET_HOURS_POLICY_MODES.INBOUND_REPLY_ALLOWED;
  }

  return null;
}

export function resolveEnvironmentQuietHoursPolicyMode(): QuietHoursPolicyMode {
  return parsePolicyMode(process.env[ENV_KEY]) || DEFAULT_QUIET_HOURS_POLICY;
}

async function observePolicyModeChange(input: {
  clientId: string;
  mode: QuietHoursPolicyMode;
  source: QuietHoursPolicyResolution['source'];
}): Promise<void> {
  const db = getDb();
  const key = `quiet_hours_policy_last_observed:${input.clientId}`;

  const [existing] = await db
    .select({ id: systemSettings.id, value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  if (!existing) {
    await db.insert(systemSettings).values({
      key,
      value: input.mode,
      description: 'Last observed quiet-hours policy mode for client message delivery.',
    });
    return;
  }

  if (existing.value === input.mode) {
    return;
  }

  await db
    .update(systemSettings)
    .set({ value: input.mode, updatedAt: new Date() })
    .where(eq(systemSettings.id, existing.id));

  await ComplianceService.logComplianceEvent(input.clientId, 'quiet_hours_policy_mode_changed', {
    previousMode: existing.value,
    newMode: input.mode,
    source: input.source,
    envMode: resolveEnvironmentQuietHoursPolicyMode(),
  });
}

export async function getQuietHoursPolicy(
  clientId: string,
  options?: { trackModeChanges?: boolean }
): Promise<QuietHoursPolicyResolution> {
  const db = getDb();
  const envMode = resolveEnvironmentQuietHoursPolicyMode();

  const [config] = await db
    .select({ policyModeOverride: quietHoursConfig.policyModeOverride })
    .from(quietHoursConfig)
    .where(eq(quietHoursConfig.clientId, clientId))
    .limit(1);

  const overrideMode = parsePolicyMode(config?.policyModeOverride ?? null);
  const mode = overrideMode || envMode;
  const source: QuietHoursPolicyResolution['source'] = overrideMode ? 'client_override' : 'env_default';

  if (options?.trackModeChanges) {
    await observePolicyModeChange({
      clientId,
      mode,
      source,
    });
  }

  return {
    mode,
    source,
    environmentMode: envMode,
    clientOverrideMode: overrideMode,
  };
}

export function resolveQuietHoursDecision(
  input: QuietHoursDecisionInput
): QuietHoursDecisionResult {
  if (!input.messageClassification) {
    return {
      decision: 'block',
      reason: 'Missing quiet-hours message classification',
    };
  }

  if (!input.isQuietHours) {
    return { decision: 'send' };
  }

  if (input.policyMode === QUIET_HOURS_POLICY_MODES.STRICT_ALL_OUTBOUND_QUEUE) {
    return input.queueOnQuietHours
      ? { decision: 'queue' }
      : { decision: 'block', reason: 'Quiet hours — strict queue mode in effect' };
  }

  if (input.messageClassification === QUIET_HOURS_MESSAGE_CLASSIFICATIONS.INBOUND_REPLY) {
    return { decision: 'send' };
  }

  return input.queueOnQuietHours
    ? { decision: 'queue' }
    : { decision: 'block', reason: 'Quiet hours — proactive outreach deferred' };
}

export async function getQuietHoursPolicyDiagnostics(): Promise<QuietHoursPolicyDiagnostics> {
  const db = getDb();
  const environmentMode = resolveEnvironmentQuietHoursPolicyMode();

  const rows = await db
    .select({
      clientId: quietHoursConfig.clientId,
      businessName: clients.businessName,
      mode: quietHoursConfig.policyModeOverride,
      updatedAt: quietHoursConfig.updatedAt,
    })
    .from(quietHoursConfig)
    .leftJoin(clients, eq(quietHoursConfig.clientId, clients.id))
    .where(isNotNull(quietHoursConfig.policyModeOverride));

  return {
    environmentMode,
    overrideCount: rows.length,
    overrides: rows
      .map((row) => {
        const mode = parsePolicyMode(row.mode);
        if (!mode) {
          return null;
        }

        return {
          clientId: row.clientId,
          businessName: row.businessName,
          mode,
          updatedAt: row.updatedAt.toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row),
  };
}
