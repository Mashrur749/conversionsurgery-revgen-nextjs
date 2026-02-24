import { ADDON_PRICING_KEYS, type AddonPricingKey } from '@/lib/services/addon-pricing';

const ADDON_LABELS: Record<AddonPricingKey, string> = {
  [ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER]: 'Additional Team Member',
  [ADDON_PRICING_KEYS.EXTRA_NUMBER]: 'Additional Phone Number',
  [ADDON_PRICING_KEYS.VOICE_MINUTES]: 'Voice AI Minutes',
};

function pluralize(base: string, quantity: number): string {
  return quantity === 1 ? base : `${base}s`;
}

export function formatAddonCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatAddonUnit(addonType: AddonPricingKey, quantity: number): string {
  switch (addonType) {
    case ADDON_PRICING_KEYS.EXTRA_TEAM_MEMBER:
      return pluralize('seat', quantity);
    case ADDON_PRICING_KEYS.EXTRA_NUMBER:
      return pluralize('number', quantity);
    case ADDON_PRICING_KEYS.VOICE_MINUTES:
      return pluralize('minute', quantity);
  }
}

export function formatAddonLineItemDescription(
  addonType: AddonPricingKey,
  quantity: number
): string {
  const label = ADDON_LABELS[addonType];
  const unit = formatAddonUnit(addonType, quantity);
  return `Add-on: ${label} (${quantity} ${unit})`;
}
