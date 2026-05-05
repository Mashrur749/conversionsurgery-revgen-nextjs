import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface Day14CancelBannerProps {
  /** When paid service began (subscriptions.currentPeriodStart). Null until subscription is active. */
  serviceStartDate: Date | null;
  /** Plan slug — controls maximum-exposure dollar amount shown. */
  tier: 'pilot' | 'standard' | 'premium' | string;
}

const CANCEL_WINDOW_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Maximum client exposure during the Day-14 cancel window — equals the
 * signing-fee installment (50% of setup fee). Hardcoded per the approved
 * offer copy (see docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md §7a).
 */
function exposureForTier(tier: string): string {
  switch (tier) {
    case 'pilot':
      return '$1,750';
    case 'standard':
      return '$2,750';
    case 'premium':
      return '$4,750';
    default:
      return '$1,750';
  }
}

export function Day14CancelBanner({ serviceStartDate, tier }: Day14CancelBannerProps) {
  // State 3: no service start date yet — render nothing.
  if (!serviceStartDate) return null;

  const now = new Date();
  const elapsedMs = now.getTime() - serviceStartDate.getTime();
  const daysSinceStart = Math.floor(elapsedMs / MS_PER_DAY);

  const windowEnd = new Date(serviceStartDate.getTime() + CANCEL_WINDOW_DAYS * MS_PER_DAY);
  const windowEndLabel = format(windowEnd, 'MMM d, yyyy');

  // State 1: Day 0–14 — yellow/sienna info card.
  if (daysSinceStart <= CANCEL_WINDOW_DAYS) {
    const daysRemaining = Math.max(0, CANCEL_WINDOW_DAYS - daysSinceStart);
    const exposure = exposureForTier(tier);

    return (
      <Card className="border-sienna/30 bg-[#FFF3E0]">
        <CardContent className="py-4">
          <p className="text-sm text-sienna">
            <span className="font-medium">Day-14 cancel window:</span> {daysRemaining}{' '}
            {daysRemaining === 1 ? 'day' : 'days'} remaining. Client may cancel with one
            call until {windowEndLabel}. Max client exposure: {exposure}.
          </p>
        </CardContent>
      </Card>
    );
  }

  // State 2: Day 15+ — neutral muted closed indicator.
  return (
    <p className="text-xs text-muted-foreground">
      Day-14 cancel window: closed {windowEndLabel}
    </p>
  );
}
