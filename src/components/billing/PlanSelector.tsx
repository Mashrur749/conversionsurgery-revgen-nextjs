'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  features: {
    maxLeadsPerMonth: number | null;
    maxTeamMembers: number | null;
    maxPhoneNumbers: number;
    includesVoiceAi: boolean;
    includesCalendarSync: boolean;
    includesAdvancedAnalytics: boolean;
    includesWhiteLabel: boolean;
    supportLevel: string;
    apiAccess: boolean;
  };
  isPopular?: boolean;
}

interface PlanSelectorProps {
  plans: Plan[];
  currentPlanId: string | null;
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'yearly') => Promise<void>;
  isChangingPlan?: boolean;
}

export function PlanSelector({
  plans,
  currentPlanId,
  onSelectPlan,
  isChangingPlan,
}: PlanSelectorProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const hasYearlyPricing = plans.some((p) => p.priceYearly !== null);
  const yearlySavingsPercent = 20;

  const handleSelect = async (planId: string) => {
    setSelectedPlanId(planId);
    try {
      await onSelectPlan(planId, billingCycle);
    } finally {
      setSelectedPlanId(null);
    }
  };

  const getFeatureList = (plan: Plan): string[] => {
    const features: string[] = [];
    if (plan.features.includesVoiceAi) features.push('Voice AI');
    if (plan.features.includesCalendarSync) features.push('Calendar sync');
    if (plan.features.includesAdvancedAnalytics) features.push('Advanced analytics');
    if (plan.features.includesWhiteLabel) features.push('White labeling');
    if (plan.features.apiAccess) features.push('API access');
    if (plan.features.supportLevel === 'priority') features.push('Priority support');
    if (plan.features.supportLevel === 'dedicated') features.push('Dedicated support');
    return features;
  };

  return (
    <div className="space-y-6">
      {hasYearlyPricing && (
        <div className="flex items-center justify-center gap-4">
          <Label htmlFor="billing-toggle" className={cn(billingCycle === 'monthly' && 'font-bold')}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingCycle === 'yearly'}
            onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="billing-toggle" className={cn(billingCycle === 'yearly' && 'font-bold')}>
              Yearly
            </Label>
            <Badge variant="secondary" className="bg-[#E8F5E9] text-[#3D7A50]">
              Save {yearlySavingsPercent}%
            </Badge>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const price = billingCycle === 'yearly' && plan.priceYearly
            ? plan.priceYearly / 12
            : plan.priceMonthly;
          const isDowngrade = currentPlanId && plans.findIndex((p) => p.id === plan.id) <
            plans.findIndex((p) => p.id === currentPlanId);
          const featureList = getFeatureList(plan);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative',
                plan.isPopular && 'border-primary shadow-lg',
                isCurrentPlan && 'bg-muted/50'
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${(price / 100).toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingCycle === 'yearly' && plan.priceYearly && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Billed annually (${(plan.priceYearly / 100).toFixed(0)}/year)
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#3D7A50]" />
                    {plan.features.maxLeadsPerMonth
                      ? `${plan.features.maxLeadsPerMonth.toLocaleString()} leads/month`
                      : 'Unlimited leads'}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#3D7A50]" />
                    {plan.features.maxTeamMembers
                      ? `${plan.features.maxTeamMembers} team members`
                      : 'Unlimited team members'}
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-[#3D7A50]" />
                    {plan.features.maxPhoneNumbers} phone number{plan.features.maxPhoneNumbers > 1 ? 's' : ''}
                  </li>
                  {featureList.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-[#3D7A50]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? 'outline' : plan.isPopular ? 'default' : 'outline'}
                  disabled={isCurrentPlan || isChangingPlan}
                  onClick={() => handleSelect(plan.id)}
                >
                  {selectedPlanId === plan.id ? (
                    'Processing...'
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : isDowngrade ? (
                    'Downgrade'
                  ) : (
                    'Upgrade'
                  )}
                </Button>

                {isDowngrade && !isCurrentPlan && (
                  <p className="text-xs text-center text-muted-foreground">
                    Takes effect at end of current billing period
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
