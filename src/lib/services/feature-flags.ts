/**
 * Feature flag resolution service with system-level defaults.
 *
 * Resolution order for SystemFeatureFlags:
 *   1. global.automationPause system_settings key — if true, all flags resolve false
 *      (P0 compliance flags are NOT routed through this function)
 *   2. Client column override (if column exists and is not null)
 *   3. system_settings row `feature.<flag>.enabled` (value 'true'/'false')
 *   4. Hardcoded safe default: false
 *
 * Legacy per-client flags use isFeatureEnabled() from @/lib/features/check-feature directly.
 */

import { getDb } from '@/db';
import { clients, systemSettings } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  type SystemFeatureFlag,
  systemFlagToColumn,
} from '@/lib/features/check-feature';

/** System_settings key for the global automation pause flag */
const GLOBAL_PAUSE_KEY = 'global.automationPause';

/** Build the system_settings key for a given flag */
function flagSettingsKey(flag: SystemFeatureFlag): string {
  return `feature.${flag}.enabled`;
}

/**
 * Check if the global automation pause is active.
 * When active, all FMA automations skip except P0 compliance.
 */
export async function isGlobalAutomationPaused(): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, GLOBAL_PAUSE_KEY))
    .limit(1);

  return row?.value === 'true';
}

/**
 * Resolve a single system-level feature flag for a client.
 *
 * Resolution order:
 *   1. Global automation pause → false
 *   2. Client column (if not null) → client value
 *   3. system_settings key `feature.<flag>.enabled` → parsed value
 *   4. Hardcoded default → false
 */
export async function resolveFeatureFlag(
  clientId: string,
  flag: SystemFeatureFlag
): Promise<boolean> {
  const db = getDb();

  // Step 1: global pause check
  const paused = await isGlobalAutomationPaused();
  if (paused) return false;

  // Step 2: client column override (only for Wave 1 flags that have columns)
  const clientColumn = systemFlagToColumn[flag];
  if (clientColumn) {
    const [clientRow] = await db
      .select({ value: clients[clientColumn] })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    const clientValue = clientRow?.value as boolean | null | undefined;
    if (clientValue !== null && clientValue !== undefined) {
      return clientValue;
    }
  }

  // Step 3: system_settings default
  const settingsKey = flagSettingsKey(flag);
  const [settingRow] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, settingsKey))
    .limit(1);

  if (settingRow !== undefined) {
    return settingRow.value === 'true';
  }

  // Step 4: safe default
  return false;
}

/**
 * Resolve multiple system-level feature flags for a client in a single pass.
 * More efficient than calling resolveFeatureFlag() in a loop.
 *
 * Returns a record of flag → boolean.
 */
export async function resolveFeatureFlags(
  clientId: string,
  flags: SystemFeatureFlag[]
): Promise<Record<SystemFeatureFlag, boolean>> {
  const db = getDb();

  // Step 1: global pause — short-circuit all flags
  const paused = await isGlobalAutomationPaused();
  if (paused) {
    return flags.reduce(
      (acc, flag) => {
        acc[flag] = false;
        return acc;
      },
      {} as Record<SystemFeatureFlag, boolean>
    );
  }

  // Collect client column names for flags that have them
  const flagsWithColumns = flags.filter((f) => systemFlagToColumn[f] !== undefined);
  const flagsWithoutColumns = flags.filter((f) => systemFlagToColumn[f] === undefined);

  // Step 2: fetch client row (only if any flag has a column)
  let clientOverrides: Record<string, boolean | null> = {};
  if (flagsWithColumns.length > 0) {
    const columns = Object.fromEntries(
      flagsWithColumns.map((f) => [f, clients[systemFlagToColumn[f]!]])
    );
    const [clientRow] = await db
      .select(columns)
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (clientRow) {
      clientOverrides = clientRow as Record<string, boolean | null>;
    }
  }

  // Step 3: fetch all system_settings rows for flags not resolved by client column
  const unresolvedFlags = flags.filter((f) => {
    const col = systemFlagToColumn[f];
    if (!col) return true; // no column → need system default
    const val = clientOverrides[f as string] as boolean | null | undefined;
    return val === null || val === undefined; // column is null → need system default
  });

  let settingsMap: Record<string, string> = {};
  if (unresolvedFlags.length > 0) {
    const keys = unresolvedFlags.map(flagSettingsKey);
    const settingRows = await db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
      .where(inArray(systemSettings.key, keys));

    settingsMap = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
  }

  // Assemble final result
  return flags.reduce(
    (acc, flag) => {
      const col = systemFlagToColumn[flag];
      if (col) {
        const clientVal = clientOverrides[flag as string] as boolean | null | undefined;
        if (clientVal !== null && clientVal !== undefined) {
          acc[flag] = clientVal;
          return acc;
        }
      }
      // Fall back to system_settings or hardcoded default
      const key = flagSettingsKey(flag);
      const raw = settingsMap[key];
      acc[flag] = raw !== undefined ? raw === 'true' : false;
      return acc;
    },
    {} as Record<SystemFeatureFlag, boolean>
  );
}
