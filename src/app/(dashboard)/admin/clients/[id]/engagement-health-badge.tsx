import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EngagementSignals {
  daysSinceLastEstimateFlag: number | null;
  daysSinceLastWonLost: number | null;
  openKbGaps: number;
}

interface EngagementHealthBadgeProps {
  status: 'healthy' | 'at_risk' | 'disengaged' | null;
  signals: EngagementSignals | null;
  recommendations: string[] | null;
}

function buildSignalBullets(signals: EngagementSignals): string[] {
  const bullets: string[] = [];
  if (signals.daysSinceLastEstimateFlag !== null) {
    bullets.push(`${signals.daysSinceLastEstimateFlag} days since last estimate flag`);
  }
  if (signals.daysSinceLastWonLost !== null) {
    bullets.push(`${signals.daysSinceLastWonLost} days since last won/lost outcome`);
  }
  if (signals.openKbGaps > 0) {
    bullets.push(
      `${signals.openKbGaps} open knowledge gap${signals.openKbGaps === 1 ? '' : 's'}`
    );
  }
  return bullets;
}

export function EngagementHealthBadge({
  status,
  signals,
  recommendations,
}: EngagementHealthBadgeProps) {
  if (status === null || status === 'healthy') return null;

  const isAtRisk = status === 'at_risk';
  const signalBullets = signals ? buildSignalBullets(signals) : [];

  const badgeClass = isAtRisk
    ? 'bg-[#FFF3E0] text-[#C15B2E] border-[#C15B2E]/20'
    : 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20';

  const cardBorderClass = isAtRisk
    ? 'border-[#C15B2E]/30'
    : 'border-[#C15B2E]/40';

  return (
    <Card className={`${cardBorderClass}`}>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={badgeClass}>
            {isAtRisk ? 'At Risk' : 'Disengaged'}
          </Badge>
        </div>

        {signalBullets.length > 0 && (
          <ul className="space-y-0.5">
            {signalBullets.map((bullet) => (
              <li key={bullet} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="mt-0.5 shrink-0">&bull;</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {!isAtRisk && recommendations && recommendations.length > 0 && (
          <ul className="space-y-0.5">
            {recommendations.map((rec) => (
              <li key={rec} className="text-xs text-[#C15B2E] flex items-start gap-1">
                <span className="mt-0.5 shrink-0">&rarr;</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
