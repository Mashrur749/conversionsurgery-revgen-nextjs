import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type GuaranteePhase =
  | 'proof_pending'
  | 'recovery_pending'
  | 'proof_passed'
  | 'recovery_passed'
  | 'proof_failed_refund_review'
  | 'recovery_failed_refund_review'
  | 'completed';

interface GuaranteeStatusCardProps {
  phase: GuaranteePhase | null;
  qleCount: number;
  qleTarget: number;
  pipelineValueCents: number;
  pipelineTargetCents: number;
  daysRemaining: number;
  windowEndDate: string | null;
  attributedOpportunities: number;
}

function phaseLabel(phase: GuaranteePhase): string {
  switch (phase) {
    case 'proof_pending':
      return 'Proof-of-Life Window';
    case 'recovery_pending':
      return 'Recovery Window';
    case 'proof_passed':
      return 'Proof-of-Life Passed';
    case 'recovery_passed':
      return 'Recovery Passed';
    case 'proof_failed_refund_review':
    case 'recovery_failed_refund_review':
      return 'Refund Review';
    case 'completed':
      return 'Completed';
  }
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatWindowEndDate(dateStr: string): string {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function progressBarPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function statusColor(
  valuePercent: number,
  daysRemaining: number,
  totalWindowDays: number
): 'green' | 'yellow' | 'red' {
  const timePercent = totalWindowDays > 0 ? (daysRemaining / totalWindowDays) * 100 : 0;
  if (valuePercent < 30 || timePercent < 10) return 'red';
  if (valuePercent >= 60 && timePercent > 30) return 'green';
  return 'yellow';
}

interface ProgressBarProps {
  percent: number;
  colorClass: string;
}

function ProgressBar({ percent, colorClass }: ProgressBarProps) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/10">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function GuaranteeStatusCard({
  phase,
  qleCount,
  qleTarget,
  pipelineValueCents,
  pipelineTargetCents,
  daysRemaining,
  windowEndDate,
  attributedOpportunities,
}: GuaranteeStatusCardProps) {
  if (phase === null || phase === 'completed') return null;

  const isRefundReview =
    phase === 'proof_failed_refund_review' || phase === 'recovery_failed_refund_review';
  const isProofPassed = phase === 'proof_passed';
  const isRecoveryPassed = phase === 'recovery_passed';

  // Estimate total window days (30 for proof, 60 for recovery) for color heuristic
  const estimatedWindowDays =
    phase === 'proof_pending' || phase === 'proof_passed' ? 30 : 60;

  const qlePercent = progressBarPercent(qleCount, qleTarget);
  const pipelinePercent = progressBarPercent(pipelineValueCents, pipelineTargetCents);

  const primaryPercent =
    phase === 'recovery_pending' ? Math.max(qlePercent, pipelinePercent) : qlePercent;

  const color = isRefundReview
    ? 'red'
    : isProofPassed || isRecoveryPassed
    ? 'green'
    : statusColor(primaryPercent, daysRemaining, estimatedWindowDays);

  const badgeStyle: Record<typeof color, string> = {
    green: 'bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20',
    yellow: 'bg-[#FFF3E0] text-[#C15B2E] border-[#C15B2E]/20',
    red: 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20',
  };

  const progressBarColor: Record<typeof color, string> = {
    green: 'bg-[#3D7A50]',
    yellow: 'bg-[#C15B2E]',
    red: 'bg-[#C15B2E]',
  };

  const daysColor: Record<typeof color, string> = {
    green: 'text-[#3D7A50]',
    yellow: 'text-[#C15B2E]',
    red: 'text-[#C15B2E]',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Guarantee Status</CardTitle>
          <Badge className={badgeStyle[color]}>{phaseLabel(phase)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Proof-of-Life Window */}
        {phase === 'proof_pending' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Proof-of-Life Window</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>Qualified Lead Engagements</span>
                <span className="font-medium">
                  {qleCount}/{qleTarget}
                </span>
              </div>
              <ProgressBar percent={qlePercent} colorClass={progressBarColor[color]} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days remaining</span>
              <span className={`font-bold ${daysColor[color]}`}>{daysRemaining}d</span>
            </div>
            {windowEndDate && (
              <p className="text-xs text-muted-foreground">
                Window ends {formatWindowEndDate(windowEndDate)}
              </p>
            )}
          </div>
        )}

        {/* Recovery Window */}
        {phase === 'recovery_pending' && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Recovery Window</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>Attributed Results</span>
                <span className="font-medium">
                  {attributedOpportunities}/1 booked estimate
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span>Pipeline Value</span>
                <span className="font-medium">
                  {formatDollars(pipelineValueCents)}/{formatDollars(pipelineTargetCents)}
                </span>
              </div>
              <ProgressBar percent={pipelinePercent} colorClass={progressBarColor[color]} />
            </div>
            <p className="text-xs text-muted-foreground">
              Either metric passing satisfies the recovery window.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Days remaining</span>
              <span className={`font-bold ${daysColor[color]}`}>{daysRemaining}d</span>
            </div>
            {windowEndDate && (
              <p className="text-xs text-muted-foreground">
                Window ends {formatWindowEndDate(windowEndDate)}
              </p>
            )}
          </div>
        )}

        {/* Proof passed — move to recovery info */}
        {isProofPassed && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20">
                Proof-of-Life Passed
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Transitioning to recovery window. Pipeline target:{' '}
              {formatDollars(pipelineTargetCents)}.
            </p>
            {windowEndDate && (
              <p className="text-xs text-muted-foreground">
                Next window ends {formatWindowEndDate(windowEndDate)}
              </p>
            )}
          </div>
        )}

        {/* Recovery passed */}
        {isRecoveryPassed && (
          <div className="space-y-2">
            <Badge className="bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20">
              Recovery Passed
            </Badge>
            <p className="text-sm text-muted-foreground">
              Guarantee conditions met. No refund action required.
            </p>
          </div>
        )}

        {/* Refund review */}
        {isRefundReview && (
          <div className="space-y-2">
            <Badge className="bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20">
              Refund Review Required
            </Badge>
            <p className="text-sm text-muted-foreground">
              This client&apos;s guarantee window has ended without meeting the target.
              Review billing and initiate refund process if applicable.
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
