'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { changePlan } from '@/lib/billing/actions';
import type { Plan } from '@/db/schema/plans';

interface UpgradePageClientProps {
  clientId: string;
  plans: Plan[];
  currentPlanId: string | null;
}

export function UpgradePageClient({
  clientId,
  plans,
  currentPlanId,
}: UpgradePageClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const planData = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    features: plan.features as {
      maxLeadsPerMonth: number | null;
      maxTeamMembers: number | null;
      maxPhoneNumbers: number;
      includesVoiceAi: boolean;
      includesCalendarSync: boolean;
      includesAdvancedAnalytics: boolean;
      includesWhiteLabel: boolean;
      supportLevel: string;
      apiAccess: boolean;
    },
    isPopular: plan.isPopular ?? false,
  }));

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          {currentPlanId
            ? 'Upgrade or downgrade your subscription at any time. Changes take effect at the start of your next billing cycle.'
            : 'Select a plan to get started. You&apos;ll be redirected to our secure payment page.'}
        </p>
        {error && (
          <p className="mt-2 text-sm text-sienna" role="alert">{error}</p>
        )}
      </div>

      <PlanSelector
        plans={planData}
        currentPlanId={currentPlanId}
        onSelectPlan={async (planId, billingCycle) => {
          setError(null);

          if (!currentPlanId) {
            // New subscription — redirect to Stripe Checkout
            try {
              const res = await fetch('/api/client/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, billingCycle }),
              });

              const data: { url?: string; error?: string } = await res.json();

              if (!res.ok || !data.url) {
                setError(data.error || 'Failed to start checkout');
                return;
              }

              // Redirect to Stripe Checkout
              window.location.href = data.url;
            } catch {
              setError('Something went wrong. Please try again.');
            }
          } else {
            // Existing subscription — use server action for plan change
            await changePlan(clientId, planId, billingCycle);
            router.push('/client/billing');
          }
        }}
      />
    </div>
  );
}
