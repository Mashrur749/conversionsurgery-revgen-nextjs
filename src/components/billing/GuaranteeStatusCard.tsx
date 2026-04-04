'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import type { GuaranteeSummary } from '@/lib/services/guarantee-v2/summary';
export type { GuaranteeSummary } from '@/lib/services/guarantee-v2/summary';

interface GuaranteeStatusCardProps {
  guarantee: GuaranteeSummary;
}

const stageBadgeClasses: Record<GuaranteeSummary['stage'], string> = {
  proof: 'bg-[#FFF3E0] text-[#C15B2E]',
  recovery: 'bg-[#FFF3E0] text-[#C15B2E]',
  fulfilled: 'bg-[#E8F5E9] text-[#3D7A50]',
  refund_review: 'bg-[#FDEAE4] text-[#C15B2E]',
};

function formatWindowDate(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy');
}

function formatWindowRange(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return 'Not yet started';
  return `${format(new Date(startAt), 'MMM d')} \u2013 ${format(new Date(endAt), 'MMM d, yyyy')}`;
}

function plainEnglishExplanation(
  status: string,
  proofEngagements: number,
  recoveryOpportunities: number
): string {
  switch (status) {
    case 'proof_pending':
      return `We need to see 5 leads engage with your AI in the first 30 days. You have ${proofEngagements}/5 so far.`;
    case 'proof_passed':
      return 'Your system is proven \u2014 5+ leads engaged with the AI in your first month.';
    case 'recovery_pending':
      return `By day 90, the system should help you book at least one estimate. Progress: ${recoveryOpportunities}/1 attributed opportunities.`;
    case 'recovery_passed':
      return 'Guarantee fulfilled \u2014 the system delivered results.';
    case 'proof_failed_refund_review':
    case 'recovery_failed_refund_review':
      return 'Your guarantee claim is under review. We will follow up within 10 business days.';
    default:
      return 'Your guarantee is active.';
  }
}

interface ProgressBarProps {
  value: number;
  max: number;
  stage: GuaranteeSummary['stage'];
}

function GuaranteeProgressBar({ value, max, stage }: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));

  let trackClass = 'bg-muted';
  let indicatorStyle: React.CSSProperties = { backgroundColor: '#9CA3AF' };

  if (stage === 'fulfilled') {
    trackClass = 'bg-[#E8F5E9]';
    indicatorStyle = { backgroundColor: '#3D7A50' };
  } else if (stage === 'refund_review') {
    trackClass = 'bg-[#FDEAE4]';
    indicatorStyle = { backgroundColor: '#C15B2E' };
  } else {
    // proof or recovery in progress
    trackClass = 'bg-[#FFF3E0]';
    indicatorStyle = { backgroundColor: '#C15B2E' };
  }

  return (
    <div className="space-y-1">
      <div className={`relative h-2 w-full overflow-hidden rounded-full ${trackClass}`}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, ...indicatorStyle }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {value} of {max} {max === 5 ? 'lead engagements' : 'opportunities'}
      </p>
    </div>
  );
}

export function GuaranteeStatusCard({ guarantee }: GuaranteeStatusCardProps) {
  const {
    status,
    stage,
    statusLabel,
    proofQualifiedLeadEngagements,
    recoveryAttributedOpportunities,
    proofWindow,
    recoveryWindow,
    extension,
    refundReviewRequired,
    refundEligibleAt,
  } = guarantee;

  const explanation = plainEnglishExplanation(
    status,
    proofQualifiedLeadEngagements,
    recoveryAttributedOpportunities
  );

  const proofEndDisplay = proofWindow.adjustedEndAt ?? proofWindow.endAt;
  const recoveryEndDisplay = recoveryWindow.adjustedEndAt ?? recoveryWindow.endAt;

  const showProofProgress = stage === 'proof' || stage === 'refund_review';
  const showRecoveryProgress =
    stage === 'recovery' || stage === 'fulfilled' || stage === 'refund_review';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Guarantee Status</span>
          <Badge className={stageBadgeClasses[stage]}>{statusLabel}</Badge>
        </CardTitle>
        <CardDescription>{explanation}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {refundReviewRequired && (
          <Alert variant="destructive">
            <AlertDescription>
              Your guarantee claim is under review
              {refundEligibleAt
                ? ` (submitted ${format(new Date(refundEligibleAt), 'MMM d, yyyy')})`
                : '.'}
              {' '}We will follow up within 10 business days.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress bars */}
        {showProofProgress && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">30-Day Proof Progress</p>
            <GuaranteeProgressBar
              value={proofQualifiedLeadEngagements}
              max={5}
              stage={stage}
            />
          </div>
        )}

        {showRecoveryProgress && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">90-Day Recovery Progress</p>
            <GuaranteeProgressBar
              value={recoveryAttributedOpportunities}
              max={1}
              stage={stage}
            />
          </div>
        )}

        {/* Timeline strip */}
        <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-[#1B2F26] mb-2">Guarantee Timeline</p>
          <div className="grid gap-2 md:grid-cols-3 text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Free Month</p>
              <p>
                Day&nbsp;1&nbsp;&ndash;&nbsp;30
                {proofWindow.startAt
                  ? ` (from ${format(new Date(proofWindow.startAt), 'MMM d')})`
                  : ''}
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Proof Window</p>
              <p>{formatWindowRange(proofWindow.startAt, proofEndDisplay)}</p>
              {proofWindow.adjustedEndAt && proofWindow.adjustedEndAt !== proofWindow.endAt && (
                <p className="text-[#C15B2E]">
                  Extended due to lower lead volume
                </p>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Recovery Window</p>
              <p>{formatWindowRange(recoveryWindow.startAt, recoveryEndDisplay)}</p>
              {recoveryWindow.adjustedEndAt &&
                recoveryWindow.adjustedEndAt !== recoveryWindow.endAt && (
                  <p className="text-[#C15B2E]">
                    Extended due to lower lead volume
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Extension notice */}
        {extension.adjusted && (
          <p className="text-xs text-muted-foreground">
            Extended to{' '}
            {proofEndDisplay ? formatWindowDate(proofEndDisplay) : 'a later date'} due to lower
            lead volume
            {extension.observedMonthlyLeadAverage !== null
              ? ` (${extension.observedMonthlyLeadAverage} leads/month observed)`
              : ''}
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
