import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const OPS_KILL_SWITCH_KEYS = {
  OUTBOUND_AUTOMATIONS: 'ops.kill_switch.outbound_automations',
  SMART_ASSIST_AUTO_SEND: 'ops.kill_switch.smart_assist_auto_send',
  VOICE_AI: 'ops.kill_switch.voice_ai',
} as const;

export type OpsKillSwitchKey = typeof OPS_KILL_SWITCH_KEYS[keyof typeof OPS_KILL_SWITCH_KEYS];

const CACHE_TTL_MS = 30_000;

type CachedSwitchValue = {
  value: boolean;
  cachedAt: number;
};

const valueCache = new Map<OpsKillSwitchKey, CachedSwitchValue>();

export function parseBooleanSystemSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export async function isOpsKillSwitchEnabled(key: OpsKillSwitchKey): Promise<boolean> {
  const cached = valueCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const db = getDb();
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  const parsed = parseBooleanSystemSetting(row?.value);
  valueCache.set(key, { value: parsed, cachedAt: Date.now() });
  return parsed;
}

export function clearOpsKillSwitchCache(): void {
  valueCache.clear();
}
