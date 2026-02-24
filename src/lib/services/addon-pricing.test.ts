import { describe, expect, it } from 'vitest';
import {
  ADDON_PRICING_KEYS,
  formatAddonPrice,
  resolveAddonPricingForDate,
  selectEffectiveAddonRevision,
  type AddonPricingCatalog,
} from './addon-pricing';

const testCatalog: AddonPricingCatalog = {
  [ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER]: [
    {
      effectiveFrom: '2026-01-01',
      unitPriceCents: 2000,
      currency: 'CAD',
      displayName: 'Additional Team Member',
      unitLabel: 'seat',
      cadence: 'monthly_recurring',
    },
    {
      effectiveFrom: '2026-03-01',
      unitPriceCents: 2500,
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

describe('addon-pricing', () => {
  it('selects effective revision based on date', () => {
    const revisions = testCatalog[ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER];
    expect(
      selectEffectiveAddonRevision(revisions, new Date('2026-02-10T00:00:00.000Z')).unitPriceCents
    ).toBe(2000);
    expect(
      selectEffectiveAddonRevision(revisions, new Date('2026-03-10T00:00:00.000Z')).unitPriceCents
    ).toBe(2500);
  });

  it('resolves all catalog keys for a date', () => {
    const resolved = resolveAddonPricingForDate(
      testCatalog,
      new Date('2026-03-10T00:00:00.000Z')
    );
    expect(resolved[ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER].unitPriceCents).toBe(2500);
    expect(resolved[ADDON_PRICING_KEYS.EXTRA_NUMBER].unitPriceCents).toBe(1500);
    expect(resolved[ADDON_PRICING_KEYS.VOICE_MINUTES].unitPriceCents).toBe(15);
  });

  it('formats cents into invoice-safe price string', () => {
    expect(formatAddonPrice(2000)).toBe('$20.00');
    expect(formatAddonPrice(15)).toBe('$0.15');
  });
});
