'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays } from 'date-fns';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, Pause, X } from 'lucide-react';
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog';
import { PauseSubscriptionDialog } from './PauseSubscriptionDialog';

interface SubscriptionCardProps {
  subscription: {
    id: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
    plan: {
      name: string;
      priceMonthly: number;
      features: {
        maxLeadsPerMonth: number | null;
        maxTeamMembers: number | null;
      };
    };
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    discountPercent: number | null;
  };
  usage?: {
    leads: number;
    messages: number;
  };
  onUpgrade: () => void;
  onCancelSubscription: (reason: string) => Promise<void>;
  onPauseSubscription: (resumeDate: Date) => Promise<void>;
  onResumeSubscription: () => Promise<void>;
}

export function SubscriptionCard({
  subscription,
  usage,
  onUpgrade,
  onCancelSubscription,
  onPauseSubscription,
  onResumeSubscription,
}: SubscriptionCardProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  const statusConfig = {
    trialing: { label: 'Trial', color: 'bg-blue-100 text-blue-800', icon: Calendar },
    active: { label: 'Active', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    past_due: { label: 'Past Due', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    canceled: { label: 'Canceled', color: 'bg-gray-100 text-gray-800', icon: X },
    unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  };

  const status = statusConfig[subscription.status];
  const StatusIcon = status.icon;

  const daysRemaining = differenceInDays(subscription.currentPeriodEnd, new Date());
  const trialDaysRemaining = subscription.trialEnd
    ? differenceInDays(subscription.trialEnd, new Date())
    : null;

  const maxLeads = subscription.plan.features.maxLeadsPerMonth;
  const leadsUsagePercent = maxLeads && usage
    ? Math.min((usage.leads / maxLeads) * 100, 100)
    : 0;

  const effectivePrice = subscription.discountPercent
    ? subscription.plan.priceMonthly * (1 - subscription.discountPercent / 100)
    : subscription.plan.priceMonthly;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {subscription.plan.name} Plan
              </CardTitle>
              <CardDescription>
                ${(effectivePrice / 100).toFixed(2)}/month
                {subscription.discountPercent && (
                  <span className="ml-2 text-green-600">
                    ({subscription.discountPercent}% discount applied)
                  </span>
                )}
              </CardDescription>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trial Banner */}
          {subscription.status === 'trialing' && trialDaysRemaining !== null && (
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                <strong>{trialDaysRemaining} days</strong> remaining in your trial.
                Your card will be charged on {format(subscription.trialEnd!, 'MMM d, yyyy')}.
              </p>
            </div>
          )}

          {/* Past Due Warning */}
          {subscription.status === 'past_due' && (
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm text-red-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Your payment is past due. Please update your payment method to avoid service interruption.
              </p>
            </div>
          )}

          {/* Cancellation Pending */}
          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                Your subscription will cancel on {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}.
                You can still use all features until then.
              </p>
            </div>
          )}

          {/* Billing Period */}
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Current billing period</span>
              <span>{daysRemaining} days remaining</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(subscription.currentPeriodStart, 'MMM d')} - {format(subscription.currentPeriodEnd, 'MMM d, yyyy')}
            </div>
          </div>

          {/* Usage */}
          {maxLeads && usage && (
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Leads this period</span>
                <span>
                  {usage.leads} / {maxLeads}
                </span>
              </div>
              <Progress value={leadsUsagePercent} className="h-2" />
              {leadsUsagePercent >= 80 && (
                <p className="mt-1 text-xs text-amber-600">
                  Approaching lead limit. Consider upgrading for more capacity.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onUpgrade}>
              Upgrade Plan
            </Button>

            {subscription.status === 'paused' ? (
              <Button variant="outline" onClick={onResumeSubscription}>
                Resume Subscription
              </Button>
            ) : subscription.status === 'active' && (
              <Button variant="outline" onClick={() => setShowPauseDialog(true)}>
                Pause Subscription
              </Button>
            )}

            {!subscription.cancelAtPeriodEnd && subscription.status !== 'canceled' && (
              <Button
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={onCancelSubscription}
        endDate={subscription.currentPeriodEnd}
      />

      <PauseSubscriptionDialog
        open={showPauseDialog}
        onOpenChange={setShowPauseDialog}
        onConfirm={onPauseSubscription}
      />
    </>
  );
}
