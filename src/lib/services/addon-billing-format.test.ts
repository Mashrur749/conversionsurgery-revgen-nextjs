import { describe, expect, it } from 'vitest';
import {
  formatAddonCurrency,
  formatAddonLineItemDescription,
  formatAddonUnit,
} from '@/lib/services/addon-billing-format';
import { ADDON_PRICING_KEYS } from '@/lib/services/addon-pricing';

describe('addon-billing-format', () => {
  it('formats addon line item descriptions consistently', () => {
    expect(
      formatAddonLineItemDescription(ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER, 2)
    ).toBe('Add-on: Additional Team Member (2 seats)');
    expect(
      formatAddonLineItemDescription(ADDON_PRICING_KEYS.EXTRA_NUMBER, 1)
    ).toBe('Add-on: Additional Phone Number (1 number)');
    expect(
      formatAddonLineItemDescription(ADDON_PRICING_KEYS.VOICE_MINUTES, 5)
    ).toBe('Add-on: Voice AI Minutes (5 minutes)');
  });

  it('formats addon units and currency', () => {
    expect(formatAddonUnit(ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER, 1)).toBe('seat');
    expect(formatAddonUnit(ADDON_PRICING_KEYS.VOICE_MINUTES, 3)).toBe('minutes');
    expect(formatAddonCurrency(1500)).toBe('$15.00');
  });
});
