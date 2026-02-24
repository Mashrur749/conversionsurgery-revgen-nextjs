'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import type { GuaranteeSummary } from '@/lib/services/guarantee-v2/summary';
export type { GuaranteeSummary } from '@/lib/services/guarantee-v2/summary';

interface GuaranteeStatusCardProps {
  guarantee: GuaranteeSummary;
}

const stageClasses: Record<GuaranteeSummary['stage'], string> = {
  proof: 'bg-[#FFF3E0] text-sienna',
  recovery: 'bg-[#FFF3E0] text-sienna',
  fulfilled: 'bg-sage-light text-forest',
  refund_review: 'bg-[#FDEAE4] text-sienna',
};

const timelineLabels: Record<GuaranteeSummary['timeline'][number]['state'], string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Done',
  failed: 'Failed',
};

function formatWindow(startAt: string | null, endAt: string | null) {
  if (!startAt || !endAt) return 'Not available';
  return `${format(new Date(startAt), 'MMM d')} - ${format(new Date(endAt), 'MMM d, yyyy')}`;
}

export function GuaranteeStatusCard({ guarantee }: GuaranteeStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Guarantee Status</span>
          <Badge className={stageClasses[guarantee.stage]}>{guarantee.statusLabel}</Badge>
        </CardTitle>
        <CardDescription>{guarantee.stageMessage}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {guarantee.refundReviewRequired && (
          <Alert variant="destructive">
            <AlertDescription>
              Refund review required
              {guarantee.refundEligibleAt
                ? ` since ${format(new Date(guarantee.refundEligibleAt), 'MMM d, yyyy')}`
                : '.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2 text-sm">
          {guarantee.timeline.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-muted-foreground">{item.detail}</p>
              </div>
              <Badge variant="outline">{timelineLabels[item.state]}</Badge>
            </div>
          ))}
        </div>

        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <p className="font-medium">Proof Window</p>
            <p className="text-muted-foreground">
              {formatWindow(guarantee.proofWindow.startAt, guarantee.proofWindow.adjustedEndAt)}
            </p>
          </div>
          <div>
            <p className="font-medium">Recovery Window</p>
            <p className="text-muted-foreground">
              {formatWindow(
                guarantee.recoveryWindow.startAt,
                guarantee.recoveryWindow.adjustedEndAt
              )}
            </p>
          </div>
        </div>

        {guarantee.extension.adjusted && (
          <p className="text-sm text-muted-foreground">
            Low-volume extension active (x{guarantee.extension.factorMultiplier.toFixed(2)}
            {guarantee.extension.observedMonthlyLeadAverage !== null
              ? `, observed ${guarantee.extension.observedMonthlyLeadAverage} leads/month`
              : ''}
            ).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
