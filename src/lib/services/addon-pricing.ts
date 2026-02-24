import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const ADDON_PRICING_KEYS = {
  EXTRA_TEAM_MEMBER: 'extra_team_member',
  EXTRA_NUMBER: 'extra_number',
  VOICE_MINUTES: 'voice_minutes',
} as const;

export type AddonPricingKey =
  (typeof ADDON_PRICING_KEYS)[keyof typeof ADDON_PRICING_KEYS];

export interface AddonPricingRevision {
  effectiveFrom: string;
  unitPriceCents: number;
  currency: 'CAD';
  displayName: string;
  unitLabel: string;
  cadence: 'monthly_recurring' | 'usage';
}

export type AddonPricingCatalog = Record<AddonPricingKey, AddonPricingRevision[]>;
export type EffectiveAddonPricing = Record<AddonPricingKey, AddonPricingRevision>;

const ADDON_PRICING_SETTING_KEY = 'addon_pricing_catalog';

const addonRevisionSchema = z.object({
  effectiveFrom: z.string().min(10),
  unitPriceCents: z.number().int().nonnegative(),
  currency: z.literal('CAD'),
  displayName: z.string().min(1),
  unitLabel: z.string().min(1),
  cadence: z.enum(['monthly_recurring', 'usage']),
});

const addonCatalogSchema = z.object({
  [ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER]: z.array(addonRevisionSchema).min(1),
  [ADDON_PRICING_KEYS.EXTRA_NUMBER]: z.array(addonRevisionSchema).min(1),
  [ADDON_PRICING_KEYS.VOICE_MINUTES]: z.array(addonRevisionSchema).min(1),
});

const DEFAULT_ADDON_PRICING_CATALOG: AddonPricingCatalog = {
  [ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER]: [
    {
      effectiveFrom: '2026-01-01',
      unitPriceCents: 2000,
      currency: 'CAD',
      displayName: 'Additional Team Member',
      unitLabel: 'seat',
      cadence: 'monthly_recurring',
    },
  ],
  [ADDON_PRICING_KEYS.EXTRA_NUMBER]: [
    {
      effectiveFrom: '2026-01-01',
      unitPriceCents: 1500,
      currency: 'CAD',
      displayName: 'Additional Phone Number',
      unitLabel: 'number',
      cadence: 'monthly_recurring',
    },
  ],
  [ADDON_PRICING_KEYS.VOICE_MINUTES]: [
    {
      effectiveFrom: '2026-01-01',
      unitPriceCents: 15,
      currency: 'CAD',
      displayName: 'Voice AI Minutes',
      unitLabel: 'minute',
      cadence: 'usage',
    },
  ],
};

function toStartOfDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function selectEffectiveAddonRevision(
  revisions: AddonPricingRevision[],
  date: Date
): AddonPricingRevision {
  const sorted = [...revisions].sort(
    (a, b) =>
      toStartOfDay(a.effectiveFrom).getTime() -
      toStartOfDay(b.effectiveFrom).getTime()
  );
  const candidates = sorted.filter(
    (revision) => toStartOfDay(revision.effectiveFrom).getTime() <= date.getTime()
  );
  return candidates[candidates.length - 1] ?? sorted[0];
}

export function resolveAddonPricingForDate(
  catalog: AddonPricingCatalog,
  date: Date
): EffectiveAddonPricing {
  return {
    [ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER]: selectEffectiveAddonRevision(
      catalog[ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER],
      date
    ),
    [ADDON_PRICING_KEYS.EXTRA_NUMBER]: selectEffectiveAddonRevision(
      catalog[ADDON_PRICING_KEYS.EXTRA_NUMBER],
      date
    ),
    [ADDON_PRICING_KEYS.VOICE_MINUTES]: selectEffectiveAddonRevision(
      catalog[ADDON_PRICING_KEYS.VOICE_MINUTES],
      date
    ),
  };
}

async function loadAddonPricingCatalogOverrides(): Promise<AddonPricingCatalog | null> {
  const db = getDb();
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, ADDON_PRICING_SETTING_KEY))
    .limit(1);

  if (!setting?.value) {
    return null;
  }

  try {
    const parsed = addonCatalogSchema.safeParse(JSON.parse(setting.value));
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export async function getAddonPricing(
  clientId: string,
  date: Date = new Date()
): Promise<EffectiveAddonPricing> {
  void clientId;
  const overrides = await loadAddonPricingCatalogOverrides();
  const catalog = overrides ?? DEFAULT_ADDON_PRICING_CATALOG;
  return resolveAddonPricingForDate(catalog, date);
}

export function formatAddonPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
